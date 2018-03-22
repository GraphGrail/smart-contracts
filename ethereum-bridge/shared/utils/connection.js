import {promisifyCall} from './promisify'

let connectionPromise

export function setWeb3Promise(web3Promise) {
  connectionPromise = makeConnectionPromise(web3Promise)
}

export function getConnection() {
  if (!connectionPromise) {
    throw new Error(
      `you should set web3 Promise by calling setWeb3Promise before calling getConnection`
    )
  }
  return connectionPromise
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
