# ClaimBot — AI Insurance Claim Processor trên Ethereum Sepolia

> **Project spec cho Claude Code**
> Đây là tài liệu đầy đủ để build từ zero → production-ready MVP.
> Đọc từ đầu tới cuối trước khi code. Follow đúng thứ tự trong Development Roadmap.

---

## MỤC LỤC

1. [Context: Rialo là gì và tại sao dự án này tồn tại](#1-context-rialo)
2. [Project Overview](#2-project-overview)
3. [Architecture tổng thể](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Folder Structure](#5-folder-structure)
6. [Smart Contracts (full spec)](#6-smart-contracts)
7. [Backend AI Agent Pipeline](#7-backend)
8. [Frontend Application](#8-frontend)
9. [Chainlink Integration](#9-chainlink)
10. [Environment Variables](#10-env)
11. [Deployment Guide](#11-deployment)
12. [Testing Plan](#12-testing)
13. [Development Roadmap](#13-roadmap)
14. [Acceptance Criteria](#14-acceptance)
15. [Common Issues & Solutions](#15-troubleshooting)

---

<a name="1-context-rialo"></a>

# 1. CONTEXT: RIALO — TẠI SAO DỰ ÁN NÀY TỒN TẠI

## 1.1. Rialo là gì?

**Rialo** là một Layer 1 blockchain mới, được backed bởi Coinbase, Pantera Capital, Susquehanna, Mysten Labs, và partner với Nasdaq, CBOE, NYSE. Team đứng sau là **Subzero Labs**, với contributors đến từ Meta, Google, Solana, Near, EigenLayer, Diem.

Rialo tự định vị là **"the real-world blockchain"** — blockchain được thiết kế từ đầu để **kết nối trực tiếp với thế giới thực** (Web2 APIs, real-world data, off-chain events) mà không cần middleware.

## 1.2. Vấn đề Rialo giải quyết

Các blockchain hiện tại (Ethereum, Solana, v.v.) tồn tại như những "hòn đảo cô lập" — không thể tương tác trực tiếp với thế giới thực. Developer phải ghép nối rất nhiều middleware:

- **Oracle** (Chainlink) để đưa data off-chain lên on-chain
- **Keeper/Automation bot** để trigger transaction theo lịch
- **Indexer** (The Graph) để đọc data on-chain hiệu quả
- **Bridge** để chuyển asset giữa các chain
- **Backend server** để orchestrate mọi thứ

Kết quả: dev tốn **~90% thời gian ghép middleware**, chỉ 10% viết business logic. Cost cao, latency cao, trust surface lớn (mỗi service là 1 điểm fail tiềm năng).

## 1.3. 4 "siêu năng lực" cốt lõi của Rialo

**A. Native Webcalls** — Smart contract gọi HTTPS API trực tiếp bằng 1 dòng code:
```rust
// Pseudo-code Rialo
let weather = Http::get("https://api.openweather.com/...").await?;
```
Không cần Chainlink Functions, không cần oracle. Verifiable qua consensus.

**B. Native Timers & Reactive Transactions** — Contract có thể "ngủ" xuyên block, tự thức dậy khi timer/event trigger:
```rust
sleep(48.hours).then(|| refund_user());
```
Không cần keeper bot chạy off-chain.

**C. RISC-V Execution** — VM chạy RISC-V thay vì EVM. Cho phép logic phức tạp: async/await, loops, sleeping contracts. Contract gần với "normal software" hơn.

**D. Configurable Privacy + Real-World Identity** — Login bằng email/SMS/social. Privacy tùy chỉnh cho từng transaction. Có 2FA. Support programmable will (smart contract "di chúc").

## 1.4. Vì sao ClaimBot chọn Sepolia (không phải Rialo)?

Rialo hiện chỉ có **Private DevNet** (cần early access). Chưa public mainnet/testnet cho general builder. Do đó chiến lược là:

1. **Build trên Sepolia** (Ethereum testnet) với các workaround: Chainlink Functions thay webcalls, Chainlink Automation thay native timers, Node.js backend thay reactive execution.
2. **Trong AMA, so sánh side-by-side**: "Trên Sepolia tôi phải viết 2000 dòng code + ghép 5 service. Trên Rialo chỉ cần 500 dòng, 1 service." → chứng minh anh hiểu sâu pain point Rialo giải quyết.
3. Dự án này sẽ **migrate lên Rialo native** khi mainnet public.

## 1.5. Tại sao AI Agent + Insurance = fit hoàn hảo với Rialo

Rialo có **SCALE (Simple Contracts for Agent Labor Execution)** — framework để pay AI agents làm task với escrow + deadline + quality judge. Blog gốc: [Making the Agent Economy Simple and Safe with Rialo](https://www.rialo.io/posts/making-the-agent-economy-simple-and-safe-with-rialo).

Insurance claim processing là **use case xịn nhất** cho AI agent workflow:
- Multi-agent verification (extract → verify → estimate → judge)
- Cần escrow (payout money)
- Cần deadline (SLA 48h)
- Cần external data (weather, DMV, image analysis)
- Real-world utility, không phải speculation

Đây chính là câu chuyện anh sẽ pitch tại AMA.

---

<a name="2-project-overview"></a>

# 2. PROJECT OVERVIEW

## 2.1. Tên dự án

**ClaimBot** — AI-Powered Micro-Insurance Claim Processor cho xe máy tại Việt Nam.

## 2.2. Value Proposition

> "Nộp claim bảo hiểm xe máy trong 90 giây thay vì 2-4 tuần. 4 AI agent phối hợp verify + estimate + judge tự động. Payout on-chain minh bạch."

## 2.3. User Journey

**Bối cảnh**: Người dùng đi xe máy tại VN, mua policy micro-insurance qua ClaimBot. Xe bị va chạm nhẹ, cần claim bồi thường.

**Flow chính**:
1. User connect wallet → mua policy: chọn coverage (VD: 2,000,000 VND), pay premium bằng USDC test
2. Xe bị damage → user chụp ảnh, mở ClaimBot → submit claim với ảnh + description
3. Backend orchestrator nhận event → chạy 4 AI agents tuần tự (~60-90 giây)
4. Agent submit verdict on-chain → nếu approved, USDC tự động transfer về ví user
5. Nếu deadline 48h mà không xử lý xong → Chainlink Automation tự trigger refund

## 2.4. Scope MVP (bắt buộc phải có)

- ✅ Purchase policy flow (buy với USDC test)
- ✅ Submit claim với photo upload
- ✅ 4-agent AI pipeline hoàn chỉnh
- ✅ On-chain verdict + auto payout
- ✅ Chainlink Automation cho deadline refund
- ✅ Chainlink Functions integration cho ít nhất 1 external API call (vehicle verification)
- ✅ Real-time status tracking UI
- ✅ Etherscan verified contracts

## 2.5. Out of scope (không build trong MVP)

- ❌ Dispute resolution flow (chỉ show placeholder)
- ❌ Multi-vehicle support (chỉ xe máy)
- ❌ Real DMV API integration (dùng mock endpoint)
- ❌ Advanced fraud detection ML model (chỉ dùng LLM heuristic)
- ❌ Mobile app native (chỉ web responsive)

---

<a name="3-architecture"></a>

# 3. ARCHITECTURE

## 3.1. High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Web Browser)                       │
│                     RainbowKit + wagmi wallet                   │
└──────────────┬────────────────────────────┬─────────────────────┘
               │                            │
               │ (1) Purchase policy        │ (2) Submit claim + IPFS
               ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SEPOLIA SMART CONTRACTS                      │
│  ┌─────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ PolicyManager   │  │ ClaimRegistry  │  │ PayoutVault     │  │
│  └─────────────────┘  └────────┬───────┘  └─────────────────┘  │
└─────────────────────────────────┼───────────────────────────────┘
                                  │ Events (ClaimSubmitted)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND ORCHESTRATOR (Node.js)                     │
│    ethers.js event listener + Express health endpoint           │
│                                                                 │
│    ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│    │Extractor │→ │Verifier  │→ │Estimator │→ │Judge     │    │
│    │ (Vision) │   │(APIs)    │   │(LLM)     │   │(Aggreg.) │   │
│    └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│                                                                 │
│    Sign verdict → submitVerdict() → auto payout                 │
└─────────────────────────────────────────────────────────────────┘
                    ▲                        ▲
                    │                        │
      ┌─────────────┴───────┐   ┌────────────┴──────────┐
      │ Chainlink Functions │   │ Chainlink Automation  │
      │ (Vehicle verify API)│   │ (48h deadline refund) │
      └─────────────────────┘   └───────────────────────┘

              ┌──────────────────────────────┐
              │  External Services:          │
              │  - Anthropic Claude API      │
              │  - Pinata IPFS               │
              │  - OpenWeather API           │
              │  - Google Vision (optional)  │
              └──────────────────────────────┘
```

## 3.2. Data flow: Claim lifecycle

```
User submits claim
      │
      ▼
[Status: Submitted] ─────────── Event emitted → Backend listens
      │
      ▼
[Status: Extracting]  ← Agent 1: GPT-4V/Claude Vision phân tích ảnh
      │
      ▼
[Status: Verifying]   ← Agent 2: check weather + DMV mock + EXIF
      │
      ▼
[Status: Estimating]  ← Agent 3: LLM ước tính chi phí VND
      │
      ▼
[Status: Judged]      ← Agent 4: aggregate + sign verdict
      │
      ├─── Approved → PayoutVault.executePayout() → USDC → User ✅
      │
      └─── Rejected → No payout, reason stored on-chain ❌

     (Nếu quá 48h mà chưa Judged)
      │
      ▼
Chainlink Automation trigger:
[Status: Refunded]    ← Trả lại premium tương ứng, close claim
```

## 3.3. Trust model

Ở version Sepolia này, backend orchestrator có role `ORACLE_ROLE` để submit verdict. Đây là **trust point** — nhưng được minimize bằng:
- Verdict phải kèm signature từ registered oracle address
- Amount payout không vượt được policy coverage (contract enforce)
- Chainlink Automation là fallback nếu backend die
- Trong AMA, nhấn: **"Trên Rialo, layer này sẽ được thay bằng SCALE program — trustless hoàn toàn"**

---

<a name="4-tech-stack"></a>

# 4. TECH STACK

## 4.1. Smart Contracts
- **Language**: Solidity `^0.8.24`
- **Framework**: Foundry (không dùng Hardhat)
- **Libraries**:
  - OpenZeppelin `^5.0.0` (AccessControl, ReentrancyGuard, ECDSA, IERC20)
  - Chainlink Contracts `^1.2.0` (FunctionsClient, AutomationCompatible)

## 4.2. Backend
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript
- **Framework**: Express (health + admin endpoints only)
- **Blockchain lib**: ethers.js v6
- **AI SDK**: `@anthropic-ai/sdk` (Claude 3.5 Sonnet Vision)
- **IPFS**: Pinata SDK
- **Queue** (optional): BullMQ + Redis nếu cần retry logic; MVP dùng in-memory

## 4.3. Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Wallet**: RainbowKit + wagmi v2 + viem
- **State**: Zustand cho local UI state
- **File upload**: react-dropzone + Pinata upload API

## 4.4. Infrastructure
- **RPC**: Alchemy Sepolia (primary) + Infura Sepolia (fallback)
- **Frontend hosting**: Vercel (free tier)
- **Backend hosting**: Railway hoặc Fly.io (~$5/month)
- **IPFS pinning**: Pinata (free tier 1GB)
- **Monitoring**: Tenderly cho contract debugging

## 4.5. Testing
- **Contracts**: Foundry (`forge test`) — target 90%+ coverage cho core logic
- **Backend**: Vitest + msw (mock API calls)
- **Frontend**: Playwright cho E2E flow chính
- **Integration**: Bash script test full flow trên Sepolia sau deploy

---

<a name="5-folder-structure"></a>

# 5. FOLDER STRUCTURE

```
claimbot/
├── README.md                     # Setup + quick start
├── CLAIMBOT_SPEC.md              # File này (spec đầy đủ)
├── .env.example                  # Template env vars
├── docker-compose.yml            # Local dev (Anvil + backend)
│
├── contracts/                    # Foundry project
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── src/
│   │   ├── PolicyManager.sol
│   │   ├── ClaimRegistry.sol
│   │   ├── PayoutVault.sol
│   │   ├── ClaimAutomation.sol         # Chainlink Automation consumer
│   │   ├── VehicleVerifier.sol         # Chainlink Functions consumer
│   │   ├── interfaces/
│   │   │   ├── IClaimRegistry.sol
│   │   │   ├── IPayoutVault.sol
│   │   │   └── IPolicyManager.sol
│   │   └── libraries/
│   │       └── VerdictSignature.sol    # EIP-712 signature verification
│   ├── test/
│   │   ├── PolicyManager.t.sol
│   │   ├── ClaimRegistry.t.sol
│   │   ├── PayoutVault.t.sol
│   │   ├── FullFlow.t.sol              # Integration test
│   │   └── mocks/
│   │       ├── MockUSDC.sol
│   │       └── MockAutomation.sol
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   ├── SeedPolicy.s.sol
│   │   └── SubmitTestClaim.s.sol
│   └── deployments/
│       └── sepolia.json                # Address dump sau deploy
│
├── backend/                      # Node.js orchestrator
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                    # Entry: start listener + express
│   │   ├── config.ts                   # Load env + chain config
│   │   ├── orchestrator.ts             # Main pipeline
│   │   ├── contracts.ts                # ethers.js contract instances
│   │   ├── agents/
│   │   │   ├── extractor.ts            # Agent 1: Vision LLM
│   │   │   ├── verifier.ts             # Agent 2: cross-check APIs
│   │   │   ├── estimator.ts            # Agent 3: cost estimate
│   │   │   └── judge.ts                # Agent 4: aggregate + sign
│   │   ├── services/
│   │   │   ├── anthropic.ts            # Claude Vision wrapper
│   │   │   ├── ipfs.ts                 # Pinata fetch
│   │   │   ├── weather.ts              # OpenWeather wrapper
│   │   │   ├── exif.ts                 # EXIF metadata parser
│   │   │   └── mockDMV.ts              # Mock VN DMV API
│   │   ├── utils/
│   │   │   ├── signature.ts            # EIP-712 sign verdict
│   │   │   ├── retry.ts                # Exponential backoff
│   │   │   └── logger.ts               # pino logger
│   │   └── routes/
│   │       ├── health.ts               # GET /health
│   │       └── admin.ts                # Admin endpoints (retry claim, etc)
│   ├── test/
│   │   ├── extractor.test.ts
│   │   ├── verifier.test.ts
│   │   ├── judge.test.ts
│   │   └── orchestrator.test.ts
│   └── Dockerfile
│
├── frontend/                     # Next.js app
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # Root với RainbowKit provider
│   │   │   ├── page.tsx                # Landing
│   │   │   ├── policies/
│   │   │   │   ├── page.tsx            # List + purchase
│   │   │   │   └── [id]/page.tsx       # Detail
│   │   │   ├── claims/
│   │   │   │   ├── new/page.tsx        # Submit new claim
│   │   │   │   ├── page.tsx            # List user's claims
│   │   │   │   └── [id]/page.tsx       # Detail + real-time status
│   │   │   └── api/
│   │   │       └── upload/route.ts     # Pinata upload proxy
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── PolicyCard.tsx
│   │   │   ├── ClaimForm.tsx
│   │   │   ├── ClaimStatusTracker.tsx  # Real-time status
│   │   │   ├── PhotoUpload.tsx
│   │   │   └── ui/                     # shadcn components
│   │   ├── hooks/
│   │   │   ├── usePolicies.ts
│   │   │   ├── useClaim.ts
│   │   │   ├── useClaimStatus.ts       # Poll status every 3s
│   │   │   └── usePurchasePolicy.ts
│   │   ├── lib/
│   │   │   ├── wagmi.ts                # Config
│   │   │   ├── contracts.ts            # ABI + addresses
│   │   │   └── ipfs.ts                 # IPFS URL builder
│   │   └── types/
│   │       └── claim.ts
│   ├── public/
│   │   └── demo-images/                # Sample damage photos cho demo
│   └── e2e/
│       └── full-flow.spec.ts
│
└── scripts/
    ├── setup.sh                        # One-time setup
    ├── deploy-all.sh                   # Deploy + verify + init
    ├── seed-test-data.sh
    └── register-chainlink.md           # Manual steps cho Chainlink
```

---

<a name="6-smart-contracts"></a>

# 6. SMART CONTRACTS — FULL SPEC

## 6.1. `PolicyManager.sol`

**Responsibility**: Quản lý lifecycle của policy (mua, hết hạn, kiểm tra active).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PolicyManager
 * @notice Quản lý micro-insurance policies cho xe máy
 * @dev Premium paid bằng USDC (Sepolia test USDC)
 */
contract PolicyManager is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Policy {
        address holder;
        bytes32 vehicleHash;        // keccak256(license_plate + VIN)
        uint256 premium;            // USDC (6 decimals)
        uint256 coverage;           // Max payout USDC
        uint256 startTime;
        uint256 endTime;
        uint256 claimsCount;        // Số claim đã dùng
        uint256 totalPaidOut;       // Tổng đã payout
        bool active;
    }

    IERC20 public immutable usdc;
    address public treasury;
    uint256 public nextPolicyId = 1;

    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public policiesByHolder;

    // Tier config
    struct Tier {
        uint256 premium;      // USDC per month
        uint256 coverage;     // Max USDC per policy period
        uint256 durationDays;
    }
    Tier[] public tiers;

    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed holder,
        uint256 premium,
        uint256 coverage
    );
    event PolicyExpired(uint256 indexed policyId);

    error InvalidTier();
    error PolicyNotActive();
    error TransferFailed();

    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        // Default 3 tiers (USDC 6 decimals)
        tiers.push(Tier(1_000_000, 20_000_000, 30));    // $1/mo, $20 cov
        tiers.push(Tier(3_000_000, 80_000_000, 30));    // $3/mo, $80 cov
        tiers.push(Tier(5_000_000, 200_000_000, 30));   // $5/mo, $200 cov
    }

    function purchasePolicy(
        uint256 tierId,
        bytes32 vehicleHash
    ) external nonReentrant returns (uint256 policyId) {
        if (tierId >= tiers.length) revert InvalidTier();
        Tier memory t = tiers[tierId];

        bool ok = usdc.transferFrom(msg.sender, treasury, t.premium);
        if (!ok) revert TransferFailed();

        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            holder: msg.sender,
            vehicleHash: vehicleHash,
            premium: t.premium,
            coverage: t.coverage,
            startTime: block.timestamp,
            endTime: block.timestamp + (t.durationDays * 1 days),
            claimsCount: 0,
            totalPaidOut: 0,
            active: true
        });
        policiesByHolder[msg.sender].push(policyId);

        emit PolicyPurchased(policyId, msg.sender, t.premium, t.coverage);
    }

    function isActive(uint256 policyId) public view returns (bool) {
        Policy memory p = policies[policyId];
        return p.active
            && block.timestamp <= p.endTime
            && p.totalPaidOut < p.coverage;
    }

    function remainingCoverage(uint256 policyId) external view returns (uint256) {
        Policy memory p = policies[policyId];
        if (!isActive(policyId)) return 0;
        return p.coverage - p.totalPaidOut;
    }

    // Called by ClaimRegistry sau khi payout
    function recordPayout(uint256 policyId, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
    {
        Policy storage p = policies[policyId];
        p.totalPaidOut += amount;
        p.claimsCount += 1;
        if (p.totalPaidOut >= p.coverage) {
            p.active = false;
        }
    }

    function addTier(uint256 premium, uint256 coverage, uint256 durationDays)
        external
        onlyRole(ADMIN_ROLE)
    {
        tiers.push(Tier(premium, coverage, durationDays));
    }

    function updateTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        treasury = newTreasury;
    }
}
```

## 6.2. `ClaimRegistry.sol`

**Responsibility**: State machine cho claim, gọi PayoutVault khi verdict pass.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IPolicyManager} from "./interfaces/IPolicyManager.sol";
import {IPayoutVault} from "./interfaces/IPayoutVault.sol";

contract ClaimRegistry is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");

    uint256 public constant CLAIM_DEADLINE = 48 hours;

    enum Status {
        Submitted,   // 0
        Extracting,  // 1
        Verifying,   // 2
        Estimating,  // 3
        Judged,      // 4
        Paid,        // 5
        Rejected,    // 6
        Refunded,    // 7 - via Automation
        Disputed     // 8 - future
    }

    struct Claim {
        uint256 policyId;
        address claimant;
        string evidenceIPFS;         // ipfs://Qm...
        string description;
        uint256 submittedAt;
        uint256 deadline;
        Status status;
        uint256 approvedAmount;
        uint8 confidence;
        string reasoning;            // Judge reasoning stored on-chain
        bytes32 verdictHash;
    }

    IPolicyManager public policyManager;
    IPayoutVault public payoutVault;

    uint256 public nextClaimId = 1;
    mapping(uint256 => Claim) public claims;
    mapping(address => uint256[]) public claimsByUser;
    uint256[] public activeClaimIds;         // For Automation to scan

    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        string evidenceIPFS
    );
    event StatusUpdated(uint256 indexed claimId, Status newStatus);
    event VerdictSubmitted(
        uint256 indexed claimId,
        bool approved,
        uint256 amount,
        uint8 confidence
    );
    event ClaimRefunded(uint256 indexed claimId, string reason);

    error PolicyNotActive();
    error NotClaimant();
    error InvalidStatus();
    error DeadlineExceeded();
    error AmountExceedsCoverage();
    error InvalidSignature();

    constructor(address _policyManager, address _payoutVault) {
        policyManager = IPolicyManager(_policyManager);
        payoutVault = IPayoutVault(_payoutVault);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function submitClaim(
        uint256 policyId,
        string calldata evidenceIPFS,
        string calldata description
    ) external nonReentrant returns (uint256 claimId) {
        if (!policyManager.isActive(policyId)) revert PolicyNotActive();
        // Only policy holder can claim
        (address holder,,,,,,,,) = _getPolicy(policyId);
        if (holder != msg.sender) revert NotClaimant();

        claimId = nextClaimId++;
        claims[claimId] = Claim({
            policyId: policyId,
            claimant: msg.sender,
            evidenceIPFS: evidenceIPFS,
            description: description,
            submittedAt: block.timestamp,
            deadline: block.timestamp + CLAIM_DEADLINE,
            status: Status.Submitted,
            approvedAmount: 0,
            confidence: 0,
            reasoning: "",
            verdictHash: bytes32(0)
        });
        claimsByUser[msg.sender].push(claimId);
        activeClaimIds.push(claimId);

        emit ClaimSubmitted(claimId, policyId, msg.sender, evidenceIPFS);
    }

    function updateStatus(uint256 claimId, Status newStatus)
        external
        onlyRole(ORACLE_ROLE)
    {
        Claim storage c = claims[claimId];
        // Only allow forward progression up to Judged
        require(uint8(newStatus) > uint8(c.status), "Cannot regress");
        require(uint8(newStatus) <= uint8(Status.Judged), "Use submitVerdict");
        c.status = newStatus;
        emit StatusUpdated(claimId, newStatus);
    }

    /**
     * @notice Oracle submit final verdict với signature
     * @dev Signature là EIP-712 hash của (claimId, approved, amount, confidence, reasoning)
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
        if (block.timestamp > c.deadline) revert DeadlineExceeded();
        if (c.status == Status.Paid || c.status == Status.Rejected
            || c.status == Status.Refunded) revert InvalidStatus();

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encode(claimId, approved, amount, confidence, reasoning)
        );
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        if (!hasRole(ORACLE_ROLE, signer)) revert InvalidSignature();

        c.confidence = confidence;
        c.reasoning = reasoning;
        c.verdictHash = messageHash;

        if (approved) {
            uint256 remaining = policyManager.remainingCoverage(c.policyId);
            if (amount > remaining) revert AmountExceedsCoverage();

            c.status = Status.Paid;
            c.approvedAmount = amount;
            payoutVault.executePayout(c.claimant, amount);
            policyManager.recordPayout(c.policyId, amount);
            _removeFromActive(claimId);
        } else {
            c.status = Status.Rejected;
            _removeFromActive(claimId);
        }

        emit VerdictSubmitted(claimId, approved, amount, confidence);
    }

    function refundExpiredClaim(uint256 claimId)
        external
        onlyRole(AUTOMATION_ROLE)
    {
        Claim storage c = claims[claimId];
        require(block.timestamp > c.deadline, "Not yet expired");
        require(
            c.status != Status.Paid
            && c.status != Status.Rejected
            && c.status != Status.Refunded,
            "Already finalized"
        );
        c.status = Status.Refunded;
        _removeFromActive(claimId);
        emit ClaimRefunded(claimId, "Deadline exceeded");
    }

    function getActiveClaims() external view returns (uint256[] memory) {
        return activeClaimIds;
    }

    function getUserClaims(address user) external view returns (uint256[] memory) {
        return claimsByUser[user];
    }

    // Internal helpers
    function _removeFromActive(uint256 claimId) internal {
        uint256 len = activeClaimIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (activeClaimIds[i] == claimId) {
                activeClaimIds[i] = activeClaimIds[len - 1];
                activeClaimIds.pop();
                break;
            }
        }
    }

    function _getPolicy(uint256 policyId) internal view returns (
        address, bytes32, uint256, uint256, uint256, uint256, uint256, uint256, bool
    ) {
        return IPolicyManager(address(policyManager)).policies(policyId);
    }

    function grantOracleRole(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ORACLE_ROLE, oracle);
    }

    function grantAutomationRole(address automation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(AUTOMATION_ROLE, automation);
    }
}
```

## 6.3. `PayoutVault.sol`

**Responsibility**: Giữ USDC reserve, chỉ ClaimRegistry gọi được executePayout.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PayoutVault is AccessControl, ReentrancyGuard {
    bytes32 public constant CLAIM_REGISTRY_ROLE = keccak256("CLAIM_REGISTRY_ROLE");
    bytes32 public constant FUNDER_ROLE = keccak256("FUNDER_ROLE");

    IERC20 public immutable usdc;
    uint256 public totalReserve;
    uint256 public totalPaidOut;

    event Funded(address indexed from, uint256 amount);
    event PayoutExecuted(address indexed to, uint256 amount, address indexed by);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    error InsufficientReserve();
    error TransferFailed();
    error ZeroAmount();

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FUNDER_ROLE, msg.sender);
    }

    function fundReserve(uint256 amount)
        external
        nonReentrant
        onlyRole(FUNDER_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
        totalReserve += amount;
        emit Funded(msg.sender, amount);
    }

    function executePayout(address to, uint256 amount)
        external
        nonReentrant
        onlyRole(CLAIM_REGISTRY_ROLE)
    {
        if (amount == 0) revert ZeroAmount();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientReserve();
        totalPaidOut += amount;
        bool ok = usdc.transfer(to, amount);
        if (!ok) revert TransferFailed();
        emit PayoutExecuted(to, amount, msg.sender);
    }

    function emergencyWithdraw(address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        bool ok = usdc.transfer(to, amount);
        if (!ok) revert TransferFailed();
        emit EmergencyWithdraw(to, amount);
    }

    function grantClaimRegistryRole(address registry)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _grantRole(CLAIM_REGISTRY_ROLE, registry);
    }
}
```

## 6.4. `ClaimAutomation.sol` (Chainlink Automation)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AutomationCompatibleInterface} from
    "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {IClaimRegistry} from "./interfaces/IClaimRegistry.sol";

/**
 * @notice Chainlink Automation checks expired claims every block
 * @dev Register at automation.chain.link với "Custom Logic" trigger
 */
contract ClaimAutomation is AutomationCompatibleInterface {
    IClaimRegistry public immutable registry;
    uint256 public constant MAX_CLAIMS_PER_UPKEEP = 5;

    constructor(address _registry) {
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
            (, , , , , uint256 deadline, IClaimRegistry.Status status, , , , ) =
                registry.claims(active[i]);
            if (block.timestamp > deadline
                && uint8(status) < uint8(IClaimRegistry.Status.Paid)) {
                expired[count++] = active[i];
            }
        }

        if (count > 0) {
            uint256[] memory result = new uint256[](count);
            for (uint256 i = 0; i < count; i++) result[i] = expired[i];
            return (true, abi.encode(result));
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256[] memory expired = abi.decode(performData, (uint256[]));
        for (uint256 i = 0; i < expired.length; i++) {
            try registry.refundExpiredClaim(expired[i]) {} catch {}
        }
    }
}
```

## 6.5. `VehicleVerifier.sol` (Chainlink Functions)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from
    "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from
    "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {ConfirmedOwner} from
    "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

contract VehicleVerifier is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    // Sepolia
    address constant ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 constant DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;

    uint64 public subscriptionId;
    uint32 public gasLimit = 300_000;

    // JS source code inline (compile-time constant)
    string public sourceCode =
        "const plate = args[0];"
        "const response = await Functions.makeHttpRequest({"
        "  url: `https://vn-dmv-mock.claimbot.io/verify/${plate}`,"
        "  method: 'GET'"
        "});"
        "if (response.error) throw Error('API failed');"
        "const data = response.data;"
        "return Functions.encodeString(JSON.stringify({"
        "  valid: data.valid,"
        "  owner_match: data.ownerMatch,"
        "  active_insurance: data.hasActive"
        "}));";

    mapping(bytes32 => uint256) public requestToClaimId;
    mapping(uint256 => string) public claimVerification;

    event VerificationRequested(bytes32 indexed requestId, uint256 indexed claimId);
    event VerificationFulfilled(uint256 indexed claimId, string result);

    constructor(uint64 _subscriptionId)
        FunctionsClient(ROUTER)
        ConfirmedOwner(msg.sender)
    {
        subscriptionId = _subscriptionId;
    }

    function requestVerification(uint256 claimId, string calldata licensePlate)
        external
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

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory /* err */
    ) internal override {
        uint256 claimId = requestToClaimId[requestId];
        string memory result = string(response);
        claimVerification[claimId] = result;
        emit VerificationFulfilled(claimId, result);
    }

    function setSubscriptionId(uint64 newId) external onlyOwner {
        subscriptionId = newId;
    }
}
```

## 6.6. Deploy Script — `script/Deploy.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PolicyManager} from "../src/PolicyManager.sol";
import {ClaimRegistry} from "../src/ClaimRegistry.sol";
import {PayoutVault} from "../src/PayoutVault.sol";
import {ClaimAutomation} from "../src/ClaimAutomation.sol";

contract Deploy is Script {
    // Sepolia USDC (Circle test)
    address constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");

        vm.startBroadcast(pk);

        // 1. Deploy PayoutVault
        PayoutVault vault = new PayoutVault(SEPOLIA_USDC);
        console.log("PayoutVault:", address(vault));

        // 2. Deploy PolicyManager (treasury = deployer for MVP)
        PolicyManager policyManager = new PolicyManager(SEPOLIA_USDC, deployer);
        console.log("PolicyManager:", address(policyManager));

        // 3. Deploy ClaimRegistry
        ClaimRegistry registry = new ClaimRegistry(
            address(policyManager),
            address(vault)
        );
        console.log("ClaimRegistry:", address(registry));

        // 4. Deploy Automation
        ClaimAutomation automation = new ClaimAutomation(address(registry));
        console.log("ClaimAutomation:", address(automation));

        // 5. Wire up roles
        vault.grantClaimRegistryRole(address(registry));
        registry.grantOracleRole(oracleAddress);
        registry.grantAutomationRole(address(automation));

        // 6. Grant PolicyManager admin role to ClaimRegistry (for recordPayout)
        policyManager.grantRole(policyManager.ADMIN_ROLE(), address(registry));

        vm.stopBroadcast();

        // Write addresses to deployment file
        string memory json = string.concat(
            '{"payoutVault":"', vm.toString(address(vault)),
            '","policyManager":"', vm.toString(address(policyManager)),
            '","claimRegistry":"', vm.toString(address(registry)),
            '","claimAutomation":"', vm.toString(address(automation)),
            '","usdc":"', vm.toString(SEPOLIA_USDC),
            '"}'
        );
        vm.writeFile("./deployments/sepolia.json", json);
    }
}
```

---

<a name="7-backend"></a>

# 7. BACKEND — AI AGENT PIPELINE

## 7.1. Overview

Backend là **event-driven orchestrator**. Listen `ClaimSubmitted` event từ Sepolia → chạy pipeline 4 agent → submit verdict on-chain.

## 7.2. Entry point — `src/index.ts`

```typescript
import express from 'express';
import { config } from './config';
import { startOrchestrator } from './orchestrator';
import { healthRouter } from './routes/health';
import { adminRouter } from './routes/admin';
import { logger } from './utils/logger';

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/health', healthRouter);
  app.use('/admin', adminRouter);

  app.listen(config.PORT, () => {
    logger.info(`Server listening on :${config.PORT}`);
  });

  await startOrchestrator();
}

main().catch(err => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
```

## 7.3. Orchestrator — `src/orchestrator.ts`

```typescript
import { claimRegistry, provider } from './contracts';
import { extractorAgent } from './agents/extractor';
import { verifierAgent } from './agents/verifier';
import { estimatorAgent } from './agents/estimator';
import { judgeAgent } from './agents/judge';
import { signVerdict } from './utils/signature';
import { logger } from './utils/logger';
import { retry } from './utils/retry';

enum Status {
  Submitted = 0, Extracting = 1, Verifying = 2, Estimating = 3,
  Judged = 4, Paid = 5, Rejected = 6, Refunded = 7, Disputed = 8
}

export async function startOrchestrator() {
  logger.info('Orchestrator starting, listening for ClaimSubmitted events...');

  claimRegistry.on(
    'ClaimSubmitted',
    async (claimId: bigint, policyId: bigint, claimant: string, evidenceIPFS: string) => {
      const id = Number(claimId);
      logger.info({ claimId: id }, 'Received ClaimSubmitted event');

      try {
        await processClaim(id, evidenceIPFS);
      } catch (err) {
        logger.error({ claimId: id, err }, 'Pipeline failed');
        // Automation sẽ auto-refund sau deadline nếu ta không submit verdict
      }
    }
  );

  // Also process any pending claims on startup (crash recovery)
  const active = await claimRegistry.getActiveClaims();
  logger.info(`Found ${active.length} active claims on startup`);
  for (const cid of active) {
    const claim = await claimRegistry.claims(cid);
    if (claim.status === 0n) {
      processClaim(Number(cid), claim.evidenceIPFS).catch(err =>
        logger.error({ err, claimId: Number(cid) }, 'Recovery failed')
      );
    }
  }
}

async function processClaim(claimId: number, evidenceIPFS: string) {
  logger.info({ claimId }, '── Starting pipeline ──');

  // Step 1: Extract
  await updateStatus(claimId, Status.Extracting);
  const extracted = await retry(() => extractorAgent(evidenceIPFS), 3);
  logger.info({ claimId, extracted }, 'Extractor done');

  // Step 2: Verify
  await updateStatus(claimId, Status.Verifying);
  const verified = await retry(() => verifierAgent(extracted, evidenceIPFS), 3);
  logger.info({ claimId, verified }, 'Verifier done');

  // Step 3: Estimate
  await updateStatus(claimId, Status.Estimating);
  const estimated = await retry(() => estimatorAgent(extracted), 3);
  logger.info({ claimId, estimated }, 'Estimator done');

  // Step 4: Judge
  await updateStatus(claimId, Status.Judged);
  const verdict = await judgeAgent({ extracted, verified, estimated });
  logger.info({ claimId, verdict }, 'Judge done');

  // Submit verdict on-chain
  const signature = await signVerdict(
    claimId,
    verdict.approved,
    verdict.amount,
    verdict.confidence,
    verdict.reasoning
  );

  const tx = await claimRegistry.submitVerdict(
    claimId,
    verdict.approved,
    verdict.amount,
    verdict.confidence,
    verdict.reasoning,
    signature
  );
  logger.info({ claimId, txHash: tx.hash }, 'Verdict submitted');
  await tx.wait();
  logger.info({ claimId }, '✅ Pipeline complete');
}

async function updateStatus(claimId: number, status: Status) {
  const tx = await claimRegistry.updateStatus(claimId, status);
  await tx.wait();
}
```

## 7.4. Agent 1: Extractor — `src/agents/extractor.ts`

```typescript
import { anthropic } from '../services/anthropic';
import { fetchIPFS } from '../services/ipfs';

export interface ExtractedData {
  vehicle_type: 'motorbike' | 'car' | 'unknown';
  license_plate: string | null;
  damage_locations: string[];      // ['front', 'left', ...]
  affected_parts: string[];        // ['headlight', 'mirror', ...]
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;              // 0-100
  red_flags: string[];             // Fraud signals
  image_quality: 'good' | 'blurry' | 'edited_suspected';
  scene_description: string;
}

const SYSTEM_PROMPT = `Bạn là chuyên viên giám định bảo hiểm xe tại Việt Nam với 15 năm kinh nghiệm.
Phân tích ảnh damage được cung cấp và trả về JSON đúng schema. Chú ý:
- Nếu ảnh không phải xe → confidence = 0
- Nếu phát hiện dấu hiệu chỉnh sửa ảnh, chụp lại màn hình → red_flags
- Severity dựa trên số part hư + độ hư
- Chỉ trả JSON, không markdown, không giải thích thêm`;

const USER_PROMPT = `Phân tích ảnh này và trả về JSON theo schema:
{
  "vehicle_type": "motorbike|car|unknown",
  "license_plate": "biển số hoặc null",
  "damage_locations": ["front"|"rear"|"left"|"right"|"top"],
  "affected_parts": ["bumper"|"headlight"|"mirror"|"door"|"windshield"|...],
  "severity": "minor|moderate|severe",
  "confidence": 0-100,
  "red_flags": ["ảnh chỉnh sửa", "damage không nhất quán", ...],
  "image_quality": "good|blurry|edited_suspected",
  "scene_description": "mô tả ngắn cảnh trong ảnh"
}`;

export async function extractorAgent(ipfsHash: string): Promise<ExtractedData> {
  const imageData = await fetchIPFS(ipfsHash);
  const base64 = imageData.toString('base64');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
        },
        { type: 'text', text: USER_PROMPT }
      ]
    }]
  });

  const text = (response.content[0] as { type: 'text'; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM did not return JSON');
  return JSON.parse(jsonMatch[0]) as ExtractedData;
}
```

## 7.5. Agent 2: Verifier — `src/agents/verifier.ts`

```typescript
import { ExtractedData } from './extractor';
import { checkVehicle } from '../services/mockDMV';
import { getWeatherAt } from '../services/weather';
import { extractEXIF } from '../services/exif';
import { fetchIPFS } from '../services/ipfs';

export interface VerifiedData {
  dmv_check: {
    plate_valid: boolean;
    active_insurance: boolean;
  } | null;
  weather_at_scene: {
    temp: number;
    conditions: string;
    matches_scene: boolean;
  } | null;
  exif: {
    timestamp: number | null;
    gps: { lat: number; lng: number } | null;
    device: string | null;
    suspicious: boolean;      // no exif hoặc timestamp trong tương lai
  };
  cross_check_score: number;  // 0-100
  issues: string[];
}

export async function verifierAgent(
  extracted: ExtractedData,
  ipfsHash: string
): Promise<VerifiedData> {
  const issues: string[] = [];

  // DMV check
  let dmv = null;
  if (extracted.license_plate) {
    try {
      dmv = await checkVehicle(extracted.license_plate);
      if (!dmv.plate_valid) issues.push('Biển số không tồn tại trong DMV');
      if (!dmv.active_insurance) issues.push('Không có bảo hiểm active');
    } catch (e) {
      issues.push('DMV API error');
    }
  } else {
    issues.push('Không đọc được biển số từ ảnh');
  }

  // EXIF check
  const imageBuffer = await fetchIPFS(ipfsHash);
  const exif = await extractEXIF(imageBuffer);
  if (!exif.timestamp) issues.push('Ảnh không có EXIF timestamp');
  if (exif.timestamp && exif.timestamp > Date.now()) issues.push('Timestamp tương lai');

  // Weather cross-check
  let weather = null;
  if (exif.gps && exif.timestamp) {
    try {
      const w = await getWeatherAt(exif.gps.lat, exif.gps.lng, exif.timestamp);
      const sceneWet = extracted.scene_description.toLowerCase().match(/mưa|ướt|wet|rain/);
      const actuallyRained = w.conditions.toLowerCase().match(/rain|mưa/);
      weather = {
        temp: w.temp,
        conditions: w.conditions,
        matches_scene: !!(sceneWet) === !!(actuallyRained)
      };
      if (!weather.matches_scene) issues.push('Cảnh trong ảnh không khớp thời tiết thực tế');
    } catch (e) {
      // Non-fatal
    }
  }

  // Score
  let score = 100;
  if (!dmv?.plate_valid) score -= 40;
  if (!dmv?.active_insurance) score -= 30;
  if (exif.suspicious) score -= 15;
  if (weather && !weather.matches_scene) score -= 15;

  return {
    dmv_check: dmv,
    weather_at_scene: weather,
    exif: { ...exif, suspicious: !exif.timestamp || (exif.timestamp > Date.now()) },
    cross_check_score: Math.max(0, score),
    issues
  };
}
```

## 7.6. Agent 3: Estimator — `src/agents/estimator.ts`

```typescript
import { anthropic } from '../services/anthropic';
import { ExtractedData } from './extractor';

export interface EstimatedCost {
  min_cost_vnd: number;
  max_cost_vnd: number;
  recommended_payout_vnd: number;
  recommended_payout_usdc: number;   // 6 decimals
  reasoning: string;
  parts_breakdown: { part: string; cost: number }[];
}

// Simplified price DB
const PART_PRICES_VND: Record<string, [number, number]> = {
  headlight:  [200_000, 800_000],
  mirror:     [100_000, 400_000],
  bumper:     [500_000, 2_000_000],
  door:       [800_000, 3_000_000],
  windshield: [1_500_000, 5_000_000],
  fender:     [300_000, 1_500_000],
  seat:       [400_000, 2_000_000],
  handlebar:  [200_000, 1_000_000],
  exhaust:    [500_000, 2_500_000],
};

const USD_VND_RATE = 25_000;

export async function estimatorAgent(extracted: ExtractedData): Promise<EstimatedCost> {
  // Rule-based estimation
  let minTotal = 0;
  let maxTotal = 0;
  const breakdown: { part: string; cost: number }[] = [];

  const severityMultiplier =
    extracted.severity === 'severe' ? 1.5 :
    extracted.severity === 'moderate' ? 1.0 : 0.6;

  for (const part of extracted.affected_parts) {
    const key = part.toLowerCase();
    const range = PART_PRICES_VND[key] ?? [200_000, 800_000];
    const min = range[0] * severityMultiplier;
    const max = range[1] * severityMultiplier;
    minTotal += min;
    maxTotal += max;
    breakdown.push({ part: key, cost: Math.round((min + max) / 2) });
  }

  const recommendedVnd = Math.round((minTotal + maxTotal) / 2);
  const recommendedUsdcSix = Math.round((recommendedVnd / USD_VND_RATE) * 1_000_000);

  // LLM sanity check
  const prompt = `Cost estimation cho damage xe máy VN:
Parts: ${extracted.affected_parts.join(', ')}
Severity: ${extracted.severity}
Rule-based estimate: ${recommendedVnd.toLocaleString()} VND

Xác nhận số này hợp lý hay không, và viết reasoning ngắn (2 câu, tiếng Việt).
Chỉ trả JSON: {"looks_reasonable": true|false, "adjusted_vnd": number, "reasoning": "..."}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = (response.content[0] as { type: 'text'; text: string }).text;
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);

  const finalVnd = parsed.looks_reasonable ? recommendedVnd : parsed.adjusted_vnd;
  const finalUsdc = Math.round((finalVnd / USD_VND_RATE) * 1_000_000);

  return {
    min_cost_vnd: Math.round(minTotal),
    max_cost_vnd: Math.round(maxTotal),
    recommended_payout_vnd: finalVnd,
    recommended_payout_usdc: finalUsdc,
    reasoning: parsed.reasoning,
    parts_breakdown: breakdown
  };
}
```

## 7.7. Agent 4: Judge — `src/agents/judge.ts`

```typescript
import { ExtractedData } from './extractor';
import { VerifiedData } from './verifier';
import { EstimatedCost } from './estimator';

export interface Verdict {
  approved: boolean;
  amount: bigint;              // USDC 6 decimals
  confidence: number;          // 0-100
  reasoning: string;
}

export async function judgeAgent(input: {
  extracted: ExtractedData;
  verified: VerifiedData;
  estimated: EstimatedCost;
}): Promise<Verdict> {
  const { extracted, verified, estimated } = input;

  // Compute overall confidence
  let confidence = Math.min(extracted.confidence, verified.cross_check_score);

  // Auto-reject rules
  if (extracted.red_flags.length > 0) {
    return {
      approved: false,
      amount: 0n,
      confidence,
      reasoning: `REJECT: Red flags: ${extracted.red_flags.join(', ')}`
    };
  }

  if (extracted.vehicle_type === 'unknown') {
    return {
      approved: false,
      amount: 0n,
      confidence,
      reasoning: 'REJECT: Không xác định được loại xe'
    };
  }

  if (verified.cross_check_score < 50) {
    return {
      approved: false,
      amount: 0n,
      confidence,
      reasoning: `REJECT: Verification score thấp (${verified.cross_check_score}/100). Issues: ${verified.issues.join('; ')}`
    };
  }

  if (confidence < 70) {
    return {
      approved: false,
      amount: 0n,
      confidence,
      reasoning: `REJECT: Confidence quá thấp (${confidence}/100), cần review thủ công`
    };
  }

  // Approve
  const reasoning = [
    `APPROVED (confidence ${confidence}%).`,
    `Damage: ${extracted.severity}, parts: ${extracted.affected_parts.join(', ')}.`,
    `Estimated: ${estimated.recommended_payout_vnd.toLocaleString()} VND.`,
    estimated.reasoning
  ].join(' ');

  return {
    approved: true,
    amount: BigInt(estimated.recommended_payout_usdc),
    confidence,
    reasoning
  };
}
```

## 7.8. Services

### `services/anthropic.ts`
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

export const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
```

### `services/ipfs.ts`
```typescript
import { config } from '../config';

export async function fetchIPFS(hash: string): Promise<Buffer> {
  const cleanHash = hash.replace('ipfs://', '');
  const url = `${config.PINATA_GATEWAY}/ipfs/${cleanHash}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
```

### `services/mockDMV.ts`
```typescript
// Mock VN DMV - trong production sẽ replace bằng real API
export async function checkVehicle(plate: string) {
  // Simulate API delay
  await new Promise(r => setTimeout(r, 300));

  // Fake logic: plate ending 8/9 → valid, others → invalid (for demo variance)
  const lastChar = plate.slice(-1);
  const valid = ['8', '9', '7', '6', '5'].includes(lastChar);
  return {
    plate_valid: valid,
    active_insurance: valid,
    owner_verified: valid
  };
}
```

### `services/weather.ts`
```typescript
import { config } from '../config';

export async function getWeatherAt(lat: number, lng: number, timestamp: number) {
  const dt = Math.floor(timestamp / 1000);
  const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lng}&dt=${dt}&appid=${config.OPENWEATHER_KEY}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather API failed');
  const data = await res.json();
  const hour = data.data[0];
  return {
    temp: hour.temp,
    conditions: hour.weather[0].main
  };
}
```

### `services/exif.ts`
```typescript
import exifr from 'exifr';

export async function extractEXIF(buf: Buffer) {
  try {
    const data = await exifr.parse(buf, { gps: true });
    return {
      timestamp: data?.DateTimeOriginal?.getTime() ?? null,
      gps: (data?.latitude && data?.longitude)
        ? { lat: data.latitude, lng: data.longitude } : null,
      device: data?.Make ?? null,
    };
  } catch {
    return { timestamp: null, gps: null, device: null };
  }
}
```

## 7.9. Utils

### `utils/signature.ts`
```typescript
import { Wallet } from 'ethers';
import { config } from '../config';
import { ethers } from 'ethers';

const oracleWallet = new Wallet(config.ORACLE_PRIVATE_KEY);

export async function signVerdict(
  claimId: number,
  approved: boolean,
  amount: bigint,
  confidence: number,
  reasoning: string
): Promise<string> {
  const messageHash = ethers.solidityPackedKeccak256(
    ['uint256', 'bool', 'uint256', 'uint8', 'string'],
    [claimId, approved, amount, confidence, reasoning]
  );
  return await oracleWallet.signMessage(ethers.getBytes(messageHash));
}
```

### `utils/retry.ts`
```typescript
export async function retry<T>(fn: () => Promise<T>, max: number): Promise<T> {
  let lastErr;
  for (let i = 0; i < max; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}
```

### `contracts.ts`
```typescript
import { ethers } from 'ethers';
import { config } from './config';
import ClaimRegistryABI from './abis/ClaimRegistry.json';
import PolicyManagerABI from './abis/PolicyManager.json';
import deployments from '../../contracts/deployments/sepolia.json';

export const provider = new ethers.JsonRpcProvider(config.RPC_URL);
export const oracleSigner = new ethers.Wallet(config.ORACLE_PRIVATE_KEY, provider);

export const claimRegistry = new ethers.Contract(
  deployments.claimRegistry,
  ClaimRegistryABI,
  oracleSigner
);

export const policyManager = new ethers.Contract(
  deployments.policyManager,
  PolicyManagerABI,
  provider
);
```

### `config.ts`
```typescript
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.string().default('4000').transform(Number),
  RPC_URL: z.string().url(),
  RPC_URL_FALLBACK: z.string().url().optional(),
  ORACLE_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  PINATA_GATEWAY: z.string().url().default('https://gateway.pinata.cloud'),
  PINATA_JWT: z.string(),
  OPENWEATHER_KEY: z.string(),
});

export const config = schema.parse(process.env);
```

---

<a name="8-frontend"></a>

# 8. FRONTEND

## 8.1. Key screens

**Landing** (`/`): Hero với tagline "Bảo hiểm xe máy 90 giây". CTA: Connect wallet.

**Policies list** (`/policies`): 3 tier card ($1, $3, $5 premium). Click → purchase flow.

**Purchase modal**: Nhập biển số → hash → approve USDC → purchasePolicy tx.

**Submit claim** (`/claims/new`): Chọn policy → upload ảnh damage → description → submit.

**Claim tracker** (`/claims/[id]`): Real-time status với 5 steps visual, mỗi 3s poll `claims(id)`. Khi Paid → hiện congratulation + tx link Etherscan.

**My claims** (`/claims`): List các claim đã submit.

## 8.2. Config wagmi — `lib/wagmi.ts`

```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'ClaimBot',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [sepolia],
  ssr: true,
});
```

## 8.3. Hook: `useClaimStatus.ts`

```typescript
'use client';
import { useReadContract, useWatchContractEvent } from 'wagmi';
import { CLAIM_REGISTRY, claimRegistryAbi } from '@/lib/contracts';

export function useClaimStatus(claimId: bigint) {
  const { data, refetch } = useReadContract({
    address: CLAIM_REGISTRY,
    abi: claimRegistryAbi,
    functionName: 'claims',
    args: [claimId],
    query: { refetchInterval: 3000 },   // Poll every 3s
  });

  useWatchContractEvent({
    address: CLAIM_REGISTRY,
    abi: claimRegistryAbi,
    eventName: 'StatusUpdated',
    args: { claimId },
    onLogs: () => refetch(),
  });

  return data;
}
```

## 8.4. Component: `ClaimStatusTracker.tsx`

```tsx
'use client';
import { useClaimStatus } from '@/hooks/useClaimStatus';

const STEPS = [
  { id: 0, label: 'Đã nộp', desc: 'Claim được ghi lên blockchain' },
  { id: 1, label: 'Phân tích ảnh', desc: 'AI đang đọc damage từ ảnh' },
  { id: 2, label: 'Xác minh', desc: 'Cross-check DMV, thời tiết, EXIF' },
  { id: 3, label: 'Ước tính chi phí', desc: 'AI tính giá sửa theo VN' },
  { id: 4, label: 'Judge quyết định', desc: 'Agent aggregate + verdict' },
  { id: 5, label: 'Thanh toán', desc: 'USDC chuyển về ví của bạn' },
];

export function ClaimStatusTracker({ claimId }: { claimId: bigint }) {
  const claim = useClaimStatus(claimId);
  const currentStatus = claim?.status ?? 0;

  return (
    <div className="space-y-4">
      {STEPS.map(step => {
        const active = currentStatus === step.id;
        const done = currentStatus > step.id || currentStatus === 5;
        return (
          <div key={step.id} className="flex gap-4 items-start">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center
              ${done ? 'bg-green-500' : active ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}
            `}>
              {done ? '✓' : step.id + 1}
            </div>
            <div>
              <div className="font-semibold">{step.label}</div>
              <div className="text-sm text-gray-600">{step.desc}</div>
            </div>
          </div>
        );
      })}

      {currentStatus === 5 && (
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="font-bold text-green-800">✅ Thanh toán thành công!</div>
          <div>Amount: {(Number(claim.approvedAmount) / 1e6).toFixed(2)} USDC</div>
          <div className="text-sm mt-2 italic">{claim.reasoning}</div>
        </div>
      )}
      {currentStatus === 6 && (
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="font-bold text-red-800">❌ Claim bị từ chối</div>
          <div className="text-sm mt-2 italic">{claim.reasoning}</div>
        </div>
      )}
    </div>
  );
}
```

## 8.5. IPFS upload proxy — `app/api/upload/route.ts`

```typescript
export async function POST(req: Request) {
  const formData = await req.formData();
  const pinataForm = new FormData();
  pinataForm.append('file', formData.get('file') as File);

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: pinataForm
  });
  const data = await res.json();
  return Response.json({ ipfsHash: data.IpfsHash });
}
```

---

<a name="9-chainlink"></a>

# 9. CHAINLINK INTEGRATION — STEP BY STEP

## 9.1. Chainlink Functions setup (cho VehicleVerifier)

**Step 1**: Vào https://functions.chain.link, connect wallet (Sepolia)

**Step 2**: Click "Create Subscription" → fund với 10 LINK từ https://faucets.chain.link

**Step 3**: Note subscription ID (VD: 3521)

**Step 4**: Deploy `VehicleVerifier` với subscription ID:
```bash
forge script script/DeployVerifier.s.sol --rpc-url $SEPOLIA_RPC --broadcast \
  --sig "run(uint64)" 3521
