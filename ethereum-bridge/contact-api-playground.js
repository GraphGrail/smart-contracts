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
  const {account} = await getConnection()

  const token = await TokenContract.deployed()
  const balance = await token.balanceOf(account)

  console.log(`balance of ${account}: ${balance}`)

  const project = await ProjectContract.deploy(
    token.address,
    account,
    '0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef',
    '0x821aea9a577a9b44299b9c15c88cf3087f3b5544',
    100,
    200,
    100,
    10,
    60,
  )

  await token.transfer(project.address, 1000)

  const state1 = await project.getState()
  console.log(`state1:`, state1)

  const data = await project.activate()

  const state2 = await project.getState()
  console.log(`state2:`, state2)
}


test().catch(err => console.log(err.stack))

