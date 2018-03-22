import BaseContract from './base-contract'

import {
  State as State,
  getContractStatus,
  totalsToArrays,
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
    // TODO: check basic pre-conditions
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
