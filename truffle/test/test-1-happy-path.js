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

contract('GGProject: happy path', (accounts) => {

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
  })

  it(`starts with owner set to the creator of the contract`, async () => {
    const owner = await contract.owner()
    assert.equal(owner.toString(), addr.graphGrail)
  })

  it(`starts with client set properly`, async () => {
    const client = await contract.client()
    assert.equal(client.toString(), addr.client)
  })

  it(`starts in New state`, async () => {
    const state = await contract.state()
    assert.equal(state.toNumber(), State.New)
  })

  it(`owner cannot updateTotals before contract activation`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await assertRevert(contract.updateTotals(addresses, totals, {from: addr.graphGrail}))
  })

  it(`populating client's balance from graphGrail's address`, async () => {
    await token.transfer(addr.client, new BigNumber('1e20'), {from: addr.graphGrail})
    const clientBalance = await token.balanceOf(addr.client)
    assert.equal(clientBalance.toString(), (new BigNumber('1e20')).toString())
  })

  it(`client sends some amount of tokens to the contract`, async () => {
    await token.transfer(contract.address, new BigNumber('1e19'), {from: addr.client})
    const contractBalance = await token.balanceOf(contract.address)
    assert.equal(contractBalance.toString(), (new BigNumber('1e19')).toString())
  })

  it(`client can activate the contract`, async () => {
    await contract.activate({from: addr.client})
    const state = await contract.state()
    assert.equal(state.toNumber(), State.Active)
  })

  it(`owner can call updateTotals while the contract is active`, async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})

    const perfMap = performanceToMap(await contract.getPerformance())

    assert.equal(perfMap[addr.contractor_1].totalItems, '1')
    assert.equal(perfMap[addr.contractor_2].totalItems, '2')
    assert.equal(perfMap[addr.contractor_3].totalItems, '3')
  })

  it(`client can call updatePerformance while the contract is active`, async () => {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_1]: {'approvedItems': '1', 'declinedItems': '0'},
      [addr.contractor_2]: {'approvedItems': '2', 'declinedItems': '0'},
      [addr.contractor_3]: {'approvedItems': '3', 'declinedItems': '0'}
    })
    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
  })

  it(`client can finalize the contract`, async () => {
    await contract.finalize({from: addr.client})
    const state = await contract.state()
    assert.equal(state.toNumber(), State.Finalized)
  })
})
