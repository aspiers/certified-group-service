import { readFileSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Agent } from '@atproto/api'
import type { LexiconDoc } from '@atproto/lexicon'
import { getOauthClient } from './client.js'

/** Recursively load all .json lexicon files from a directory. */
function loadLexicons(dir: string): LexiconDoc[] {
  const docs: LexiconDoc[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      docs.push(...loadLexicons(fullPath))
    } else if (extname(entry.name) === '.json') {
      docs.push(JSON.parse(readFileSync(fullPath, 'utf8')))
    }
  }
  return docs
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// The custom CGS lexicons (app.certified.group.repo.*) registered on the proxy
// agent so the @atproto/api client recognises them. They live in the repo-root
// lexicons/; in the deployed image that resolves to /app/lexicons/app/certified.
// Override with LEXICONS_DIR if your layout differs. Fail soft: a missing dir
// logs a clear warning and leaves customLexicons empty (the server still boots
// and /api/health responds) rather than crashing the whole BFF at module load.
const lexiconsDir =
  process.env.LEXICONS_DIR || join(__dirname, '..', '..', '..', 'lexicons', 'app', 'certified')

let customLexicons: LexiconDoc[] = []
try {
  customLexicons = loadLexicons(lexiconsDir)
} catch (err) {
  console.error(
    `[proxy-agent] could not load custom lexicons from ${lexiconsDir} — ` +
      `record/proxy operations needing them will fail. Set LEXICONS_DIR to the ` +
      `directory containing app/certified/*.json. Cause: ${(err as Error).message}`,
  )
}

export function isSessionExpiredError(err: any): boolean {
  // Only treat OAuth-layer failures as session-expired.
  // Upstream XRPC 401s (e.g. "not a member") are authorization errors, not session errors.
  if (err.message?.includes('log in again')) return true
  // OAuthSessionError or token-refresh failures set status 401 but lack XRPC `error` field
  if (err.status === 401 && !err.error) return true
  return false
}

/**
 * Creates an AtpAgent for the user's PDS (via OAuth session),
 * proxied through the certified_group service to the given group DID.
 */
export async function createProxyAgent(userDid: string, groupDid: string): Promise<Agent> {
  const oauthSession = await getOauthClient().restore(userDid)
  const agent = new Agent(oauthSession)
  const proxied = agent.withProxy('certified_group', groupDid) as Agent
  for (const doc of customLexicons) {
    proxied.lex.add(doc)
  }
  return proxied
}