```

**Step 5**: Vào subscription page → "Add consumer" → paste VehicleVerifier address

**Step 6**: Test manual: gọi `requestVerification(1, "51-A1-2345")` → chờ ~30s → check `claimVerification(1)`

## 9.2. Chainlink Automation setup

**Step 1**: Vào https://automation.chain.link, connect wallet

**Step 2**: "Register new Upkeep" → chọn "Custom Logic"

**Step 3**: Fill:
- Target contract address: `<ClaimAutomation address>`
- Upkeep name: `ClaimBot Deadline Refund`
- Gas limit: `500000`
- Starting balance: `5 LINK`
- Check data: `0x` (empty)
- Trigger: Every block

**Step 4**: Confirm → note Upkeep ID

**Step 5**: Verify: create test claim, đợi qua deadline (hoặc sửa `CLAIM_DEADLINE = 5 minutes` cho test) → automation sẽ auto refund

## 9.3. Test USDC on Sepolia

Circle Sepolia USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

Faucet: https://faucet.circle.com → chọn Ethereum Sepolia → mint 10 USDC

Cho MVP, fund `PayoutVault` với ít nhất 100 USDC bằng cách:
```bash
forge script script/FundVault.s.sol --rpc-url $SEPOLIA_RPC --broadcast
```

---

<a name="10-env"></a>

# 10. ENVIRONMENT VARIABLES

## `.env.example` (root level)

```bash
# ─── Deploy / Contracts ───
DEPLOYER_PRIVATE_KEY=0x...
ORACLE_ADDRESS=0x...                    # Address của oracle backend
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY

