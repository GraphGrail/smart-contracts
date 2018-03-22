import BigNumber from 'bignumber.js'

import {getConnection} from './connection'
import {promisifyCall} from './promisify'

import {UserError} from '../errors'
import * as ErrorCodes from '../error-codes'


export async function assertTxSucceeds(txResultPromise) {
  const txProps = await inspectTransaction(txResultPromise)
  if (!txProps.success) {
    throw new UserError(`transaction failed`, ErrorCodes.TRANSACTION_FAILED)
  }
  return txProps
}


export async function inspectTransaction(txResultPromise) {
  const [{web3}, txResult] = await Promise.all([getConnection(), txResultPromise])
  const tx = await promisifyCall(web3.eth.getTransaction, web3.eth, [txResult.tx])
  const {receipt} = txResult
  const success = receipt.status !== undefined
    ? receipt.status === '0x1' || receipt.status === 1 // Since Byzantium fork
    : receipt.cumulativeGasUsed < tx.gas // Before Byzantium fork
  const txPriceWei = new BigNumber(tx.gasPrice).times(receipt.cumulativeGasUsed)
  const events = txResult.logs
    .map(log => log.event ? {name: log.event, args: log.args} : null)
    .filter(x => !!x)
  return {raw: txResult, success, txPriceWei, events}
}
