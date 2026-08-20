// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VehicleVerifier} from "../src/VehicleVerifier.sol";
import {IFunctionsRouter} from
    "@chainlink/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsRouter.sol";

/// @dev The Sepolia Functions router is mocked so the CBOR encode + callback path is exercised.
contract VehicleVerifierTest is Test {
    VehicleVerifier internal verifier;

    address internal constant ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 internal constant REQUEST_ID = keccak256("request-1");
    uint64 internal constant SUB_ID = 3521;

    address internal owner = address(this);
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        vm.mockCall(
            ROUTER, abi.encodeWithSelector(IFunctionsRouter.sendRequest.selector), abi.encode(REQUEST_ID)
        );
        verifier = new VehicleVerifier(SUB_ID);
    }

    function test_Constructor_SetsSubscriptionAndOwner() public view {
        assertEq(verifier.subscriptionId(), SUB_ID);
        assertEq(verifier.owner(), owner);
        assertEq(verifier.gasLimit(), 300_000);
        assertEq(verifier.ROUTER(), ROUTER);
    }

    function test_RequestVerification_MapsRequestToClaim() public {
        bytes32 requestId = verifier.requestVerification(42, "51-A1-2345");
        assertEq(requestId, REQUEST_ID);
        assertEq(verifier.requestToClaimId(requestId), 42);
    }

    function test_RevertWhen_RequestFromNonOwner() public {
        vm.expectRevert();
        vm.prank(stranger);
        verifier.requestVerification(1, "51-A1-2345");
    }

    function test_Fulfill_StoresResultOnSuccess() public {
        verifier.requestVerification(42, "51-A1-2345");

        string memory payload = '{"valid":true,"owner_match":true,"active_insurance":true}';
        vm.prank(ROUTER);
        verifier.handleOracleFulfillment(REQUEST_ID, bytes(payload), "");

        assertEq(verifier.claimVerification(42), payload);
        assertEq(verifier.claimVerificationError(42).length, 0);
    }

    function test_Fulfill_StoresErrorOnFailure() public {
        verifier.requestVerification(42, "51-A1-2345");

        vm.prank(ROUTER);
        verifier.handleOracleFulfillment(REQUEST_ID, "", bytes("API failed"));

        assertEq(verifier.claimVerification(42), "");
        assertEq(string(verifier.claimVerificationError(42)), "API failed");
    }

    function test_RevertWhen_FulfillFromNonRouter() public {
        verifier.requestVerification(42, "51-A1-2345");
        vm.expectRevert();
        vm.prank(stranger);
        verifier.handleOracleFulfillment(REQUEST_ID, bytes("x"), "");
    }

    function test_OwnerSetters() public {
        verifier.setSubscriptionId(999);
        verifier.setGasLimit(500_000);
        verifier.setSourceCode("return Functions.encodeString('ok');");

        assertEq(verifier.subscriptionId(), 999);
        assertEq(verifier.gasLimit(), 500_000);
        assertEq(verifier.sourceCode(), "return Functions.encodeString('ok');");
    }

    function test_RevertWhen_SettersFromNonOwner() public {
        vm.expectRevert();
        vm.prank(stranger);
        verifier.setSubscriptionId(1);
    }
}
