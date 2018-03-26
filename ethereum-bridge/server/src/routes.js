import BigNumber from 'bignumber.js'
import KoaBody from 'koa-body'
import KoaRouter from 'koa-router'
import Joi from 'joi'
import Web3 from 'web3'

import notifyWhenCompleted from './utils/notify-when-completed'
import config from './config'

import {UserError} from '../../shared/errors'
import * as ErrorCodes from '../../shared/error-codes'

import {getConnection} from '../../shared/utils/connection'
import {promisifyCall} from '../../shared/utils/promisify'

import TokenContract from '../../shared/token-contract'
import ProjectContract from '../../shared/project-contract'

// Consts
const ETH_ADDRESS_REGEX = /^0x([a-fA-F0-9]{40})$/
const BIG_NUMBER_REGEX = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/

const JOI_ETH_ADDRESS = Joi.string()
  .regex(ETH_ADDRESS_REGEX)
  .required()

const JOI_BIG_NUMBER = Joi.string()
  .regex(BIG_NUMBER_REGEX)
  .required()

const JOI_STATUS_MAP = Joi.object().pattern(ETH_ADDRESS_REGEX, Joi.number().required())

const router = KoaRouter()
const koaBody = KoaBody()

// Public API
// GET wallet-address
router.get('/api/wallet-address', async ctx => {
  console.log('[/api/wallet-address]')

  const {account: address} = await getConnection()

  ctx.body = {address}
})

// GET check-balances/:address?tokenAddress=0x436e362ac2c1d5f88986b7553395746446922be2
router.get('/api/check-balances/:address', async ctx => {
  console.log('[/api/checkBalances]', ctx.params, ctx.request.query)

  const address = ctx.params['address']
  if (!address.match(ETH_ADDRESS_REGEX)) {
    ctx.throw(400, JSON.stringify({error: 'address is invalid'}))
  }

  const tokenAddress = ctx.request.query['tokenAddress']
  if (!tokenAddress.match(ETH_ADDRESS_REGEX)) {
    ctx.throw(400, JSON.stringify({error: 'token address is invalid'}))
  }

  const token = await TokenContract.at(tokenAddress)
  const result = await token.balanceOf(address)
  const {web3} = await getConnection()
  const ethBalance = await web3.eth.getBalance(address)
  ctx.body = {token: result, ether: ethBalance}
})

// POST deploy-contract
router.post('/api/deploy-contract', koaBody, ctx => {
  console.log('[/api/deploy-contract]', ctx.request.body)

  const schema = Joi.object().keys({
    callback: Joi.string().required(),
    payload: {
      tokenContractAddress: JOI_ETH_ADDRESS,
      clientAddress: JOI_ETH_ADDRESS,
      approvalCommissionBenificiaryAddress: JOI_ETH_ADDRESS,
      disapprovalCommissionBeneficiaryAddress: JOI_ETH_ADDRESS,
      approvalCommissionFraction: Joi.number().required(),
      disapprovalCommissionFraction: Joi.number().required(),
      totalWorkItems: Joi.number().required(),
      workItemPrice: JOI_BIG_NUMBER,
      autoApprovalTimeoutSec: Joi.number().required(),
    },
  })

  const {error, value} = Joi.validate(ctx.request.body, schema)

  if (error !== null) {
    ctx.throw(400, JSON.stringify({error: error.details[0].message}))
  }

  const {callback, payload} = ctx.request.body

  const project = ProjectContract.deploy(
    payload.tokenContractAddress, // tokenContractAddress
    payload.clientAddress, // clientAddress, equals ownerAddress here
    payload.approvalCommissionBenificiaryAddress, // approvalCommissionBenificiaryAddress
    payload.disapprovalCommissionBeneficiaryAddress, // disapprovalCommissionBeneficiaryAddress
    payload.approvalCommissionFractionThousands, // approvalCommissionFractionThousands
    payload.disapprovalCommissionFractionThousands, // disapprovalCommissionFractionThousands
    payload.totalWorkItems, // totalWorkItems
    payload.workItemPrice, // workItemPrice
    payload.autoApprovalTimeoutSec // autoApprovalTimeoutSec
  ).then(contract => ({contractAddress: contract.address}))

  const taskId = notifyWhenCompleted(callback, project)
  ctx.body = {taskId}
})

