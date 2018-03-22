// Run like this:
//
// cd <project root>/local-dev-net
// ./run-geth
//
// In second terminal:
//
// cd <project root>
// ./run-with-babel ethereum-bridge/contact-api-playground.js

import Web3 from 'web3'

import {setWeb3Promise, getConnection} from './shared/utils/connection'

import ProjectContract from './shared/project-contract'
import TokenContract from './shared/token-contract'


async function getWeb3() {
  const provider = new Web3.providers.HttpProvider('http://127.0.0.1:9545')
  return new Web3(provider)
}


setWeb3Promise(getWeb3())


async function test() {
  const {account, accounts} = await getConnection()
  console.log(`account:`, account)

  info(`Deploying GraphGrailToken contract...`)

  const {address: tokenAddress} = await TokenContract.deploy()
  console.log(`token address:`, tokenAddress)

  const token = await TokenContract.at(tokenAddress)
  const balance = await token.balanceOf(account)
  console.log(`balance of ${account}: ${balance}`)

  info(`Deploying GGProject contract...`)

  const project = await ProjectContract.deploy(
    token.address, // tokenContractAddress
    account, // clientAddress, equals ownerAddress here
    accounts[8], // approvalCommissionBenificiaryAddress
    accounts[9], // disapprovalCommissionBeneficiaryAddress
    100, // approvalCommissionFractionThousands
    200, // disapprovalCommissionFractionThousands
    100, // totalWorkItems
    10, // workItemPrice
    60, // autoApprovalTimeoutSec
  )

  console.log(`project address:`, project.address)
  console.log(`project state:`, stringifyState(await project.describe()))

  info(`Transferring tokens to project...`)

  await token.transfer(project.address, 1000)
  console.log(`project state:`, stringifyState(await project.describe()))

  info(`Activating project...`)

  await project.activate()
  console.log(`project state:`, stringifyState(await project.describe()))

  info(`Updating totals...`)

  await project.updateTotals({
    '0x0f4f2ac550a1b4e2280d04c21cea7ebd822934b5': 1,
    '0x6330a553fc93768f612722bb8c2ec78ac90b3bbc': 2,
  })
  console.log(`project state:`, stringifyState(await project.describe()))

  info(`Updating performance...`)

  await project.updatePerformance({
    '0x0f4f2ac550a1b4e2280d04c21cea7ebd822934b5': {approvedItems: 1, declinedItems: 0},
    '0x6330a553fc93768f612722bb8c2ec78ac90b3bbc': {approvedItems: 1, declinedItems: 1},
  })
  console.log(`project state:`, stringifyState(await project.describe()))

  info(`Finalizing project...`)

  await project.finalize()
  console.log(`project state:`, stringifyState(await project.describe()))
}


test().catch(err => console.log(err.stack))


function info(...args) {
  console.log(`\n==>`, ...args, '\n')
}

function stringifyState(performanceMap) {
  return JSON.stringify(performanceMap, null, '  ')
}
