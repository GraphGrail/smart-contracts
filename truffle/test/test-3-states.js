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
  getContractStatus,
} from '../../ethereum-bridge/shared/contract-api-helpers'

contract('GGProject: states checks', (accounts) => {

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

  const addr = getAddresses()

  function getMockTotals() {
    return {
      [addr.contractor_1]: '1',
      [addr.contractor_2]: '2',
      [addr.contractor_3]: '3',
    }
  }

  function getMockPerformance() {
    const totals = getMockTotals()
    return performanceToArrays(Object.keys(totals).reduce((res, totalKey) => {
      res[totalKey] = {
        approvedItems: totals[totalKey],
        declinedItems: '0'
      }
      return res
    }, {}))
  }

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
    await token.transfer(addr.client, new BigNumber('1e20'), {from: addr.graphGrail})
  })

  it('starts in New state', async () => {
    const {state} = await getContractStatus(contract)
    assert.equal(state, State.New)
  })

  it('fails to updateTotals in New state', async () => {
    await assertRevert(contract.updateTotals([addr.contractor_1], [0], {from: addr.graphGrail}))
  })

  it('fails to updatePerformance in New state', async () => {
    const {addresses, approved, declined} = getMockPerformance()
    await assertRevert(contract.updatePerformance(addresses, approved, declined, {from: addr.client}))
  })

  it('fails to finalize in New state', async () => {
    await assertRevert(contract.finalize({from: addr.client}))
  })

  it('fails to forceFinalize in Active state', async () => {
    await assertRevert(contract.forceFinalize(2000000, {from: addr.client}))
  })

  it('activates contract', async () => {
    await token.transfer(contract.address, new BigNumber('1e19'), {from: addr.client})
    await contract.activate({from: addr.client})
    const {state} = await getContractStatus(contract)
    assert.equal(state, State.Active)
  })

  it('fails to activate contract in Active state', async () => {
    await assertRevert(contract.activate({from: addr.client}))
  })

  it('runs updateTotals in Active state', async () => {
    const {addresses, totals} = totalsToArrays(getMockTotals())
    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
  })

  it('runs updatePerformance in Active state', async () => {
    const {addresses, approved, declined} = getMockPerformance()
    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
  })

  it('runs finalize from active state', async () => {
    await contract.finalize({from: addr.client})
    const state = await contract.state()
    assert.equal(state.toNumber(), State.Finalized)
  })

  it('fails to updateTotals in Finalized state', async () => {
    await assertRevert(contract.updateTotals([addr.contractor_1], [0], {from: addr.graphGrail}))
  })

  it('fails to updatePerformance in Finalized state', async () => {
    const {addresses, approved, declined} = getMockPerformance()
    await assertRevert(contract.updatePerformance(addresses, approved, declined, {from: addr.client}))
  })

  it('fails to activate contract in Finalized state', async () => {
    await assertRevert(contract.activate({from: addr.client}))
  })

  it('fails to finalize in Finalized state', async () => {
    await assertRevert(contract.finalize({from: addr.client}))
  })

  it('fails to forceFinalize in Finalized state', async () => {
    await assertRevert(contract.forceFinalize(2000000, {from: addr.client}))
  })

  // Note: tests for ForceFinalizing state are in test-6-force-finalize.js

})
