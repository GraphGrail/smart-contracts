import BigNumber from 'bignumber.js'
import chai from 'chai'

import {assertRevert, getTransactionReceiptMined} from './helpers'

import {
  State,
  totalsToArrays,
  performanceToMap,
  performanceToArrays,
} from './ggproject-utils'

const {assert} = chai

const GraphGrailToken = artifacts.require('./GraphGrailToken.sol')
const GGProject = artifacts.require('./GGProjectDebug.sol')


function getAddresses(accounts) {
  const [
    graphGrail, client,
    contractor_1, contractor_2,
    contractor_3, approvalCommissionBeneficiary,
    disapprovalCommissionBeneficiary,
  ] = accounts
  return {
    graphGrail, client,
    contractor_1, contractor_2,
    contractor_3, approvalCommissionBeneficiary,
    disapprovalCommissionBeneficiary,
  }
}

async function getBalances(contract, token, addr) {
  const [tokenBalance, requiredInitialTokenBalance, workItemsBalance,
    balanceOf_contract, balanceOf_client,
    balanceOf_approvalCommission, balanceOf_disapprovalCommission,
    balanceOf_contractor_1, balanceOf_contractor_2, balanceOf_contractor_3] =
    await Promise.all([
      contract.getTokenBalance(),
      contract.getRequiredInitialTokenBalance(),
      contract.getWorkItemsBalance(),
      token.balanceOf(contract.address),
      token.balanceOf(addr.client),
      token.balanceOf(addr.approvalCommissionBeneficiary),
      token.balanceOf(addr.disapprovalCommissionBeneficiary),
      token.balanceOf(addr.contractor_1),
      token.balanceOf(addr.contractor_2),
      token.balanceOf(addr.contractor_3),
    ])
  return {
    tokenBalance, requiredInitialTokenBalance, workItemsBalance,
    balanceOf_contract, balanceOf_client,
    balanceOf_approvalCommission, balanceOf_disapprovalCommission,
    balanceOf_contractor_1, balanceOf_contractor_2, balanceOf_contractor_3,
  }
}


const totalWorkItems = 100
const workItemPrice = 10
const approvalCommissionFractionThousands = 100 // 10% (1)
const disapprovalCommissionFractionThousands = 200 // 20% (2)
const autoApprovalTimeoutSec = 86400


