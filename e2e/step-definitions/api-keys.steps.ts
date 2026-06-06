/**
 * Steps for api-keys.feature — the platform backend-sync flow (#26):
 * owner mints a scoped key (JWT-authed keys.create), a backend uses it via the
 * X-API-Key header (no JWT), and the owner revokes it. Group targeting is the
 * same request-level `repo` the JWT new path uses.
 */
import { When, Then, Given } from '@cucumber/cucumber'
import { strict as assert } from 'node:assert'
import type { CgsWorld } from '../support/world.js'
import { mintServiceAuth, callXrpc, callXrpcWithApiKey } from '../support/cgs.js'
import { scopeNeededFor } from '../../src/auth/scopes.js'

const KEYS_CREATE = 'app.certified.group.keys.create'
const KEYS_LIST = 'app.certified.group.keys.list'
const KEYS_DELETE = 'app.certified.group.keys.delete'
const MEMBER_LIST = 'app.certified.group.member.list'
const AUDIT_QUERY = 'app.certified.group.audit.query'

function ownerCreds(world: CgsWorld) {
  return { identifier: world.env.ownerIdentifier, password: world.env.ownerPassword }
}

function memberListScope(world: CgsWorld): string {
  const scope = scopeNeededFor('member.list', world.serviceDid)
  assert.ok(scope, 'member.list must be a key-accessible operation')
  return scope
}

async function createKey(world: CgsWorld): Promise<void> {
  const token = await mintServiceAuth({
    ...ownerCreds(world),
    aud: world.serviceDid,
    lxm: KEYS_CREATE,
  })
  await callXrpc(world, {
    cgsUrl: world.env.cgsUrl,
    nsid: KEYS_CREATE,
    token,
    body: { repo: world.groupDid, name: 'platform backend e2e sync', scopes: [memberListScope(world)] },
  })
  if (world.lastHttpStatus === 200 && world.lastHttpJson) {
    world.apiKey = world.lastHttpJson.key as string
    world.apiKeyRef = world.lastHttpJson.keyRef as string
  }
}

When('the owner creates an API key scoped to member.list', async function (this: CgsWorld) {
  await createKey(this)
})

Given('the owner has created an API key scoped to member.list', async function (this: CgsWorld) {
  await createKey(this)
  assert.equal(this.lastHttpStatus, 200, 'key creation should succeed in setup')
  assert.ok(this.apiKey, 'an API key should have been returned')
})

Then('the response contains an API key and keyRef', function (this: CgsWorld) {
  assert.ok(this.apiKey, 'expected an API key in the response')
  assert.match(this.apiKey!, /^cgsk_/, 'API key should have the cgsk_ prefix')
  assert.ok(this.apiKeyRef, 'expected a keyRef in the response')
})

When('a backend lists the group members using the API key', async function (this: CgsWorld) {
  assert.ok(this.apiKey, 'no API key available for the backend call')
  await callXrpcWithApiKey(this, {
    cgsUrl: this.env.cgsUrl,
    nsid: MEMBER_LIST,
    apiKey: this.apiKey!,
    method: 'GET',
    repo: this.groupDid,
  })
})

When('a backend queries the audit log using the API key', async function (this: CgsWorld) {
  assert.ok(this.apiKey, 'no API key available for the backend call')
  await callXrpcWithApiKey(this, {
    cgsUrl: this.env.cgsUrl,
    nsid: AUDIT_QUERY,
    apiKey: this.apiKey!,
    method: 'GET',
    repo: this.groupDid,
  })
})

When('the owner revokes the API key', async function (this: CgsWorld) {
  assert.ok(this.apiKeyRef, 'no keyRef available to revoke')
  const token = await mintServiceAuth({
    ...ownerCreds(this),
    aud: this.serviceDid,
    lxm: KEYS_DELETE,
  })
  await callXrpc(this, {
    cgsUrl: this.env.cgsUrl,
    nsid: KEYS_DELETE,
    token,
    body: { repo: this.groupDid, keyRef: this.apiKeyRef },
  })
})

When('the owner lists the group API keys', async function (this: CgsWorld) {
  const token = await mintServiceAuth({
    ...ownerCreds(this),
    aud: this.serviceDid,
    lxm: KEYS_LIST,
  })
  await callXrpc(this, {
    cgsUrl: this.env.cgsUrl,
    nsid: KEYS_LIST,
    token,
    method: 'GET',
    repo: this.groupDid,
  })
})

Then('the API key list does not contain any secret material', function (this: CgsWorld) {
  const body = this.lastHttpBody ?? ''
  assert.ok(!body.includes('cgsk_'), 'keys.list must not leak a plaintext key')
  const json = this.lastHttpJson as { keys?: Array<Record<string, unknown>> } | undefined
  for (const key of json?.keys ?? []) {
    assert.ok(!('key' in key), 'key entry must not include the plaintext')
    assert.ok(!('key_hash' in key) && !('keyHash' in key), 'key entry must not include the hash')
  }
})
