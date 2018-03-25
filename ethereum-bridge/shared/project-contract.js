import BaseContract from './base-contract'
import {UserError} from './errors'
import * as ErrorCodes from './error-codes'

import {
  State as State,
  stateToString,
  getContractStatus,
  totalsToArrays,
  performanceToArrays,
} from './contract-api-helpers'

import builtProjectContract from '../../truffle/build/contracts/GGProject.json'


export default class ProjectContract extends BaseContract {
  static builtContract = builtProjectContract

  static State = State

  static async deploy(
    tokenContractAddress,
    clientAddress,
    approvalCommissionBenificiaryAddress,
    disapprovalCommissionBeneficiaryAddress,
    approvalCommissionFractionThousands,
    disapprovalCommissionFractionThousands,
    totalWorkItems,
    workItemPrice,
    autoApprovalTimeoutSec,
  ) {
    return await BaseContract.deploy.call(this,
      tokenContractAddress,
      clientAddress,
      approvalCommissionBenificiaryAddress,
      disapprovalCommissionBeneficiaryAddress,
      approvalCommissionFractionThousands,
      disapprovalCommissionFractionThousands,
      totalWorkItems,
      workItemPrice,
      autoApprovalTimeoutSec,
    )
  }

  constructor(connection, truffleContract) {
    super(connection, truffleContract)
  }

  async describe() {
    return await getContractStatus(this.truffleContract)
  }

  async activate() {
    const {tokenBalance, totalWorkItems, workItemPrice, state, client} = await this.describe()

    if (tokenBalance < totalWorkItems * workItemPrice) {
      throw new UserError(
        `Contract needs ${totalWorkItems * workItemPrice} tokens to be activated, but has only ${tokenBalance}`,
        ErrorCodes.INSUFFICIENT_TOKEN_BALANCE
      )
    }

    if (state !== State.New) {
      throw new UserError(
        `Contract should be in New state to be activated, but is in ${stateToString(state)}`,
        ErrorCodes.INVALID_CONTRACT_STATE
      )
    }

    if (client !== this.account) {
      throw new UserError(
        `Only authorized address for contract is ${client}, but you're running as ${this.account} now`,
        ErrorCodes.UNAUTHORIZED
      )
    }

    return this._callContractMethod('activate')
  }

  async updateTotals(totalsMap) {
    // TODO: check basic pre-conditions
    const {addresses, totals} = totalsToArrays(totalsMap)
    return this._callContractMethod('updateTotals', [addresses, totals], {from: this.account})
  }

  async updatePerformance(performanceMap) {
    // TODO: check basic pre-conditions
    const {addresses, approved, declined} = performanceToArrays(performanceMap)
    return this._callContractMethod(
      'updatePerformance',
      [addresses, approved, declined],
      {from: this.account}
    )
  }

  async finalize() {
    // TODO: check basic pre-conditions
    return this._callContractMethod('finalize')
  }

  async forceFinalize() {
    // TODO: check basic pre-conditions
    return this._callContractMethod('forceFinalize')
  }

}
