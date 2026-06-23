---
'group-service': minor
---

API keys are now available for backend services. Group owners can create long-lived keys, limit what each key can do, and revoke them without rotating the owner's signing key or relying on short-lived service-auth tokens.

Keys also support reusable permission sets, so owners can choose a published bundle instead of listing every record permission by hand. Permission sets are copied into the key when it is created; recreate the key to pick up later changes to a set.

**Affects:** Client app developers, Operators

Operators do not need new environment variables or a manual migration. Leaked keys are recognizable by the `cgsk_` prefix and can be revoked.

See `docs/design/api-keys.md`, `docs/design/api-key-permission-sets.md`, and `docs/integration-guide.md` for integration details and supported permissions.
