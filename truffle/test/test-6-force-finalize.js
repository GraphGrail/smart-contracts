import BigNumber from 'bignumber.js'

const assert = require('chai').assert

import {
  approvalCommissionFractionThousands,
  disapprovalCommissionFractionThousands,
  totalWorkItems,
  workItemPrice,
  autoApprovalTimeoutSec,
} from './ggproject-mock-data'

import {assertRevert, generateRandomAddress} from './helpers'

import {
  State,
  totalsToArrays,
  performanceToArrays,
  getContractStatus,
  describeToMap,
} from '../../ethereum-bridge/shared/contract-api-helpers'

const GraphGrailToken = artifacts.require('./GraphGrailToken.sol')
const GGProject = artifacts.require('./GGProjectDebug.sol')

const halfAutoApprovalTimeoutSec = (Number(autoApprovalTimeoutSec) / 2).toString()

const MAX_FORCE_FINALIZE_GAS = 2000000

function getAddresses(accounts) {
  const [
    graphGrail, client,
    contractor_1, contractor_2,
    contractor_3, approvalCommissionAddr,
    disapprovalCommissionAddr, anonymous
  ] = accounts
  return {
    graphGrail, client,
    contractor_1, contractor_2,
    contractor_3, approvalCommissionAddr,
    disapprovalCommissionAddr, anonymous
  }
}

contract('GGProject: force finalization', (accounts) => {
  function getMockTotals(addition = 0) {
    return {
      [addr.contractor_1]: String(1 + addition),
      [addr.contractor_2]: String(2 + addition),
      [addr.contractor_3]: String(3 + addition),
    }
  }

  async function assertNobodyCanFinalizeContract() {
    await assertRevert(contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.graphGrail}))
    await assertRevert(contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.client}))
    await assertRevert(contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.contractor_1}))
    await assertRevert(contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.contractor_2}))
    await assertRevert(contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.contractor_3}))
    await assertRevert(contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.approvalCommissionAddr}))
    await assertRevert(contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.disapprovalCommissionAddr}))
    await assertRevert(contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.anonymous}))
  }

  function addStringsAsNumbers(a, b) {
    return Number(a) + Number(b)
  }

  async function assertCanForceFinalizeIn(duration, contract) {
    const canForceFinalizeAt = await contract.getCanForceFinalizeAt()
    const timestamp = await contract.debugTimestamp()
    assert.equal(
      canForceFinalizeAt.toString(),
      addStringsAsNumbers(timestamp, duration).toString()
    )
  }

  const addr = getAddresses(accounts)

  let contract
  let token

  before(async () => {
    token = await GraphGrailToken.new({from: addr.graphGrail})
    contract = await GGProject.new(
      token.address,
      addr.client,
      addr.approvalCommissionAddr,
      addr.disapprovalCommissionAddr,
      approvalCommissionFractionThousands,
      disapprovalCommissionFractionThousands,
      totalWorkItems,
      workItemPrice,
      autoApprovalTimeoutSec,
      {from: addr.graphGrail}
    )
    await token.transfer(contract.address, new BigNumber('1e20'),{from: addr.graphGrail})
    await contract.activate({from: addr.client})
  })

  it(`if nothing happens after activation nobody can force finalize the contract`, async () => {
    await contract.increaseTimeBy(autoApprovalTimeoutSec, {from: addr.anonymous})

    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, false)

    await assertNobodyCanFinalizeContract()
  })

  it(`getCanForceFinalizeAt should be zero`, async () => {
    const canForceFinalizeAt = await contract.getCanForceFinalizeAt()
    assert.equal(canForceFinalizeAt.toString(), '0')
  })

  it(`updateTotals call leads to set up the deadline`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    await assertCanForceFinalizeIn(autoApprovalTimeoutSec, contract)
  })

  it(`nobody can force finalize before the deadline`, async () => {
    await contract.increaseTimeBy(halfAutoApprovalTimeoutSec, {from: addr.anonymous})

    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, false)

    await assertNobodyCanFinalizeContract()
  })

  it(`canForceFinalize returns true after the deadline`, async () => {
    await contract.increaseTimeBy(halfAutoApprovalTimeoutSec, {from: addr.anonymous})
    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, true)
  })

  it(`scroing of all the work clears the dealine`, async () => {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_1]: {'approvedItems': '1', 'declinedItems': '0'},
      [addr.contractor_2]: {'approvedItems': '2', 'declinedItems': '0'},
      [addr.contractor_3]: {'approvedItems': '3', 'declinedItems': '0'}
    })
    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})

    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, false)
  })

  it(`updatePerformance and updateTotals calls causes moving the deadline forward`, async () => {
    let canForceFinalizeAt, timestamp

    const {addresses, totals} = totalsToArrays(getMockTotals(2))
    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    await assertCanForceFinalizeIn(autoApprovalTimeoutSec, contract)
    await contract.increaseTimeBy(halfAutoApprovalTimeoutSec, {from: addr.anonymous})
    await assertCanForceFinalizeIn(halfAutoApprovalTimeoutSec, contract)

    const perfMap = performanceToArrays({
      [addr.contractor_1]: {'approvedItems': '3', 'declinedItems': '0'},
    })

    await contract.updatePerformance(perfMap.addresses, perfMap.approved, perfMap.declined, {from: addr.client})
    await assertCanForceFinalizeIn(autoApprovalTimeoutSec, contract)

    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, false)

    await assertNobodyCanFinalizeContract()
  })

  it(`everyone can force finalize the contract after the deadline`, async () => {
    await contract.increaseTimeBy(autoApprovalTimeoutSec, {from: addr.anonymous})
    const canForceFinalize = await contract.getCanForceFinalize()
    const hasPendingItems = await contract.hasPendingItems()
    const getCanForceFinalizeAt = await contract.getCanForceFinalizeAt()
    await contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.anonymous})
  })

  it(`canForceFinalize returns false after force finalization`, async () => {
    await contract.increaseTimeBy('200', {from: addr.anonymous})
    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, false)
  })
})

