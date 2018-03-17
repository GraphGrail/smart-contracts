var GraphGrailToken = artifacts.require('./GraphGrailToken.sol')
var SafeMath = artifacts.require('./SafeMath.sol')

module.exports = function(deployer) {
  deployer.link(SafeMath, GraphGrailToken)
  deployer.deploy(GraphGrailToken)
}
