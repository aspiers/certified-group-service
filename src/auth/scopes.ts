import { ScopesSet, RpcPermission } from '@atproto/oauth-scopes'
import type { Operation } from '../rbac/permissions.js'

/**
 * Service-id fragment for CGS's own DID, used as the `aud` of `rpc:` scopes.
 *
 * `@atproto/oauth-scopes` validates an `rpc:` scope's `aud` with
 * `isAtprotoDidRefAbsolute`, which **requires a `did:web:host#fragment` service
 * ref** — it rejects a bare `did:web:host` (and all `did:plc:*`). CGS's
 * `config.serviceDid` is a bare `did:web`, so we append this fragment when
 * minting and checking scopes. The same constant is used on both sides, so the
 * check is internally consistent regardless of the bare-DID config value.
 *
 * Independent of the JWT-auth `aud`, which stays bare-DID tolerant (the
 * reference PDS strips the service fragment from proxied JWTs until Spring
 * 2026). See docs/design/api-keys.md and issue #29 / HYPER-484.
 */
export const SERVICE_ID_FRAGMENT = 'certified_group_service'

/** Build the scope `aud` ref for this service's (bare) DID. */
export function serviceScopeAud(serviceDid: string): string {
  return `${serviceDid}#${SERVICE_ID_FRAGMENT}`
}

/**
 * Map an internal RBAC `Operation` to the XRPC method NSID (lxm) a key scope is
 * declared against. Only operations reachable by an API key need an entry; an
 * operation with no mapping is **not** key-accessible (the gate denies it for
 * key callers). Iteration 1 grants only `member.list`.
 */
const OPERATION_LXM: Partial<Record<Operation, string>> = {
  'member.list': 'app.certified.group.member.list',
  'audit.query': 'app.certified.group.audit.query',
}

/** The lxm an operation maps to, or undefined if it is not key-accessible. */
export function lxmForOperation(operation: Operation): string | undefined {
  return OPERATION_LXM[operation]
}

/**
 * The `rpc:` scope string an operation requires, or undefined if the operation
 * is not key-accessible. Computed via the package helper, not hand-rolled.
 */
export function scopeNeededFor(operation: Operation, serviceDid: string): string | undefined {
  const lxm = lxmForOperation(operation)
  if (lxm === undefined) return undefined
  return RpcPermission.scopeNeededFor({ lxm, aud: serviceScopeAud(serviceDid) })
}

/**
 * Does a granted scope set cover an operation for this service? Returns false
 * for operations that are not key-accessible (no lxm mapping) — a key can never
 * reach them regardless of its scopes.
 */
export function scopesCoverOperation(
  grantedScopes: string[],
  operation: Operation,
  serviceDid: string,
): boolean {
  const lxm = lxmForOperation(operation)
  if (lxm === undefined) return false
  const granted = ScopesSet.fromString(grantedScopes.join(' '))
  return granted.matches('rpc', { lxm, aud: serviceScopeAud(serviceDid) })
}

/**
 * Validate that every scope string in a list parses as a known scope. Used at
 * key-creation time to reject garbage scopes before they are stored. Returns the
 * first invalid scope, or null if all are valid.
 */
export function firstInvalidScope(scopes: string[]): string | null {
  for (const scope of scopes) {
    // A scope is valid if any resource permission parser accepts it. We only
    // emit/consume `rpc:` scopes in iteration 1, so check that form.
    if (RpcPermission.fromString(scope) === null) return scope
  }
  return null
}

/** Outcome of canonicalizing one client-supplied scope string. */
export type ScopeCanonicalization =
  | { ok: true; scope: string }
  | { ok: false; scope: string; reason: string }

/**
 * Canonicalize a client-supplied `rpc:` scope to this service's stored form.
 *
 * A key only ever calls the CGS it was created on, so the scope `aud` can only
 * be this service's ref — there is no other valid value. Clients therefore pass
 * the friendly `rpc:<lxm>` form and we append the `aud` here, matching what the
 * gate checks. An already-canonical scope is accepted idempotently **iff** its
 * `aud` is ours; a scope naming a different `aud` is rejected (it could never
 * match the gate, so storing it would be a silent dead grant).
 */
export function canonicalizeScope(scope: string, serviceDid: string): ScopeCanonicalization {
  const aud = serviceScopeAud(serviceDid)

  // Already carries params (an `aud=`): accept only if that aud is ours.
  if (scope.includes('?')) {
    const parsed = RpcPermission.fromString(scope)
    if (parsed === null) return { ok: false, scope, reason: 'unparseable scope' }
    if (parsed.aud !== aud) {
      return { ok: false, scope, reason: `scope aud must be this service (${aud})` }
    }
    return { ok: true, scope }
  }

  // Bare `rpc:<lxm>` — derive the lxm and rebuild via the package helper so the
  // stored string is exactly what the gate computes.
  const match = /^rpc:(?<lxm>[^?]+)$/.exec(scope)
  if (!match?.groups?.lxm) return { ok: false, scope, reason: 'not an rpc: scope' }
  const canonical = RpcPermission.scopeNeededFor({ lxm: match.groups.lxm, aud })
  if (RpcPermission.fromString(canonical) === null) {
    return { ok: false, scope, reason: 'invalid rpc method (lxm)' }
  }
  return { ok: true, scope: canonical }
}

/**
 * Canonicalize a list of client scopes. Returns the canonical list on success,
 * or the first scope that failed (with a reason) so the caller can surface an
 * `InvalidScope` error naming it.
 */
export function canonicalizeScopes(
  scopes: string[],
  serviceDid: string,
): { ok: true; scopes: string[] } | { ok: false; scope: string; reason: string } {
  const out: string[] = []
  for (const scope of scopes) {
    const result = canonicalizeScope(scope, serviceDid)
    if (!result.ok) return { ok: false, scope: result.scope, reason: result.reason }
    out.push(result.scope)
  }
  return { ok: true, scopes: out }
}
