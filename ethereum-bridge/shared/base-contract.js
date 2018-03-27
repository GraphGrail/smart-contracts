import nanoid from 'nanoid'
import Pino from 'pino'
let pino

// initialize pino logger for node only
if (typeof window !== 'object') {
  pino = Pino()
} else {
  pino = {}
  pino.info = () => {}
}

import BigNumber from 'bignumber.js'
import TruffleContract from 'truffle-contract'

import {getConnection} from './utils/connection'
import {getGasPrice} from './utils/gas-price'
import {promisifyCall} from './utils/promisify'
import {assertTxSucceeds} from './utils/tx-utils'

import {UserError} from './errors'
import * as ErrorCodes from './error-codes'

export default class BaseContract {

  static builtContract = null
  static TruffleCls = null
  static connection = null

  static _initPromise = null

  static async _init() {
    this.connection = await getConnection()
    this.TruffleCls = TruffleContract(this.builtContract)
    this.TruffleCls.setProvider(this.connection.web3.currentProvider)
  }

  static _initialized() {
    return this._initPromise || (this._initPromise = this._init())
  }

  static async at(address) {
    await this._initialized()
    try {
      const truffleContract =  await this.TruffleCls.at(address).then(x => x)
      return new this(this.connection, truffleContract)
    } catch (err) {
      if (/no code at address/.test(err.message)) {
        throw new UserError(err.message, ErrorCodes.CONTRACT_NOT_FOUND, err)
      } else {
        throw err
      }
    }
  }

  static async deployed() {
    await this._initialized()
    const truffleContract =  await this.TruffleCls.deployed().then(x => x)
    return new this(this.connection, truffleContract)
  }

  static async deploy(...args) {
    await this._initialized()
    const {web3, account, blockGasLimit} = this.connection

    const gasEstimation = +await this.estimateDeployGas(...args)

    if (gasEstimation > blockGasLimit) {
      throw new UserError(
        `transaction takes more gas than block limit of ${blockGasLimit}`,
        ErrorCodes.TRANSACTION_FAILED
      )
    }

    const gasPrice = await getGasPrice()
    const txFee = new BigNumber(gasPrice).times(gasEstimation)
    const balance = await promisifyCall(web3.eth.getBalance, web3.eth, [account])

    if (new BigNumber(balance).lt(txFee)) {
      throw new UserError(
        `balance of address ${account} is insufficient to deploy this contract`,
        ErrorCodes.INSUFFICIENT_ETHER_BALANCE
      )
    }

    const txId = nanoid()

    pino.info({
      txId: txId,
      contractName: this.TruffleCls.contractName,
      args: args,
      from: account,
      gas: Math.min(gasEstimation + 20000, blockGasLimit),
      gasPrice: gasPrice,
    }, 'will deploy contract')

    const truffleContract = await this.TruffleCls.new(...args, {
      from: account,
      gas: Math.min(gasEstimation + 20000, blockGasLimit),
      gasPrice,
    }).then(x => x)

    pino.info({
      txId: txId,
      contractName: this.TruffleCls.contractName,
      address: truffleContract.address,
    }, 'contract deployed')

    return new this(this.connection, truffleContract)
  }

  static async estimateDeployGas(...args) {
    await this._initialized()
    const {web3, account} = this.connection
    const Web3Cls = web3.eth.contract(this.builtContract.abi)
    const txData = Web3Cls.new.getData(...args, {data: this.builtContract.bytecode})
    try {
      return await promisifyCall(web3.eth.estimateGas, web3.eth, [{from: account, data: txData}])
    } catch (err) {
      throw new UserError(err.message, ErrorCodes.TRANSACTION_FAILED, err)
    }
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
    let gasEstimation

    try {
      gasEstimation = +await promisifyCall(method.estimateGas, method, gasEstCallArgs)
    } catch (err) {
      throw new UserError(err.message, ErrorCodes.TRANSACTION_FAILED, err)
    }

    if (gasEstimation > this.connection.blockGasLimit) {
      throw new UserError(
        `transaction takes more gas than block limit of ${this.connection.blockGasLimit}`,
        ErrorCodes.TRANSACTION_FAILED
      )
    }

    const {web3} = this.connection
    const gasPrice = await getGasPrice()
    const txFee = new BigNumber(gasPrice).times(gasEstimation)
    const balance = await promisifyCall(web3.eth.getBalance, web3.eth, [this.account])

    if (new BigNumber(balance).lt(txFee)) {
      throw new UserError(
        `balance of address ${this.account} is insufficient to call this method`,
        ErrorCodes.INSUFFICIENT_ETHER_BALANCE
      )
    }

    const txOpts = {
      from: this.account,
      gas: Math.min(gasEstimation + 20000, this.connection.blockGasLimit),
      gasPrice: gasPrice,
      value: value,
    }

    const txId = nanoid()

    pino.info({
      txId: txId,
      methodName: methodName,
      contractAddress: this.address,
      args: args,
      ...txOpts,
    }, 'will send tx')

    const txArgs = args ? [...args, txOpts] : [txOpts]
    let txResult

    try {
      txResult = await this.truffleContract[methodName].apply(this.truffleContract, txArgs)
    } catch (err) {
      if (err.message.search('revert') >= 0) {
        throw new UserError(err.message, ErrorCodes.TRANSACTION_FAILED, err)
      } else {
        throw err
      }
    }

    pino.info({
      txId: txId,
      methodName: methodName,
      contractAddress: this.address,
      txHash: txResult.tx,
      gasUsed: txResult.receipt.gasUsed,
    }, 'tx sent')

    return await assertTxSucceeds(txResult)
  }

}
