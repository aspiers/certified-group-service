/**
 * Steps for register.feature (@manual). group.register is service-level (aud =
 * service DID), signed by the owner who will be seeded. Creates a brand-new PDS
 * account, so this feature is excluded from CI — see register.feature.
 */
import { When, Then } from '@cucumber/cucumber'
import { strict as assert } from 'node:assert'
import type { CgsWorld } from '../support/world.js'
import { mintServiceAuth, callXrpc } from '../support/cgs.js'

const REGISTER_NSID = 'app.certified.group.register'

When('the owner registers a new group with the configured handle', async function (this: CgsWorld) {
  if (!this.env.registerHandle) return 'pending'
  const token = await mintServiceAuth({
    identifier: this.env.ownerIdentifier,
    password: this.env.ownerPassword,
    aud: this.serviceDid,
    lxm: REGISTER_NSID,
  })
  await callXrpc(this, {
    cgsUrl: this.env.cgsUrl,
    nsid: REGISTER_NSID,
    token,
    body: { handle: this.env.registerHandle, ownerDid: this.ownerDid },
  })
})

Then('the register response returns the group DID and handle', function (this: CgsWorld) {
  const body = this.lastHttpJson as { groupDid?: string; handle?: string } | undefined
  assert.ok(body?.groupDid, `expected a groupDid, got ${this.lastHttpBody}`)
  assert.ok(body?.handle, `expected a handle, got ${this.lastHttpBody}`)
})

Then('the register response returns an account password', function (this: CgsWorld) {
  const accountPassword = (this.lastHttpJson as { accountPassword?: string } | undefined)
    ?.accountPassword
  assert.ok(accountPassword, `expected an accountPassword, got ${this.lastHttpBody}`)
})
