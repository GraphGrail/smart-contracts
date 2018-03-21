import BaseContract from './base-contract'
import {inspectTransaction} from './utils/tx-utils'

import {UserError} from './errors'
import * as ErrorCodes from './error-codes'

import tokenContractABI from '../../truffle/build/contracts/GraphGrailToken.json'


export default class ProjectContract extends BaseContract {
  static ABI = tokenContractABI

  async totalSupply() {
    return await this.truffleContract.totalSupply()
  }

  async balanceOf(who) {
    return await this.truffleContract.balanceOf(who)
  }

  async transfer(to, value) {
    const result = await this._callContractMethod('transfer', [to, value])

    const transferEmitted = result.events.some(evt => evt.name === 'Transfer')
    if (!transferEmitted) {
      throw new UserError(`token transfer failed`, ErrorCodes.TRANSACTION_FAILED)
    }

    return result
  }

}
