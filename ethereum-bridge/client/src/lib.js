import BigNumber from 'bignumber.js'
import ethereumAddress from 'ethereum-address'

import TokenContract from '../../shared/token-contract'
import ProjectContract from '../../shared/project-contract'
import {UserError} from '../../shared/errors'
import * as ErrorCodes from '../../shared/error-codes'
import {promisifyCall} from '../../shared/utils/promisify'
import {getConnection, setWeb3Promise} from '../../shared/utils/connection'

import getWeb3 from './utils/get-web3'
import validateResponseStatus from './utils/validate-response-status'

export default {
  init,
  isInitialized,
  getClientAddress,
  checkBalances,
  isTransacting,
  activeTransactionFinishedPromise,
  transferTokensTo,
  activateContract,
  scoreWork,
  finalizeContract,
  UserError,
}

const RESOLVED_PROMISE = new Promise(resolve => resolve())

let isInitializing = false
let moduleIsInitialized = false
let tokenContract
let internalApi

async function init(tokenContractAddress, expectedNetworkId = 4, internalApiAddress = null) {
  if (isInitializing || moduleIsInitialized) {
    throw new UserError(`Already initialized`, ErrorCodes.ALREADY_INITIALIZED)
  }

  setWeb3Promise(getWeb3())

  try {
    isInitializing = true
    const clientAddress = await _init(tokenContractAddress, expectedNetworkId, internalApiAddress)
    moduleIsInitialized = true
    return clientAddress
  } finally {
    isInitializing = false
  }
}

async function _init(tokenContractAddress, expectedNetworkId, internalApiAddress) {
  if (!ethereumAddress.isAddress(tokenContractAddress)) {
    throw new UserError(
      `Invalid Ethereum address: ${tokenContractAddress}`,
      ErrorCodes.INVALID_ETHEREUM_ADDRESS
    )
  }

  tokenContract = await TokenContract.at(tokenContractAddress)
  internalApi = internalApiAddress

  const {web3, networkId, account} = await getConnection()

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

  moduleIsInitialized = true
  return account
}

function isInitialized() {
  return isInitializing || moduleIsInitialized
}

function assertNotInitialized() {
  if (isInitializing || !moduleIsInitialized) {
    throw new UserError(`Not initialized`, ErrorCodes.ALREADY_INITIALIZED)
  }
}

async function getClientAddress() {
  assertNotInitialized()
  const {account} = await getConnection()
  return account
}

async function checkBalances(address) {
  assertNotInitialized()
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

function isTransacting() {
  assertNotInitialized()
  return false
}

function activeTransactionFinishedPromise() {
  assertNotInitialized()
  return RESOLVED_PROMISE
}

async function transferTokensTo(address, amount) {
  assertNotInitialized()
  const res = await tokenContract.transfer(address, amount)
  return
}

async function activateContract(contractAddress) {
  assertNotInitialized()
  //TODO: check that it's a ProjectContract
  //TODO: check that it's client is a contract-specified one
  const project = await ProjectContract.at(contractAddress)
  await project.activate()
  return
}

async function scoreWork(contractAddress, workers) {
  assertNotInitialized()
  //TODO: check that it's a ProjectContract
  //TODO: check that it's client is a contract-specified one
  const project = await ProjectContract.at(contractAddress)
  await project.updatePerformance(workers)
  return
}

async function finalizeContract(contractAddress) {
  assertNotInitialized()
  //TODO: check that it's a ProjectContract
  //TODO: check that it's client is a contract-specified one
  const project = await ProjectContract.at(contractAddress)
  await project.finalize()
}
