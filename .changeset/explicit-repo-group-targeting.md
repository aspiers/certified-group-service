---
'group-service': minor
---

Apps now name the target group with an explicit `repo` field instead of overloading the service-auth token's audience.

**Affects:** Client app developers, Operators

**Client app developers:** group-scoped methods take a `repo` field (a handle or DID) naming the target group, with the JWT `aud` set to the service DID — the shape a stock `@atproto/api` client already emits. The old form (group in `aud`, no `repo`) still works but is deprecated.

- **Where `repo` goes:** body for the JSON procedures (`createRecord`, `putRecord`, `deleteRecord`, `member.add`, `member.remove`, `role.set`); querystring for queries (`member.list`, `audit.query`) and raw/body-less methods (`repo.uploadBlob`, `group.destroy`).
- **Migrating off the legacy path:** mint `aud` = the service DID and send `repo`. For queries, adding `repo` to the querystring alone silences the deprecation signal (the verifier sees it); for JSON-body procedures the verifier decides legacy-vs-new from `aud` before the body is parsed, so a body-only `repo` does **not** clear it — `aud` must be the service DID. Legacy responses carry RFC 8594 `Deprecation: true` + a `Link` header so you can spot un-migrated calls; no `Sunset` date is set yet.
- **Behaviour change:** `repo` is now the group selector, not a cross-check — the old `403` "repo field must match the group DID" is gone; a `repo` naming no registered group returns `401 Unknown group`. RBAC is unchanged: you can only target groups you have a role in.
- Full migration steps, both-forms precedence, and the security rationale: `docs/integration-guide.md` ("Migrating from the legacy `aud` form") and `docs/design/aud-deprecation.md`.

**Operators:** no new environment variables and no migration; `SERVICE_DID` is unchanged. A rate-limited `warn` log flags any client still on the legacy form — one line per caller per 15 minutes.
