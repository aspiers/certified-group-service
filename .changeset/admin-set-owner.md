---
'group-service': minor
---

Operators can reassign a group's owner through a new admin API.

**Affects:** Operators

This adds an operator-only admin endpoint. It is deliberately **not** part of the member-facing API — it is authenticated with the service admin password, not a member's JWT or API key — so client app developers building on the group service have nothing to call or adapt; only operators running an instance are affected.

**Operators:** a new optional env var `CGS_ADMIN_PASSWORD` enables operator-only admin endpoints (`app.certified.group.admin.*`), authenticated with HTTP Basic auth rather than group membership — the same mechanism the upstream AT Protocol reference PDS uses for `com.atproto.admin.*`. When unset, all admin endpoints are disabled. The trust model is the one a PDS operator already operates under, applied to the groups CGS hosts; admin actions are audit-logged. The first such endpoint, `app.certified.group.admin.setOwner`, reassigns a group's owner (including installing an owner who is not yet a member, for operator recovery when the incumbent is unavailable). See `docs/deployment.md#admin-endpoints` and the API reference for configuration and the endpoint contract.