# ─── Backend ───
PORT=4000
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
RPC_URL_FALLBACK=https://sepolia.infura.io/v3/YOUR_KEY
ORACLE_PRIVATE_KEY=0x...                # KEY của address trên
ANTHROPIC_API_KEY=sk-ant-...
PINATA_JWT=eyJhbGc...
PINATA_GATEWAY=https://gateway.pinata.cloud
OPENWEATHER_KEY=...
LOG_LEVEL=info

# ─── Frontend ───
NEXT_PUBLIC_WC_PROJECT_ID=...           # WalletConnect Cloud
NEXT_PUBLIC_ALCHEMY_KEY=...
NEXT_PUBLIC_POLICY_MANAGER=0x...
NEXT_PUBLIC_CLAIM_REGISTRY=0x...
NEXT_PUBLIC_PAYOUT_VAULT=0x...
NEXT_PUBLIC_USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
PINATA_JWT=eyJhbGc...                   # server-only, không public
```

## Nơi lấy các keys

| Key | Nơi lấy | Cost |
|-----|---------|------|
| Alchemy | alchemy.com → new app Sepolia | Free |
| Etherscan | etherscan.io → API keys | Free |
| Anthropic | console.anthropic.com | ~$5 credit đủ demo |
| Pinata | pinata.cloud | Free 1GB |
| OpenWeather | openweathermap.org | Free tier |
| WalletConnect | cloud.walletconnect.com | Free |
| LINK Sepolia | faucets.chain.link | Free |

---

<a name="11-deployment"></a>

# 11. DEPLOYMENT GUIDE

## 11.1. One-time setup script — `scripts/setup.sh`

```bash
#!/bin/bash
set -e

# Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Contracts deps
cd contracts
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
forge install smartcontractkit/chainlink-brownie-contracts@v1.2.0
cd ..

# Backend deps
cd backend
npm install
cd ..

# Frontend deps
cd frontend
npm install
cd ..

echo "✅ Setup complete. Now fill .env then run scripts/deploy-all.sh"
```

## 11.2. Deploy script — `scripts/deploy-all.sh`

```bash
#!/bin/bash
set -e
source .env

echo "── 1. Deploying contracts to Sepolia ──"
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY

echo "── 2. Copy ABIs to backend & frontend ──"
mkdir -p ../backend/src/abis ../frontend/src/lib/abis
for c in PolicyManager ClaimRegistry PayoutVault; do
  jq '.abi' out/$c.sol/$c.json > ../backend/src/abis/$c.json
  cp ../backend/src/abis/$c.json ../frontend/src/lib/abis/$c.json
done

echo "── 3. Copy deployment addresses ──"
cp deployments/sepolia.json ../frontend/src/lib/deployments.json

cd ..
echo "── 4. Fund PayoutVault ──"
cd contracts
forge script script/FundVault.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

echo "✅ Deploy complete. Contract addresses:"
cat contracts/deployments/sepolia.json | jq
```

## 11.3. Backend deploy (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login
cd backend
railway init
railway up
railway variables set ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
railway variables set ORACLE_PRIVATE_KEY=$ORACLE_PRIVATE_KEY
# ... (repeat for other vars)
```

