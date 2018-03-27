import BaseContract from './base-contract'
import {UserError} from './errors'
import * as ErrorCodes from './error-codes'

import {
  State as State,
  stateToString,
  getContractStatus,
  getContractPerformance,
  totalsToArrays,
  performanceToArrays,
} from './contract-api-helpers'

import compareAddress from './utils/compare-address'

import builtProjectContract from '../../truffle/build/contracts/GGProject.json'


const MAX_FORCE_FINALIZE_GAS = 2000000

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

  async getPerformance() {
    return await getContractPerformance(this.truffleContract)
  }

  async activate() {
    const {tokenBalance, totalWorkItems, workItemPrice, state, client} = await this.describe()
    this.assertActivationTokenBalance(workItemPrice.mul(totalWorkItems), tokenBalance)
    this.assertContractStateIs(State.New, state)
    this.assertActorIs(client)

    return this._callContractMethod('activate')
  }

  async updateTotals(totalsMap) {
    const {state, owner} = await this.describe()

    this.assertActorIs(owner)
    this.assertContractStateIs(State.Active, state)

    const {addresses, totals} = totalsToArrays(totalsMap)
    return this._callContractMethod('updateTotals', [addresses, totals], {from: this.account})
  }

  async updatePerformance(performanceUpdate) {
    const [{state, client}, currentPerformanceMap] = await Promise.all([this.describe(),
      this.getPerformance()])

    this.assertContractStateIs(State.Active, state)
    this.assertActorIs(client)
    this.assertPerformanceUpdateIsValid(currentPerformanceMap, performanceUpdate)

    const {addresses, approved, declined} = performanceToArrays(performanceUpdate)
    return this._callContractMethod(
      'updatePerformance',
      [addresses, approved, declined],
      {from: this.account}
    )
  }

  async finalize() {
    const {state, client, canFinalize} = await this.describe()

    this.assertContractStateIs(State.Active, state)
    this.assertActorIs(client)
    this.assertCanFinalize(canFinalize)

    return this._callContractMethod('finalize')
  }

  async forceFinalize() {
    const {state, canForceFinalize} = await this.describe()
    this.assertCanForceFinalize(state, canForceFinalize)

    let newState = state

    while (newState !== State.Finalized) {
      await this._callContractMethod('forceFinalize', [MAX_FORCE_FINALIZE_GAS])
      newState = +await this.truffleContract.state()
    }
  }

  assertActorIs(address) {
    if (!compareAddress(address, this.account)) {
      throw new UserError(
        `Only authorized address for action is ${address}, but you're running as ${this.account} now`,
        ErrorCodes.UNAUTHORIZED
      )
    }
    return
  }

  assertContractStateIs(expected, fact) {
    if (expected !== fact) {
      throw new UserError(
        `Contract should be in ${stateToString(expected)} state, but is in `
        +`${stateToString(fact)}`,
        ErrorCodes.INVALID_CONTRACT_STATE
      )
    }
  }

  assertActivationTokenBalance(requiredBalance, factBalance) {
    if (factBalance.lt(requiredBalance)) {
      throw new UserError(
        `Failed to activate contract; need ${requiredBalance} tokens, have ${factBalance}`,
        ErrorCodes.INSUFFICIENT_TOKEN_BALANCE
      )
    }
  }

  assertPerformanceUpdateIsValid(currentPerformanceData, update) {
    Object.keys(update).forEach(updateItemAddress => {
      const existingItem = currentPerformanceData[updateItemAddress]
      if (!existingItem) {
        throw new UserError(`Got performance update for unknown address ${updateItemAddress}`,
          ErrorCodes.INVALID_DATA)
      }
      const {approvedItems, declinedItems} = update[updateItemAddress]
      const updatingItemsCount = (approvedItems || 0) + (declinedItems || 0)
      if (approvedItems && approvedItems < 0) {
        throw new UserError(`Performance data for ${updateItemAddress} lists negative`
          + ` ${approvedItems} approved work items`,
          ErrorCodes.INVALID_DATA)
      }
      if (approvedItems && approvedItems < existingItem.approvedItems) {
        throw new UserError(`Invalid performance data for ${updateItemAddress}`
          + ` ${approvedItems} approved work items in update,`
          + ` ${existingItem.approvedItems} already approved`,
          ErrorCodes.INVALID_DATA)
      }
      if (declinedItems && declinedItems < 0) {
        throw new UserError(`Performance data for ${updateItemAddress} lists negative`
          + ` ${declinedItems} declined work items`,
          ErrorCodes.INVALID_DATA)
      }
      if (declinedItems && declinedItems < existingItem.declinedItems) {
        throw new UserError(`Invalid performance data for ${updateItemAddress}`
          + ` ${approvedItems} declineed work items in update`,
          + ` ${existingItem.declinedItems} already declineed`,
          ErrorCodes.INVALID_DATA)
      }
      if (existingItem.totalItems !== updatingItemsCount) {
        throw new UserError(`Performance data for ${updateItemAddress} lists ${updatingItemsCount}`
          + ` work items while contract awaits update on ${existingItem.totalItems} work items`,
          ErrorCodes.INVALID_DATA)
      }
    })
    return
  }

  assertCanFinalize(canFinalize) {
    if (!canFinalize) {
      throw new UserError(`Contract has pending work and couldn't be finalized`,
        ErrorCodes.INVALID_CONTRACT_STATE)
    }
  }

  assertCanForceFinalize(state, canForceFinalize) {
    if (state !== State.Active && state !== State.ForceFinalizing) {
      throw new UserError(
        `You can only force-finalize contract in ACTIVE or FORCE_FINALIZING state, ` +
          `current state: ${stateToString(state)}`,
        ErrorCodes.INVALID_CONTRACT_STATE
      )
    }
    if (!canForceFinalize) {
      throw new UserError(`Contract couldn't be force-finalized`, ErrorCodes.INVALID_CONTRACT_STATE)
    }
  }

}