// POST update-completed-work
router.post('/api/update-completed-work', koaBody, async ctx => {
  console.log('[/api/update-completed-work]', ctx.request.body)

  const schema = Joi.object().keys({
    callback: Joi.string().required(),
    contractAddress: JOI_ETH_ADDRESS,
    payload: JOI_STATUS_MAP,
  })

  const {error, value} = Joi.validate(ctx.request.body, schema)

  if (error !== null) {
    ctx.throw(400, JSON.stringify({error: error.details[0].message}))
  }

  const {callback, contractAddress, payload} = ctx.request.body

  async function run() {
    const contract = await ProjectContract.at(contractAddress)
    await contract.updateTotals(payload)
    return {success: true, error: null}
  }

  const taskId = notifyWhenCompleted(callback, run())
  ctx.body = {taskId}
})

// GET contract-status
router.get('/api/contract-status/:address', async ctx => {
  console.log('[/api/contract-status]', ctx.params)

  const address = ctx.params['address']
  if (!address.match(ETH_ADDRESS_REGEX)) {
    ctx.throw(400, JSON.stringify({error: 'address is invalid'}))
  }
  function stateToString(state) {
    switch(state) {
      case 0: return "NEW"
      case 1: return "ACTIVE"
      case 2: return "FINALIZED"
      default: return state
    }
  }

  try {
    const contract = await ProjectContract.at(address)
    ctx.body = await contract.describe().then(r => {
      const {state, performance, ...other} = r
      return {
        "state": stateToString(state),
        "workers": performance,
        ...other,
      }
    })
  } catch (err) {
    if (err.code === ErrorCodes.CONTRACT_NOT_FOUND) {
      ctx.throw(404, JSON.stringify({error: err.message}))
    } else {
      ctx.throw(400, JSON.stringify({error: err.message}))
    }
  }
})

// POST force-finalize
router.post('/api/force-finalize', koaBody, ctx => {
  console.log('[/api/force-finalize]', ctx.request.body)

  const schema = Joi.object().keys({
    callback: Joi.string().required(),
    contractAddress: JOI_ETH_ADDRESS,
  })

  const {error, value} = Joi.validate(ctx.request.body, schema)

  if (error !== null) {
    ctx.throw(400, JSON.stringify({error: error.details[0].message}))
  }

  const {callback, contractAddress} = ctx.request.body

  async function run() {
    const contract = await ProjectContract.at(contractAddress)
    await contract.forceFinalize()
    return {success: true, error: null}
  }

  const taskId = notifyWhenCompleted(callback, run())
  ctx.body = {taskId}
})

// POST credit-account
router.post('/api/credit-account', koaBody, ctx => {
  console.log('[/api/credit-account]', ctx.request.body)

  const schema = Joi.object().keys({
    callback: Joi.string().required(),
    payload: {
      tokenContractAddress: JOI_ETH_ADDRESS,
      recepientAddress: JOI_ETH_ADDRESS,
      etherValue: JOI_BIG_NUMBER,
      tokenValue: JOI_BIG_NUMBER,
    },
  })

  const {error, value} = Joi.validate(ctx.request.body, schema)

  if (error !== null) {
    ctx.throw(400, JSON.stringify({error: error.details[0].message}))
  }

  const {
    callback,
    payload: {tokenContractAddress, recepientAddress, tokenValue, etherValue},
  } = ctx.request.body

  async function run() {
    const token = await TokenContract.at(tokenContractAddress)
    await token.transfer(recepientAddress, tokenValue)

    const {web3, account} = await getConnection()

    const balance = await promisifyCall(web3.eth.getBalance, web3.eth, [account])
    if (new BigNumber('' + balance).lt(etherValue)) {
      throw new UserError(`balance of address ${account} is insufficient to deploy this contract`,
        ErrorCodes.INSUFFICIENT_ETHER_BALANCE)
    }

    const etherSentPromise = promisifyCall(web3.eth.sendTransaction, web3.eth, [{
      from: account,
      to: recepientAddress,
      value: etherValue,
    }])

    try {
      await etherSentPromise
    } catch (err) {
      throw new UserError(err.message, ErrorCodes.TRANSACTION_FAILED)
    }

    return {success: true, error: null}
  }

  const taskId = notifyWhenCompleted(callback, run())
  ctx.body = {taskId}
})

