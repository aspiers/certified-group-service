import { randomBytes } from 'node:crypto'
import type { Express } from 'express'
import { AtpAgent } from '@atproto/api'
import { ensureValidDid } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { ConflictError } from '../../errors.js'
import {
  generateRecoveryKey,
  getLatestPlcCid,
  signPlcOperation,
  submitPlcOperation,
} from '../../pds/plc.js'
import { finalizeGroup } from './finalize.js'

export default function (app: Express, ctx: AppContext) {
  app.post('/xrpc/app.certified.group.register', async (req, res, next) => {
    try {
      const { handle, ownerDid, email } = req.body

      // Validate inputs
      if (!handle || !ownerDid) {
        throw new InvalidRequestError('Missing required fields: handle, ownerDid')
      }
      try {
        ensureValidDid(ownerDid)
      } catch {
        throw new InvalidRequestError('Invalid ownerDid')
      }

      // Verify the caller controls the claimed ownerDid
      const { iss } = await ctx.authVerifier.verifyRegistration(req)
      if (iss !== ownerDid) {
        throw new AuthRequiredError('Service auth token issuer does not match ownerDid')
      }
      if (!/^[a-zA-Z0-9-]+$/.test(handle)) {
        throw new InvalidRequestError('Invalid handle: must be alphanumeric with hyphens')
      }

      const pdsUrl = ctx.config.groupPdsUrl
      const pdsHostname = new URL(pdsUrl).hostname

      // Build the full handle: {handle}.{pdsHostname}
      const fullHandle = `${handle}.${pdsHostname}`

      // Use caller-provided email or generate a placeholder
      const accountEmail = email || `${handle}@group.${pdsHostname}`

      // Generate a random password for the account
      const accountPassword = randomBytes(24).toString('base64url')

      // Generate a recovery keypair so the group service can update the DID
      // document independently of the PDS (no email confirmation required)
      const recoveryKey = await generateRecoveryKey()
      const recoveryDidKey = recoveryKey.did()

      // Create the group account on the group's PDS
      const agent = new AtpAgent({ service: pdsUrl })
      let createRes
      try {
        createRes = await agent.com.atproto.server.createAccount({
          email: accountEmail,
          handle: fullHandle,
          password: accountPassword,
          recoveryKey: recoveryDidKey,
          ...(ctx.config.groupPdsInviteCode && {
            inviteCode: ctx.config.groupPdsInviteCode,
          }),
        })
      } catch (err) {
        const e = err as { status?: number; error?: string; message?: string }
        if (
          e?.status === 400 &&
          (e?.error === 'HandleNotAvailable' || e?.message?.includes('Handle already taken'))
        ) {
          throw new ConflictError('Handle already taken on the PDS', 'HandleNotAvailable')
        }
        if (e?.status === 400) {
          throw new InvalidRequestError(e?.message ?? 'Invalid request')
        }
        throw err
      }

      const groupDid = createRes.data.did

      // Resume the session so the agent is authenticated for subsequent calls
      await agent.resumeSession({
        did: createRes.data.did,
        handle: createRes.data.handle,
        accessJwt: createRes.data.accessJwt,
        refreshJwt: createRes.data.refreshJwt,
        active: true,
      })

      // Register service endpoint in group's DID document.
      // We sign the PLC operation ourselves using the recovery key,
      // bypassing the PDS's signPlcOperation (which may require email confirmation).
      const [{ data: recommended }, prevCid] = await Promise.all([
        agent.com.atproto.identity.getRecommendedDidCredentials(),
        getLatestPlcCid(ctx.config.plcUrl, groupDid),
      ])

      const operation = await signPlcOperation(
        {
          type: 'plc_operation',
          rotationKeys: (recommended.rotationKeys as string[]) ?? [recoveryDidKey],
          verificationMethods: (recommended.verificationMethods as Record<string, string>) ?? {},
          alsoKnownAs: (recommended.alsoKnownAs as string[]) ?? [],
          services: {
            ...((recommended.services as Record<string, { type: string; endpoint: string }>) ?? {}),
            certified_group: {
              type: 'CertifiedGroupService',
              endpoint: ctx.config.serviceUrl,
            },
          },
          prev: prevCid,
        },
        recoveryKey,
      )

      await submitPlcOperation(ctx.config.plcUrl, groupDid, operation)

      // Create an app password for the group service to use
      const appPasswordRes = await agent.com.atproto.server.createAppPassword({
        name: 'group-service',
      })
      const appPassword = appPasswordRes.data.password

      // Persist credentials, init per-group DB, seed owner, audit-log
      const recoveryKeyBytes = await recoveryKey.export()
      await finalizeGroup(ctx, {
        groupDid,
        pdsUrl,
        appPassword,
        ownerDid,
        recoveryKeyMaterial: Buffer.from(recoveryKeyBytes).toString('base64url'),
        action: 'group.register',
        handle: fullHandle,
      })

      res.json({
        groupDid,
        handle: fullHandle,
      })
    } catch (err) {
      next(err)
    }
  })
}
