---
'group-service': minor
---

Apps can now name the group they're acting on directly in the request, instead of hiding it inside the login token.

**Affects:** Client app developers, Operators

**Client app developers:** group-scoped methods now accept an explicit `repo` field naming the target group (a handle or DID), with the JWT `aud` set to the group service's own DID — its correct meaning. This replaces the previous overload where the group was smuggled through `aud`. The fix matches what a stock `@atproto/api` client already emits, so calls work without hand-crafting tokens.

- **Where `repo` goes:** query methods (`app.certified.group.member.list`, `app.certified.group.audit.query`) and the raw-body / body-less methods (`app.certified.group.repo.uploadBlob`, `app.certified.group.destroy`) read `repo` from the **querystring**; the JSON-body procedures (`createRecord`, `putRecord`, `deleteRecord`, `app.certified.group.member.add`, `app.certified.group.member.remove`, `app.certified.group.role.set`) read it from the **request body**. `repo` accepts a handle or a DID, resolved to the group DID server-side.
- **Mint tokens with `aud` = the service DID:** `getServiceAuth({ aud: <serviceDid>, lxm })` instead of `aud: <groupDid>`. Setting `aud` to the service DID is what takes a call off the deprecated path. For query methods (where `repo` is on the querystring) adding `?repo=` also requires `aud` to be the service DID. For JSON-body procedures, a token with `aud=<groupDid>` is still treated as legacy even with `repo` in the body — the service decides this at the auth layer, which does not see the body — so fully migrating a procedure means setting `aud` to the service DID, not just adding body `repo`.
- **Legacy still works, but is deprecated:** the old form (`aud` = the group DID, no `repo`) keeps working during a transition window. Such responses now carry RFC 8594 headers — `Deprecation: true` and a `Link: <…/issues/27>; rel="deprecation"` — so you can detect un-migrated calls programmatically. No `Sunset` date is set yet; the legacy path will be removed in a later release once clients have migrated.
- **Behaviour change on the `repo` field:** procedures no longer require `repo` to equal the token's group and no longer return a `403` "repo field must match the group DID". `repo` is now the group selector itself; a `repo` that names no registered group is rejected at resolution (`401`, "Unknown group"). Membership/role checks are unchanged — a caller can only target groups they already have a role in.
- **Security note:** the group target is no longer bound by the token signature (it never was in standard AT Protocol either); a token is now scoped to a method and the service rather than to one group. Authorization is still enforced per-group by RBAC, and tokens remain short-lived and single-use. See `docs/design/aud-deprecation.md`.

**Operators:** no new environment variables and no migration. The service DID is unchanged (`SERVICE_DID`, defaulting to `did:web:<SERVICE_URL host>`). Watch for a rate-limited `warn` log — "Deprecated auth: group taken from JWT aud …" — which flags any client still using the legacy targeting form, one line per caller per 15 minutes.
