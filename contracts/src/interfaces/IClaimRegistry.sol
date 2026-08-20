// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IClaimRegistry {
    enum Status {
        Submitted, // 0
        Extracting, // 1
        Verifying, // 2
        Estimating, // 3
        Judged, // 4
        Paid, // 5
        Rejected, // 6
        Refunded, // 7
        Disputed // 8
    }

    function getActiveClaims() external view returns (uint256[] memory);

    function refundExpiredClaim(uint256 claimId) external;

    function claims(uint256 claimId)
        external
        view
        returns (
            uint256 policyId,
            address claimant,
            string memory evidenceIPFS,
            string memory description,
            uint256 submittedAt,
            uint256 deadline,
            Status status,
            uint256 approvedAmount,
            uint8 confidence,
            string memory reasoning,
            bytes32 verdictHash
        );
}