// Internal API - FOR TESTING purposes only

if (config.isTestRun) {

  const JOI_WORK_MAP = Joi.object().pattern(ETH_ADDRESS_REGEX, {
    approvedItems: Joi.number().required(),
    declinedItems: Joi.number().required(),
  })

  // POST _activateContract
  router.post('/api/_activateContract', koaBody, async ctx => {
    console.log('[/api/_activateContract]', ctx.request.body)

    const schema = Joi.object().keys({
      actorAddress: JOI_ETH_ADDRESS,
      contractAddress: JOI_ETH_ADDRESS,
    })

    const {error, value} = Joi.validate(ctx.request.body, schema)

    if (error !== null) {
      ctx.throw(400, JSON.stringify({error: error.details[0].message}))
    }

    const {actorAddress, contractAddress} = ctx.request.body

    let contract
    try {
      let token = await TokenContract.at("0x436e362ac2c1d5f88986b7553395746446922be2")
      await token.transfer(contractAddress, 1000)
      contract = await ProjectContract.at(contractAddress)
      await contract.activate()
    } catch (err) {
      console.log(err.message, err.code)
      if (err.code === ErrorCodes.INSUFFICIENT_ETHER_BALANCE) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      if (err.code === ErrorCodes.INSUFFICIENT_TOKEN_BALANCE) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      if (err.code === ErrorCodes.CONTRACT_NOT_FOUND) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      throw err
    }

    ctx.body = {status: 'ok'}
  })

  // POST _scoreWork
  router.post('/api/_scoreWork', koaBody, async ctx => {
    console.log('[/api/_scoreWork]', ctx.request.body)

    const schema = Joi.object().keys({
      actorAddress: JOI_ETH_ADDRESS,
      contractAddress: JOI_ETH_ADDRESS,
      workers: JOI_WORK_MAP,
    })

    const {error, value} = Joi.validate(ctx.request.body, schema)

    if (error !== null) {
      ctx.throw(400, JSON.stringify({error: error.details[0].message}))
    }

    const {actorAddress, contractAddress, workers} = ctx.request.body

    try {
      const contract = await ProjectContract.at(contractAddress)
      await contract.updatePerformance(workers)
    } catch (err) {
      console.log(err.message, err.code)
      if (err.code === ErrorCodes.INSUFFICIENT_ETHER_BALANCE) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      if (err.code === ErrorCodes.CONTRACT_NOT_FOUND) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      throw err
    }

    ctx.body = {status: 'ok'}
  })

  router.post('/api/_finalizeContract', koaBody, async ctx => {
    console.log('[/api/_finalizeContract]', ctx.request.body)

    const schema = Joi.object().keys({
      actorAddress: JOI_ETH_ADDRESS,
      contractAddress: JOI_ETH_ADDRESS,
    })

    const {error, value} = Joi.validate(ctx.request.body, schema)

    if (error !== null) {
      ctx.throw(400, JSON.stringify({error: error.details[0].message}))
    }
    const {actorAddress, contractAddress} = ctx.request.body

    try {
      const contract = await ProjectContract.at(contractAddress)
      await contract.finalize()
    } catch (err) {
      console.log(err.message, err.code)
      if (err.code === ErrorCodes.INSUFFICIENT_ETHER_BALANCE) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      if (err.code === ErrorCodes.CONTRACT_NOT_FOUND) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      throw err
    }

    ctx.body = {status: 'ok'}
  })


  router.post('/api/_test-callback', koaBody, ctx => {
    console.log('POST /api/_test-callback:', ctx.request.body)
    ctx.body = {ok: true}
  })

  console.log(`GG_SERVER_TEST_RUN is enabled`)
}

export {router}
