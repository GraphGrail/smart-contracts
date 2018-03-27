import {UserError} from '../errors'
import * as ErrorCodes from '../error-codes'

import {promisifyCall} from './promisify'


let connectionPromise
let connectionError

export function setWeb3Promise(web3Promise) {
  connectionPromise = makeConnectionPromise(web3Promise)
    .catch(err => {connectionError = err})
}

export async function getConnection() {
  if (!connectionPromise) {
    throw new Error(
      `you should set web3 Promise by calling setWeb3Promise before calling getConnection`
    )
  }
  const connection = await connectionPromise
  if (connectionError) {
    throw (/Invalid JSON RPC response: ""/.test(connectionError.message)
      ? new UserError('Failed to connect to Ethereum node',
          ErrorCodes.NO_ETHEREUM_CLIENT,
          connectionError)
      : connectionError
    )
  }
  return connection
}

async function makeConnectionPromise(web3Promise) {
  const web3 = await web3Promise

  const [networkId, latestBlock, accounts] = await Promise.all([
    promisifyCall(web3.version.getNetwork, web3.version, []),
    promisifyCall(web3.eth.getBlock, web3.eth, ['latest']),
    promisifyCall(web3.eth.getAccounts, web3.eth),
  ])

  let blockGasLimit = +latestBlock.gasLimit
  if (!(blockGasLimit > 0)) {
    blockGasLimit = 4712388
  }

  //we just use default account
  return {web3, networkId, blockGasLimit, accounts, account: accounts && accounts[0]}
}