## 11.4. Frontend deploy (Vercel)

```bash
cd frontend
vercel --prod
# Or: connect Github repo → auto-deploy
```

---

<a name="12-testing"></a>

# 12. TESTING PLAN

## 12.1. Foundry unit tests

Ít nhất phải cover:

**`PolicyManager.t.sol`**:
- ✅ Purchase policy successful with proper premium transfer
- ✅ Cannot purchase với invalid tier
- ✅ Cannot purchase without USDC approval
- ✅ `isActive` returns false after endTime
- ✅ `isActive` returns false after totalPaidOut >= coverage
- ✅ `recordPayout` chỉ callable bởi ADMIN_ROLE

**`ClaimRegistry.t.sol`**:
- ✅ Submit claim success
- ✅ Cannot submit if policy not active
- ✅ Cannot submit if not policy holder
- ✅ Status update chỉ callable bởi ORACLE_ROLE
- ✅ Verdict với invalid signature → revert
- ✅ Verdict amount > coverage → revert
- ✅ Verdict approved → payout đúng amount
- ✅ Verdict rejected → không payout
- ✅ Deadline exceeded → verdict revert
- ✅ `refundExpiredClaim` chỉ callable bởi AUTOMATION_ROLE
- ✅ Cannot refund claim đã Paid/Rejected

