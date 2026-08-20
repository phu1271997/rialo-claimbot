// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {ClaimRegistry} from "../src/ClaimRegistry.sol";
import {PayoutVault} from "../src/PayoutVault.sol";
import {ClaimAutomation} from "../src/ClaimAutomation.sol";

contract Deploy is Script {
    /// @dev Circle test USDC on Ethereum Sepolia.
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        address usdc = vm.envOr("USDC_ADDRESS", SEPOLIA_USDC);
        // Shorten for demos: `CLAIM_DEADLINE_SECONDS=300 forge script ...`
        uint256 deadline = vm.envOr("CLAIM_DEADLINE_SECONDS", uint256(48 hours));

        vm.startBroadcast(pk);

        PayoutVault vault = new PayoutVault(usdc);
        PolicyManager policyManager = new PolicyManager(usdc, deployer);
        ClaimRegistry registry =
            new ClaimRegistry(address(policyManager), address(vault), deadline);
        ClaimAutomation automation = new ClaimAutomation(address(registry));

        // Wire roles.
        vault.grantClaimRegistryRole(address(registry));
        registry.grantOracleRole(oracleAddress);
        registry.grantAutomationRole(address(automation));
        policyManager.grantRole(policyManager.ADMIN_ROLE(), address(registry));

        vm.stopBroadcast();

        console.log("PayoutVault:    ", address(vault));
        console.log("PolicyManager:  ", address(policyManager));
        console.log("ClaimRegistry:  ", address(registry));
        console.log("ClaimAutomation:", address(automation));
        console.log("USDC:           ", usdc);
        console.log("Oracle:         ", oracleAddress);
        console.log("Deadline (s):   ", deadline);

        string memory json = string.concat(
            '{\n  "chainId": ',
            vm.toString(block.chainid),
            ',\n  "payoutVault": "',
            vm.toString(address(vault)),
            '",\n  "policyManager": "',
            vm.toString(address(policyManager)),
            '",\n  "claimRegistry": "',
            vm.toString(address(registry)),
            '",\n  "claimAutomation": "',
            vm.toString(address(automation)),
            '",\n  "usdc": "',
            vm.toString(usdc),
            '",\n  "oracle": "',
            vm.toString(oracleAddress),
            '",\n  "claimDeadlineSeconds": ',
            vm.toString(deadline),
            "\n}\n"
        );
        vm.writeFile("./deployments/sepolia.json", json);
    }
}
