// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AutomationCompatibleInterface} from
    "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {IClaimRegistry} from "./interfaces/IClaimRegistry.sol";

/**
 * @notice Chainlink Automation upkeep that refunds claims past their deadline.
 * @dev Register at automation.chain.link with a "Custom Logic" trigger.
 */
contract ClaimAutomation is AutomationCompatibleInterface {
    IClaimRegistry public immutable registry;
    uint256 public constant MAX_CLAIMS_PER_UPKEEP = 5;

    event UpkeepPerformed(uint256 indexed claimId, bool success);

    error ZeroAddress();

    constructor(address _registry) {
        if (_registry == address(0)) revert ZeroAddress();
        registry = IClaimRegistry(_registry);
    }

    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256[] memory active = registry.getActiveClaims();
        uint256[] memory expired = new uint256[](MAX_CLAIMS_PER_UPKEEP);
        uint256 count = 0;

        for (uint256 i = 0; i < active.length && count < MAX_CLAIMS_PER_UPKEEP; i++) {
            (,,,,, uint256 deadline, IClaimRegistry.Status status,,,,) = registry.claims(active[i]);
            if (block.timestamp > deadline && uint8(status) < uint8(IClaimRegistry.Status.Paid)) {
                expired[count++] = active[i];
            }
        }

        if (count == 0) return (false, "");

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = expired[i];
        }
        return (true, abi.encode(result));
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256[] memory expired = abi.decode(performData, (uint256[]));
        for (uint256 i = 0; i < expired.length; i++) {
            // Re-validate on-chain: performData is attacker-supplied in the general case,
            // but refundExpiredClaim itself enforces deadline + finalized checks.
            try registry.refundExpiredClaim(expired[i]) {
                emit UpkeepPerformed(expired[i], true);
            } catch {
                emit UpkeepPerformed(expired[i], false);
            }
        }
    }
}
