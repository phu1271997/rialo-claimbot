// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PayoutVault} from "../src/PayoutVault.sol";

/// @dev Tops up the payout reserve. Amount is in whole USDC, e.g. FUND_AMOUNT_USDC=200.
contract FundVault is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 whole = vm.envOr("FUND_AMOUNT_USDC", uint256(200));
        uint256 amount = whole * 1e6;

        string memory json = vm.readFile("./deployments/sepolia.json");
        address vaultAddr = vm.parseJsonAddress(json, ".payoutVault");
        address usdc = vm.parseJsonAddress(json, ".usdc");

        vm.startBroadcast(pk);
        IERC20(usdc).approve(vaultAddr, amount);
        PayoutVault(vaultAddr).fundReserve(amount);
        vm.stopBroadcast();

        console.log("Funded vault:", vaultAddr);
        console.log("Amount (USDC 6dp):", amount);
    }
}
