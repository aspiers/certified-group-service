/**
 * Steps for admin-set-owner.feature — the operator-only
 * app.certified.group.admin.setOwner endpoint. Unlike every other feature, these
 * calls authenticate with HTTP Basic auth against the service admin password
 * (CgsWorld.env.cgsAdminPassword, from CGS_ADMIN_PASSWORD), not a member's
 * service-auth JWT. The happy path reassigns ownership to the admin account and
 * reverts it, leaving the group as it started.
 */
import { When, Then } from '@cucumber/cucumber'
import { strict as assert } from 'node:assert'
import type { CgsWorld } from '../support/world.js'
import { callXrpcWithBasicAuth } from '../support/cgs.js'

const ADMIN_SET_OWNER = 'app.certified.group.admin.setOwner'

function setOwner(
  world: CgsWorld,
  opts: { newOwner: string; repo?: string; password?: string; noAuth?: boolean },
): Promise<void> {
  return callXrpcWithBasicAuth(world, {
    cgsUrl: world.env.cgsUrl,
    nsid: ADMIN_SET_OWNER,
    password: opts.password ?? world.env.cgsAdminPassword,
    noAuth: opts.noAuth,
    body: { repo: opts.repo ?? world.groupDid!, newOwner: opts.newOwner },
  })
}

When('the admin setOwner endpoint is called with no credentials', async function (this: CgsWorld) {
  await setOwner(this, { newOwner: this.adminDid!, noAuth: true })
})

When(
  'the admin setOwner endpoint is called with the wrong admin password',
  async function (this: CgsWorld) {
    await setOwner(this, { newOwner: this.adminDid!, password: 'definitely-the-wrong-password' })
  },
)

When('the operator sets the owner to the admin account', async function (this: CgsWorld) {
  await setOwner(this, { newOwner: this.adminDid! })
})

When('the operator sets the owner to the original owner account', async function (this: CgsWorld) {
  await setOwner(this, { newOwner: this.ownerDid! })
})

When('the operator sets the owner of an unknown group', async function (this: CgsWorld) {
  // A syntactically valid DID that is not a managed group.
  await setOwner(this, { repo: 'did:plc:unknowngroupxxxxxxxxxxxx', newOwner: this.adminDid! })
})

Then('the setOwner response owner is the admin', function (this: CgsWorld) {
  assert.equal(this.lastHttpJson?.owner, this.adminDid)
})

Then('the setOwner response owner is the original owner', function (this: CgsWorld) {
  assert.equal(this.lastHttpJson?.owner, this.ownerDid)
})

Then('the setOwner response previousOwner is the original owner', function (this: CgsWorld) {
  assert.equal(this.lastHttpJson?.previousOwner, this.ownerDid)
})
