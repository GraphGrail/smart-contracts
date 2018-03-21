# GraphGrail smart contract

The project contains code of GraphGrail data labelling escrow smart contract and its test suite.

Smart contract is written in Solidity v. 0.4.17. JavaScript helpers and a test suite use Truffle v. 4.1.3.

To run tests and backend server `geth` v. 1.8.2 or later is required. It also should work with latest Parity.

## Repository structure

Repository contains smart contract code and utils for build and deployment, tests written with Truffle, data and scripts for running local `geth` in development mode for testing purposes, and JavaScript code for interaction with smart contract.

[`truffle`](/truffle) is a folder with Truffle development environment. Escrow smart contract code resides in [`truffle/contracts/GGProject.sol`](/truffle/contracts/GGProject.sol), [`truffle/migrations`](/truffle/migrations) folder contains code for smart contract deployment, [`truffle/test`](truffle/test) is where all the tests are.

[`local-dev-net`](/local-dev-net) is the folder with scripts and seed data required for running local `geth` in development mode.

[`ethereum-bridge`](/ethereum-bridge) folder contains JavaScript code of client and server for interacting with GraphGrail escrow and token smart contracts: [`ethereum-bridge/client`](/ethereum-bridge/client) contains code of frontend library, and [`ethereum-bridge/server`](/ethereum-bridge/server) contains implementation of Node.js backend server providing REST API. Some code is shared between frontend, backend and smart contract tests; it resides in [`ethereum-bridge/shared`](/ethereum-bridge/shared) subdirectory.

## Development setup

Prior to developing or running tests, you need to install dependencies:

```
cd <project-root>
./install-deps.sh
```

## Running tests with TestRPC

GraphGrail escrow smart contract has a test suite. To run it against TestRPC virtual blockchain just run `npm test`:

```
cd ./truffle
npm test
```

## Running tests against local geth node

To run test suite against real Ethereum node, furst run local `geth` in dev mode:

```
cd ./local-dev-net
./run-geth.sh
```

This will set up local testing Ethereum network and populate it with seed accounts and balances specified in blockchain dump `./local-dev-net/blockchain.tar.gz`. After having successfully running `geth` node, run `npm test-local`:

```
cd ./truffle
npm test-local
```
