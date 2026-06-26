// Config for the cucumber-js e2e runner. The suite runs against an
// already-running CGS (local `pnpm dev` or a Railway preview); it does not
// start services. Invoke via `pnpm test:e2e` (optionally with --tags @health
// for a credential-free liveness check).
//
// Tag exclusions are env-driven so the suite degrades cleanly:
//   - @manual / @pending are never run by default.
//   - @needs-rbac-accounts (the multi-role authorization feature) runs only
//     when the full admin/member/outsider account set is configured.
//
// The importer and owner accounts are required config — a real run always has
// them — so import/records/reporting are not tag-gated. Only the @health
// feature works with just E2E_CGS_URL.
import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load e2e/.env here too: this config is evaluated before any step/support file
// (and thus before env.ts runs dotenv), so without this the RBAC vars from a
// local .env wouldn't be visible yet and @needs-rbac-accounts would be wrongly
// excluded. CI passes the vars via the environment, where this is a no-op.
config({ path: resolve('e2e/.env') })

const rbacAccountsConfigured = Boolean(
  process.env.E2E_GROUP_ADMIN_IDENTIFIER &&
  process.env.E2E_GROUP_ADMIN_PASSWORD &&
  process.env.E2E_GROUP_MEMBER_IDENTIFIER &&
  process.env.E2E_GROUP_MEMBER_PASSWORD &&
  process.env.E2E_GROUP_OUTSIDER_IDENTIFIER &&
  process.env.E2E_GROUP_OUTSIDER_PASSWORD,
)

// The CGS *service* admin password (CGS_ADMIN_PASSWORD) gates the @needs-cgs-admin
// admin-endpoint feature. This is a service-wide credential, distinct from the
// per-test-group role accounts (E2E_GROUP_*) above.
const cgsAdminConfigured = Boolean(process.env.CGS_ADMIN_PASSWORD)

// Each gated exclusion records WHY it is excluded, so a run never silently
// drops a feature: cucumber's tag filter removes excluded scenarios from the
// run set entirely (they show as neither passed nor "skipped" in the report),
// which is easy to mistake for "everything ran". We print the exclusions up
// front so it is always visible what this run is NOT covering and why.
const gatedExclusions = [
  {
    tag: '@needs-rbac-accounts',
    excluded: !rbacAccountsConfigured,
    reason: 'E2E_GROUP_{ADMIN,MEMBER,OUTSIDER}_{IDENTIFIER,PASSWORD} not all set',
  },
  {
    tag: '@needs-cgs-admin',
    excluded: !cgsAdminConfigured,
    reason: 'CGS_ADMIN_PASSWORD not set',
  },
]

const tagExclusions = [
  'not @manual',
  'not @pending',
  ...gatedExclusions.filter((g) => g.excluded).map((g) => `not ${g.tag}`),
]

// Always-on exclusions (@manual/@pending) plus the gated ones, announced so the
// console output makes coverage gaps obvious rather than hidden.
const skipped = gatedExclusions.filter((g) => g.excluded)
if (skipped.length > 0) {
  const lines = skipped.map((g) => `  - ${g.tag}: EXCLUDED (${g.reason})`).join('\n')
  console.warn(`[e2e] Tag-gated features NOT run in this invocation:\n${lines}`)
} else {
  console.warn('[e2e] All tag-gated features are enabled for this invocation.')
}

const shared = {
  paths: ['features/**/*.feature'],
  import: ['e2e/step-definitions/**/*.ts', 'e2e/support/**/*.ts'],
  strict: true,
}

export default {
  ...shared,
  format: ['pretty', 'html:reports/e2e.html', 'junit:reports/e2e.junit.xml'],
  tags: tagExclusions.join(' and '),
}