contract('GGProject: chunked force finalization', (accounts) => {

  const addr = getAddresses(accounts)

  let contract
  let token
  let contractorAddress

  before(async () => {
    token = await GraphGrailToken.new({from: addr.graphGrail})
    contract = await GGProject.new(
      token.address,
      addr.client,
      addr.approvalCommissionAddr,
      addr.disapprovalCommissionAddr,
      approvalCommissionFractionThousands,
      disapprovalCommissionFractionThousands,
      250, // totalWorkItems
      1, // workItemPrice
      autoApprovalTimeoutSec,
      {from: addr.graphGrail}
    )
    await token.transfer(contract.address, new BigNumber('250'), {from: addr.graphGrail})
    await contract.activate({from: addr.client})
  })

  it(`adding a lot of map items`, async () => {
    let addresses = []
    let totals = []

    for (let i = 0; i < 100; ++i) {
      addresses.push(generateRandomAddress())
      totals.push(1)
    }

    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    addresses = []
    totals = []

    for (let i = 0; i < 100; ++i) {
      addresses.push(generateRandomAddress())
      totals.push(1)
    }

    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    addresses = []
    totals = []

    for (let i = 0; i < 50; ++i) {
      addresses.push(generateRandomAddress())
      totals.push(1)
    }

    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    // Client accepts the last item
    const lastAddress = addresses[addresses.length - 1]
    await contract.updatePerformance([lastAddress], [1], [0], {from: addr.client})

    contractorAddress = lastAddress

    const workItemsBalance = +await contract.getWorkItemsBalance()
    assert.equal(workItemsBalance, 250 - 1)
  })

  it(`canForceFinalize returns true after the deadline`, async () => {
    await contract.increaseTimeBy(autoApprovalTimeoutSec, {from: addr.anonymous})
    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, true)
  })

  it(`forceFinalize transfers contract to ForceFinalizing state and accepts the first ` +
    `items chunk`, async () => {

    await contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.anonymous})

    const [state, numPendingItems, workItemsBalance] = await Promise.all([
      contract.state(),
      contract.getNumPendingItems(),
      contract.getWorkItemsBalance(),
    ])

    assert.equal(+state, State.ForceFinalizing, `state`)
  })

  it(`prohibits to run activate(), finalize(), updateTotals() and updatePerformance() ` +
    `from ForceFinalizing state`, async () => {
    await assertRevert(contract.activate({from: addr.client}))
    await assertRevert(contract.updateTotals([contractorAddress], [2], {from: addr.graphGrail}))
    await assertRevert(contract.updatePerformance([contractorAddress], [1], [0], {from: addr.client}))
    await assertRevert(contract.finalize({from: addr.client}))
  })

  it(`calling forceFinalize multiple times accepts all pending items and transfers contract ` +
    `to Finalized state`, async () => {

    let state = +await contract.state()
    let i = 0

    while (state != State.Finalized) {
      if (++i >= 10) {
        assert.ok(false, `failed to finalize in 5 calls to forceFinalize()`)
      }
      await contract.forceFinalize(MAX_FORCE_FINALIZE_GAS, {from: addr.anonymous})
      state = +await contract.state()
    }

    const [numPendingItems, workItemsBalance] = await Promise.all([
      contract.getNumPendingItems(),
      contract.getWorkItemsBalance(),
    ])

    assert.equal(+numPendingItems, 0, `numPendingItems`)
    assert.equal(+workItemsBalance, 0, `workItemsBalance`)
  })
})
