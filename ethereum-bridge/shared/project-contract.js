import BaseContract from './base-contract'
import {State as State, getContractStatus} from './contract-api-helpers'

import projectContractABI from '../../truffle/build/contracts/GGProject.json'


export default class ProjectContract extends BaseContract {
  static ABI = projectContractABI

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

  async getState() {
    return await getContractStatus(this.truffleContract)
  }

  async activate() {
    return this._callContractMethod('activate')
  }

}
