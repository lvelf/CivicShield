// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CivicShieldPool} from "../src/CivicShieldPool.sol";
import {Proposal, Verdict, FailReason, ProposalStatus} from "../src/ICivicShieldPool.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @notice Full policy-path coverage for the Permissibility Machine. Mirrors the four mock
///         fixtures in docs/INTERFACES.md plus the Act-4 split-payment (trace-level) attack.
contract CivicShieldPoolTest is Test {
    CivicShieldPool pool;
    MockUSDC usdc;

    event Donated(address indexed from, uint256 amount, bytes32 indexed scope); // mirror for vm.expectEmit

    address owner = address(this);
    address relayer = makeAddr("relayer");
    address agent = makeAddr("agent");
    address donor = makeAddr("donor");

    address shelter = makeAddr("shelter-fund.eth"); // verified recipient
    address medical = makeAddr("medical-fund.eth"); // verified recipient
    address attacker = makeAddr("0xAttacker"); // NOT verified

    bytes32 eventFlood = keccak256("nws-alert-flood-001");
    bytes32 eventNoSignal = keccak256("nws-alert-none-002");
    bytes32 eventWrongScope = keccak256("nws-alert-wildfire-003");
    bytes32 eventLowRisk = keccak256("nws-alert-flood-low-004"); // in-scope flood, score < threshold

    uint8 constant THRESHOLD = 75;
    uint256 constant MAX_PER_EVENT = 500e6; // 500 USDC
    uint256 constant DAILY_LIMIT = 800e6; // 800 USDC
    uint256 constant STD_AMOUNT = 300e6; // 300 USDC

    bytes32 constant SCOPE = keccak256("US|flood"); // this pool's fund scope
    bytes32 constant WRONG_SCOPE = keccak256("US|wildfire"); // a different hazard

    function setUp() public {
        usdc = new MockUSDC();

        string[] memory purposes = new string[](4);
        purposes[0] = "emergency_shelter";
        purposes[1] = "medical_supplies";
        purposes[2] = "clean_water";
        purposes[3] = "evacuation_transport";

        address[] memory recipients = new address[](2);
        recipients[0] = shelter;
        recipients[1] = medical;

        pool = new CivicShieldPool(
            address(usdc), agent, relayer, SCOPE, THRESHOLD, MAX_PER_EVENT, DAILY_LIMIT, purposes, recipients
        );

        // Fund the escrow generously so transfers never fail for lack of balance.
        usdc.mint(address(pool), 100_000e6);

        // A qualifying, in-scope real-world hazard signal exists for the flood event.
        vm.startPrank(relayer);
        pool.submitRiskScore(eventFlood, 82, SCOPE);
        // High score but WRONG scope (a wildfire) — must be blocked at the scope rule.
        pool.submitRiskScore(eventWrongScope, 90, WRONG_SCOPE);
        // In-scope flood but score below threshold — for the rule-1 test.
        pool.submitRiskScore(eventLowRisk, 40, SCOPE);
        vm.stopPrank();
        // eventNoSignal intentionally left at 0 (no score, no scope).
    }

    // --- helpers -------------------------------------------------------------

    function _propose(address recipient, uint256 amount, string memory purpose, bytes32 eventId)
        internal
        returns (uint256 id)
    {
        Proposal memory p = Proposal({
            recipient: recipient,
            amount: amount,
            purpose: pool.purposeHash(purpose),
            eventId: eventId,
            reasoning: "test"
        });
        vm.prank(agent);
        id = pool.proposeRelease(p);
    }

    function _verdict(uint256 id) internal view returns (Verdict memory v) {
        (, v) = pool.getProposal(id);
    }

    // --- happy path ----------------------------------------------------------

    function test_HappyPath_ExecutesAndPaysVerifiedRecipient() public {
        uint256 id = _propose(shelter, STD_AMOUNT, "emergency_shelter", eventFlood);

        uint256 balBefore = usdc.balanceOf(shelter);
        pool.executeRelease(id);

        Verdict memory v = _verdict(id);
        assertEq(uint256(v.status), uint256(ProposalStatus.EXECUTED));
        assertTrue(v.passed);
        assertEq(uint256(v.failReason), uint256(FailReason.NONE));
        assertEq(usdc.balanceOf(shelter) - balBefore, STD_AMOUNT);
        assertEq(pool.releasedToday(), STD_AMOUNT);
    }

    // --- rule 1: risk below threshold (fixture #3) ---------------------------

    function test_Block_RiskBelowThreshold() public {
        // in-scope flood (scope passes) but score 40 < 75 -> blocked at rule 1.
        uint256 id = _propose(shelter, STD_AMOUNT, "emergency_shelter", eventLowRisk);
        pool.executeRelease(id);

        Verdict memory v = _verdict(id);
        assertEq(uint256(v.status), uint256(ProposalStatus.BLOCKED));
        assertEq(uint256(v.failReason), uint256(FailReason.RISK_BELOW_THRESHOLD));
        assertEq(usdc.balanceOf(shelter), 0);
    }

    // --- rule 2: amount over per-event cap -----------------------------------

    function test_Block_AmountOverEventCap() public {
        uint256 id = _propose(shelter, MAX_PER_EVENT + 1, "emergency_shelter", eventFlood);
        pool.executeRelease(id);
        assertEq(uint256(_verdict(id).failReason), uint256(FailReason.AMOUNT_OVER_EVENT_CAP));
    }

    // --- rule 4: recipient not verified (fixture #1, Act 3 injection) ---------

    function test_Block_PromptInjection_RecipientNotVerified() public {
        // The LLM was tricked into proposing a huge transfer to the attacker.
        // It is over the cap AND unverified; rule 2 fires first by evaluation order.
        uint256 id = _propose(attacker, 999_000e6, "emergency_shelter", eventFlood);
        pool.executeRelease(id);
        assertEq(uint256(_verdict(id).failReason), uint256(FailReason.AMOUNT_OVER_EVENT_CAP));

        // A within-cap transfer to the attacker is blocked squarely at rule 4.
        uint256 id2 = _propose(attacker, STD_AMOUNT, "emergency_shelter", eventFlood);
        pool.executeRelease(id2);
        assertEq(uint256(_verdict(id2).failReason), uint256(FailReason.RECIPIENT_NOT_VERIFIED));
        assertEq(usdc.balanceOf(attacker), 0);
    }

    // --- rule 5: purpose not approved (fixture #2) ---------------------------

    function test_Block_PurposeNotApproved() public {
        uint256 id = _propose(shelter, STD_AMOUNT, "buy_gpu_cluster", eventFlood);
        pool.executeRelease(id);
        assertEq(uint256(_verdict(id).failReason), uint256(FailReason.PURPOSE_NOT_APPROVED));
    }

    // --- rule 3: trace-level daily limit (Act 4 split-payment attack) ---------

    function test_Block_SplitPaymentExceedsDailyLimit() public {
        // Each release is within the per-event cap (rule 2 passes every time)...
        uint256 id1 = _propose(shelter, STD_AMOUNT, "emergency_shelter", eventFlood); // 300
        pool.executeRelease(id1);
        assertTrue(_verdict(id1).passed);

        uint256 id2 = _propose(shelter, STD_AMOUNT, "emergency_shelter", eventFlood); // 300 -> 600
        pool.executeRelease(id2);
        assertTrue(_verdict(id2).passed);

        // ...but the THIRD would push the day's trace to 900 > 800. Blocked at the trace level.
        uint256 id3 = _propose(shelter, STD_AMOUNT, "emergency_shelter", eventFlood); // 300 -> 900
        pool.executeRelease(id3);
        assertEq(uint256(_verdict(id3).failReason), uint256(FailReason.DAILY_LIMIT_EXCEEDED));
        assertEq(pool.releasedToday(), 600e6); // only the two executed releases count
    }

    function test_DailyLimit_ResetsNextUtcDay() public {
        uint256 id1 = _propose(shelter, MAX_PER_EVENT, "emergency_shelter", eventFlood); // 500
        pool.executeRelease(id1);
        assertEq(pool.releasedToday(), MAX_PER_EVENT);

        // Next day: the running total resets, so a fresh release is allowed again.
        vm.warp(block.timestamp + 1 days);
        assertEq(pool.releasedToday(), 0);

        uint256 id2 = _propose(shelter, MAX_PER_EVENT, "emergency_shelter", eventFlood); // 500
        pool.executeRelease(id2);
        assertTrue(_verdict(id2).passed);
        assertEq(pool.releasedToday(), MAX_PER_EVENT);
    }

    // --- invariants & access control -----------------------------------------

    function test_CannotReExecuteSettledProposal() public {
        uint256 id = _propose(shelter, STD_AMOUNT, "emergency_shelter", eventFlood);
        pool.executeRelease(id);
        vm.expectRevert(bytes("settled"));
        pool.executeRelease(id);
    }

    function test_OnlyRelayerCanSubmitRiskScore() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("not relayer"));
        pool.submitRiskScore(eventFlood, 100, SCOPE);
    }

    function test_BlockedProposalEmitsButDoesNotRevert() public {
        // Regression guard for the core narrative: a blocked attack is RECORDED, never reverted.
        uint256 id = _propose(attacker, STD_AMOUNT, "emergency_shelter", eventFlood);
        pool.executeRelease(id); // must not revert
        assertEq(uint256(_verdict(id).status), uint256(ProposalStatus.BLOCKED));
    }

    function test_Donate_IncreasesPoolBalance() public {
        usdc.mint(donor, 1_000e6);
        vm.startPrank(donor);
        usdc.approve(address(pool), 1_000e6);
        uint256 before = pool.poolBalance();
        pool.donate(1_000e6, donor);
        vm.stopPrank();
        assertEq(pool.poolBalance() - before, 1_000e6);
    }

    function test_Donate_CreditsDonorNotMsgSender_ComposerCase() public {
        // Simulate LI.FI Composer: an executor holds the swapped USDC and calls donate on the
        // donor's behalf. The Donated event must credit the donor, not the executor (msg.sender).
        address lifiExecutor = makeAddr("lifi-executor");
        address realDonor = makeAddr("alice");
        usdc.mint(lifiExecutor, 50e6);
        uint256 before = pool.poolBalance();
        vm.startPrank(lifiExecutor);
        usdc.approve(address(pool), 50e6);
        vm.expectEmit(true, true, false, true, address(pool));
        emit Donated(realDonor, 50e6, SCOPE); // <-- realDonor, NOT lifiExecutor; tagged with pool scope
        pool.donate(50e6, realDonor);
        vm.stopPrank();
        assertEq(pool.poolBalance() - before, 50e6);
    }

    // --- rule 0: event scope mismatch (donor-intent enforcement) --------------

    function test_Block_EventScopeMismatch() public {
        // High score (90) but the event is a wildfire — this is a flood pool. Donor intent holds.
        uint256 id = _propose(shelter, STD_AMOUNT, "emergency_shelter", eventWrongScope);
        pool.executeRelease(id);
        Verdict memory v = _verdict(id);
        assertEq(uint256(v.status), uint256(ProposalStatus.BLOCKED));
        assertEq(uint256(v.failReason), uint256(FailReason.EVENT_SCOPE_MISMATCH));
        assertEq(usdc.balanceOf(shelter), 0);
    }

    function test_Block_UnknownEventScope() public {
        // eventNoSignal has no scope attested (0) — also a scope mismatch (fundScope != 0).
        uint256 id = _propose(shelter, STD_AMOUNT, "emergency_shelter", eventNoSignal);
        pool.executeRelease(id);
        assertEq(uint256(_verdict(id).failReason), uint256(FailReason.EVENT_SCOPE_MISMATCH));
    }

    // --- human-in-the-loop review tier (Ledger) -------------------------------

    function test_LargeRelease_GoesToReview_ThenApproveExecutes() public {
        pool.setReviewThreshold(200e6); // releases >= 200 USDC need approval
        uint256 big = 300e6; // within the 500 cap, but over the review threshold
        uint256 id = _propose(shelter, big, "emergency_shelter", eventFlood);

        // First execute: policy-clean, but held for human review (no transfer).
        pool.executeRelease(id);
        assertEq(uint256(_verdict(id).status), uint256(ProposalStatus.PENDING_REVIEW));
        assertEq(usdc.balanceOf(shelter), 0);

        // Approver (Ledger) signs off; then it executes.
        pool.approveRelease(id); // test contract is owner, and approver defaults to owner
        uint256 balBefore = usdc.balanceOf(shelter);
        pool.executeRelease(id);
        assertEq(uint256(_verdict(id).status), uint256(ProposalStatus.EXECUTED));
        assertEq(usdc.balanceOf(shelter) - balBefore, big);
    }

    function test_SmallRelease_AutoExecutes_NoReview() public {
        pool.setReviewThreshold(200e6);
        uint256 small = 100e6; // below the review threshold
        uint256 id = _propose(shelter, small, "emergency_shelter", eventFlood);
        pool.executeRelease(id);
        assertEq(uint256(_verdict(id).status), uint256(ProposalStatus.EXECUTED));
    }

    function test_OnlyApproverCanApprove() public {
        pool.setReviewThreshold(200e6);
        uint256 id = _propose(shelter, 300e6, "emergency_shelter", eventFlood);
        pool.executeRelease(id);
        vm.prank(attacker);
        vm.expectRevert(bytes("not approver"));
        pool.approveRelease(id);
    }

    // --- access control: onlyAgent can propose --------------------------------

    function test_OnlyAgentCanPropose() public {
        Proposal memory p = Proposal({
            recipient: shelter,
            amount: STD_AMOUNT,
            purpose: pool.purposeHash("emergency_shelter"),
            eventId: eventFlood,
            reasoning: "spam"
        });
        vm.prank(attacker);
        vm.expectRevert(bytes("not agent"));
        pool.proposeRelease(p);
    }

    function test_Donate_RejectsZeroDonor() public {
        usdc.mint(donor, 10e6);
        vm.startPrank(donor);
        usdc.approve(address(pool), 10e6);
        vm.expectRevert(bytes("donor=0"));
        pool.donate(10e6, address(0));
        vm.stopPrank();
    }
}
