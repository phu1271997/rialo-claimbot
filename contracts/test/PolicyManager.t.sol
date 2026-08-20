// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract PolicyManagerTest is BaseTest {
    function test_PurchasePolicy_TransfersPremiumAndStoresPolicy() public {
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 policyId = _buyPolicy(alice, 1);

        assertEq(policyId, 1);
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 3_000_000);

        (
            address holder,
            bytes32 vehicleHash,
            uint256 premium,
            uint256 coverage,
            uint256 startTime,
            uint256 endTime,
            uint256 claimsCount,
            uint256 totalPaidOut,
            bool active
        ) = policyManager.policies(policyId);

        assertEq(holder, alice);
        assertEq(vehicleHash, VEHICLE_HASH);
        assertEq(premium, 3_000_000);
        assertEq(coverage, 80_000_000);
        assertEq(startTime, block.timestamp);
        assertEq(endTime, block.timestamp + 30 days);
        assertEq(claimsCount, 0);
        assertEq(totalPaidOut, 0);
        assertTrue(active);
        assertTrue(policyManager.isActive(policyId));
    }

    function test_PurchasePolicy_IndexesByHolder() public {
        _buyPolicy(alice, 0);
        _buyPolicy(alice, 2);
        uint256[] memory ids = policyManager.getPoliciesByHolder(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_RevertWhen_TierInvalid() public {
        vm.prank(alice);
        vm.expectRevert(PolicyManager.InvalidTier.selector);
        policyManager.purchasePolicy(99, VEHICLE_HASH);
    }

    function test_RevertWhen_NoApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        policyManager.purchasePolicy(0, VEHICLE_HASH);
    }

    function test_IsActive_FalseAfterEndTime() public {
        uint256 policyId = _buyPolicy(alice, 0);
        assertTrue(policyManager.isActive(policyId));
        vm.warp(block.timestamp + 31 days);
        assertFalse(policyManager.isActive(policyId));
        assertEq(policyManager.remainingCoverage(policyId), 0);
    }

    function test_IsActive_FalseWhenCoverageExhausted() public {
        uint256 policyId = _buyPolicy(alice, 0); // 20 USDC coverage
        vm.prank(address(registry));
        policyManager.recordPayout(policyId, 20_000_000);

        assertFalse(policyManager.isActive(policyId));
        assertEq(policyManager.remainingCoverage(policyId), 0);
    }

    function test_RecordPayout_AccumulatesAndDecrementsCoverage() public {
        uint256 policyId = _buyPolicy(alice, 1); // 80 USDC coverage
        vm.prank(address(registry));
        policyManager.recordPayout(policyId, 30_000_000);

        (,,,,,, uint256 claimsCount, uint256 totalPaidOut, bool active) =
            policyManager.policies(policyId);
        assertEq(claimsCount, 1);
        assertEq(totalPaidOut, 30_000_000);
        assertTrue(active);
        assertEq(policyManager.remainingCoverage(policyId), 50_000_000);
    }

    function test_RevertWhen_RecordPayoutFromNonAdmin() public {
        uint256 policyId = _buyPolicy(alice, 0);
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, bob, policyManager.ADMIN_ROLE()
        );
        vm.expectRevert(expected);
        vm.prank(bob);
        policyManager.recordPayout(policyId, 1_000_000);
    }

    function test_AddTier_AppendsAndIsPurchasable() public {
        policyManager.addTier(10_000_000, 500_000_000, 60);
        assertEq(policyManager.tiersCount(), 4);

        uint256 policyId = _buyPolicy(alice, 3);
        (,,, uint256 coverage,, uint256 endTime,,,) = policyManager.policies(policyId);
        assertEq(coverage, 500_000_000);
        assertEq(endTime, block.timestamp + 60 days);
    }

    function test_UpdateTreasury() public {
        policyManager.updateTreasury(bob);
        assertEq(policyManager.treasury(), bob);
    }

    function test_RevertWhen_UpdateTreasuryToZero() public {
        vm.expectRevert(PolicyManager.ZeroAddress.selector);
        policyManager.updateTreasury(address(0));
    }

    function testFuzz_RemainingCoverageNeverUnderflows(uint96 payout) public {
        uint256 policyId = _buyPolicy(alice, 2); // 200 USDC coverage
        uint256 amount = bound(uint256(payout), 0, 200_000_000);

        vm.prank(address(registry));
        policyManager.recordPayout(policyId, amount);

        uint256 remaining = policyManager.remainingCoverage(policyId);
        assertLe(remaining, 200_000_000);
        if (amount >= 200_000_000) assertEq(remaining, 0);
    }
}
