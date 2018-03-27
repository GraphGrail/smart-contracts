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

function logRequest(ctx) {
  ctx.log.info({
    params: ctx.params,
    query: ctx.request.query,
    body: ctx.request.body},
    'new request')
}

function logResponse(ctx, json) {
  ctx.log.info({response: json}, 'response is ready')
}

// Public API
// GET wallet-address
router.get('/api/wallet-address', async ctx => {
  logRequest(ctx)
  const {account: address} = await getConnection()
  ctx.body = {address}
  logResponse(ctx, ctx.body)
})

// GET check-balances/:address?tokenAddress=0x436e362ac2c1d5f88986b7553395746446922be2
router.get('/api/check-balances/:address', async ctx => {
  logRequest(ctx)

  const address = ctx.params['address']
  if (!address.match(ETH_ADDRESS_REGEX)) {
    ctx.throw(400, JSON.stringify({error: 'address is invalid'}))
  }

  const tokenAddress = ctx.request.query['tokenAddress']
  if (!tokenAddress) {
    ctx.throw(400, JSON.stringify({error: 'token address missed'}))
  }

  if (!tokenAddress.match(ETH_ADDRESS_REGEX)) {
    ctx.throw(400, JSON.stringify({error: 'token address is invalid'}))
  }

  const token = await TokenContract.at(tokenAddress)
  const result = await token.balanceOf(address)
  const {web3} = await getConnection()
  const ethBalance = await web3.eth.getBalance(address)
  ctx.body = {token: result, ether: ethBalance}
  logResponse(ctx, ctx.body)
})

// POST deploy-contract
router.post('/api/deploy-contract', koaBody, ctx => {
  logRequest(ctx)

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
  logResponse(ctx, ctx.body)
})

// POST update-completed-work
router.post('/api/update-completed-work', koaBody, async ctx => {
  logRequest(ctx)

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
  logResponse(ctx, ctx.body)
})

// GET contract-status
router.get('/api/contract-status/:address', async ctx => {
  logRequest(ctx)

  const address = ctx.params['address']
  if (!address.match(ETH_ADDRESS_REGEX)) {
    ctx.throw(400, JSON.stringify({error: 'address is invalid'}))
  }

  let contract
  try {
    contract = await ProjectContract.at(address)
  } catch (err) {
    if (err.code === ErrorCodes.CONTRACT_NOT_FOUND) {
      ctx.throw(404, JSON.stringify({error: err.message}))
    } else {
      ctx.throw(500, JSON.stringify({error: err.message}))
    }
  }

  const [{state, ...other}, performance] = await Promise.all([contract.describe(),
    contract.getPerformance()])

  ctx.body = {
    state: ProjectContract.State.stringify(state),
    workers: performance,
    ...other,
  }
  logResponse(ctx, ctx.body)
})

// POST force-finalize
router.post('/api/force-finalize', koaBody, ctx => {
  logRequest(ctx)

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
  logResponse(ctx, ctx.body)
})

// POST credit-account
router.post('/api/credit-account', koaBody, ctx => {
  logRequest(ctx)

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
  logResponse(ctx, ctx.body)
})

// Internal API - FOR TESTING purposes only

if (config.isTestRun) {

  const JOI_WORK_MAP = Joi.object().pattern(ETH_ADDRESS_REGEX, {
    approvedItems: Joi.number().required(),
    declinedItems: Joi.number().required(),
  })

  // POST _activateContract
  router.post('/api/_activateContract', koaBody, async ctx => {
    logRequest(ctx)

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
      if (err.code === ErrorCodes.INSUFFICIENT_ETHER_BALANCE) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      if (err.code === ErrorCodes.INSUFFICIENT_TOKEN_BALANCE) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      if (err.code === ErrorCodes.CONTRACT_NOT_FOUND) {
        ctx.throw(404, JSON.stringify({error: err.message}))
      }
      throw err
    }

    ctx.body = {status: 'ok'}
    logResponse(ctx, ctx.body)
  })

  // POST _scoreWork
  router.post('/api/_scoreWork', koaBody, async ctx => {
    logRequest(ctx)

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
      if (err.code === ErrorCodes.INSUFFICIENT_ETHER_BALANCE) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      if (err.code === ErrorCodes.CONTRACT_NOT_FOUND) {
        ctx.throw(404, JSON.stringify({error: err.message}))
      }
      throw err
    }

    ctx.body = {status: 'ok'}
    logResponse(ctx, ctx.body)
  })

  router.post('/api/_finalizeContract', koaBody, async ctx => {
    logRequest(ctx)

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
      if (err.code === ErrorCodes.INSUFFICIENT_ETHER_BALANCE) {
        ctx.throw(400, JSON.stringify({error: err.message}))
      }
      if (err.code === ErrorCodes.CONTRACT_NOT_FOUND) {
        ctx.throw(404, JSON.stringify({error: err.message}))
      }
      throw err
    }

    ctx.body = {status: 'ok'}
    logResponse(ctx, ctx.body)
  })


  router.post('/api/_test-callback', koaBody, ctx => {
    logRequest(ctx)
    ctx.body = {ok: true}
    logResponse(ctx, ctx.body)
  })
}

export {router}
