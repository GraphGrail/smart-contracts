import BigNumber from 'bignumber.js'
const assert = require('chai').assert
const GraphGrailToken = artifacts.require('./GraphGrailToken.sol')
const GGProject = artifacts.require('./GGProjectDebug.sol')

import {
  approvalCommissionFractionThousands,
  disapprovalCommissionFractionThousands,
  totalWorkItems,
  workItemPrice,
  autoApprovalTimeoutSec,
} from './ggproject-mock-data'

import {assertRevert} from './helpers'
import {totalsToArrays, performanceToArrays} from './ggproject-utils'

contract('GGProject', (accounts) => {

  function getAddresses() {
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

  function getMockTotals() {
    return {
      [addr.contractor_1]: '1',
      [addr.contractor_2]: '2',
      [addr.contractor_3]: '3',
    }
  }

  async function assertNobodyCanFinalizeContract() {
    await assertRevert(contract.forceFinalize({from: addr.graphGrail}))
    await assertRevert(contract.forceFinalize({from: addr.client}))
    await assertRevert(contract.forceFinalize({from: addr.contractor_1}))
    await assertRevert(contract.forceFinalize({from: addr.contractor_2}))
    await assertRevert(contract.forceFinalize({from: addr.contractor_3}))
    await assertRevert(contract.forceFinalize({from: addr.approvalCommissionAddr}))
    await assertRevert(contract.forceFinalize({from: addr.disapprovalCommissionAddr}))
    await assertRevert(contract.forceFinalize({from: addr.anonymous}))
  }

  const addr = getAddresses()

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

  it(`updateTotals call leads to set up the deadline`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
  })

  it(`nobody can force finalize before the deadline`, async () => {
    const rewindTime = (Number(autoApprovalTimeoutSec) / 2).toString()
    await contract.increaseTimeBy(rewindTime, {from: addr.anonymous})

    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, false)

    await assertNobodyCanFinalizeContract()
  })

  it(`canForceFinalize returns true after the deadline`, async () => {
    const rewindTime = (Number(autoApprovalTimeoutSec) / 2).toString()
    await contract.increaseTimeBy(rewindTime, {from: addr.anonymous})
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

  it(`updatePerformance call causes moving the deadline forward`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    await contract.increaseTimeBy(autoApprovalTimeoutSec, {from: addr.anonymous})

    const perfMap = performanceToArrays({
      [addr.contractor_1]: {'approvedItems': '1', 'declinedItems': '0'},
    })

    await contract.updatePerformance(perfMap.addresses, perfMap.approved, perfMap.declined, {from: addr.client})

    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, false)

    await assertNobodyCanFinalizeContract()
  })

  it(`everyone can force finalize the contract after the deadline`, async () => {
    await contract.increaseTimeBy(autoApprovalTimeoutSec, {from: addr.anonymous})
    await contract.forceFinalize({from: addr.anonymous})
  })

  it(`canForceFinalize returns false after force finalization`, async () => {
    await contract.increaseTimeBy('200', {from: addr.anonymous})
    const canForceFinalize = await contract.getCanForceFinalize()
    assert.equal(canForceFinalize, false)
  })
})
