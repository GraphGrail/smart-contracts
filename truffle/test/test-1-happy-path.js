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

import {States} from './ggproject-utils'

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

  it(`client balance should be populated from graphGrail's address`, async () => {
    await token.transfer(addr.client, new BigNumber('1e20'),{from: addr.graphGrail})
    const clientBalance = await token.balanceOf(addr.client)
    assert.equal(clientBalance.toString(), (new BigNumber('1e20')).toString())
  })

  it(`starts with owner set to the creator of the contract`, async () => {
    const owner = await contract.owner()
    assert.equal(owner.toString(), addr.graphGrail)
  })

  it(`starts with client set properly`, async () => {
    const client = await contract.client()
    assert.equal(client.toString(), addr.client)
  })

  it(`should be started in New state`, async () => {
    const state = await contract.state()
    assert.equal(state.toNumber(), States.New)
  })
})
