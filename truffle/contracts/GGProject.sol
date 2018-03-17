pragma solidity ^0.4.17;

import "./ERC20.sol";


contract GGProject {

  enum State {
    New,
    Active,
    Finalized
  }

  uint16 public constant VERSION = 1;
  State public state = State.New;

  address public owner = msg.sender;
  address public client;
  ERC20 public tokenContract;
  address public approvalCommissionBenificiary;
  address public disapprovalCommissionBeneficiary;

  uint16 public approvalCommissionFractionThousands;
  uint16 public disapprovalCommissionFractionThousands;
  uint32 public totalWorkItems;
  uint32 public autoApprovalTimeoutSec;
  uint public workItemPrice;

  struct ContractorPerformance {
    bool isSet;
    uint16 totalItems;
    uint16 approvedItems;
    uint16 declinedItems;
  }

  mapping(address => ContractorPerformance) public performanceByContractor;
  address[] public contractors;

  modifier atState(State _state) {
    require(state == _state);
    _;
  }

  modifier allowOnly(address callerAddress) {
    require(msg.sender == callerAddress);
    _;
  }

  function GGProject(
    address _tokenContractAddress,
    address _clientAddress,
    address _approvalCommissionBenificiaryAddress,
    address _disapprovalCommissionBeneficiaryAddress,
    uint _approvalCommissionFractionThousands,
    uint _disapprovalCommissionFractionThousands,
    uint _totalWorkItems,
    uint _workItemPrice,
    uint _autoApprovalTimeoutSec
  ) public {
    require(_tokenContractAddress != 0);
    require(_clientAddress != 0);
    require(_approvalCommissionBenificiaryAddress != 0);
    require(_disapprovalCommissionBeneficiaryAddress != 0);

    require(_approvalCommissionFractionThousands <= 1000);
    require(_disapprovalCommissionFractionThousands <= 1000);

    require(_totalWorkItems < 4294967296); // 2^32
    require(_autoApprovalTimeoutSec < 4294967296); // 2^32

    client = _clientAddress;
    tokenContract = ERC20(_tokenContractAddress);
    approvalCommissionBenificiary = _approvalCommissionBenificiaryAddress;
    disapprovalCommissionBeneficiary = _disapprovalCommissionBeneficiaryAddress;

    approvalCommissionFractionThousands = uint16(_approvalCommissionFractionThousands);
    disapprovalCommissionFractionThousands = uint16(_disapprovalCommissionFractionThousands);

    totalWorkItems = uint32(_totalWorkItems);
    workItemPrice = _workItemPrice;
    autoApprovalTimeoutSec = uint32(_autoApprovalTimeoutSec);
  }

  function activate() public allowOnly(client) atState(State.New) {
    // TODO
    state = State.Active;
  }

  function getTokenBalance() public view returns (uint) {
    // TODO
    return 0;
  }

  function getWorkItemsBalance() public view returns (uint) {
    // TODO
    return 0;
  }

  function getWorkItemsLeft() public view returns (uint) {
    // TODO
    return 0;
  }

  function getCanForceFinalize() public view returns (bool) {
    // TODO
    return false;
  }

  function getPerformance() external view returns (address[], uint[], uint[], uint[]) {
    uint totalContractors = contractors.length;

    uint[] memory totalItems = new uint[](totalContractors);
    uint[] memory approvedItems = new uint[](totalContractors);
    uint[] memory declinedItems = new uint[](totalContractors);

    for (uint i = 0; i < totalContractors; i++) {
      address addr = contractors[i];
      ContractorPerformance storage perf = performanceByContractor[addr];
      totalItems[i] = perf.totalItems;
      approvedItems[i] = perf.approvedItems;
      declinedItems[i] = perf.declinedItems;
    }

    return (contractors, totalItems, approvedItems, declinedItems);
  }

  function updateTotals(address[] contractorAddrs, uint16[] totalItems) public allowOnly(owner) {
    require(contractorAddrs.length == totalItems.length);

    for (uint i = 0; i < contractorAddrs.length; i++) {
      address addr = contractorAddrs[i];
      ContractorPerformance storage perf = performanceByContractor[addr];

      if (!perf.isSet) {
        perf.isSet = true;
        contractors.push(addr);
      }

      perf.totalItems = totalItems[i];
    }
  }

  function updatePerformance(
    address[] contractorAddrs,
    uint16[] approvedItems,
    uint16[] declinedItems
  ) public
    allowOnly(client)
  {
    require(contractorAddrs.length == approvedItems.length);
    require(contractorAddrs.length == declinedItems.length);

    for (uint i = 0; i < contractorAddrs.length; i++) {
      address addr = contractorAddrs[i];
      ContractorPerformance storage perf = performanceByContractor[addr];
      require(perf.isSet);
      perf.approvedItems = approvedItems[i];
      perf.declinedItems = declinedItems[i];
    }
  }

  function finalize() public allowOnly(client) atState(State.Active) {
    // TODO
    state = State.Finalized;
  }

  function forceFinalize() public atState(State.Active) {
    // TODO
    state = State.Finalized;
  }

}
