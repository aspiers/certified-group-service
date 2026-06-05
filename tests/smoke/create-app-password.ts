/**
 * Helper for the import smoke test: mint an app password for the account being
 * imported, so you can paste it into IMPORT_APP_PASSWORD in tests/smoke/.env.
 *
 * Creating an app password requires a FULL session (com.atproto.server
 * .createAppPassword needs the ACCESS_FULL scope), i.e. the account's real
 * password — an app password cannot mint another app password. This script
 * therefore uses the OWNER_* full credentials and only works in the common case
 * where the account being imported IS the owner account
 * (IMPORT_DID === OWNER_IDENTIFIER). If they differ, there is no full credential
 * for the import account in the env file, so the script refuses rather than
 * minting a password against the wrong account.
 *
 * Config comes from the same dedicated env file as the import smoke test
 * (tests/smoke/.env — separate from the repo-root .env, gitignored). It reads
 * only var names declared in .env.example; it never depends on inspecting the
 * filled-in secrets.
 *
 * Run from the worktree (has node_modules):
 *   cd .../.claude/worktrees/adam+hyper-469-group-import
 *   npx tsx tests/smoke/create-app-password.ts
 *
 * Then copy the printed password into IMPORT_APP_PASSWORD in tests/smoke/.env.
 *
 * Override the env file path with SMOKE_ENV_FILE=/path/to/file if needed.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import dotenv from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
const envFile = process.env.SMOKE_ENV_FILE || join(here, '.env')
const loaded = dotenv.config({ path: envFile })
if (loaded.error) {
  console.error(`Could not read smoke-test env file: ${envFile}`)
  console.error(`Copy ${join(here, '.env.example')} to ${envFile} and fill it in.`)
  process.exit(2)
}
console.log(`Loaded smoke-test config from ${envFile}`)

import { AtpAgent } from '@atproto/api'

// Fixed label so the password is identifiable in the account's settings. The
// PDS rejects a duplicate name, so if you re-run after a failure either revoke
// the old one or pass APP_PASSWORD_NAME to override.
const APP_PASSWORD_NAME = process.env.APP_PASSWORD_NAME || 'cgs-import-smoke'

function reqEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var: ${name}`)
    process.exit(2)
  }
  return v
}

async function main() {
  const ownerPds = reqEnv('OWNER_PDS')
  const ownerIdentifier = reqEnv('OWNER_IDENTIFIER')
  const ownerPassword = reqEnv('OWNER_PASSWORD')
  const importDid = reqEnv('IMPORT_DID')

  console.log('Owner PDS:  ', ownerPds)
  console.log('Owner:      ', ownerIdentifier)
  console.log('Import DID: ', importDid)
  console.log('---')

  console.log('Logging into owner PDS with full credentials...')
  const agent = new AtpAgent({ service: ownerPds })
  await agent.login({ identifier: ownerIdentifier, password: ownerPassword })
  const sessionDid = agent.session?.did
  if (!sessionDid) throw new Error('Login did not yield a DID')
  console.log('Logged in as:', sessionDid)

  // The full credentials authenticate the owner account. We can only mint an
  // app password for THAT account, so it must be the one being imported.
  if (sessionDid !== importDid) {
    console.error(
      `\n❌ IMPORT_DID (${importDid}) is not the owner account (${sessionDid}).\n` +
        `   This script can only mint an app password for the account whose full\n` +
        `   credentials are in the env file (the owner). To import a different\n` +
        `   account, create its app password from its own PDS/owner directly.`,
    )
    process.exit(1)
  }

  console.log(`Creating app password "${APP_PASSWORD_NAME}"...`)
  const { data } = await agent.com.atproto.server.createAppPassword({
    name: APP_PASSWORD_NAME,
  })

  console.log('\n✅ App password created. Copy this into IMPORT_APP_PASSWORD:\n')
  console.log('   ' + data.password)
  console.log('\n(Shown once; the PDS will not display it again.)')
}

main().catch((err) => {
  console.error('\n❌ failed to create app password:', err)
  process.exit(1)
})
