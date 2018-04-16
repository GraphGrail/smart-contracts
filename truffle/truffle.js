require('babel-register')

const GAS_LIMIT = 4712388
const GWEI = 1000000000

const RINKEBY_GAS_LIMIT = 6650000
const RINKEBY_GAS_PRICE = 20 * GWEI
const RINKEBY_DEPLOY_FROM = "0x389ED518dcaA84F55C74032e446205555cb94fC7"

module.exports = {
  networks: {
    local: {
      host: 'localhost',
      port: 9545,
      network_id: 1337,
      gas: GAS_LIMIT,
      gasPrice: 1 * GWEI,
    },
    rinkeby: {
      host: 'localhost',
      port: 8545,
      network_id: 4,
      gas: RINKEBY_GAS_LIMIT,
      gasPrice: RINKEBY_GAS_PRICE,
      from: RINKEBY_DEPLOY_FROM,
    },
    live: {
      host: 'localhost',
      port: 8545,
      network_id: 1,
      gas: GAS_LIMIT,
      gasPrice: 1 * GWEI,
    },
  }
};
