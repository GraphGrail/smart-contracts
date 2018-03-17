var SafeMath = artifacts.require('./SafeMath.sol')
var GGProject = artifacts.require('./GGProject.sol')

module.exports = function(deployer) {
  deployer.link(SafeMath, GGProject)
}
