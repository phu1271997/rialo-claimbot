// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {ClaimRegistry} from "../src/ClaimRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract ClaimRegistryTest is BaseTest {
    uint256 internal policyId;

    function setUp() public override {
        super.setUp();
        policyId = _buyPolicy(alice, 1); // 80 USDC coverage
    }

    // ─── submitClaim ───

    function test_SubmitClaim_StoresAndIndexes() public {
        uint256 claimId = _submitClaim(alice, policyId);
        assertEq(claimId, 1);

        ClaimRegistry.Claim memory c = registry.getClaim(claimId);
        assertEq(c.policyId, policyId);
        assertEq(c.claimant, alice);
        assertEq(c.evidenceIPFS, "ipfs://QmEvidence");
        assertEq(c.deadline, block.timestamp + DEADLINE);
        assertEq(uint8(c.status), uint8(ClaimRegistry.Status.Submitted));

        assertEq(registry.getUserClaims(alice).length, 1);
        assertEq(registry.getActiveClaims().length, 1);
    }

    function test_RevertWhen_PolicyNotActive() public {
        vm.warp(block.timestamp + 31 days);
        vm.expectRevert(ClaimRegistry.PolicyNotActive.selector);
        vm.prank(alice);
        registry.submitClaim(policyId, "ipfs://Qm", "late");
    }

    function test_RevertWhen_NotPolicyHolder() public {
        vm.expectRevert(ClaimRegistry.NotClaimant.selector);
        vm.prank(bob);
        registry.submitClaim(policyId, "ipfs://Qm", "not mine");
    }

    function test_RevertWhen_EvidenceEmpty() public {
        vm.expectRevert(ClaimRegistry.EmptyEvidence.selector);
        vm.prank(alice);
        registry.submitClaim(policyId, "", "no evidence");
    }

    // ─── updateStatus ───

    function test_UpdateStatus_AdvancesForward() public {
        uint256 claimId = _submitClaim(alice, policyId);
        vm.startPrank(oracle);
        registry.updateStatus(claimId, ClaimRegistry.Status.Extracting);
        registry.updateStatus(claimId, ClaimRegistry.Status.Verifying);
        registry.updateStatus(claimId, ClaimRegistry.Status.Estimating);
        registry.updateStatus(claimId, ClaimRegistry.Status.Judged);
        vm.stopPrank();

        assertEq(uint8(registry.getClaim(claimId).status), uint8(ClaimRegistry.Status.Judged));
    }

    function test_RevertWhen_UpdateStatusFromNonOracle() public {
        uint256 claimId = _submitClaim(alice, policyId);
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, bob, registry.ORACLE_ROLE()
        );
        vm.expectRevert(expected);
        vm.prank(bob);
        registry.updateStatus(claimId, ClaimRegistry.Status.Extracting);
    }

    function test_RevertWhen_StatusRegresses() public {
        uint256 claimId = _submitClaim(alice, policyId);
        vm.prank(oracle);
        registry.updateStatus(claimId, ClaimRegistry.Status.Verifying);

        vm.expectRevert(ClaimRegistry.CannotRegress.selector);
        vm.prank(oracle);
        registry.updateStatus(claimId, ClaimRegistry.Status.Extracting);
    }

    function test_RevertWhen_StatusJumpsPastJudged() public {
        uint256 claimId = _submitClaim(alice, policyId);
        vm.expectRevert(ClaimRegistry.UseSubmitVerdict.selector);
        vm.prank(oracle);
        registry.updateStatus(claimId, ClaimRegistry.Status.Paid);
    }

    // ─── submitVerdict ───

    function test_SubmitVerdict_ApprovedPaysClaimant() public {
        uint256 claimId = _submitClaim(alice, policyId);
        uint256 amount = 12_000_000;
        string memory reasoning = "APPROVED (confidence 88%)";
        bytes memory sig = _signVerdict(claimId, true, amount, 88, reasoning, oraclePk);

        uint256 balanceBefore = usdc.balanceOf(alice);
        vm.prank(oracle);
        registry.submitVerdict(claimId, true, amount, 88, reasoning, sig);

        ClaimRegistry.Claim memory c = registry.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimRegistry.Status.Paid));
        assertEq(c.approvedAmount, amount);
        assertEq(c.confidence, 88);
        assertEq(c.reasoning, reasoning);
        assertEq(usdc.balanceOf(alice) - balanceBefore, amount);
        assertEq(policyManager.remainingCoverage(policyId), 80_000_000 - amount);
        assertEq(registry.getActiveClaims().length, 0);
    }

    function test_SubmitVerdict_RejectedDoesNotPay() public {
        uint256 claimId = _submitClaim(alice, policyId);
        string memory reasoning = "REJECT: red flags";
        bytes memory sig = _signVerdict(claimId, false, 0, 20, reasoning, oraclePk);

        uint256 balanceBefore = usdc.balanceOf(alice);
        vm.prank(oracle);
        registry.submitVerdict(claimId, false, 0, 20, reasoning, sig);

        ClaimRegistry.Claim memory c = registry.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimRegistry.Status.Rejected));
        assertEq(c.approvedAmount, 0);
        assertEq(usdc.balanceOf(alice), balanceBefore);
        assertEq(registry.getActiveClaims().length, 0);
    }

    function test_RevertWhen_SignatureFromUnknownSigner() public {
        uint256 claimId = _submitClaim(alice, policyId);
        uint256 rogueKey = 0xBADBAD;
        bytes memory sig = _signVerdict(claimId, true, 1_000_000, 90, "hi", rogueKey);

        vm.expectRevert(ClaimRegistry.InvalidSignature.selector);
        vm.prank(oracle);
        registry.submitVerdict(claimId, true, 1_000_000, 90, "hi", sig);
    }

    function test_RevertWhen_SignaturePayloadTampered() public {
        uint256 claimId = _submitClaim(alice, policyId);
        bytes memory sig = _signVerdict(claimId, true, 1_000_000, 90, "ok", oraclePk);

        // Same signature, inflated amount.
        vm.expectRevert(ClaimRegistry.InvalidSignature.selector);
        vm.prank(oracle);
        registry.submitVerdict(claimId, true, 50_000_000, 90, "ok", sig);
    }

    function test_RevertWhen_AmountExceedsCoverage() public {
        uint256 claimId = _submitClaim(alice, policyId);
        uint256 amount = 80_000_001;
        bytes memory sig = _signVerdict(claimId, true, amount, 95, "big", oraclePk);

        vm.expectRevert(ClaimRegistry.AmountExceedsCoverage.selector);
        vm.prank(oracle);
        registry.submitVerdict(claimId, true, amount, 95, "big", sig);
    }

    function test_RevertWhen_ApprovedAmountIsZero() public {
        uint256 claimId = _submitClaim(alice, policyId);
        bytes memory sig = _signVerdict(claimId, true, 0, 95, "zero", oraclePk);

        vm.expectRevert(ClaimRegistry.ZeroApprovedAmount.selector);
        vm.prank(oracle);
        registry.submitVerdict(claimId, true, 0, 95, "zero", sig);
    }

    function test_RevertWhen_VerdictAfterDeadline() public {
        uint256 claimId = _submitClaim(alice, policyId);
        bytes memory sig = _signVerdict(claimId, true, 1_000_000, 90, "late", oraclePk);

        vm.warp(block.timestamp + DEADLINE + 1);
        vm.expectRevert(ClaimRegistry.DeadlineExceeded.selector);
        vm.prank(oracle);
        registry.submitVerdict(claimId, true, 1_000_000, 90, "late", sig);
    }

    function test_RevertWhen_VerdictOnFinalizedClaim() public {
        uint256 claimId = _submitClaim(alice, policyId);
        bytes memory sig = _signVerdict(claimId, false, 0, 10, "no", oraclePk);
        vm.prank(oracle);
        registry.submitVerdict(claimId, false, 0, 10, "no", sig);

        vm.expectRevert(ClaimRegistry.InvalidStatus.selector);
        vm.prank(oracle);
        registry.submitVerdict(claimId, false, 0, 10, "no", sig);
    }

    function test_RevertWhen_VerdictFromNonOracle() public {
        uint256 claimId = _submitClaim(alice, policyId);
        bytes memory sig = _signVerdict(claimId, true, 1_000_000, 90, "ok", oraclePk);

        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, bob, registry.ORACLE_ROLE()
        );
        vm.expectRevert(expected);
        vm.prank(bob);
        registry.submitVerdict(claimId, true, 1_000_000, 90, "ok", sig);
    }

    function test_VerdictHashFor_MatchesOffchainEncoding() public view {
        bytes32 onchain = registry.verdictHashFor(7, true, 1_234_567, 91, "reason text");
        bytes32 expected = keccak256(abi.encode(uint256(7), true, uint256(1_234_567), uint8(91), "reason text"));
        assertEq(onchain, expected);
    }

    // ─── refundExpiredClaim ───

    function test_RefundExpiredClaim_MarksRefunded() public {
        uint256 claimId = _submitClaim(alice, policyId);
        vm.warp(block.timestamp + DEADLINE + 1);

        vm.prank(address(automation));
        registry.refundExpiredClaim(claimId);

        assertEq(uint8(registry.getClaim(claimId).status), uint8(ClaimRegistry.Status.Refunded));
        assertEq(registry.getActiveClaims().length, 0);
    }

    function test_RevertWhen_RefundBeforeDeadline() public {
        uint256 claimId = _submitClaim(alice, policyId);
        vm.expectRevert(ClaimRegistry.DeadlineNotReached.selector);
        vm.prank(address(automation));
        registry.refundExpiredClaim(claimId);
    }

    function test_RevertWhen_RefundFromNonAutomation() public {
        uint256 claimId = _submitClaim(alice, policyId);
        vm.warp(block.timestamp + DEADLINE + 1);

        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, bob, registry.AUTOMATION_ROLE()
        );
        vm.expectRevert(expected);
        vm.prank(bob);
        registry.refundExpiredClaim(claimId);
    }

    function test_RevertWhen_RefundAlreadyPaidClaim() public {
        uint256 claimId = _submitClaim(alice, policyId);
        bytes memory sig = _signVerdict(claimId, true, 1_000_000, 90, "ok", oraclePk);
        vm.prank(oracle);
        registry.submitVerdict(claimId, true, 1_000_000, 90, "ok", sig);

        vm.warp(block.timestamp + DEADLINE + 1);
        vm.expectRevert(ClaimRegistry.InvalidStatus.selector);
        vm.prank(address(automation));
        registry.refundExpiredClaim(claimId);
    }

    // ─── active set bookkeeping ───

    function test_ActiveSet_SwapAndPopKeepsRemainingClaims() public {
        uint256 c1 = _submitClaim(alice, policyId);
        uint256 c2 = _submitClaim(alice, policyId);
        uint256 c3 = _submitClaim(alice, policyId);
        assertEq(registry.getActiveClaims().length, 3);

        // Finalize the middle one; the other two must survive intact.
        bytes memory sig = _signVerdict(c2, false, 0, 10, "no", oraclePk);
        vm.prank(oracle);
        registry.submitVerdict(c2, false, 0, 10, "no", sig);

        uint256[] memory active = registry.getActiveClaims();
        assertEq(active.length, 2);

        bool hasC1;
        bool hasC3;
        for (uint256 i = 0; i < active.length; i++) {
            if (active[i] == c1) hasC1 = true;
            if (active[i] == c3) hasC3 = true;
        }
        assertTrue(hasC1);
        assertTrue(hasC3);
    }
}
