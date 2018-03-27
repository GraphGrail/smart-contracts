import splitToChunks from './utils/split-to-chunks'

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
const UPDATE_TOTALS_CHUNK_SIZE = 20
const UPDATE_PERFORMANCE_CHUNK_SIZE = 20


export default class ProjectContract extends BaseContract {
  static builtContract = builtProjectContract

  static State = State

  static async deploy(
    tokenContractAddress,
    clientAddress,
    approvalCommissionBenificiaryAddress,
    disapprovalCommissionBeneficiaryAddress,
    approvalCommissionFraction,
    disapprovalCommissionFraction,
    totalWorkItems,
    workItemPrice,
    autoApprovalTimeoutSec,
  ) {
    if (approvalCommissionFraction < 0 || approvalCommissionFraction > 1) {
      throw new UserError(
        `approvalCommissionFraction must be between 0 and 1, inclusive`,
        ErrorCodes.INVALID_DATA,
      )
    }

    if (disapprovalCommissionFraction < 0 || disapprovalCommissionFraction > 1) {
      throw new UserError(
        `disapprovalCommissionFraction must be between 0 and 1, inclusive`,
        ErrorCodes.INVALID_DATA,
      )
    }

    if (approvalCommissionFraction + disapprovalCommissionFraction > 1) {
      throw new UserError(
        `sum of approvalCommissionFraction and disapprovalCommissionFraction ` +
          `cannot be more than 1`,
        ErrorCodes.INVALID_DATA,
      )
    }

    return await BaseContract.deploy.call(this,
      tokenContractAddress,
      clientAddress,
      approvalCommissionBenificiaryAddress,
      disapprovalCommissionBeneficiaryAddress,
      Math.floor(1000 * approvalCommissionFraction),
      Math.floor(1000 * disapprovalCommissionFraction),
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
    this._assertActivationTokenBalance(workItemPrice.mul(totalWorkItems), tokenBalance)
    this._assertContractStateIs(State.New, state)
    this._assertActorIs(client)

    return this._callContractMethod('activate')
  }

  async updateTotals(totalsMap) {
    const {state, owner} = await this.describe()

    this._assertActorIs(owner)
    this._assertContractStateIs(State.Active, state)

    const {addresses, totals} = totalsToArrays(totalsMap)

    const [addressesChunks, totalsChunks] = splitToChunks(
      UPDATE_TOTALS_CHUNK_SIZE,
      [addresses, totals])

    const txPromises = addressesChunks.map((addresses, i) => this._callContractMethod(
      'updateTotals',
      [addresses, totalsChunks[i]],
      {from: this.account}
    ))

    return await Promise.all(txPromises)
  }

  async updatePerformance(performanceUpdate) {
    const [{state, client}, currentPerformanceMap] = await Promise.all([this.describe(),
      this.getPerformance()])

    this._assertContractStateIs(State.Active, state)
    this._assertActorIs(client)
    this._assertPerformanceUpdateIsValid(currentPerformanceMap, performanceUpdate)

    const {addresses, approved, declined} = performanceToArrays(performanceUpdate)

    const [addressesChunks, approvedChunks, declinedChunks] = splitToChunks(
      UPDATE_PERFORMANCE_CHUNK_SIZE,
      [addresses, approved, declined])

    // NOTE: not parallelizing here as this is intended to be called by a client,
    // and it would be a bad UX to ask signing a lot of transactions at once.

    let txResults = []

    for (let i = 0; i < addressesChunks.length; ++i) {
      console.log(`calling updatePerformance`, addressesChunks[i], approvedChunks[i], declinedChunks[i])
      const result = await this._callContractMethod(
        'updatePerformance',
        [addressesChunks[i], approvedChunks[i], declinedChunks[i]],
        {from: this.account}
      )
      txResults.push(result)
    }

    return txResults
  }

  async finalize() {
    const {state, client, canFinalize} = await this.describe()

    this._assertContractStateIs(State.Active, state)
    this._assertActorIs(client)
    this._assertCanFinalize(canFinalize)

    return this._callContractMethod('finalize')
  }

  async forceFinalize() {
    const {state, canForceFinalize} = await this.describe()
    this._assertCanForceFinalize(state, canForceFinalize)

    let newState = state

    while (newState !== State.Finalized) {
      await this._callContractMethod('forceFinalize', [MAX_FORCE_FINALIZE_GAS])
      newState = +await this.truffleContract.state()
    }
  }

  _assertActorIs(address) {
    if (!compareAddress(address, this.account)) {
      throw new UserError(
        `Only authorized address for action is ${address}, but you're running as ${this.account} now`,
        ErrorCodes.UNAUTHORIZED
      )
    }
    return
  }

  _assertContractStateIs(expected, fact) {
    if (expected !== fact) {
      throw new UserError(
        `Contract should be in ${stateToString(expected)} state, but is in `
        +`${stateToString(fact)}`,
        ErrorCodes.INVALID_CONTRACT_STATE
      )
    }
  }

  _assertActivationTokenBalance(requiredBalance, factBalance) {
    if (factBalance.lt(requiredBalance)) {
      throw new UserError(
        `Failed to activate contract; need ${requiredBalance} tokens, have ${factBalance}`,
        ErrorCodes.INSUFFICIENT_TOKEN_BALANCE
      )
    }
  }

  _assertPerformanceUpdateIsValid(currentPerformanceData, update) {
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

  _assertCanFinalize(canFinalize) {
    if (!canFinalize) {
      throw new UserError(`Contract has pending work and couldn't be finalized`,
        ErrorCodes.INVALID_CONTRACT_STATE)
    }
  }

  _assertCanForceFinalize(state, canForceFinalize) {
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