**`PayoutVault.t.sol`**:
- ✅ Fund reserve
- ✅ ExecutePayout chỉ callable bởi CLAIM_REGISTRY_ROLE
- ✅ ExecutePayout reverts if insufficient
- ✅ Emergency withdraw chỉ admin

**`FullFlow.t.sol`** (integration):
- ✅ Full happy path: buy policy → submit claim → verdict approved → payout received
- ✅ Full rejection path
- ✅ Deadline refund path

## 12.2. Backend tests (Vitest + msw)

Mock Anthropic, IPFS, weather API. Test:
- Extractor returns valid schema
- Verifier flags red cases (invalid plate, no EXIF)
- Estimator sane amounts
- Judge auto-reject rules correct
- Orchestrator handles agent failure (retry)

## 12.3. E2E test (Playwright)

```typescript
// e2e/full-flow.spec.ts
test('happy path: buy policy, submit claim, get payout', async ({ page }) => {
  // Requires local Anvil fork + backend mocked
  await page.goto('/');
  await page.click('button:has-text("Connect Wallet")');
  // ... use synpress or mock wallet
  await page.click('button:has-text("Buy Policy - $3")');
  // ... assert tx hash appears
  await page.goto('/claims/new');
  await page.setInputFiles('input[type=file]', 'fixtures/damage.jpg');
  await page.fill('textarea', 'Va chạm nhẹ tại ngã tư');
  await page.click('button:has-text("Submit Claim")');
  await expect(page.locator('text=Đã nộp')).toBeVisible();
  // Wait up to 2 min for full pipeline
  await expect(page.locator('text=Thanh toán thành công')).toBeVisible({ timeout: 120_000 });
});
```

