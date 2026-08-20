// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPolicyManager {
    function isActive(uint256 policyId) external view returns (bool);

    function remainingCoverage(uint256 policyId) external view returns (uint256);

    function recordPayout(uint256 policyId, uint256 amount) external;

    function policies(uint256 policyId)
        external
        view
        returns (
            address holder,
            bytes32 vehicleHash,
            uint256 premium,
            uint256 coverage,
            uint256 startTime,
            uint256 endTime,
            uint256 claimsCount,
            uint256 totalPaidOut,
            bool active
        );
}
