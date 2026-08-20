// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {ClaimRegistry} from "../src/ClaimRegistry.sol";

/// @dev End-to-end: the three lifecycles the demo must survive.
contract FullFlowTest is BaseTest {
    function test_HappyPath_BuyPolicySubmitClaimApprovedPayout() public {
        uint256 policyId = _buyPolicy(alice, 1); // 80 USDC coverage
        uint256 claimId = _submitClaim(alice, policyId);

        // Backend walks the pipeline.
        vm.startPrank(oracle);
        registry.updateStatus(claimId, ClaimRegistry.Status.Extracting);
        registry.updateStatus(claimId, ClaimRegistry.Status.Verifying);
        registry.updateStatus(claimId, ClaimRegistry.Status.Estimating);
        registry.updateStatus(claimId, ClaimRegistry.Status.Judged);
        vm.stopPrank();

        uint256 amount = 18_000_000; // ~450k VND
        string memory reasoning = "APPROVED (confidence 87%). Damage: moderate, parts: headlight, mirror.";
        bytes memory sig = _signVerdict(claimId, true, amount, 87, reasoning, oraclePk);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 vaultBefore = vault.availableReserve();

        vm.prank(oracle);
        registry.submitVerdict(claimId, true, amount, 87, reasoning, sig);

        assertEq(uint8(registry.getClaim(claimId).status), uint8(ClaimRegistry.Status.Paid));
        assertEq(usdc.balanceOf(alice) - aliceBefore, amount);
        assertEq(vaultBefore - vault.availableReserve(), amount);
        assertEq(vault.totalPaidOut(), amount);
        assertEq(policyManager.remainingCoverage(policyId), 80_000_000 - amount);

        (,,,,,, uint256 claimsCount,,) = policyManager.policies(policyId);
        assertEq(claimsCount, 1);
    }

    function test_RejectionPath_NoPayoutReasonOnChain() public {
        uint256 policyId = _buyPolicy(alice, 0);
        uint256 claimId = _submitClaim(alice, policyId);

        string memory reasoning = "REJECT: Red flags: anh chinh sua";
        bytes memory sig = _signVerdict(claimId, false, 0, 30, reasoning, oraclePk);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(oracle);
        registry.submitVerdict(claimId, false, 0, 30, reasoning, sig);

        ClaimRegistry.Claim memory c = registry.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimRegistry.Status.Rejected));
        assertEq(c.reasoning, reasoning);
        assertEq(usdc.balanceOf(alice), aliceBefore);
        assertEq(vault.totalPaidOut(), 0);
    }

    function test_DeadlinePath_AutomationRefundsStalledClaim() public {
        uint256 policyId = _buyPolicy(alice, 1);
        uint256 claimId = _submitClaim(alice, policyId);

        // Backend dies mid-pipeline.
        vm.prank(oracle);
        registry.updateStatus(claimId, ClaimRegistry.Status.Verifying);

        // Before the deadline the upkeep must stay idle.
        (bool needed,) = automation.checkUpkeep("");
        assertFalse(needed);

        vm.warp(block.timestamp + DEADLINE + 1);

        bytes memory performData;
        (needed, performData) = automation.checkUpkeep("");
        assertTrue(needed);

        uint256[] memory expired = abi.decode(performData, (uint256[]));
        assertEq(expired.length, 1);
        assertEq(expired[0], claimId);

        automation.performUpkeep(performData);

        assertEq(uint8(registry.getClaim(claimId).status), uint8(ClaimRegistry.Status.Refunded));
        assertEq(registry.getActiveClaims().length, 0);

        // Upkeep is idempotent: nothing left to do.
        (needed,) = automation.checkUpkeep("");
        assertFalse(needed);
    }

    function test_Automation_BatchesUpToMaxPerUpkeep() public {
        uint256 policyId = _buyPolicy(alice, 2); // 200 USDC coverage
        for (uint256 i = 0; i < 7; i++) {
            _submitClaim(alice, policyId);
        }
        assertEq(registry.getActiveClaims().length, 7);

        vm.warp(block.timestamp + DEADLINE + 1);

        (bool needed, bytes memory performData) = automation.checkUpkeep("");
        assertTrue(needed);
        assertEq(abi.decode(performData, (uint256[])).length, automation.MAX_CLAIMS_PER_UPKEEP());

        automation.performUpkeep(performData);
        assertEq(registry.getActiveClaims().length, 2);

        (needed, performData) = automation.checkUpkeep("");
        assertTrue(needed);
        automation.performUpkeep(performData);
        assertEq(registry.getActiveClaims().length, 0);
    }

    function test_CoverageExhaustion_SecondClaimBlocked() public {
        uint256 policyId = _buyPolicy(alice, 0); // 20 USDC coverage

        uint256 claimId = _submitClaim(alice, policyId);
        bytes memory sig = _signVerdict(claimId, true, 20_000_000, 95, "full", oraclePk);
        vm.prank(oracle);
        registry.submitVerdict(claimId, true, 20_000_000, 95, "full", sig);

        assertFalse(policyManager.isActive(policyId));

        vm.expectRevert(ClaimRegistry.PolicyNotActive.selector);
        vm.prank(alice);
        registry.submitClaim(policyId, "ipfs://Qm2", "second");
    }

    function test_MultipleClaimsAgainstSamePolicyDrainCoverage() public {
        uint256 policyId = _buyPolicy(alice, 1); // 80 USDC

        uint256 c1 = _submitClaim(alice, policyId);
        bytes memory s1 = _signVerdict(c1, true, 30_000_000, 90, "one", oraclePk);
        vm.prank(oracle);
        registry.submitVerdict(c1, true, 30_000_000, 90, "one", s1);
        assertEq(policyManager.remainingCoverage(policyId), 50_000_000);

        uint256 c2 = _submitClaim(alice, policyId);
        bytes memory s2 = _signVerdict(c2, true, 50_000_001, 90, "two", oraclePk);
        vm.expectRevert(ClaimRegistry.AmountExceedsCoverage.selector);
        vm.prank(oracle);
        registry.submitVerdict(c2, true, 50_000_001, 90, "two", s2);

        bytes memory s3 = _signVerdict(c2, true, 50_000_000, 90, "two", oraclePk);
        vm.prank(oracle);
        registry.submitVerdict(c2, true, 50_000_000, 90, "two", s3);
        assertEq(policyManager.remainingCoverage(policyId), 0);
    }
}
