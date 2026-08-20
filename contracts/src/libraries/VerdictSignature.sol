// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title VerdictSignature
 * @notice Single source of truth for how an AI verdict is hashed and signed.
 * @dev Uses `abi.encode` (NOT `abi.encodePacked`) so the dynamic `reasoning`
 *      string cannot be used to craft a colliding payload. The backend must
 *      mirror this with ethers `AbiCoder.defaultAbiCoder().encode(...)`.
 */
library VerdictSignature {
    using MessageHashUtils for bytes32;

    /// @notice Raw payload hash for a verdict.
    function hash(
        uint256 claimId,
        bool approved,
        uint256 amount,
        uint8 confidence,
        string memory reasoning
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(claimId, approved, amount, confidence, reasoning));
    }

    /// @notice Recovers the signer of an EIP-191 (`personal_sign`) verdict signature.
    function recoverSigner(bytes32 payloadHash, bytes memory signature)
        internal
        pure
        returns (address)
    {
        return ECDSA.recover(payloadHash.toEthSignedMessageHash(), signature);
    }
}
