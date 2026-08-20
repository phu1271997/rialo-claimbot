// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ClaimRegistry} from "../src/ClaimRegistry.sol";

/// @dev Fires a claim so the backend orchestrator has an event to react to.
contract SubmitTestClaim is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 policyId = vm.envOr("CLAIM_POLICY_ID", uint256(1));
        string memory evidence = vm.envOr("CLAIM_EVIDENCE_IPFS", string("ipfs://QmDemoEvidence"));
        string memory description =
            vm.envOr("CLAIM_DESCRIPTION", string("Minor collision at a junction, broken headlight"));

        string memory json = vm.readFile("./deployments/sepolia.json");
        address registryAddr = vm.parseJsonAddress(json, ".claimRegistry");

        vm.startBroadcast(pk);
        uint256 claimId = ClaimRegistry(registryAddr).submitClaim(policyId, evidence, description);
        vm.stopBroadcast();

        console.log("Claim ID:", claimId);
    }
}
