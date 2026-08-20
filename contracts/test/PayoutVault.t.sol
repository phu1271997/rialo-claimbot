// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {PayoutVault} from "../src/PayoutVault.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract PayoutVaultTest is BaseTest {
    function test_FundReserve_AccountsAndPullsTokens() public {
        uint256 reserveBefore = vault.totalReserve();
        usdc.mint(admin, 50_000_000);
        usdc.approve(address(vault), 50_000_000);
        vault.fundReserve(50_000_000);

        assertEq(vault.totalReserve(), reserveBefore + 50_000_000);
        assertEq(vault.availableReserve(), VAULT_FUNDING + 50_000_000);
    }

    function test_RevertWhen_FundZero() public {
        vm.expectRevert(PayoutVault.ZeroAmount.selector);
        vault.fundReserve(0);
    }

    function test_RevertWhen_FundFromNonFunder() public {
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, bob, vault.FUNDER_ROLE()
        );
        vm.expectRevert(expected);
        vm.prank(bob);
        vault.fundReserve(1_000_000);
    }

    function test_ExecutePayout_OnlyRegistryRole() public {
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            bob,
            vault.CLAIM_REGISTRY_ROLE()
        );
        vm.expectRevert(expected);
        vm.prank(bob);
        vault.executePayout(bob, 1_000_000);
    }

    function test_ExecutePayout_TransfersAndAccounts() public {
        vm.prank(address(registry));
        vault.executePayout(alice, 5_000_000);

        assertEq(usdc.balanceOf(alice), 105_000_000);
        assertEq(vault.totalPaidOut(), 5_000_000);
        assertEq(vault.availableReserve(), VAULT_FUNDING - 5_000_000);
    }

    function test_RevertWhen_PayoutExceedsReserve() public {
        vm.expectRevert(PayoutVault.InsufficientReserve.selector);
        vm.prank(address(registry));
        vault.executePayout(alice, VAULT_FUNDING + 1);
    }

    function test_RevertWhen_PayoutZeroAmount() public {
        vm.expectRevert(PayoutVault.ZeroAmount.selector);
        vm.prank(address(registry));
        vault.executePayout(alice, 0);
    }

    function test_RevertWhen_PayoutToZeroAddress() public {
        vm.expectRevert(PayoutVault.ZeroAddress.selector);
        vm.prank(address(registry));
        vault.executePayout(address(0), 1_000_000);
    }

    function test_EmergencyWithdraw_OnlyAdmin() public {
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, bob, bytes32(0)
        );
        vm.expectRevert(expected);
        vm.prank(bob);
        vault.emergencyWithdraw(bob, 1_000_000);

        vault.emergencyWithdraw(treasury, 10_000_000);
        assertEq(usdc.balanceOf(treasury), 10_000_000);
    }

    function testFuzz_ExecutePayoutWithinReserve(uint96 amount) public {
        uint256 value = bound(uint256(amount), 1, VAULT_FUNDING);
        vm.prank(address(registry));
        vault.executePayout(alice, value);
        assertEq(vault.availableReserve(), VAULT_FUNDING - value);
    }
}
