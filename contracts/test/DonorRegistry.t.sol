// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DonorRegistry} from "../src/DonorRegistry.sol";

contract DonorRegistryTest is Test {
    DonorRegistry reg;
    address alice = makeAddr("alice");

    event RegionDeclared(address indexed donor, string region);

    function setUp() public {
        reg = new DonorRegistry();
    }

    function test_DeclareSetsRegionAndEmits() public {
        vm.expectEmit(true, false, false, true, address(reg));
        emit RegionDeclared(alice, "London");
        vm.prank(alice);
        reg.declare("London");
        assertEq(reg.regionOf(alice), "London");
    }

    function test_DefaultIsEmpty_Anonymous() public view {
        assertEq(bytes(reg.regionOf(alice)).length, 0);
    }

    function test_CanUpdate() public {
        vm.startPrank(alice);
        reg.declare("London");
        reg.declare("Tokyo");
        vm.stopPrank();
        assertEq(reg.regionOf(alice), "Tokyo");
    }
}
