import { describe, it, expect } from 'vitest'
import {
  SERVICE_ID_FRAGMENT,
  serviceScopeAud,
  lxmForOperation,
  scopeNeededFor,
  scopesCoverOperation,
  firstInvalidScope,
  canonicalizeScope,
  canonicalizeScopes,
} from '../src/auth/scopes.js'

const SERVICE_DID = 'did:web:groups.example.com'
// The package URL-encodes `#` as `%23` in the emitted scope string; use its own
// output as the canonical form rather than hand-writing the encoding.
const MEMBER_LIST_SCOPE = scopeNeededFor('member.list', SERVICE_DID)!

describe('serviceScopeAud', () => {
  it('appends the service-id fragment to the bare DID', () => {
    expect(serviceScopeAud(SERVICE_DID)).toBe(`${SERVICE_DID}#${SERVICE_ID_FRAGMENT}`)
    expect(SERVICE_ID_FRAGMENT).toBe('certified_group_service')
  })
})

describe('lxmForOperation', () => {
  it('maps key-accessible operations to their NSID', () => {
    expect(lxmForOperation('member.list')).toBe('app.certified.group.member.list')
    expect(lxmForOperation('audit.query')).toBe('app.certified.group.audit.query')
  })

  it('returns undefined for operations not reachable by a key', () => {
    expect(lxmForOperation('role.set')).toBeUndefined()
    expect(lxmForOperation('createRecord')).toBeUndefined()
    expect(lxmForOperation('group.destroy')).toBeUndefined()
  })
})

describe('scopeNeededFor', () => {
  it('computes the rpc: scope for a key-accessible op with url-encoded service aud', () => {
    const needed = scopeNeededFor('member.list', SERVICE_DID)
    expect(needed).toBe(
      'rpc:app.certified.group.member.list?aud=did:web:groups.example.com%23certified_group_service',
    )
  })

  it('returns undefined for a non-key-accessible op', () => {
    expect(scopeNeededFor('role.set', SERVICE_DID)).toBeUndefined()
  })
})

describe('scopesCoverOperation', () => {
  it('grants when the exact scope is present', () => {
    expect(scopesCoverOperation([MEMBER_LIST_SCOPE], 'member.list', SERVICE_DID)).toBe(true)
  })

  it('denies when the scope is absent', () => {
    expect(scopesCoverOperation([], 'member.list', SERVICE_DID)).toBe(false)
  })

  it('denies coverage for a different operation', () => {
    expect(scopesCoverOperation([MEMBER_LIST_SCOPE], 'audit.query', SERVICE_DID)).toBe(false)
  })

  it('denies for an op with no lxm mapping even with a wildcard scope', () => {
    const wild = `rpc:*?aud=${serviceScopeAud(SERVICE_DID)}`
    expect(scopesCoverOperation([wild], 'role.set', SERVICE_DID)).toBe(false)
  })

  it('a wildcard rpc scope covers a mapped op', () => {
    const wild = `rpc:*?aud=${serviceScopeAud(SERVICE_DID)}`
    expect(scopesCoverOperation([wild], 'member.list', SERVICE_DID)).toBe(true)
  })

  it('denies when the scope aud is for a different service', () => {
    const otherAud = scopeNeededFor('member.list', 'did:web:evil.example.com')!
    expect(scopesCoverOperation([otherAud], 'member.list', SERVICE_DID)).toBe(false)
  })
})

describe('firstInvalidScope', () => {
  it('returns null when all scopes are valid rpc scopes', () => {
    expect(firstInvalidScope([MEMBER_LIST_SCOPE])).toBeNull()
  })

  it('returns the first invalid scope string', () => {
    expect(firstInvalidScope([MEMBER_LIST_SCOPE, 'not-a-scope'])).toBe('not-a-scope')
  })
})

describe('canonicalizeScope', () => {
  it('expands a friendly rpc:<lxm> to the aud-bound canonical form', () => {
    const r = canonicalizeScope('rpc:app.certified.group.member.list', SERVICE_DID)
    expect(r).toEqual({ ok: true, scope: MEMBER_LIST_SCOPE })
  })

  it('accepts an already-canonical scope whose aud is this service', () => {
    const r = canonicalizeScope(MEMBER_LIST_SCOPE, SERVICE_DID)
    expect(r).toEqual({ ok: true, scope: MEMBER_LIST_SCOPE })
  })

  it('rejects a scope whose aud names a DIFFERENT service DID', () => {
    const foreign = scopeNeededFor('member.list', 'did:web:other.example.com')!
    const r = canonicalizeScope(foreign, SERVICE_DID)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/aud must be this service/)
  })

  it('rejects a scope with the right DID but a DIFFERENT service fragment', () => {
    const wrongFragment = `rpc:app.certified.group.member.list?aud=${SERVICE_DID}%23some_other_service`
    const r = canonicalizeScope(wrongFragment, SERVICE_DID)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/aud must be this service/)
  })

  it('rejects a non-rpc / malformed scope', () => {
    expect(canonicalizeScope('not-a-scope', SERVICE_DID).ok).toBe(false)
    expect(canonicalizeScope('repo:app.bsky.feed.post', SERVICE_DID).ok).toBe(false)
  })
})

describe('canonicalizeScopes', () => {
  it('canonicalizes a whole list', () => {
    const r = canonicalizeScopes(['rpc:app.certified.group.member.list'], SERVICE_DID)
    expect(r).toEqual({ ok: true, scopes: [MEMBER_LIST_SCOPE] })
  })

  it('fails on the first bad scope, naming it', () => {
    const foreign = scopeNeededFor('member.list', 'did:web:other.example.com')!
    const r = canonicalizeScopes(['rpc:app.certified.group.member.list', foreign], SERVICE_DID)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.scope).toBe(foreign)
  })
})
