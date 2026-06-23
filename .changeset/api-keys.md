---
'group-service': minor
---

Backend services can now use revocable API keys for group-owned records.

**Affects:** Client app developers, Operators

**Client app developers:** group owners can create, list, and revoke keys with `app.certified.group.keys.create`, `app.certified.group.keys.list`, and `app.certified.group.keys.delete`. Key auth uses `X-API-Key` and supports explicit scopes plus reusable permission-set scopes such as `include:org.hypercerts.authWrite`, so apps no longer need to list every record permission by hand. See `docs/design/api-keys.md`, `docs/design/api-key-permission-sets.md`, and `docs/integration-guide.md` for request shapes, supported permissions, and examples.

**Operators:** no new environment variables or manual migration are required. Leaked keys are recognizable by the `cgsk_` prefix and can be revoked by the group owner.