## 12.4. Manual test checklist trước AMA

- [ ] Deploy fresh contracts trên Sepolia
- [ ] Verify all contracts on Etherscan
- [ ] Fund PayoutVault với 200 USDC
- [ ] Test buy policy từ MetaMask
- [ ] Submit test claim với ảnh mẫu → complete pipeline < 120s
- [ ] Test rejection flow (ảnh không phải xe)
- [ ] Test deadline refund (set CLAIM_DEADLINE=5min tạm thời)
- [ ] Record backup video 4 phút demo
- [ ] Prepare 3 pre-loaded wallets với USDC ready
- [ ] Prepare 5 sample damage photos đa dạng

---

<a name="13-roadmap"></a>

# 13. DEVELOPMENT ROADMAP (4 tuần)

## Week 1: Contract Foundation

**Day 1** (setup):
- Init monorepo structure
- Setup Foundry + install deps
- Init Next.js + backend TypeScript
- Setup `.env.example`

**Day 2-3** (write contracts):
- Write PolicyManager, ClaimRegistry, PayoutVault
- Write interfaces + libraries
- Write mock contracts (MockUSDC)

**Day 4-5** (unit tests):
- Write all Foundry tests, target 90%+ coverage
- Run `forge coverage` verify

**Day 6-7** (deploy):
- Write Deploy.s.sol
- Deploy Sepolia + verify Etherscan
- Manual test buy policy + submit claim từ Foundry cast

