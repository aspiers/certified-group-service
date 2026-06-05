/**
 * Infrastructure steps shared across features: the health-check gate, account
 * resolution, the /health query, and generic response assertions.
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { strict as assert } from 'node:assert'
import type { CgsWorld } from '../support/world.js'
import { resolveGroupAndOwner } from '../support/fixtures.js'
import { idResolver, resolveToDid } from '../support/cgs.js'

/**
 * Health-check the CGS with a short retry budget. A transient edge/DNS blip on
 * the first scenario should not fail the whole run; a real outage still surfaces
 * once the budget (6 x 2s fetch + 2s backoff ≈ 24s) is spent.
 */
Given('the CGS environment is running', async function (this: CgsWorld) {
  const url = `${this.env.cgsUrl}/health`
  const maxAttempts = 6
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return
      lastErr = new Error(`health check failed: ${res.status} at ${url}`)
    } catch (err) {
      lastErr = err
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  throw new Error(
    `CGS health check failed after ${maxAttempts} attempts at ${url}: ` +
      `${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  )
})

/** Resolve the group/owner (always) and the RBAC role DIDs (when configured). */
Given('the test accounts are resolved', async function (this: CgsWorld) {
  const { groupDid, groupHandle, ownerDid } = await resolveGroupAndOwner()
  this.groupDid = groupDid
  this.groupHandle = groupHandle
  this.ownerDid = ownerDid

  if (this.env.adminIdentifier) {
    this.adminDid = await resolveToDid(idResolver, this.env.adminIdentifier)
  }
  if (this.env.memberIdentifier) {
    this.memberDid = await resolveToDid(idResolver, this.env.memberIdentifier)
  }
  if (this.env.outsiderIdentifier) {
    this.outsiderDid = await resolveToDid(idResolver, this.env.outsiderIdentifier)
  }
})

// Cucumber Expressions treat `/` as an alternation separator; String.raw with
// `\/` passes a literal escaped slash so "/health" isn't read as an alternative.
When(String.raw`the CGS \/health endpoint is queried`, async function (this: CgsWorld) {
  const res = await fetch(`${this.env.cgsUrl}/health`)
  this.lastHttpStatus = res.status
  this.lastHttpJson = (await res.json()) as Record<string, unknown>
})

Then('the response status is {int}', function (this: CgsWorld, expected: number) {
  assert.equal(
    this.lastHttpStatus,
    expected,
    `expected HTTP ${expected}, got ${this.lastHttpStatus}: ${this.lastHttpBody}`,
  )
})

Then('the response status field is {string}', function (this: CgsWorld, expected: string) {
  const status = (this.lastHttpJson as { status?: string } | undefined)?.status
  assert.equal(status, expected, `expected status field "${expected}", got "${status}"`)
})

Then('the response error is {string}', function (this: CgsWorld, expected: string) {
  const error = (this.lastHttpJson as { error?: string } | undefined)?.error
  assert.equal(
    error,
    expected,
    `expected error "${expected}", got "${error}" (${this.lastHttpBody})`,
  )
})

Then('the response contains a record URI', function (this: CgsWorld) {
  const uri = (this.lastHttpJson as { uri?: string } | undefined)?.uri
  assert.ok(uri && uri.startsWith('at://'), `expected an at:// record URI, got "${uri}"`)
})
