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
    // await assertRevert(contract.activate({from: addr.client}))
    // const state = await contract.state()
    // assert.equal(state.toNumber(), State.New)
  })


})
