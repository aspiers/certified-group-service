---
'group-service': minor
---

Operators can reassign a group's owner through a new admin API.

**Affects:** Operators

This adds an operator-only admin endpoint. It is deliberately **not** part of the member-facing API — it is authenticated with the service admin password, not a member's JWT or API key — so client app developers building on the group service have nothing to call or adapt; only operators running an instance are affected.

**Operators:**

- New optional env var `ADMIN_PASSWORD` (min 16 non-whitespace chars). When set, it enables the operator-only `app.certified.group.admin.*` endpoints, authenticated via HTTP Basic auth as user `admin` with this password. When unset, **all admin endpoints are disabled** and every request to them returns `401` — there is no insecure default.
- **Trust model:** this admin-password mechanism mirrors the upstream AT Protocol reference PDS's `com.atproto.admin.*` endpoints. The trust model is the same one a PDS operator already operates under — they can control much of the data and accounts they host and are expected to use that power only as agreed by and for the benefit of their users — applied to the groups CGS hosts. Admin actions are audit-logged (actor `admin`) for transparency. See `docs/deployment.md#admin-endpoints`.
- The first such endpoint is `app.certified.group.admin.setOwner`, which reassigns a group's owner: `POST /xrpc/app.certified.group.admin.setOwner` with `Authorization: Basic <base64(admin:$ADMIN_PASSWORD)>` and a JSON body `{ "repo": "<group>", "newOwner": "<did-or-handle>" }`. The previous owner is demoted to admin; the new owner is promoted in place if already a member, or **added as a new owner member if not** — supporting recovery when the incumbent owner is unavailable. Response includes `addedAsMember` and `noop` flags; an unknown group returns `UnknownGroup` (404). The change takes effect immediately, with no service restart.
- The change is recorded in the group's audit log as an `admin.setOwner` action by actor `admin`.
