// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PolicyManager
 * @notice Manages micro-insurance policy lifecycle for motorbikes.
 * @dev Premiums are paid in USDC (6 decimals) on Sepolia.
 */
contract PolicyManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Policy {
        address holder;
        bytes32 vehicleHash; // keccak256(license_plate + VIN)
        uint256 premium; // USDC (6 decimals)
        uint256 coverage; // Max payout in USDC
        uint256 startTime;
        uint256 endTime;
        uint256 claimsCount;
        uint256 totalPaidOut;
        bool active;
    }

    struct Tier {
        uint256 premium;
        uint256 coverage;
        uint256 durationDays;
    }

    IERC20 public immutable usdc;
    address public treasury;
    uint256 public nextPolicyId = 1;

    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public policiesByHolder;

    Tier[] public tiers;

    event PolicyPurchased(
        uint256 indexed policyId, address indexed holder, uint256 premium, uint256 coverage
    );
    event PolicyExpired(uint256 indexed policyId);
    event PayoutRecorded(uint256 indexed policyId, uint256 amount, uint256 totalPaidOut);
    event TierAdded(uint256 indexed tierId, uint256 premium, uint256 coverage, uint256 durationDays);
    event TreasuryUpdated(address indexed newTreasury);

    error InvalidTier();
    error ZeroAddress();
    error PolicyNotFound();

    constructor(address _usdc, address _treasury) {
        if (_usdc == address(0) || _treasury == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        // Default tiers (USDC, 6 decimals)
        tiers.push(Tier(1_000_000, 20_000_000, 30)); // $1/mo  -> $20 coverage
        tiers.push(Tier(3_000_000, 80_000_000, 30)); // $3/mo  -> $80 coverage
        tiers.push(Tier(5_000_000, 200_000_000, 30)); // $5/mo -> $200 coverage
    }

    function purchasePolicy(uint256 tierId, bytes32 vehicleHash)
        external
        nonReentrant
        returns (uint256 policyId)
    {
        if (tierId >= tiers.length) revert InvalidTier();
        Tier memory t = tiers[tierId];

        usdc.safeTransferFrom(msg.sender, treasury, t.premium);

        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            holder: msg.sender,
            vehicleHash: vehicleHash,
            premium: t.premium,
            coverage: t.coverage,
            startTime: block.timestamp,
            endTime: block.timestamp + (t.durationDays * 1 days),
            claimsCount: 0,
            totalPaidOut: 0,
            active: true
        });
        policiesByHolder[msg.sender].push(policyId);

        emit PolicyPurchased(policyId, msg.sender, t.premium, t.coverage);
    }

    function isActive(uint256 policyId) public view returns (bool) {
        Policy memory p = policies[policyId];
        return p.active && block.timestamp <= p.endTime && p.totalPaidOut < p.coverage;
    }

    function remainingCoverage(uint256 policyId) external view returns (uint256) {
        Policy memory p = policies[policyId];
        if (!isActive(policyId)) return 0;
        return p.coverage - p.totalPaidOut;
    }

    /// @notice Called by ClaimRegistry after a successful payout.
    function recordPayout(uint256 policyId, uint256 amount) external onlyRole(ADMIN_ROLE) {
        Policy storage p = policies[policyId];
        if (p.holder == address(0)) revert PolicyNotFound();

        p.totalPaidOut += amount;
        p.claimsCount += 1;
        if (p.totalPaidOut >= p.coverage) {
            p.active = false;
            emit PolicyExpired(policyId);
        }
        emit PayoutRecorded(policyId, amount, p.totalPaidOut);
    }

    function getPoliciesByHolder(address holder) external view returns (uint256[] memory) {
        return policiesByHolder[holder];
    }

    function tiersCount() external view returns (uint256) {
        return tiers.length;
    }

    function getTiers() external view returns (Tier[] memory) {
        return tiers;
    }

    function addTier(uint256 premium, uint256 coverage, uint256 durationDays)
        external
        onlyRole(ADMIN_ROLE)
    {
        tiers.push(Tier(premium, coverage, durationDays));
        emit TierAdded(tiers.length - 1, premium, coverage, durationDays);
    }

    function updateTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }
}
