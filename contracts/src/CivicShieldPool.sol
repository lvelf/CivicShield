// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {
    ICivicShieldPool, Proposal, Verdict, FailReason, ProposalStatus
} from "./ICivicShieldPool.sol";

/// @title CivicShieldPool
/// @notice On-chain Permissibility Machine for a disaster-relief fund. Holds donated USDC in
///         escrow and releases it ONLY when an agent-generated proposal passes every rule in the
///         policy Pi. Generation is not permission: the agent can propose, but this contract — not
///         the agent — decides, and every decision (pass or block) is logged on-chain.
/// @dev    Evaluation order is fixed (rules 1 -> 5); executeRelease reports the FIRST failing rule
///         and, crucially, NEVER reverts on a policy failure — a blocked attack must be recorded.
contract CivicShieldPool is ICivicShieldPool, Ownable {
    using SafeERC20 for IERC20;

    // ---- immutable wiring ----
    IERC20 public immutable usdc;

    // ---- policy Pi ----
    uint8 public riskThreshold; // rule 1: riskScore must be >= this
    uint256 public maxReleasePerEvent; // rule 2: per-proposal cap
    uint256 public dailyReleaseLimit; // rule 3: trace-level cap per UTC day
    mapping(address => bool) public verifiedRecipients; // rule 4: ENS-subname allowlist (addresses)
    mapping(bytes32 => bool) public approvedPurposes; // rule 5: keccak256(purpose) allowlist

    // ---- trusted off-chain actors ----
    address public agent; // proposes (no fund keys); see proposeRelease access note
    address public relayer; // delivers CRE risk scores

    // ---- state ----
    mapping(bytes32 => uint8) private _riskScore; // eventId => score (0..100)
    Proposal[] private _proposals;
    mapping(uint256 => Verdict) private _verdicts;

    uint256 private _releasedToday; // running total of EXECUTED releases within _lastReleaseDay
    uint256 private _lastReleaseDay; // UTC day index (block.timestamp / 1 days) of last execution

    modifier onlyRelayer() {
        require(msg.sender == relayer, "not relayer");
        _;
    }

    constructor(
        address _usdc,
        address _relayer,
        uint8 _riskThreshold,
        uint256 _maxReleasePerEvent,
        uint256 _dailyReleaseLimit,
        string[] memory _approvedPurposes,
        address[] memory _verifiedRecipients
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "usdc=0");
        usdc = IERC20(_usdc);
        relayer = _relayer;
        riskThreshold = _riskThreshold;
        maxReleasePerEvent = _maxReleasePerEvent;
        dailyReleaseLimit = _dailyReleaseLimit;
        for (uint256 i = 0; i < _approvedPurposes.length; i++) {
            approvedPurposes[purposeHash(_approvedPurposes[i])] = true;
        }
        for (uint256 i = 0; i < _verifiedRecipients.length; i++) {
            verifiedRecipients[_verifiedRecipients[i]] = true;
        }
    }

    // ---------------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------------

    /// @inheritdoc ICivicShieldPool
    /// @dev Permissionless on purpose: anyone (including a manipulated agent or an attacker) may
    ///      propose. Safety lives at executeRelease, not here — "generation is not permission".
    function proposeRelease(Proposal calldata p) external returns (uint256 id) {
        id = _proposals.length;
        _proposals.push(p);
        _verdicts[id] = Verdict({status: ProposalStatus.PENDING, passed: false, failReason: FailReason.NONE});
        emit ProposalCreated(id, p.recipient, p.amount, p.purpose, p.eventId);
    }

    /// @inheritdoc ICivicShieldPool
    /// @dev Permissionless: the policy gates the money, not the caller. Idempotent guard prevents
    ///      re-evaluating an already-settled proposal.
    function executeRelease(uint256 id) external {
        require(id < _proposals.length, "bad id");
        Verdict storage v = _verdicts[id];
        require(v.status == ProposalStatus.PENDING, "already settled");
        Proposal storage p = _proposals[id];

        FailReason reason = _evaluate(p);

        if (reason != FailReason.NONE) {
            // BLOCKED — record it, log it, do NOT revert. The attack is now on-chain.
            v.status = ProposalStatus.BLOCKED;
            v.passed = false;
            v.failReason = reason;
            emit ActionEvaluated(id, p.recipient, p.amount, p.purpose, false, reason);
            return;
        }

        // PASSED — commit the trace-level daily total, then move the money.
        _accrueDaily(p.amount);
        v.status = ProposalStatus.EXECUTED;
        v.passed = true;
        v.failReason = FailReason.NONE;
        emit ActionEvaluated(id, p.recipient, p.amount, p.purpose, true, FailReason.NONE);
        usdc.safeTransfer(p.recipient, p.amount);
    }

    /// @inheritdoc ICivicShieldPool
    function submitRiskScore(bytes32 eventId, uint8 score) external onlyRelayer {
        require(score <= 100, "score>100");
        _riskScore[eventId] = score;
        emit RiskScoreSubmitted(eventId, score);
    }

    /// @inheritdoc ICivicShieldPool
    /// @dev `donor` is recorded for the Transparency Log; it is NOT msg.sender. When the deposit
    ///      arrives via LI.FI Composer, msg.sender is LI.FI's executor contract (which has been
    ///      approved to move the swapped USDC) — recording it would attribute every Composer
    ///      donation to the same LI.FI address. The frontend encodes the connected wallet as
    ///      `donor` in the contract-call calldata so "donors verify" holds. Attribution is a label,
    ///      not fund-bearing: funds always move from msg.sender via transferFrom.
    function donate(uint256 amount, address donor) external {
        require(amount > 0, "amount=0");
        require(donor != address(0), "donor=0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Donated(donor, amount);
    }

    // ---------------------------------------------------------------------
    // Policy evaluation (rules 1 -> 5, first failure wins)
    // ---------------------------------------------------------------------

    function _evaluate(Proposal storage p) internal view returns (FailReason) {
        // rule 1: real-world hazard signal must clear the threshold
        if (_riskScore[p.eventId] < riskThreshold) return FailReason.RISK_BELOW_THRESHOLD;
        // rule 2: per-event cap
        if (p.amount > maxReleasePerEvent) return FailReason.AMOUNT_OVER_EVENT_CAP;
        // rule 3: trace-level daily cap (blocks split-payment composition attacks)
        if (_effectiveReleasedToday() + p.amount > dailyReleaseLimit) return FailReason.DAILY_LIMIT_EXCEEDED;
        // rule 4: recipient must be a verified (ENS-subname) address
        if (!verifiedRecipients[p.recipient]) return FailReason.RECIPIENT_NOT_VERIFIED;
        // rule 5: purpose must be approved
        if (!approvedPurposes[p.purpose]) return FailReason.PURPOSE_NOT_APPROVED;
        return FailReason.NONE;
    }

    /// @dev releasedToday, accounting for UTC-day rollover without needing a separate reset tx.
    function _effectiveReleasedToday() internal view returns (uint256) {
        return (block.timestamp / 1 days == _lastReleaseDay) ? _releasedToday : 0;
    }

    function _accrueDaily(uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        if (today != _lastReleaseDay) {
            _lastReleaseDay = today;
            _releasedToday = 0;
        }
        _releasedToday += amount;
    }

    // ---------------------------------------------------------------------
    // Admin (owner) — issuing a verified recipient IS issuing certification
    // ---------------------------------------------------------------------

    function addVerifiedRecipient(address r) external onlyOwner {
        verifiedRecipients[r] = true;
    }

    function removeVerifiedRecipient(address r) external onlyOwner {
        verifiedRecipients[r] = false;
    }

    function setApprovedPurpose(string calldata purpose, bool approved) external onlyOwner {
        approvedPurposes[purposeHash(purpose)] = approved;
    }

    function setPolicy(uint8 _riskThreshold, uint256 _maxReleasePerEvent, uint256 _dailyReleaseLimit)
        external
        onlyOwner
    {
        riskThreshold = _riskThreshold;
        maxReleasePerEvent = _maxReleasePerEvent;
        dailyReleaseLimit = _dailyReleaseLimit;
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }

    // ---------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------

    function getProposal(uint256 id) external view returns (Proposal memory, Verdict memory) {
        require(id < _proposals.length, "bad id");
        return (_proposals[id], _verdicts[id]);
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function policy()
        external
        view
        returns (uint8 _riskThreshold, uint256 _maxReleasePerEvent, uint256 _dailyReleaseLimit)
    {
        return (riskThreshold, maxReleasePerEvent, dailyReleaseLimit);
    }

    function isVerifiedRecipient(address recipient) external view returns (bool) {
        return verifiedRecipients[recipient];
    }

    function isApprovedPurpose(bytes32 purpose) external view returns (bool) {
        return approvedPurposes[purpose];
    }

    function riskScoreOf(bytes32 eventId) external view returns (uint8) {
        return _riskScore[eventId];
    }

    function releasedToday() external view returns (uint256) {
        return _effectiveReleasedToday();
    }

    function poolBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Canonical purpose hashing shared by agent, deploy script, and tests.
    function purposeHash(string memory purpose) public pure returns (bytes32) {
        return keccak256(bytes(purpose));
    }
}
