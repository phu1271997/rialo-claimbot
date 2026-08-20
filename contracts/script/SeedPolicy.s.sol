// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PolicyManager} from "../src/PolicyManager.sol";

/// @dev Buys a demo policy so a fresh deployment has something to claim against.
contract SeedPolicy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 tierId = vm.envOr("SEED_TIER_ID", uint256(1));
        string memory plate = vm.envOr("SEED_PLATE", string("51-A1-2345"));

        string memory json = vm.readFile("./deployments/sepolia.json");
        address pmAddr = vm.parseJsonAddress(json, ".policyManager");
        address usdc = vm.parseJsonAddress(json, ".usdc");

        PolicyManager pm = PolicyManager(pmAddr);
        (uint256 premium,,) = pm.tiers(tierId);

        vm.startBroadcast(pk);
        IERC20(usdc).approve(pmAddr, premium);
        uint256 policyId = pm.purchasePolicy(tierId, keccak256(abi.encodePacked(plate)));
        vm.stopBroadcast();

        console.log("Policy ID:", policyId);
        console.log("Plate:    ", plate);
        console.log("Premium:  ", premium);
    }
}
