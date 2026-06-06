/**
 * Steps for aud-targeting.feature — exercise both group-targeting forms (#27):
 *  - NEW: aud = the SERVICE DID, group named by an explicit `repo` (querystring
 *    for member.list, request body for createRecord).
 *  - LEGACY: aud = the GROUP DID overload, no `repo`.
 *
 * Each mints a fresh owner-signed JWT for its method. The only differences are
 * the `aud` value and where (if anywhere) `repo` is sent.
 */
import { When, Then } from '@cucumber/cucumber'
import { strict as assert } from 'node:assert'
import type { CgsWorld } from '../support/world.js'
import { mintServiceAuth, callXrpc } from '../support/cgs.js'

const MEMBER_LIST = 'app.certified.group.member.list'
const CREATE_RECORD = 'app.certified.group.repo.createRecord'
const FEED_POST = 'app.bsky.feed.post'

function ownerCreds(world: CgsWorld) {
  return { identifier: world.env.ownerIdentifier, password: world.env.ownerPassword }
}

function feedPostBody(world: CgsWorld, includeRepo: boolean) {
  return {
    ...(includeRepo ? { repo: world.groupDid } : {}),
    collection: FEED_POST,
    record: {
      $type: FEED_POST,
      text: 'CGS e2e post — #27 aud-targeting scenario.',
      createdAt: new Date().toISOString(),
    },
  }
}

// --- member.list (query): repo on the querystring ---

When(
  'the owner lists the group members with aud=service and an explicit repo',
  async function (this: CgsWorld) {
    const token = await mintServiceAuth({
      ...ownerCreds(this),
      aud: this.serviceDid, // correct: the service DID
      lxm: MEMBER_LIST,
    })
    await callXrpc(this, {
      cgsUrl: this.env.cgsUrl,
      nsid: MEMBER_LIST,
      token,
      method: 'GET',
      repo: this.groupDid, // group named explicitly
    })
  },
)

When(
  'the owner lists the group members with the legacy aud overload',
  async function (this: CgsWorld) {
    const token = await mintServiceAuth({
      ...ownerCreds(this),
      aud: this.groupDid!, // legacy: aud overloaded as the group DID
      lxm: MEMBER_LIST,
    })
    await callXrpc(this, {
      cgsUrl: this.env.cgsUrl,
      nsid: MEMBER_LIST,
      token,
      method: 'GET',
      // no repo — the group comes from aud
    })
  },
)

// --- createRecord (procedure): repo in the body ---

When(
  'the owner creates a feed post with aud=service and repo in the body',
  async function (this: CgsWorld) {
    const token = await mintServiceAuth({
      ...ownerCreds(this),
      aud: this.serviceDid,
      lxm: CREATE_RECORD,
    })
    await callXrpc(this, {
      cgsUrl: this.env.cgsUrl,
      nsid: CREATE_RECORD,
      token,
      body: feedPostBody(this, true), // repo in the body
    })
  },
)

When('the owner creates a feed post with the legacy aud overload', async function (this: CgsWorld) {
  const token = await mintServiceAuth({
    ...ownerCreds(this),
    aud: this.groupDid!,
    lxm: CREATE_RECORD,
  })
  await callXrpc(this, {
    cgsUrl: this.env.cgsUrl,
    nsid: CREATE_RECORD,
    token,
    body: feedPostBody(this, false), // no repo — group from aud
  })
})

// --- deprecation header assertions ---

Then('the response has a deprecation header', function (this: CgsWorld) {
  const dep = this.lastHttpHeaders?.get('deprecation')
  assert.equal(dep, 'true', `expected Deprecation: true on the legacy path, got "${dep}"`)
})

Then('the response has no deprecation header', function (this: CgsWorld) {
  const dep = this.lastHttpHeaders?.get('deprecation')
  assert.equal(dep, null, `expected no Deprecation header on the new path, got "${dep}"`)
})