contract('GGProject: token transfers', (accounts) => {

  const addr = getAddresses(accounts)
  let contract
  let token

  before(async () => {
    token = await GraphGrailToken.new({from: addr.graphGrail})
    contract = await GGProject.new(
      token.address,
      addr.client,
      addr.approvalCommissionBeneficiary,
      addr.disapprovalCommissionBeneficiary,
      approvalCommissionFractionThousands,
      disapprovalCommissionFractionThousands,
      totalWorkItems,
      workItemPrice,
      autoApprovalTimeoutSec,
      {from: addr.graphGrail}
    )

    // later in tests we assum that initial token balance of client is zero
    const clientTokenBalance = await token.balanceOf(addr.client)
    assert.bignumEqual(clientTokenBalance, 0)
  })

  it(`calculates required initial token balance correctly`, async () => {
    const requiredInitialTokenBalance = await contract.getRequiredInitialTokenBalance()
    assert.bignumEqual(requiredInitialTokenBalance, 1000)
  })

  it(`initial token balance is zero`, async () => {
    const tokenBalance = await contract.getTokenBalance()
    assert.bignumEqual(tokenBalance, 0)
  })

  it(`initial work items balance is zero`, async () => {
    const workItemsBalance = await contract.getWorkItemsBalance()
    assert.bignumEqual(workItemsBalance, 0)
  })

  it(`transferring tokens to contract updates balances`, async () => {
    // transferring exactly requiredInitialTokenBalance
    await token.transfer(contract.address, 1000, {from: addr.graphGrail})

    const [tokenBalance, workItemsBalance] = await Promise.all([
      contract.getTokenBalance(),
      contract.getWorkItemsBalance(),
    ])

    assert.bignumEqual(tokenBalance, 1000, `token balance`)
    assert.bignumEqual(workItemsBalance, 100, `work items balance`)
  })

  it(`required initial token balance stays the same after tokens transfer`, async () => {
    const requiredInitialTokenBalance = await contract.getRequiredInitialTokenBalance()
    assert.bignumEqual(requiredInitialTokenBalance, 1000)
  })

  it(`activating the contract doesn't change token balances`, async () => {
    await contract.activate({from: addr.client})

    const [tokenBalance, requiredInitialTokenBalance, workItemsBalance,
      balanceOf_contract, balanceOf_client] = await Promise.all([
        contract.getTokenBalance(),
        contract.getRequiredInitialTokenBalance(),
        contract.getWorkItemsBalance(),
        token.balanceOf(contract.address),
        token.balanceOf(addr.client),
      ])

    assert.bignumEqual(tokenBalance, 1000, `token balance (contract's view)`)
    assert.bignumEqual(requiredInitialTokenBalance, 1000, `required initial token balance`)
    assert.bignumEqual(workItemsBalance, 100, `work items balance`)

    assert.bignumEqual(balanceOf_contract, 1000, `token balance of contract`)
    assert.bignumEqual(balanceOf_client, 0, `token balance of client`)
  })

  it(`updating totals doesn't change balances`, async () => {
    const {addresses, totals} = totalsToArrays({
      [addr.contractor_1]: 1,
      [addr.contractor_2]: 0,
      [addr.contractor_3]: 1,
    })

    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
    const bal = await getBalances(contract, token, addr)

    assert.bignumEqual(bal.tokenBalance, 1000, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 100, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 1000, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 0, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 0, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 0, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 0, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 0, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 0, `client's balance`)
  })

  it(`approving work by client pays contractor and holds commission`, async () => {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_1]: {approvedItems: 1, declinedItems: 0},
    })

    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
    const bal = await getBalances(contract, token, addr)

    assert.bignumEqual(bal.tokenBalance, 990, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 99, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 990, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 1, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 0, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 9, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 0, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 0, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 0, `client's balance`)
  })

  it(`disapproving work by client holds commission`, async () => {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_3]: {approvedItems: 0, declinedItems: 1},
    })

    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
    const bal = await getBalances(contract, token, addr)

    // disapproval commission: 10 * 0.2 = 2
    // new contract balance: 990 - 2 = 988
    // new work items balance: floor(988 / 10) = floor(98.8) = 98

    assert.bignumEqual(bal.tokenBalance, 988, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 98, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 988, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 1, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 2, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 9, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 0, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 0, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 0, `client's balance`)
  })

  it(`updating work for multiple contractors simultaneously works correctly`, async () => {
    const {addresses, totals} = totalsToArrays({
      [addr.contractor_1]: 2, // was 1, inc. 1
      [addr.contractor_2]: 2, // was 0, inc. 2
      [addr.contractor_3]: 2, // was 1, inc. 1
    })

    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
    const bal = await getBalances(contract, token, addr)

    // balances are the same as in the previous test

    assert.bignumEqual(bal.tokenBalance, 988, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 98, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 988, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 1, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 2, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 9, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 0, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 0, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 0, `client's balance`)
  })

  it(`approving and disapproving work for multiple contractors simultaneously works correctly`,
    async () =>
  {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_1]: {approvedItems: 1, declinedItems: 1}, // was appr: 1, decl: 0 (total 2)
      [addr.contractor_2]: {approvedItems: 2, declinedItems: 0}, // was appr: 0, decl: 0 (total 2)
      [addr.contractor_3]: {approvedItems: 1, declinedItems: 1}, // was appr: 0, decl: 1 (total 2)
    })

    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
    const bal = await getBalances(contract, token, addr)

    // changes:
    //
    // - declined 1 item for contractor 1 (commission 2)
    // - approved 2 items for contractor 2 (paid 18 to contractor and 2 to commission)
    // - approved 1 item for contractor 3 (paid 9 to contractor and 1 to commission)
    //
    // new balances:
    //
    // contract: 988 - 2 - 20 - 10 = 956
    // approval commission beneficiary: 1 + 2 + 1 = 4
    // disapproval commission beneficiary: 2 + 2 = 4
    // contractor 1: 9 (no changes)
    // contractor 2: 0 + 18 = 18
    // contractor 3: 0 + 9 = 9

    assert.bignumEqual(bal.tokenBalance, 956, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 95, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 956, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 4, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 4, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 9, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 18, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 9, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 0, `client's balance`)
  })

  it(`finalizing contract by client sends all unused tokens back to client`, async () => {
    await contract.finalize({from: addr.client})
    const bal = await getBalances(contract, token, addr)

    assert.bignumEqual(bal.tokenBalance, 0, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 0, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 0, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 4, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 4, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 9, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 18, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 9, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 956, `client's balance`)
  })
})


