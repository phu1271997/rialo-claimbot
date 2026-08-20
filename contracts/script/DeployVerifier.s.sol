// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VehicleVerifier} from "../src/VehicleVerifier.sol";

/// @dev Deployed separately because it needs a funded Chainlink Functions subscription.
contract DeployVerifier is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint64 subscriptionId = uint64(vm.envUint("FUNCTIONS_SUBSCRIPTION_ID"));

        vm.startBroadcast(pk);
        VehicleVerifier verifier = new VehicleVerifier(subscriptionId);
        vm.stopBroadcast();

        console.log("VehicleVerifier:", address(verifier));
        console.log("Add it as a consumer at https://functions.chain.link");
    }
}
