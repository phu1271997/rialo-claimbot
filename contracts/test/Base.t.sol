// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {PayoutVault} from "../src/PayoutVault.sol";
import {ClaimRegistry} from "../src/ClaimRegistry.sol";
import {ClaimAutomation} from "../src/ClaimAutomation.sol";

/// @dev Shared fixture: deploys the full stack and wires the roles like Deploy.s.sol does.
abstract contract BaseTest is Test {
    MockUSDC internal usdc;
    PolicyManager internal policyManager;
    PayoutVault internal vault;
    ClaimRegistry internal registry;
    ClaimAutomation internal automation;

    address internal admin = address(this);
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal oraclePk = 0xA11CE;
    address internal oracle;

    uint256 internal constant DEADLINE = 48 hours;
    uint256 internal constant VAULT_FUNDING = 1_000_000_000; // 1,000 USDC

    bytes32 internal constant VEHICLE_HASH = keccak256("51-A1-2345|VIN123");

    function setUp() public virtual {
        oracle = vm.addr(oraclePk);

        usdc = new MockUSDC();
        vault = new PayoutVault(address(usdc));
        policyManager = new PolicyManager(address(usdc), treasury);
        registry = new ClaimRegistry(address(policyManager), address(vault), DEADLINE);
        automation = new ClaimAutomation(address(registry));

        vault.grantClaimRegistryRole(address(registry));
        registry.grantOracleRole(oracle);
        registry.grantAutomationRole(address(automation));
        policyManager.grantRole(policyManager.ADMIN_ROLE(), address(registry));

        // Fund the reserve.
        usdc.mint(admin, VAULT_FUNDING);
        usdc.approve(address(vault), VAULT_FUNDING);
        vault.fundReserve(VAULT_FUNDING);

        // Give the users spending money.
        usdc.mint(alice, 100_000_000);
        usdc.mint(bob, 100_000_000);
    }

    function _buyPolicy(address who, uint256 tierId) internal returns (uint256 policyId) {
        (uint256 premium,,) = policyManager.tiers(tierId);
        vm.startPrank(who);
        usdc.approve(address(policyManager), premium);
        policyId = policyManager.purchasePolicy(tierId, VEHICLE_HASH);
        vm.stopPrank();
    }

    function _submitClaim(address who, uint256 policyId) internal returns (uint256 claimId) {
        vm.prank(who);
        claimId = registry.submitClaim(policyId, "ipfs://QmEvidence", "Minor collision at a junction");
    }

    function _signVerdict(
        uint256 claimId,
        bool approved,
        uint256 amount,
        uint8 confidence,
        string memory reasoning,
        uint256 signerPk
    ) internal pure returns (bytes memory) {
        bytes32 payloadHash = keccak256(abi.encode(claimId, approved, amount, confidence, reasoning));
        bytes32 ethHash =
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethHash);
        return abi.encodePacked(r, s, v);
    }
}