## Week 2: Backend Pipeline

**Day 8-9** (agents scaffolding):
- Setup TypeScript project
- Implement Extractor với Claude Vision
- Test standalone với sample image

**Day 10-11** (verifier + estimator):
- Implement Verifier (mock DMV + weather + EXIF)
- Implement Estimator (rule-based + LLM sanity check)

**Day 12** (judge + orchestrator):
- Implement Judge
- Wire up orchestrator với event listener
- Signature signing/verification

**Day 13-14** (integration + Chainlink Automation):
- End-to-end test on Sepolia
- Deploy ClaimAutomation
- Register Chainlink Automation upkeep
- Test deadline refund

## Week 3: Frontend + Chainlink Functions

**Day 15-16** (frontend scaffolding):
- Setup Next.js với RainbowKit + wagmi
- Landing page + wallet connect
- Policies page với 3 tiers

**Day 17-18** (submit claim flow):
- ClaimForm với photo upload
- IPFS upload via Pinata
- Submit tx flow

**Day 19-20** (status tracker + polish):
- Real-time status tracker
- Claim detail page
- Loading states + error handling

**Day 21** (Chainlink Functions):
- Deploy VehicleVerifier
- Register Functions subscription
- Test verification call

## Week 4: Polish + Demo Prep

**Day 22-23**:
- E2E testing full flow trên Sepolia
- Fix edge cases (retry, timeouts, revert reasons)
- Improve UX (toasts, tx status)

**Day 24-25**:
- Record 4-minute demo video (BACKUP QUAN TRỌNG)
- Prepare 3 demo scenarios: approved, rejected, refund

**Day 26-27**:
- Slide deck (theo AMA Killer Comparison Table)
- Prepare Q&A (15 hard questions)
- Rehearsal 3 lần

**Day 28**: Buffer day cho unexpected issues

---

<a name="14-acceptance"></a>

# 14. ACCEPTANCE CRITERIA

MVP được coi là **DONE** khi tất cả các items sau pass:

## Contracts
- [ ] Tất cả contracts deployed + verified trên Sepolia Etherscan
- [ ] `forge coverage` ≥ 85% cho src/
- [ ] Full flow test pass: buy policy → submit claim → verdict → payout
- [ ] Deadline refund test pass
- [ ] Signature verification test pass (invalid sig → revert)

## Backend
- [ ] Orchestrator process claim end-to-end trong < 120s
- [ ] Retry logic hoạt động khi agent fail
- [ ] Health endpoint returns 200
- [ ] Logs structured JSON (pino)
- [ ] Deployed lên Railway/Fly.io, running 24/7

## Frontend
- [ ] Connect wallet với MetaMask thành công
- [ ] Purchase policy flow hoàn chỉnh (approve + tx)
- [ ] Submit claim với ảnh upload lên IPFS
- [ ] Status tracker update real-time (poll 3s)
- [ ] Hiển thị congratulation/rejection message với reasoning
- [ ] Responsive trên mobile
- [ ] Deployed Vercel với custom domain (optional)

## Integration
- [ ] Chainlink Automation registered + tested
- [ ] Chainlink Functions request/response hoạt động
- [ ] Backend nhận event từ Sepolia trong < 5s

## Demo readiness
- [ ] Backup demo video sẵn sàng
- [ ] 3 demo wallets pre-loaded USDC
- [ ] 5 sample damage photos ready
- [ ] PayoutVault có đủ USDC (≥ 200)
- [ ] AMA slide deck done

---

<a name="15-troubleshooting"></a>

# 15. COMMON ISSUES & SOLUTIONS

## 15.1. Contract issues

**Issue**: `forge script` fails với "insufficient funds"
→ Deployer wallet cần ≥ 0.3 Sepolia ETH. Faucet: sepoliafaucet.com

**Issue**: Verify Etherscan fails
→ Check compiler version match exactly. Add `--compiler-version v0.8.24+commit.e11b9ed9` explicitly.

**Issue**: Test USDC transfer fails
→ Sepolia USDC address correct? Circle test USDC yêu cầu `transferFrom` với approval trước.

**Issue**: `submitVerdict` revert với InvalidSignature
→ Message hash trong TS phải EXACTLY match contract. Check parameter order + types. Use `ethers.solidityPackedKeccak256`.

## 15.2. Backend issues

**Issue**: Event listener miss events
→ ethers.js v6 với WebSocket có bug reconnect. Dùng HTTP polling fallback:
```typescript
provider.on('block', async (blockNum) => {
  const events = await claimRegistry.queryFilter('ClaimSubmitted', blockNum, blockNum);
  events.forEach(e => processClaim(...));
});
```

**Issue**: Claude Vision returns non-JSON
→ Add explicit "Only JSON, no markdown, no explanation" trong prompt. Set `temperature: 0`. Parse với regex `\{[\s\S]*\}`.

**Issue**: IPFS fetch timeout
→ Pinata gateway đôi khi chậm. Fallback multiple gateways:
```typescript
const gateways = [
  'https://gateway.pinata.cloud',
  'https://ipfs.io',
  'https://cloudflare-ipfs.com'
];
```

**Issue**: EXIF không có
→ Nhiều app remove EXIF (WhatsApp, Facebook). Đây là REALITY — skill này trong verifier chỉ là bonus signal, không block claim.

## 15.3. Chainlink issues

**Issue**: Chainlink Functions callback không trigger
→ Check subscription có consumer chưa. Check LINK balance ≥ 1. Check `fun-ethereum-sepolia-1` DON ID correct.

**Issue**: Automation không perform upkeep
→ `checkUpkeep` phải là `view`. Return `true` + `performData`. Check upkeep có LINK balance. Simulate qua Etherscan "Read".

## 15.4. Frontend issues

**Issue**: wagmi hooks không refetch
→ Trong wagmi v2, dùng `useReadContract` với `query.refetchInterval` thay vì `useWatchContractEvent` cho polling.

**Issue**: MetaMask không hiện Sepolia
→ Config trong `wagmi.ts` phải include `sepolia`. RainbowKit sẽ auto add.

**Issue**: File upload lớn fails
→ Compress ảnh client-side trước upload (max 2MB):
```typescript
import imageCompression from 'browser-image-compression';
const compressed = await imageCompression(file, { maxSizeMB: 2 });
```

## 15.5. Demo day issues

**Issue**: Sepolia network chậm/reorg
→ ALWAYS có backup video. Nói trước audience: "network Sepolia đôi khi chậm, có video backup".

**Issue**: Faucet ETH out
→ Pre-load 3 wallets với 0.5 ETH mỗi ví trước demo 1 ngày.

**Issue**: Anthropic rate limit trong demo
→ Pre-cache verdict cho 1 sample claim để show instant nếu cần fallback.

---

# 🎯 CLOSING NOTES CHO CLAUDE CODE

Khi implement:

1. **Follow order trong Development Roadmap**. Đừng skip tests → sẽ debug đau.
2. **Contracts trước, backend sau, frontend cuối**. Vì backend + frontend đều depend on ABIs.
3. **Test trên Anvil local trước khi deploy Sepolia**. Fork Sepolia với `anvil --fork-url $SEPOLIA_RPC_URL` để test miễn phí.
4. **Commit thường xuyên**. Mỗi phase = 1 PR.
5. **Log mọi thứ trong backend**. Debug pipeline sẽ dựa vào logs.
6. **Structure code phù hợp cho migration lên Rialo sau này**. Abstract khỏi Chainlink specifics, để sau replace bằng Rialo native calls dễ hơn.

**Reference materials**:
- Rialo docs: https://rialo.io/docs
- Rialo blog: https://rialo.io/blog
- Foundry book: https://book.getfoundry.sh
- wagmi docs: https://wagmi.sh
- Chainlink Functions: https://docs.chain.link/chainlink-functions
- Chainlink Automation: https://docs.chain.link/chainlink-automation

**When in doubt**: Prefer simple over clever. This is an MVP for AMA, không phải production insurance company. Ship first, optimize later.

Good luck 🚀
