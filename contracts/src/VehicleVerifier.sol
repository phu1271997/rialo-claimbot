// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from
    "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from
    "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

/**
 * @notice Chainlink Functions consumer that verifies a license plate against a DMV endpoint.
 * @dev On Rialo this whole contract collapses into a single native webcall.
 */
contract VehicleVerifier is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    // Sepolia Functions router + DON
    address public constant ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 public constant DON_ID =
        0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;

    uint64 public subscriptionId;
    uint32 public gasLimit = 300_000;

    string public sourceCode = "const plate = args[0];"
        "const response = await Functions.makeHttpRequest({"
        "  url: `https://vn-dmv-mock.claimbot.io/verify/${plate}`," "  method: 'GET'" "});"
        "if (response.error) throw Error('API failed');" "const data = response.data;"
        "return Functions.encodeString(JSON.stringify({" "  valid: data.valid,"
        "  owner_match: data.ownerMatch," "  active_insurance: data.hasActive" "}));";

    mapping(bytes32 => uint256) public requestToClaimId;
    mapping(uint256 => string) public claimVerification;
    mapping(uint256 => bytes) public claimVerificationError;

    event VerificationRequested(bytes32 indexed requestId, uint256 indexed claimId);
    event VerificationFulfilled(uint256 indexed claimId, string result);
    event VerificationFailed(uint256 indexed claimId, bytes err);

    constructor(uint64 _subscriptionId) FunctionsClient(ROUTER) ConfirmedOwner(msg.sender) {
        subscriptionId = _subscriptionId;
    }

    function requestVerification(uint256 claimId, string calldata licensePlate)
        external
        onlyOwner
        returns (bytes32 requestId)
    {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(sourceCode);
        string[] memory args = new string[](1);
        args[0] = licensePlate;
        req.setArgs(args);

        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, gasLimit, DON_ID);
        requestToClaimId[requestId] = claimId;
        emit VerificationRequested(requestId, claimId);
    }

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err)
        internal
        override
    {
        uint256 claimId = requestToClaimId[requestId];
        if (err.length > 0) {
            claimVerificationError[claimId] = err;
            emit VerificationFailed(claimId, err);
            return;
        }
        string memory result = string(response);
        claimVerification[claimId] = result;
        emit VerificationFulfilled(claimId, result);
    }

    function setSubscriptionId(uint64 newId) external onlyOwner {
        subscriptionId = newId;
    }

    function setGasLimit(uint32 newGasLimit) external onlyOwner {
        gasLimit = newGasLimit;
    }

    function setSourceCode(string calldata newSource) external onlyOwner {
        sourceCode = newSource;
    }
}
