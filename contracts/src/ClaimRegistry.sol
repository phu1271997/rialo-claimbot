// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPolicyManager} from "./interfaces/IPolicyManager.sol";
import {IPayoutVault} from "./interfaces/IPayoutVault.sol";
import {VerdictSignature} from "./libraries/VerdictSignature.sol";

/**
 * @title ClaimRegistry
 * @notice State machine for a claim. Calls PayoutVault once a verdict approves it.
 */
contract ClaimRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");

    uint256 public immutable claimDeadline;

    enum Status {
        Submitted, // 0
        Extracting, // 1
        Verifying, // 2
        Estimating, // 3
        Judged, // 4
        Paid, // 5
        Rejected, // 6
        Refunded, // 7 - via Chainlink Automation
        Disputed // 8 - future

    }

    struct Claim {
        uint256 policyId;
        address claimant;
        string evidenceIPFS;
        string description;
        uint256 submittedAt;
        uint256 deadline;
        Status status;
        uint256 approvedAmount;
        uint8 confidence;
        string reasoning;
        bytes32 verdictHash;
    }

    IPolicyManager public immutable policyManager;
    IPayoutVault public immutable payoutVault;

    uint256 public nextClaimId = 1;
    mapping(uint256 => Claim) public claims;
    mapping(address => uint256[]) public claimsByUser;
    uint256[] public activeClaimIds;
    mapping(uint256 => uint256) private _activeIndexPlusOne;

    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        string evidenceIPFS
    );
    event StatusUpdated(uint256 indexed claimId, Status newStatus);
    event VerdictSubmitted(
        uint256 indexed claimId, bool approved, uint256 amount, uint8 confidence
    );
    event ClaimRefunded(uint256 indexed claimId, string reason);

    error PolicyNotActive();
    error NotClaimant();
    error InvalidStatus();
    error DeadlineExceeded();
    error DeadlineNotReached();
    error AmountExceedsCoverage();
    error InvalidSignature();
    error CannotRegress();
    error UseSubmitVerdict();
    error ZeroAddress();
    error EmptyEvidence();
    error ZeroApprovedAmount();

    constructor(address _policyManager, address _payoutVault, uint256 _claimDeadline) {
        if (_policyManager == address(0) || _payoutVault == address(0)) revert ZeroAddress();
        policyManager = IPolicyManager(_policyManager);
        payoutVault = IPayoutVault(_payoutVault);
        claimDeadline = _claimDeadline == 0 ? 48 hours : _claimDeadline;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function submitClaim(uint256 policyId, string calldata evidenceIPFS, string calldata description)
        external
        nonReentrant
        returns (uint256 claimId)
    {
        if (bytes(evidenceIPFS).length == 0) revert EmptyEvidence();
        if (!policyManager.isActive(policyId)) revert PolicyNotActive();

        (address holder,,,,,,,,) = policyManager.policies(policyId);
        if (holder != msg.sender) revert NotClaimant();

        claimId = nextClaimId++;
        claims[claimId] = Claim({
            policyId: policyId,
            claimant: msg.sender,
            evidenceIPFS: evidenceIPFS,
            description: description,
            submittedAt: block.timestamp,
            deadline: block.timestamp + claimDeadline,
            status: Status.Submitted,
            approvedAmount: 0,
            confidence: 0,
            reasoning: "",
            verdictHash: bytes32(0)
        });
        claimsByUser[msg.sender].push(claimId);
        _addToActive(claimId);

        emit ClaimSubmitted(claimId, policyId, msg.sender, evidenceIPFS);
    }

    /// @notice Oracle advances the pipeline status. Forward-only, up to Judged.
    function updateStatus(uint256 claimId, Status newStatus) external onlyRole(ORACLE_ROLE) {
        Claim storage c = claims[claimId];
        if (uint8(newStatus) <= uint8(c.status)) revert CannotRegress();
        if (uint8(newStatus) > uint8(Status.Judged)) revert UseSubmitVerdict();
        c.status = newStatus;
        emit StatusUpdated(claimId, newStatus);
    }

    /**
     * @notice Oracle submits the final verdict with a signature over the payload.
     * @dev Payload hash must match VerdictSignature.hash — see backend utils/signature.ts.
     */
    function submitVerdict(
        uint256 claimId,
        bool approved,
        uint256 amount,
        uint8 confidence,
        string calldata reasoning,
        bytes calldata signature
    ) external nonReentrant onlyRole(ORACLE_ROLE) {
        Claim storage c = claims[claimId];
        if (c.claimant == address(0)) revert InvalidStatus();
        if (block.timestamp > c.deadline) revert DeadlineExceeded();
        if (_isFinalized(c.status)) revert InvalidStatus();

        bytes32 payloadHash =
            VerdictSignature.hash(claimId, approved, amount, confidence, reasoning);
        address signer = VerdictSignature.recoverSigner(payloadHash, signature);
        if (!hasRole(ORACLE_ROLE, signer)) revert InvalidSignature();

        c.confidence = confidence;
        c.reasoning = reasoning;
        c.verdictHash = payloadHash;

        if (approved) {
            if (amount == 0) revert ZeroApprovedAmount();
            uint256 remaining = policyManager.remainingCoverage(c.policyId);
            if (amount > remaining) revert AmountExceedsCoverage();

            c.status = Status.Paid;
            c.approvedAmount = amount;
            _removeFromActive(claimId);

            policyManager.recordPayout(c.policyId, amount);
            payoutVault.executePayout(c.claimant, amount);
        } else {
            c.status = Status.Rejected;
            _removeFromActive(claimId);
        }

        emit VerdictSubmitted(claimId, approved, amount, confidence);
    }

    /// @notice Chainlink Automation fallback when the pipeline misses the deadline.
    function refundExpiredClaim(uint256 claimId) external onlyRole(AUTOMATION_ROLE) {
        Claim storage c = claims[claimId];
        if (c.claimant == address(0)) revert InvalidStatus();
        if (block.timestamp <= c.deadline) revert DeadlineNotReached();
        if (_isFinalized(c.status)) revert InvalidStatus();

        c.status = Status.Refunded;
        _removeFromActive(claimId);
        emit ClaimRefunded(claimId, "Deadline exceeded");
    }

    function getActiveClaims() external view returns (uint256[] memory) {
        return activeClaimIds;
    }

    function activeClaimsCount() external view returns (uint256) {
        return activeClaimIds.length;
    }

    function getUserClaims(address user) external view returns (uint256[] memory) {
        return claimsByUser[user];
    }

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }

    function verdictHashFor(
        uint256 claimId,
        bool approved,
        uint256 amount,
        uint8 confidence,
        string calldata reasoning
    ) external pure returns (bytes32) {
        return VerdictSignature.hash(claimId, approved, amount, confidence, reasoning);
    }

    function grantOracleRole(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (oracle == address(0)) revert ZeroAddress();
        _grantRole(ORACLE_ROLE, oracle);
    }

    function grantAutomationRole(address automation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (automation == address(0)) revert ZeroAddress();
        _grantRole(AUTOMATION_ROLE, automation);
    }

    // ─── internal ───

    function _isFinalized(Status s) internal pure returns (bool) {
        return s == Status.Paid || s == Status.Rejected || s == Status.Refunded;
    }

    function _addToActive(uint256 claimId) internal {
        activeClaimIds.push(claimId);
        _activeIndexPlusOne[claimId] = activeClaimIds.length;
    }

    /// @dev O(1) swap-and-pop; avoids the unbounded loop the naive version needs.
    function _removeFromActive(uint256 claimId) internal {
        uint256 indexPlusOne = _activeIndexPlusOne[claimId];
        if (indexPlusOne == 0) return;

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = activeClaimIds.length - 1;
        if (index != lastIndex) {
            uint256 movedId = activeClaimIds[lastIndex];
            activeClaimIds[index] = movedId;
            _activeIndexPlusOne[movedId] = index + 1;
        }
        activeClaimIds.pop();
        delete _activeIndexPlusOne[claimId];
    }
}
