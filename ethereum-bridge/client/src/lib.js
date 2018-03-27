import BigNumber from 'bignumber.js'
import ethereumAddress from 'ethereum-address'

import TokenContract from '../../shared/token-contract'
import ProjectContract from '../../shared/project-contract'
import {UserError} from '../../shared/errors'
import * as ErrorCodes from '../../shared/error-codes'
import {promisifyCall} from '../../shared/utils/promisify'
import {getConnection, setWeb3Promise} from '../../shared/utils/connection'

import getWeb3 from './utils/get-web3'

BigNumber.config({EXPONENTIAL_AT: [-7, 30]})

const RESOLVED_PROMISE = new Promise(resolve => resolve())

let isInitializing = false
let moduleIsInitialized = false
let tokenContract

export {UserError, BigNumber}

export async function init(tokenContractAddress, expectedNetworkId = 4) {
  if (isInitializing || moduleIsInitialized) {
    throw new UserError(`Already initialized`, ErrorCodes.ALREADY_INITIALIZED)
  }

  setWeb3Promise(getWeb3())

  try {
    isInitializing = true
    const clientAddress = await _init(tokenContractAddress, expectedNetworkId)
    moduleIsInitialized = true
    return clientAddress
  } finally {
    isInitializing = false
  }
}

async function _init(tokenContractAddress, expectedNetworkId) {
  if (!ethereumAddress.isAddress(tokenContractAddress)) {
    throw new UserError(
      `Invalid Ethereum address: ${tokenContractAddress}`,
      ErrorCodes.INVALID_ETHEREUM_ADDRESS
    )
  }

  let networkId, account
  try {
    const connection = await getConnection()
    networkId = connection.networkId
    account = connection.account
  } catch (err) {
    throw UserError.from(err, `no Ethereum client found`, ErrorCodes.NO_ETHEREUM_CLIENT)
  }

  if (!networkId) {
    throw new UserError(`no Ethereum client found`, ErrorCodes.NO_ETHEREUM_CLIENT)
  }

  if (!account) {
    throw new UserError(`Ethereum client has no accounts set`, ErrorCodes.NO_ACCOUNTS)
  }

  if (+expectedNetworkId !== +networkId) {
    throw new UserError(
      `The active Ethereum network differs from the expected one`,
      ErrorCodes.WRONG_NETWORK,
    )
  }

  tokenContract = await TokenContract.at(tokenContractAddress)

  return account
}

export function isInitialized() {
  return isInitializing || moduleIsInitialized
}

function assertInitialized() {
  if (!moduleIsInitialized) {
    throw new UserError(`Not initialized`, ErrorCodes.ALREADY_INITIALIZED)
  }
}

export async function getClientAddress() {
  assertInitialized()
  const {account} = await getConnection()
  return account
}

export async function checkBalances(address) {
  assertInitialized()
  const {web3, account} = await getConnection()
  const [etherBigNumber, tokenBigNumber] = await Promise.all([
    promisifyCall(web3.eth.getBalance, web3.eth, [address]),
    tokenContract.balanceOf(address),
  ])
  return {
    ether: etherBigNumber.toString(),
    token: tokenBigNumber.toString()
  }
}

export function isTransacting() {
  assertInitialized()
  return false
}

export function activeTransactionFinishedPromise() {
  assertInitialized()
  return RESOLVED_PROMISE
}

export async function transferTokensTo(address, amount) {
  assertInitialized()
  await tokenContract.transfer(address, amount)
  return
}

export async function activateContract(contractAddress) {
  assertInitialized()
  const project = await ProjectContract.at(contractAddress)
  await project.activate()
  return
}

export async function scoreWork(contractAddress, workers) {
  assertInitialized()
  validateWorkersData(workers)
  const project = await ProjectContract.at(contractAddress)
  await project.updatePerformance(workers)
  return
}

export async function finalizeContract(contractAddress) {
  assertInitialized()
  const project = await ProjectContract.at(contractAddress)
  await project.finalize()
}

function validateWorkersData(workers) {
  Object.keys(workers).forEach(workerAddress => {
    const workerScoring = workers[workerAddress]
    const {approvedItems, declinedItems} = workerScoring
    if (!approvedItems && !declinedItems) {
      throw new UserError(`Worker data should contain either approvedItems or declinedItems field`,
        ErrorCodes.INVALID_DATA)
    }
    if (approvedItems && !Number.isInteger(approvedItems)) {
      throw new UserError(`approvedItems should be integer, instead got ${approvedItems}`,
        ErrorCodes.INVALID_DATA)
    }
    if (declinedItems && !Number.isInteger(declinedItems)) {
      throw new UserError(`declinedItems should be integer, instead got ${declinedItems}`,
        ErrorCodes.INVALID_DATA)
    }
  })

  return
}
