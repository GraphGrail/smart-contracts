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

  function getPerfomanceStats(perfMap) {
    var totals = 0
    var approved = 0
    var declined = 0
    Object.keys(perfMap).map(addr => { 
      totals += Number(perfMap[addr].totalItems)
      approved += Number(perfMap[addr].approvedItems)
      declined += Number(perfMap[addr].declinedItems)
    })
    return {totals, approved, declined}
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

  it(`updates totals correctly`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    const perfMap = performanceToMap(await contract.getPerformance())

    assert.equal(perfMap[addr.contractor_1].totalItems, '1')
    assert.equal(perfMap[addr.contractor_2].totalItems, '2')
    assert.equal(perfMap[addr.contractor_3].totalItems, '3')
  })

  it(`can't update totals with decremented values`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotalsDecremented())
    await assertRevert(contract.updateTotals(addresses, totals, {from: addr.graphGrail}))

    const perfMap = performanceToMap(await contract.getPerformance())

    assert.equal(perfMap[addr.contractor_1].totalItems, '1')
    assert.equal(perfMap[addr.contractor_2].totalItems, '2')
    assert.equal(perfMap[addr.contractor_3].totalItems, '3')
  })

  it(`updates performance correctly`, async () => {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_1]: {'approvedItems': '1', 'declinedItems': '0'},
      [addr.contractor_2]: {'approvedItems': '2', 'declinedItems': '0'},
      [addr.contractor_3]: {'approvedItems': '3', 'declinedItems': '0'}
    })
    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})

    const perfMap = performanceToMap(await contract.getPerformance())

    assert.equal(perfMap[addr.contractor_1].totalItems, '1')
    assert.equal(perfMap[addr.contractor_2].totalItems, '2')
    assert.equal(perfMap[addr.contractor_3].totalItems, '3')
  })

  it(`can't update performance with decremented values`, async () => {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_1]: {'approvedItems': '0', 'declinedItems': '0'},
      [addr.contractor_2]: {'approvedItems': '0', 'declinedItems': '0'},
      [addr.contractor_3]: {'approvedItems': '0', 'declinedItems': '0'}
    })

    await assertRevert(contract.updatePerformance(addresses, approved, declined, 
      {from: addr.client}))
  })

  it(`updates totals and performance twice correctly`, async () => {
    {
      const {addresses, totals} = totalsToArrays(getMockTotals())
      await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
      await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
    }

    {
      const {addresses, approved, declined} = performanceToArrays({
        [addr.contractor_1]: {'approvedItems': '1', 'declinedItems': '0'},
        [addr.contractor_2]: {'approvedItems': '2', 'declinedItems': '0'},
        [addr.contractor_3]: {'approvedItems': '3', 'declinedItems': '0'}
      })
      await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
      await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
      
      const perfMap = performanceToMap(await contract.getPerformance())

      assert.equal(perfMap[addr.contractor_1].totalItems, '1')
      assert.equal(perfMap[addr.contractor_2].totalItems, '2')
      assert.equal(perfMap[addr.contractor_3].totalItems, '3')
    }
  })

  it(`check updates of approved and declined much totals`, async () => {
    const perfMap = performanceToMap(await contract.getPerformance())
    assert.equal(perfMap[addr.contractor_1].approvedItems, '1')
    assert.equal(perfMap[addr.contractor_1].declinedItems, '0')

    await assertRevert(contract.updatePerformance([addr.contractor_1], [0], [1], 
      {from: addr.client}))
    await assertRevert(contract.updatePerformance([addr.contractor_1], [2], [0], 
      {from: addr.client}))

    assert.equal(perfMap[addr.contractor_2].approvedItems, '2')
    assert.equal(perfMap[addr.contractor_2].declinedItems, '0')

    await assertRevert(contract.updatePerformance([addr.contractor_2], [1], [1], 
      {from: addr.client}))
    await assertRevert(contract.updatePerformance([addr.contractor_2], [2], [1], 
      {from: addr.client}))
  })

  it(`check items left is totals plus declined`, async () => {
    {
      const itemsLeft = await contract.getWorkItemsLeft()
      const perfMap = performanceToMap(await contract.getPerformance())
      const {totals, approved, declined} = getPerfomanceStats(perfMap)
      assert.equal(itemsLeft.toNumber(), totalWorkItems.toNumber() - totals + declined)
    }
    {
      var {addresses, totals} = totalsToArrays(getMockTotals())
      totals[0] = 4
      totals[1] = 5
      totals[2] = 6
      await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
    }
    {
      const {addresses, approved, declined} = performanceToArrays({
        [addr.contractor_3]: {'approvedItems': '3', 'declinedItems': '3'}
      })
      await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
    }
    {
      const itemsLeft = await contract.getWorkItemsLeft()
      const perfMap = performanceToMap(await contract.getPerformance())
      const {totals, approved, declined} = getPerfomanceStats(perfMap)
      assert.equal(itemsLeft.toNumber(), totalWorkItems.toNumber() - totals + declined)
    }
    {
      var {addresses, totals} = totalsToArrays(getMockTotals())
      totals[0] = 4
      totals[1] = 5
      totals[2] = 11
      await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
    }
    {
      const itemsLeft = await contract.getWorkItemsLeft()
      const perfMap = performanceToMap(await contract.getPerformance())
      const {totals, approved, declined} = getPerfomanceStats(perfMap)
      assert.equal(itemsLeft.toNumber(), totalWorkItems.toNumber() - totals + declined)
    }
  })


})
