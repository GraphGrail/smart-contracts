const Web3 = require('web3');

var Migrations = artifacts.require('./Migrations.sol');

module.exports = function(deployer, network, addresses) {
  if (process.env.ACCOUNT_PASSWORD) {
    const web3 = new Web3(new Web3.providers.HttpProvider('http://geth:8545'));

    console.log('>> Unlocking account 0x389ED518dcaA84F55C74032e446205555cb94fC7');
    web3.personal.unlockAccount('0x389ED518dcaA84F55C74032e446205555cb94fC7', process.env.ACCOUNT_PASSWORD);
  }

  console.log('>> Deploying migration');
  deployer.deploy(Migrations);
};
