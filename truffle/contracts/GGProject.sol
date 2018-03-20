pragma solidity ^0.4.17;

import "./ERC20.sol";
import "./SafeMath.sol";


contract GGProject {
  using SafeMath for uint256;

  event Activated();
  event UpdatedPerformance();
  event Finalized();

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
  uint64 public lastClientActivity;
  uint256 public workItemPrice;

  struct ContractorPerformance {
    bool isSet;
    uint32 totalItems;
    uint32 approvedItems;
    uint32 declinedItems;
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
    uint256 _approvalCommissionFractionThousands,
    uint256 _disapprovalCommissionFractionThousands,
    uint256 _totalWorkItems,
    uint256 _workItemPrice,
    uint256 _autoApprovalTimeoutSec
  ) public {
    require(_tokenContractAddress != 0);
    require(_clientAddress != 0);
    require(_approvalCommissionBenificiaryAddress != 0);
    require(_disapprovalCommissionBeneficiaryAddress != 0);

    require(_approvalCommissionFractionThousands <= 1000);
    require(_disapprovalCommissionFractionThousands <= 1000);

    require(_totalWorkItems < 2 ** 32);
    require(_autoApprovalTimeoutSec < 2 ** 32);

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
    uint256 tokenBalance = getTokenBalance();
    uint256 requiredInitialTokenBalance = getRequiredInitialTokenBalance();

    require(tokenBalance >= requiredInitialTokenBalance);

    state = State.Active;
    lastClientActivity = getTimestamp();
    Activated();
  }

  function describe() external view returns (
    State _state,
    uint256 _totalWorkItems,
    uint256 _workItemPrice,
    uint256 _tokenBalance,
    uint256 _workItemsBalance,
    uint256 _workItemsLeft,
    uint256 _requiredInitialTokenBalance,
    bool _canFinalize,
    bool _canForceFinalize,
    uint256 _canForceFinalizeAt
  ) {
    _state = state;
    _totalWorkItems = totalWorkItems;
    _workItemPrice = workItemPrice;
    _tokenBalance = getTokenBalance();
    _workItemsBalance = getWorkItemsBalance();
    _workItemsLeft = getWorkItemsLeft();
    _requiredInitialTokenBalance = getRequiredInitialTokenBalance();
    _canFinalize = getCanFinalize();
    _canForceFinalize = getCanForceFinalize();
    _canForceFinalizeAt = getCanForceFinalizeAt();
  }

  function getRequiredInitialTokenBalance() public view returns (uint256) {
    return workItemPrice.mul(totalWorkItems);
  }

  function getTokenBalance() public view returns (uint256) {
    return tokenContract.balanceOf(address(this));
  }

  function getWorkItemsBalance() public view returns (uint256) {
    return getTokenBalance().div(workItemPrice);
  }

  /**
   * How many items are either already approved or awaiting client review. That is,
   * how many items we can additionally distribute between contractors at the moment.
   */
  function getWorkItemsLeft() public view returns (uint256) {
    uint32 totalApprovedItems;
    uint32 totalPendingItems;
    (totalApprovedItems, totalPendingItems) = _getPerformanceTotals();
    // We know this won't wrap around zero, see comments in _getPerformanceTotals.
    return totalWorkItems - totalApprovedItems - totalPendingItems;
  }

  function getCanFinalize() public view returns (bool) {
    uint32 totalPendingItems;
    (, totalPendingItems) = _getPerformanceTotals();
    return totalPendingItems == 0;
  }

  function getCanForceFinalizeAt() public view returns (uint64) {
    return lastClientActivity + autoApprovalTimeoutSec;
  }

  function getCanForceFinalize() public view returns (bool) {
    return getTimestamp() >= getCanForceFinalizeAt();
  }

  function getPerformance() external view returns (address[], uint256[], uint256[], uint256[]) {
    uint256 totalContractors = contractors.length;

    uint256[] memory totalItems = new uint256[](totalContractors);
    uint256[] memory approvedItems = new uint256[](totalContractors);
    uint256[] memory declinedItems = new uint256[](totalContractors);

    for (uint256 i = 0; i < totalContractors; i++) {
      address addr = contractors[i];
      ContractorPerformance storage perf = performanceByContractor[addr];
      totalItems[i] = perf.totalItems;
      approvedItems[i] = perf.approvedItems;
      declinedItems[i] = perf.declinedItems;
    }

    return (contractors, totalItems, approvedItems, declinedItems);
  }

  function updateTotals(address[] contractorAddrs, uint256[] totalItems) public
    allowOnly(owner)
    atState(State.Active)
  {
    require(contractorAddrs.length == totalItems.length);

    uint256 i;

    for (i = 0; i < contractorAddrs.length; i++) {
      address addr = contractorAddrs[i];
      ContractorPerformance storage perf = performanceByContractor[addr];

      if (!perf.isSet) {
        // this is a new contractor
        perf.isSet = true;
        contractors.push(addr);
      }

      uint256 newTotalItems = totalItems[i];

      require(newTotalItems >= perf.totalItems);
      require(newTotalItems < 2 ** 32);

      perf.totalItems = uint32(newTotalItems);
    }

    // We need to ensure that, after calling updateTotals, we don't end up in a situation
    // when, if client later approves everything, the total number of approved items will
    // exceed totalWorkItems. This means that total number of either approved or pending
    // items should not exceed totalWorkItems.

    uint256 totalApprovedItems;
    uint256 totalPendingItems;
    (totalApprovedItems, totalPendingItems) = _getPerformanceTotals();

    require(totalApprovedItems + totalPendingItems <= totalWorkItems);
    UpdatedPerformance();
  }

  function updatePerformance(
    address[] contractorAddrs,
    uint256[] approvedItems,
    uint256[] declinedItems
  ) public
    allowOnly(client)
    atState(State.Active)
  {
    require(contractorAddrs.length == approvedItems.length);
    require(contractorAddrs.length == declinedItems.length);

    for (uint256 i = 0; i < contractorAddrs.length; i++) {
      address addr = contractorAddrs[i];
      ContractorPerformance storage perf = performanceByContractor[addr];

      // require that contractor is already known from previous updateTotals() call
      require(perf.isSet);

      uint256 newApprovedItems = approvedItems[i];
      uint256 newDeclinedItems = declinedItems[i];

      require(newApprovedItems >= perf.approvedItems);
      require(newDeclinedItems >= perf.declinedItems);

      uint256 newTotalItems = newApprovedItems.add(newDeclinedItems);
      require(newTotalItems == perf.totalItems);

      uint256 dApprovedItems = newApprovedItems - perf.approvedItems;
      uint256 dDeclinedItems = newDeclinedItems - perf.declinedItems;

      if (dApprovedItems != 0) {
        uint256 totalFeeAmount = workItemPrice.mul(dApprovedItems);
        _splitTransferTokens(
          totalFeeAmount,
          approvalCommissionFractionThousands,
          approvalCommissionBenificiary,
          addr
        );
      }

      if (dDeclinedItems != 0) {
        uint256 commissionAmount = workItemPrice
          .mul(dDeclinedItems)
          .mul(disapprovalCommissionFractionThousands)
          .div(1000);
        require(tokenContract.transfer(disapprovalCommissionBeneficiary, commissionAmount));
      }

      // We know both these numbers fit into uint32 since their sum
      // equals to perf.totalItems, which is itself uint32.
      perf.approvedItems = uint32(newApprovedItems);
      perf.declinedItems = uint32(newDeclinedItems);
    }

    lastClientActivity = getTimestamp();
    UpdatedPerformance();
  }

  function finalize() public allowOnly(client) atState(State.Active) {
    require(getCanFinalize());
    _finalizeAndRefundClient();
  }

  function forceFinalize() public atState(State.Active) {
    require(getCanForceFinalize());

    for (uint256 i = 0; i < contractors.length; i++) {
      address contractorAddr = contractors[i];
      ContractorPerformance storage perf = performanceByContractor[contractorAddr];
      uint32 pendingItems = perf.totalItems - perf.approvedItems - perf.declinedItems;
      if (pendingItems > 0) {
        perf.approvedItems += pendingItems;
        uint256 totalFeeAmount = workItemPrice.mul(pendingItems);
        _splitTransferTokens(
          totalFeeAmount,
          approvalCommissionFractionThousands,
          approvalCommissionBenificiary,
          contractorAddr
        );
      }
    }

    _finalizeAndRefundClient();
  }

  function _splitTransferTokens(
    uint256 amount,
    uint256 fractionThousandsA,
    address addressA,
    address addressB
  ) internal
  {
    uint256 amountA = amount.mul(fractionThousandsA).div(1000);
    uint256 amountB = amount.sub(amountA);
    if (amountA > 0) {
      require(tokenContract.transfer(addressA, amountA));
    }
    if (amountB > 0) {
      require(tokenContract.transfer(addressB, amountB));
    }
  }

  function _finalizeAndRefundClient() internal {
    state = State.Finalized;
    _refundClient();
    Finalized();
  }

  function _refundClient() internal {
    uint256 tokenBalance = getTokenBalance();
    if (tokenBalance > 0) {
      assert(tokenContract.transfer(client, tokenBalance));
    }
  }

  // Returns (uint32 totalApprovedItems, uint32 totalPendingItems).
  //
  function _getPerformanceTotals() internal view returns (uint32, uint32) {
    uint32 totalApprovedItems = 0;
    uint32 totalPendingItems = 0;

    for (uint256 i = 0; i < contractors.length; i++) {
      ContractorPerformance storage perf = performanceByContractor[contractors[i]];
      // We know that sum of approvedItems and declinedItems is less than or equal to
      // totalItems since we're checking this in updatePerformance, which is the only
      // place these values get updated.
      uint32 pendingItems = perf.totalItems - perf.approvedItems - perf.declinedItems;
      // We know that sum of perf.totalItems for all contractors is less than totalWorkItems,
      // which is uint32, since we're checking this in updateTotals, which is the only place
      // perf.totalItems get updated. So we know that both sum of all perf.approvedItems and
      // and sum of all pendingItems fit into uint32, since both of these values are less
      // than or equal to perf.totalItems (see above).
      totalApprovedItems += perf.approvedItems;
      totalPendingItems += pendingItems;
    }

    return (totalApprovedItems, totalPendingItems);
  }

  // We can rely on the value of block.timestamp for our purposes, as the consensus
  // rule is that a block's timestamp must be 1) more than the parent's block timestamp;
  // and 2) less than the current wall clock time. See:
  // https://github.com/ethereum/go-ethereum/blob/885c13c/consensus/ethash/consensus.go#L223
  //
  function getTimestamp() internal view returns (uint64) {
    return uint64(block.timestamp);
  }
}
