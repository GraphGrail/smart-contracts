# GraphGrail smart contract

The project contains code of GraphGrail data labelling escrow Smart Contract and its test suite.

Smart Contract is written in Solidity v. 0.4.17. JavaScript helpers and a test suite use truffle v. 4.1.3.

## Repository structure

Repository contains Smart Contract code and truffle utils for build and deployment, tests written with truffle, data and scripts for running local geth in development mode for testing purposes, and JavaScript code for interaction with Smart Contract through `web3` library.

`truffle` is folder with truffle development environment; escrow Smart Contract code resides in `truffle/contracts/GGProject.sol`, `truffle/migrations` folder contains code for Smart Contract deployment with truffle migration utils, `truffle/test` is where all the tests are. 

`local-dev-net` is the folder with scripts and seed data required for running local geth in development mode.

`ethereum-bridge` folder contains JavaScript utils for writing client and server libraries interacting with GraphGrail escrow Smart Contract.

## Running tests with `test-rpc`

GraphGrail escrow Smart Contract has a test suite. In order to run it against `test-rpc` you should do:

```
cd ./truffle
npm install
npm test
```

## Running tests against local geth node

To run test suite against real Ethereum node, run local geth in dev mode with script `./local-dev-net/run-geth.sh`. It will run your geth in development mode, which will set up local testing Ethereum network and populate it with seed accounts and balances specified in blockchain dump `./local-dev-net/blockchain.tar.gz`. After having successfully running `geth` node, use commands:

```
cd ./truffle
npm install
npm test-local
```
