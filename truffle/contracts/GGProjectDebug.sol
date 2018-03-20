pragma solidity ^0.4.17;

import "./GGProject.sol";

contract GGProjectDebug is GGProject {

  function GGProjectDebug(
    address _tokenContractAddress,
    address _clientAddress,
    address _approvalCommissionBenificiaryAddress,
    address _disapprovalCommissionBeneficiaryAddress,
    uint256 _approvalCommissionFractionThousands,
    uint256 _disapprovalCommissionFractionThousands,
    uint256 _totalWorkItems,
    uint256 _workItemPrice,
    uint256 _autoApprovalTimeoutSec
  ) GGProject(
    _tokenContractAddress,
    _clientAddress,
    _approvalCommissionBenificiaryAddress,
    _disapprovalCommissionBeneficiaryAddress,
    _approvalCommissionFractionThousands,
    _disapprovalCommissionFractionThousands,
    _totalWorkItems,
    _workItemPrice,
    _autoApprovalTimeoutSec
  ) public {}

  uint64 public debugTimestamp = 42;

  function increaseTimeBy(uint64 sec) external {
    debugTimestamp += sec;
  }

  function getTimestamp() internal view returns (uint64) {
    return debugTimestamp;
  }
}
