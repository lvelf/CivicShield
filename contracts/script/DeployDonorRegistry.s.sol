// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DonorRegistry} from "../src/DonorRegistry.sol";

/// @notice Deploy the standalone DonorRegistry (opt-in self-attested donor regions for the map).
///         Does NOT touch CivicShieldPool or its funds — safe to deploy independently.
///
///   forge script script/DeployDonorRegistry.s.sol --rpc-url base --broadcast -vvvv
contract DeployDonorRegistry is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        DonorRegistry reg = new DonorRegistry();
        vm.stopBroadcast();
        console.log("DonorRegistry:   ", address(reg));
    }
}
