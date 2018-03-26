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

import compareAddress from './utils/compare-address'

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

    this.validateActivationTokenBalance(totalWorkItems * workItemPrice, tokenBalance)
    this.validateContractState(State.New, state)
    this.validateAuthorized(client)

    return this._callContractMethod('activate')
  }

  async updateTotals(totalsMap) {
    const {state, owner, performance} = await this.describe()

    this.validateAuthorized(owner)
    this.validateContractState(State.Active, state)

    const {addresses, totals} = totalsToArrays(totalsMap)
    return this._callContractMethod('updateTotals', [addresses, totals], {from: this.account})
  }

  async updatePerformance(performanceMap) {
    const {state, client, performance} = await this.describe()

    this.validateContractState(State.Active, state)
    this.validateAuthorized(client)
    this.validatePerformanceUpdate(performance, performanceMap)

    const {addresses, approved, declined} = performanceToArrays(performanceMap)
    return this._callContractMethod(
      'updatePerformance',
      [addresses, approved, declined],
      {from: this.account}
    )
  }

  async finalize() {
    const {state, client, canFinalize} = await this.describe()

    this.validateContractState(State.Active, state)
    this.validateAuthorized(client)
    this.validateFinalizability(canFinalize)

    return this._callContractMethod('finalize')
  }

  async forceFinalize() {
    const {state, canForceFinalize} = await this.describe()

    this.validateContractState(State.Active, state)
    this.validateForceFinalizability(canForceFinalize)

    return this._callContractMethod('forceFinalize')
  }

  validateAuthorized = (address) => {
    if (!compareAddress(address, this.account)) {
      throw new UserError(
        `Only authorized address for action is ${address}, but you're running as ${this.account} now`,
        ErrorCodes.UNAUTHORIZED
      )
    }
    return
  }

  validateContractState = (expected, fact) => {
    if (expected !== fact) {
      throw new UserError(
        `Contract should be in ${stateToString(expected)} state, but is in `
        +`${stateToString(fact)}`,
        ErrorCodes.INVALID_CONTRACT_STATE
      )
    }
  }

  validateActivationTokenBalance = (requiredBalance, factBalance) => {
    if (factBalance < requiredBalance) {
      throw new UserError(
        `Contract needs ${requiredBalance} tokens to be activated, but has only ${factBalance}`,
        ErrorCodes.INSUFFICIENT_TOKEN_BALANCE
      )
    }
  }

  validatePerformanceUpdate = (currentPerformanceData, update) => {
    Object.keys(update).forEach(updateItemAddress => {
      const existingItem = currentPerformanceData[updateItemAddress]
      if (!existingItem) {
        throw new UserError(`Got performance update for unknown address ${updateItemAddress}`,
          ErrorCodes.INVALID_DATA)
      }
      const {approvedItems, declinedItems} = update[updateItemAddress]
      const updatingItems = (approvedItems || 0) + (declinedItems || 0)
      if (approvedItems && approvedItems < 0) {
        throw new UserError(`Performance data for ${updateItemAddress} lists negative`
          + ` ${approvedItems} approved items work items`,
          ErrorCodes.INVALID_DATA)
      }
      if (declinedItems && declinedItems < 0) {
        throw new UserError(`Performance data for ${updateItemAddress} lists negative`
          + ` ${declinedItems} declined items work items`,
          ErrorCodes.INVALID_DATA)
      }
      if (existingItem.totalItems !== updatingItems) {
        throw new UserError(`Performance data for ${updateItemAddress} lists ${updatingItems} work`
          + ` items while contract awaits update on ${existingItem.totalItems} work items`,
          ErrorCodes.INVALID_DATA)
      }
    })
    return
  }

  validateFinalizability = (canFinalize) => {
    if (!canFinalize) {
      throw new UserError(`Contract has pending work and couldn't be finalized`, ErrorCodes.INVALID_CONTRACT_STATE)
    }
  }

  validateForceFinalizability = (canForceFinalize) => {
    if (!canForceFinalize) {
      throw new UserError(`Contract couldn't be force-finalized`, ErrorCodes.INVALID_CONTRACT_STATE)
    }
  }

}
