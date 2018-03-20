import BigNumber from 'bignumber.js'
const assert = require('chai').assert
const GraphGrailToken = artifacts.require('./GraphGrailToken.sol')
const GGProject = artifacts.require('./GGProject.sol')

import {
  approvalCommissionFractionThousands,
  disapprovalCommissionFractionThousands,
  totalWorkItems,
  workItemPrice,
  autoApprovalTimeoutSec,
} from './ggproject-mock-data'


import {
  assertRevert,
  getTransactionReceiptMined,
} from './helpers'

import {
  State,
  totalsToArrays,
  performanceToMap,
  performanceToArrays,
} from './ggproject-utils'

contract('GGProject', (accounts) => {

  function getAddresses() {
    const [
      graphGrail, client,
      contractor_1, contractor_2,
      contractor_3, approvalCommissionAddr,
      disapprovalCommissionAddr,
    ] = accounts
    return {
      graphGrail, client,
      contractor_1, contractor_2,
      contractor_3, approvalCommissionAddr,
      disapprovalCommissionAddr,
    }
  }

  function getMockTotals() {
    return {
      [addr.contractor_1]: '1',
      [addr.contractor_2]: '2',
      [addr.contractor_3]: '3',
    }
  }

  function getMockTotalsDecremented() {
    return {
      [addr.contractor_1]: '1',
      [addr.contractor_2]: '1',
      [addr.contractor_3]: '2',
    }
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
    const state = await contract.state()
    assert.equal(state.toNumber(), State.Active)
  })

  it(`initial contract state is zeroes`, async () => {
    const itemsLeft = await contract.getWorkItemsLeft()
    assert.equal(itemsLeft.toNumber(), totalWorkItems.toNumber())

    const perfMap = performanceToMap(await contract.getPerformance())
    assert.equal(Object.keys(perfMap).length, 0)
  })

  it(`update totals is updating correctly`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    const perfMap = performanceToMap(await contract.getPerformance())

    assert.equal(perfMap[addr.contractor_1].totalItems, '1')
    assert.equal(perfMap[addr.contractor_2].totalItems, '2')
    assert.equal(perfMap[addr.contractor_3].totalItems, '3')
  })

  it(`update totals can't decrement totals`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotalsDecremented())
    await assertRevert(contract.updateTotals(addresses, totals, {from: addr.graphGrail}))

    const perfMap = performanceToMap(await contract.getPerformance())

    assert.equal(perfMap[addr.contractor_1].totalItems, '1')
    assert.equal(perfMap[addr.contractor_2].totalItems, '2')
    assert.equal(perfMap[addr.contractor_3].totalItems, '3')
  })

})
