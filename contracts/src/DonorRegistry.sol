// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DonorRegistry
/// @notice Opt-in, self-attested donor regions for the relief map. A donor may publish a region
///         label (e.g. a city) tied to their own address — or stay anonymous by never calling this.
///         Standalone (does not touch CivicShieldPool or its funds); the frontend joins
///         `Donated` events (amounts) with `regionOf` (locations) by donor address.
contract DonorRegistry {
    /// @notice Latest region label a donor has self-declared ("" = none / anonymous).
    mapping(address => string) public regionOf;

    event RegionDeclared(address indexed donor, string region);

    /// @notice Publish (or update) the caller's region label. msg.sender is the real donor.
    function declare(string calldata region) external {
        regionOf[msg.sender] = region;
        emit RegionDeclared(msg.sender, region);
    }
}
