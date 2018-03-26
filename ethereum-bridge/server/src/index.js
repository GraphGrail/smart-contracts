import Pino from 'pino'
const pino = Pino()

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

function buildLogDetails(account, networkId, balance) {
  const result = {}
  result['account'] = account

  if (networkId) {
    result['networkId'] = networkId
  }

  if (balance) {
    result['balance'] = balance
  }
  return result
}

async function checksOnStartup() {
  const {web3, account} = await getConnection()
  const networkId = await promisifyCall(web3.version.getNetwork, web3.version)

  if (!account) {
    pino.error('no accounts set in Ethereum client')
    return process.exit(1)
  }

  if (await isAccountLocked(account, web3)) {
    pino.error(buildLogDetails(account, networkId), 'account is locked')
    return process.exit(1)
  }

  const balance = await promisifyCall(web3.eth.getBalance, web3.eth, [account])
  const balanceEth = web3.fromWei(balance, 'ether')

  if (balance.lt(ACCOUNT_CRITICAL_LOW_BALANCE)) {
    pino.error(buildLogDetails(account, networkId, balanceEth), 'account balance is too low')
    return process.exit(1)
  }

  if (balance.lt(ACCOUNT_LOW_BALANCE)) {
    pino.warn(buildLogDetails(account, networkId, balanceEth), 'low account balance')
  } else {
    pino.info(buildLogDetails(account, networkId, balanceEth), 'account balance')
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
  pino.info({version: process.versions.node}, 'node version')

  setWeb3Promise(getWeb3())
  await checksOnStartup()

  const app = new Koa()

  app.use(cors())
  app.use(router.routes())

  await promisifyCall(app.listen, app, [config.port, config.host])
  pino.info('app started')
}

run().catch(err => pino.error(err, `failed to start`))
