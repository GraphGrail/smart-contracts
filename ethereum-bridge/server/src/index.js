import BigNumber from 'bignumber.js'
import Koa from 'koa'
import cors from '@koa/cors'
import Web3 from 'web3'

import config from './config'
import {router} from './routes'

import {setWeb3Promise, getConnection} from '../../shared/utils/connection'
import {promisifyCall} from '../../shared/utils/promisify'

const ACCOUNT_LOW_BALANCE = new BigNumber('5e17') // 0.5 ETH
const ACCOUNT_CRITICAL_LOW_BALANCE = new BigNumber('1e16') // 0.01 ETH

async function getWeb3() {
  const provider = new Web3.providers.HttpProvider(config.rpcConnection)
  return new Web3(provider)
}

async function checksOnStartup() {
  const {web3, account} = await getConnection()

  if (!account) {
    console.log(`ERROR: no accounts set in Ethereum client. Aborting.`)
    return process.exit(1)
  }

  console.log(`Using account with index 0: ${account}`)

  if (await isAccountLocked(account, web3)) {
    console.log(`ERROR: account is locked. Aborting.`)
    return process.exit(1)
  }

  const balance = await promisifyCall(web3.eth.getBalance, web3.eth, [account])

  if (balance.lt(ACCOUNT_CRITICAL_LOW_BALANCE)) {
    console.log(`ERROR: account balance is too low (${web3.fromWei(balance, 'ether')} ` +
      `ETH). Aborting.`)
    return process.exit(1)
  }

  if (balance.lt(ACCOUNT_LOW_BALANCE)) {
    console.log(`WARNING: low account balance: ${web3.fromWei(balance, 'ether')} ETH`)
  } else {
    console.log(`Account balance: ${web3.fromWei(balance, 'ether')} ETH`)
  }
}

async function isAccountLocked(address, web3) {
  try {
    await promisifyCall(web3.eth.sign, web3.eth, [address, ''])
  } catch (e) {
    return true
  }
  return false
}

async function run() {
  console.log(`Node.js version: ${process.versions.node}`)

  setWeb3Promise(getWeb3())
  await checksOnStartup()

  const app = new Koa()

  app.use(cors())
  app.use(router.routes())

  await promisifyCall(app.listen, app, [config.port])
  console.log(`Listening on ${config.port} port`)
}

run().catch(err => console.log(`Failed to start: ${err.stack}`))
