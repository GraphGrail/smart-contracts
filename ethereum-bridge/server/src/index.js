import BigNumber from 'bignumber.js'
import Koa from 'koa'
import cors from '@koa/cors'
import Web3 from 'web3'

import config from './config'
import {router} from './routes'

import {setWeb3Promise, getConnection} from '../../shared/utils/connection'
import {promisifyCall} from '../../shared/utils/promisify'

const ACCOUNT_LOW_BALANCE = new BigNumber("1e50")

async function getWeb3() {
  const provider = new Web3.providers.HttpProvider(config.rpcConnection)
  return new Web3(provider)
}

async function checksOnStartup() {
  async function isAccountLocked(address, web3) {
    try {
      await promisifyCall(web3.eth.sign, web3.eth, [address, ''])
    } catch (e) {
      console.log(e.stack)
      return true
    }
    return false
  }

  const {web3, account} = await getConnection()
  if (account) {
    if (await isAccountLocked(account, web3)) {
      console.log(`ERROR. Account is locked. Aborting...`)
      process.exit(1)
    }
    const balance = await web3.eth.getBalance(account)
    // const balance = new BigNumber(10)
    if (balance.lt(ACCOUNT_LOW_BALANCE)) {
      console.log(`WARNING. Low account balance: ${balance}`)
    }
  } else {
    console.log(`ERROR. Account is undefined. Aborting...`)
    process.exit(1)
  }
}

async function run() {
  setWeb3Promise(getWeb3())
  await checksOnStartup()

  const app = new Koa()

  app.use(cors())
  app.use(router.routes())
  app.listen(config.port)
  console.log(`app started listening on ${config.port} port`)
}

run()
