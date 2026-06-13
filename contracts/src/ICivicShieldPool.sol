// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The structured proposal the agent emits. The agent has NO keys to funds.
struct Proposal {
    address recipient; // resolved from an ENS subname off-chain; checked on-chain
    uint256 amount; // USDC base units (6 decimals)
    bytes32 purpose; // keccak256 of a purpose string, e.g. "emergency_shelter"
    bytes32 eventId; // the hazard event this release is tied to
    string reasoning; // human-readable trail (logged, NOT trusted for the decision)
}

enum FailReason {
    NONE, // 0 — passed all checks
    RISK_BELOW_THRESHOLD, // 1
    AMOUNT_OVER_EVENT_CAP, // 2
    DAILY_LIMIT_EXCEEDED, // 3
    RECIPIENT_NOT_VERIFIED, // 4
    PURPOSE_NOT_APPROVED // 5

}

enum ProposalStatus {
    PENDING,
    EXECUTED,
    BLOCKED
}

struct Verdict {
    ProposalStatus status;
    bool passed;
    FailReason failReason; // NONE when passed == true
}

/// @title ICivicShieldPool
/// @notice The Permissibility Machine (M_Pi): escrow + deterministic policy + transparency log.
///         The AI agent can PROPOSE releases but holds no keys; only proposals that pass every
///         policy rule execute, and every evaluation — pass or block — is logged on-chain.
interface ICivicShieldPool {
    // ---- writes ----

    /// @notice Agent submits a structured proposal. Does NOT move funds.
    /// @return id The proposal id (also emitted in ProposalCreated).
    function proposeRelease(Proposal calldata p) external returns (uint256 id);

    /// @notice Runs all 5 policy checks against proposal `id` and, only if ALL pass,
    ///         transfers USDC to the recipient. Emits ActionEvaluated either way.
    ///         MUST NOT revert on a policy failure — it records the block on-chain.
    function executeRelease(uint256 id) external;

    /// @notice Relayer delivers the CRE-derived risk score for a hazard event.
    function submitRiskScore(bytes32 eventId, uint8 score) external;

    /// @notice Deposit USDC into the escrow pool (LI.FI Composer destination).
    /// @param amount USDC (base units) pulled from msg.sender via transferFrom.
    /// @param donor  Address credited in the Transparency Log. Pass the connected wallet — NOT
    ///               msg.sender, which is the LI.FI executor on Composer deposits.
    function donate(uint256 amount, address donor) external;

    // ---- reads (frontend) ----

    function getProposal(uint256 id) external view returns (Proposal memory, Verdict memory);
    function proposalCount() external view returns (uint256);

    /// @notice The full policy Pi. verifiedRecipients/approvedPurposes are membership
    ///         tested via the helper getters below (sets aren't returnable cheaply).
    function policy()
        external
        view
        returns (uint8 riskThreshold, uint256 maxReleasePerEvent, uint256 dailyReleaseLimit);
    function isVerifiedRecipient(address recipient) external view returns (bool);
    function isApprovedPurpose(bytes32 purpose) external view returns (bool);

    function riskScoreOf(bytes32 eventId) external view returns (uint8);
    function releasedToday() external view returns (uint256); // trace-level running total
    function poolBalance() external view returns (uint256);

    // ---- events (Transparency Log data source) ----

    event ProposalCreated(
        uint256 indexed id, address indexed recipient, uint256 amount, bytes32 purpose, bytes32 indexed eventId
    );

    /// @notice Emitted by executeRelease for EVERY evaluation — pass and block alike.
    ///         `failReason` is NONE on pass. This single event powers the whole log.
    event ActionEvaluated(
        uint256 indexed id, address indexed recipient, uint256 amount, bytes32 purpose, bool passed, FailReason failReason
    );

    event RiskScoreSubmitted(bytes32 indexed eventId, uint8 score);
    event Donated(address indexed from, uint256 amount);
}
