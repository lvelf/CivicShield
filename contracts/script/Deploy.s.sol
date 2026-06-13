// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CivicShieldPool} from "../src/CivicShieldPool.sol";
import {MockUSDC} from "../test/MockUSDC.sol";

/// @notice Deploys CivicShieldPool. Two modes:
///   - real USDC (default): point at a chain's official 6-decimal USDC (set USDC_ADDRESS).
///   - mock mode (USE_MOCK_USDC=true): also deploy a MockUSDC and pre-fund the pool, so the
///     whole thing runs self-contained on ANY testnet with zero external USDC faucet needed.
///     Use this to "get it running" on whatever chain you can fund; switch to Base + real USDC
///     for the LI.FI Composer integration later.
///
/// Run (dry run): forge script script/Deploy.s.sol --rpc-url optimism_sepolia
/// Broadcast:     USE_MOCK_USDC=true forge script script/Deploy.s.sol \
///                  --rpc-url optimism_sepolia --broadcast -vvvv
contract Deploy is Script {
    // --- policy Pi (tune before deploy) ---
    uint8 constant RISK_THRESHOLD = 75;
    uint256 constant MAX_RELEASE_PER_EVENT = 500e6; // 500 USDC per proposal
    uint256 constant DAILY_RELEASE_LIMIT = 1000e6; // 1000 USDC per UTC day (trace-level)
    uint256 constant MOCK_POOL_FUNDING = 100_000e6; // USDC minted to the pool in mock mode

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        bool useMock = vm.envOr("USE_MOCK_USDC", false);

        address relayer = vm.envOr("RELAYER_ADDRESS", deployer);
        string[] memory purposes = _purposes();
        address[] memory recipients = new address[](1);
        recipients[0] = vm.envOr("VERIFIED_RECIPIENT", deployer);

        vm.startBroadcast(pk);

        address usdc;
        if (useMock) {
            usdc = address(new MockUSDC());
        } else {
            // Circle official testnet USDC on Base Sepolia by default; override per chain via env.
            usdc = vm.envOr("USDC_ADDRESS", address(0x036CbD53842c5426634e7929541eC2318f3dCF7e));
        }

        CivicShieldPool pool = new CivicShieldPool(
            usdc, relayer, RISK_THRESHOLD, MAX_RELEASE_PER_EVENT, DAILY_RELEASE_LIMIT, purposes, recipients
        );

        if (useMock) {
            // Pre-fund the escrow so executeRelease can actually pay out in the demo.
            MockUSDC(usdc).mint(address(pool), MOCK_POOL_FUNDING);
            MockUSDC(usdc).mint(deployer, MOCK_POOL_FUNDING); // for testing donate()
        }

        vm.stopBroadcast();

        console.log("Deployer:        ", deployer);
        console.log("Mock USDC mode:  ", useMock);
        console.log("USDC:            ", usdc);
        console.log("Relayer:         ", relayer);
        console.log("Seed recipient:  ", recipients[0]);
        console.log("CivicShieldPool: ", address(pool));
    }

    function _purposes() internal pure returns (string[] memory purposes) {
        purposes = new string[](4);
        purposes[0] = "emergency_shelter";
        purposes[1] = "medical_supplies";
        purposes[2] = "clean_water";
        purposes[3] = "evacuation_transport";
    }
}
