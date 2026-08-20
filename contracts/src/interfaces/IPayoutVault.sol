// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPayoutVault {
    function executePayout(address to, uint256 amount) external;

    function totalReserve() external view returns (uint256);

    function totalPaidOut() external view returns (uint256);
}