contract('GGProject: force finalization token transfers', (accounts) => {

  const addr = getAddresses(accounts)
  let contract
  let token

  before(async () => {
    token = await GraphGrailToken.new({from: addr.graphGrail})
    contract = await GGProject.new(
      token.address,
      addr.client,
      addr.approvalCommissionBeneficiary,
      addr.disapprovalCommissionBeneficiary,
      approvalCommissionFractionThousands,
      disapprovalCommissionFractionThousands,
      totalWorkItems,
      workItemPrice,
      autoApprovalTimeoutSec,
      {from: addr.graphGrail}
    )

    // later in tests we assum that initial token balance of client is zero
    const clientTokenBalance = await token.balanceOf(addr.client)
    assert.bignumEqual(clientTokenBalance, 0)
  })

  it(`activating the contract`, async () => {
    await token.transfer(contract.address, 1000, {from: addr.graphGrail})
    await contract.activate({from: addr.client})
  })

  it(`updating totals doesn't change balances`, async () => {
    const {addresses, totals} = totalsToArrays({
      [addr.contractor_1]: 1,
      [addr.contractor_3]: 3,
    })

    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
    const bal = await getBalances(contract, token, addr)

    assert.bignumEqual(bal.tokenBalance, 1000, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 100, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 1000, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 0, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 0, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 0, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 0, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 0, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 0, `client's balance`)
  })

  it(`disapproving work by client holds commission`, async () => {
    const {addresses, approved, declined} = performanceToArrays({
      [addr.contractor_1]: {approvedItems: 0, declinedItems: 1}, // was appr: 0, decl: 0, total: 1
    })

    await contract.updatePerformance(addresses, approved, declined, {from: addr.client})
    const bal = await getBalances(contract, token, addr)

    assert.bignumEqual(bal.tokenBalance, 998, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 99, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 998, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 0, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 2, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 0, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 0, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 0, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 0, `client's balance`)
  })

  it(`updating totals (once again) doesn't change balances`, async () => {
    const {addresses, totals} = totalsToArrays({
      [addr.contractor_1]: 2,
    })

    await contract.updateTotals(addresses, totals, {from: addr.graphGrail})
    const bal = await getBalances(contract, token, addr)

    assert.bignumEqual(bal.tokenBalance, 998, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 99, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 998, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 0, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 2, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 0, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 0, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 0, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 0, `client's balance`)
  })

  it(`force-finalizing contract auto-approves all pending work and sends unused tokens ` +
     `back to client`, async () => {

    await contract.increaseTimeBy(autoApprovalTimeoutSec)
    const canForceFinalize = await contract.getCanForceFinalize()

    assert.ok(canForceFinalize, `can force finalize`)

    await contract.forceFinalize({from: addr.graphGrail})
    const bal = await getBalances(contract, token, addr)

    // was:
    //
    // contractor 1: total 2, appr 0, decl 1
    // contractor 2: total 0, appr 0, decl 0
    // contractor 3: total 3, appr 0, decl 0
    //
    // should have became:
    //
    // contractor 1: total 2, appr 1, decl 1 (appr +1, decl +0)
    // contractor 2: total 0, appr 0, decl 0 (appr +0, decl +0)
    // contractor 3: total 3, appr 3, decl 0 (appr +3, decl +0)
    //
    // new balances:
    //
    // contract: 0
    // approval commission beneficiary: 0 + 4 = 4
    // disapproval commission beneficiary: 2
    // contractor 1: 0 + 9 = 9
    // contractor 2: 0
    // contractor 3: 27
    // client: 998 - 40 = 958

    assert.bignumEqual(bal.tokenBalance, 0, `contract: token balance`)
    assert.bignumEqual(bal.requiredInitialTokenBalance, 1000, `contract: required initial balance`)
    assert.bignumEqual(bal.workItemsBalance, 0, `contract: work items balance`)

    assert.bignumEqual(bal.balanceOf_contract, 0, `contract's token balance`)
    assert.bignumEqual(bal.balanceOf_approvalCommission, 4, `approval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_disapprovalCommission, 2, `disapproval comm. benef. balance`)
    assert.bignumEqual(bal.balanceOf_contractor_1, 9, `contractor 1 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_2, 0, `contractor 2 balance`)
    assert.bignumEqual(bal.balanceOf_contractor_3, 27, `contractor 3 balance`)
    assert.bignumEqual(bal.balanceOf_client, 958, `client's balance`)
  })
})
