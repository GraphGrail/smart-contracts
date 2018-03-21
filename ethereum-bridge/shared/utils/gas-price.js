import {promisifyCall} from './promisify'
import {getConnection} from './connection'

export async function getGasPrice() {
  const {web3} = await getConnection()
  const gasPrice = await promisifyCall(web3.eth.getGasPrice, web3.eth)
  return Number(gasPrice)
}
