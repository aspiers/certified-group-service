---
'group-service': minor
---

Operators can reassign a group's owner through a new admin API.

**Affects:** Client app developers, Operators

**Client app developers:** a new procedure `app.certified.group.admin.setOwner` reassigns the owner of a group. It is **not** part of the member-facing API — it is authenticated with HTTP Basic auth (username `admin`) against the service admin password, the same model as `com.atproto.admin.*` on a PDS, and is unavailable to JWT/API-key callers. Input is `{ repo: <group handle or DID>, newOwner: <handle or DID> }`; output is `{ groupDid, owner, previousOwner?, addedAsMember, noop, updatedAt }`. The previous owner is demoted to `admin`; the new owner is promoted in place if already a member, or added as a new owner member if not (`addedAsMember: true`) — this supports operator recovery when the incumbent owner is unavailable. An unknown group returns `UnknownGroup` (404); calling `setOwner` with the current owner is a no-op (`noop: true`). The owner role remains immutable via `role.set` — this admin endpoint is the only way to change it.

**Operators:**

- New optional env var `ADMIN_PASSWORD`. When set, it enables the `app.certified.group.admin.*` endpoints, authenticated via HTTP Basic auth as user `admin` with this password. When unset, **all admin endpoints are disabled** and every request to them returns `401` — there is no insecure default.
- Use it to fix or transfer ownership without touching the database directly: `POST /xrpc/app.certified.group.admin.setOwner` with `Authorization: Basic <base64(admin:$ADMIN_PASSWORD)>` and a JSON body `{ "repo": "<group>", "newOwner": "<did-or-handle>" }`.
- Because the change is applied in-process (through the same connection the read paths use), it takes effect immediately — unlike an out-of-band SQLite edit, no service restart is required.
- The change is recorded in the group's audit log as an `admin.setOwner` action by actor `admin`.
