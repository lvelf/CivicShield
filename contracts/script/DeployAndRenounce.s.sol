// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CivicShieldPool} from "../src/CivicShieldPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice One-click: deploy CivicShieldPool on Base mainnet with demo-scale policy, an
///         INDEPENDENT relayer role, and a verified recipient — then optionally renounce
///         ownership so no one (not even us) can change the rules or move the money outside
///         policy. The relayer is set at construction, so submitRiskScore survives renounce.
///
/// Rehearse on a MUTABLE instance (owner kept — run this repeatedly while practicing):
///   forge script script/DeployAndRenounce.s.sol --rpc-url base --broadcast -vvvv
///
/// FINAL demo instance (IRREVERSIBLE — renounces ownership, run once just before going on stage):
///   RENOUNCE=true forge script script/DeployAndRenounce.s.sol --rpc-url base --broadcast -vvvv
contract DeployAndRenounce is Script {
    using SafeERC20 for IERC20;

    // --- demo-scale policy (REAL money on mainnet — keep tiny). USDC = 6 decimals. ---
    uint8 constant RISK_THRESHOLD = 75;
    uint256 constant MAX_RELEASE_PER_EVENT = 5e6; // 5 USDC
    uint256 constant DAILY_RELEASE_LIMIT = 15e6; // 15 USDC (trace-level, per UTC day)

    // Circle native USDC on Base mainnet. Override with USDC_ADDRESS only if you know why.
    address constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk); // == owner, the key that can renounce

        // --- INDEPENDENT relayer role: a SEPARATE key from the owner. No deployer fallback. ---
        // The relayer's PRIVATE key lives in the off-chain relayer process (M3), not here — we
        // only need its address. After renounce, setRelayer is frozen, so this is permanent.
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        require(relayer != address(0), "RELAYER_ADDRESS unset");
        require(relayer != deployer, "relayer MUST be a separate key from the deployer/owner");

        // Resolved address of shelter-fund.eth (rule 4 allowlist). Frozen after renounce.
        address verifiedRecipient = vm.envAddress("VERIFIED_RECIPIENT");
        require(verifiedRecipient != address(0), "VERIFIED_RECIPIENT unset");
        require(verifiedRecipient != relayer, "recipient should not be the relayer");

        address usdc = vm.envOr("USDC_ADDRESS", BASE_MAINNET_USDC);
        bool doRenounce = vm.envOr("RENOUNCE", false);
        uint256 funding = vm.envOr("POOL_FUNDING", uint256(0)); // optional, USDC base units

        string[] memory purposes = _purposes();
        address[] memory recipients = new address[](1);
        recipients[0] = verifiedRecipient;

        vm.startBroadcast(pk);

        // 1. Deploy — every owner-only setting is baked into the constructor, so there is
        //    nothing left to configure that renounce would lock out.
        CivicShieldPool pool = new CivicShieldPool(
            usdc, relayer, RISK_THRESHOLD, MAX_RELEASE_PER_EVENT, DAILY_RELEASE_LIMIT, purposes, recipients
        );

        // 2. Optional: fund the escrow with real USDC the deployer already holds (or skip and
        //    fund via the LI.FI donation flow / a manual transfer to the pool address).
        if (funding > 0) {
            IERC20(usdc).safeTransfer(address(pool), funding);
        }

        // 3. FINAL DEMO ONLY: give up ownership. owner -> address(0). No setPolicy, no
        //    addVerifiedRecipient, no setRelayer ever again. Money can now only reach the
        //    frozen verified recipient, under the frozen caps, on a qualifying riskScore.
        if (doRenounce) {
            pool.renounceOwnership();
        }

        vm.stopBroadcast();

        // --- post-conditions (view calls — safe after renounce) ---
        require(pool.relayer() == relayer, "relayer not set");
        require(pool.isVerifiedRecipient(verifiedRecipient), "recipient not verified");
        if (doRenounce) {
            require(pool.owner() == address(0), "renounce failed");
        } else {
            require(pool.owner() == deployer, "unexpected owner");
        }

        console.log("CivicShieldPool: ", address(pool));
        console.log("USDC:            ", usdc);
        console.log("Owner:           ", pool.owner());
        console.log("Relayer (indep): ", relayer);
        console.log("Verified recip:  ", verifiedRecipient);
        console.log("Funded (base u): ", funding);
        if (doRenounce) {
            console.log(">>> OWNERSHIP RENOUNCED. owner == address(0). Rules + allowlist frozen forever.");
        } else {
            console.log(">>> Owner retained (REHEARSAL). Set RENOUNCE=true for the final demo instance.");
        }
    }

    function _purposes() internal pure returns (string[] memory purposes) {
        purposes = new string[](4);
        purposes[0] = "emergency_shelter";
        purposes[1] = "medical_supplies";
        purposes[2] = "clean_water";
        purposes[3] = "evacuation_transport";
    }
}
