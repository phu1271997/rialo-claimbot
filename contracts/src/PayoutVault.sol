// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PayoutVault
 * @notice Holds the USDC reserve. Only ClaimRegistry may execute a payout.
 */
contract PayoutVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CLAIM_REGISTRY_ROLE = keccak256("CLAIM_REGISTRY_ROLE");
    bytes32 public constant FUNDER_ROLE = keccak256("FUNDER_ROLE");

    IERC20 public immutable usdc;
    uint256 public totalReserve;
    uint256 public totalPaidOut;

    event Funded(address indexed from, uint256 amount);
    event PayoutExecuted(address indexed to, uint256 amount, address indexed by);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    error InsufficientReserve();
    error ZeroAmount();
    error ZeroAddress();

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FUNDER_ROLE, msg.sender);
    }

    function fundReserve(uint256 amount) external nonReentrant onlyRole(FUNDER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalReserve += amount;
        emit Funded(msg.sender, amount);
    }

    function executePayout(address to, uint256 amount)
        external
        nonReentrant
        onlyRole(CLAIM_REGISTRY_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientReserve();

        totalPaidOut += amount;
        usdc.safeTransfer(to, amount);
        emit PayoutExecuted(to, amount, msg.sender);
    }

    function availableReserve() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function emergencyWithdraw(address to, uint256 amount)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        usdc.safeTransfer(to, amount);
        emit EmergencyWithdraw(to, amount);
    }

    function grantClaimRegistryRole(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registry == address(0)) revert ZeroAddress();
        _grantRole(CLAIM_REGISTRY_ROLE, registry);
    }
}
