import TruffleContract from 'truffle-contract'

import {getConnection} from './utils/connection'
import {getGasPrice} from './utils/gas-price'
import {promisifyCall} from './utils/promisify'
import {assertTxSucceeds} from './utils/tx-utils'


// Fail if tx is going to take more gas than this.
//
const GAS_HARD_LIMIT = 4700000


export default class BaseContract {

  static ABI = null
  static TruffleCls = null
  static connection = null

  static _initPromise = null

  static async _init() {
    this.connection = await getConnection()
    this.TruffleCls = TruffleContract(this.ABI)
    this.TruffleCls.setProvider(this.connection.web3.currentProvider)
  }

  static _initialized() {
    return this._initPromise || (this._initPromise = this._init())
  }

  static async deployed() {
    await this._initialized()
    const truffleContract =  await this.TruffleCls.deployed()
    return new this(this.connection, truffleContract)
  }

  static async deploy(...args) {
    await this._initialized()

    const gasPrice = await getGasPrice()

    const truffleContract = await this.TruffleCls.new(...args, {
      from: this.connection.account,
      gas: GAS_HARD_LIMIT,
      gasPrice,
    })

    return new this(this.connection, truffleContract)
  }

  static async estimateDeployGas(...args) {
    await this._initialized()
    const {web3} = this.connection
  }

  constructor(connection, truffleContract) {
    this.connection = connection
    this.truffleContract = truffleContract
    this.web3Contract = truffleContract.contract
    this.account = connection.account
  }

  get address() {
    return this.web3Contract.address
  }

  async _callContractMethod(methodName, args, opts) {
    if (opts === undefined && args && args.length === undefined) {
      opts = args
      args = undefined
    }

    const {value = 0} = opts || {}

    const method = this.web3Contract[methodName]

    const gasEstOpts = {
      from: this.account,
      gas: this.connection.blockGasLimit,
      value: value,
    }

    const gasEstCallArgs = args ? [...args, gasEstOpts] : [gasEstOpts]
    const gasEstimation = await promisifyCall(method.estimateGas, method, gasEstCallArgs)

    if (gasEstimation > GAS_HARD_LIMIT) {
      throw new Error(`transaction takes more than ${GAS_HARD_LIMIT} gas`)
    }

    const gasPrice = await getGasPrice()
    const txOpts = {
      from: this.account,
      gas: gasEstimation,
      gasPrice: gasPrice,
      value: value,
    }

    // const fee = 350 * (gasPrice / 1000000000) * gasEstimation / 1000000000
    // console.debug(`tx gas price ${gasPrice}, est ${gasEstimation}, fee $${fee}`)

    const txArgs = args ? [...args, txOpts] : [txOpts]
    const txResult = await this.truffleContract[methodName].apply(this.truffleContract, txArgs)

    return await assertTxSucceeds(txResult)
  }

}
