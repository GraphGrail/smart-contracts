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


import {assertRevert} from './helpers'

import {
  State,
  totalsToArrays,
  performanceToMap,
  performanceToArrays,
} from '../../ethereum-bridge/shared/contract-api-helpers'

contract('GGProject: access control', (accounts) => {

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
  })

  it(`only client activates contract`, async () => {
    await assertRevert(contract.activate({from: addr.contractor_1}))
    await assertRevert(contract.activate({from: addr.graphGrail}))

    await contract.activate({from: addr.client})
    const state = await contract.state()
    assert.equal(state.toNumber(), State.Active)
  })

  it(`only owner updates total on contract`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await assertRevert(contract.updateTotals(addresses, totals, {from: addr.contractor_1}))
    await assertRevert(contract.updateTotals(addresses, totals, {from: addr.contractor_2}))
    await assertRevert(contract.updateTotals(addresses, totals, {from: addr.contractor_3}))
    await assertRevert(contract.updateTotals(addresses, totals, {from: addr.client}))

    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    const perfMap = performanceToMap(await contract.getPerformance())

    assert.equal(perfMap[addr.contractor_1].totalItems, '1')
    assert.equal(perfMap[addr.contractor_2].totalItems, '2')
    assert.equal(perfMap[addr.contractor_3].totalItems, '3')
  })

  it(`only client updates performance on contract`, async () => {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_1]: {'approvedItems': '1', 'declinedItems': '0'},
      [addr.contractor_2]: {'approvedItems': '2', 'declinedItems': '0'},
      [addr.contractor_3]: {'approvedItems': '3', 'declinedItems': '0'}
    })
    await assertRevert(contract.updatePerformance(addresses, approved, declined, {from: addr.graphGrail}))
    await assertRevert(contract.updatePerformance(addresses, approved, declined, {from: addr.contractor_1}))
    await assertRevert(contract.updatePerformance(addresses, approved, declined, {from: addr.contractor_2}))
    await assertRevert(contract.updatePerformance(addresses, approved, declined, {from: addr.contractor_3}))
    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
  })

  it(`only client can finalize contract`, async () => {
    await assertRevert(contract.finalize({from: addr.graphGrail}))
    await assertRevert(contract.finalize({from: addr.contractor_1}))
    await assertRevert(contract.finalize({from: addr.contractor_2}))
    await assertRevert(contract.finalize({from: addr.contractor_3}))

    await contract.finalize({from: addr.client})
    const state = await contract.state()
    assert.equal(state.toNumber(), State.Finalized)
  })

})
