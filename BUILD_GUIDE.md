# Build Guide — AI-Adjudicated On-Chain Settlement App (Sepolia)

> **How to use this file**
> Paste it into an AI coding assistant (Claude Code, Cursor, etc.) as the project
> spec. Read it start to finish before writing code, then build in the phase
> order given. Each phase ends with a verification step — do not move on until it
> passes.

---

## 0. What you are building

A web application where a user submits a **request with evidence**, a chain of
**AI agents evaluates it**, and a **signed verdict settles on-chain** by moving
tokens to the user automatically.

The domain is yours to choose. The pattern fits any of these:

| Domain | Request | Evidence | Payout |
|---|---|---|---|
| Micro-insurance | Damage claim | Photo of damage | Repair cost |
| Bug bounty | Vulnerability report | PoC + logs | Bounty tier |
| Grant milestone | Milestone completion | Repo diff + demo | Milestone amount |
| Freelance escrow | Work delivered | Deliverable files | Contract amount |
| Warranty | Product defect | Photo + receipt | Refund |

Pick **one** and stay with it. This guide uses neutral names —
`Request`, `Evidence`, `Verdict`, `Payout` — substitute your own.

### The core loop

```
User buys/opens an agreement  →  deposits are escrowed on-chain
        ↓
User submits a request + evidence (evidence pinned to IPFS)
        ↓
Off-chain agents run in sequence:
   Extractor  → structured data out of unstructured evidence
   Verifier   → cross-check that data against external sources
   Estimator  → compute the amount owed
   Judge      → aggregate, apply rules, produce a signed verdict
        ↓
Verdict submitted on-chain with a signature
        ↓
Approved → tokens transfer to the user
Rejected → reason stored on-chain
No verdict before the deadline → automatic refund
```

### Non-negotiable properties

1. **The contract is the source of truth.** The UI never shows a state the chain
   does not have.
2. **The verdict is signed.** The contract verifies the signature before moving
   money.
3. **The contract caps the payout.** Even a compromised agent cannot exceed the
   agreement's remaining coverage.
4. **There is a deadline fallback.** If the agents never respond, the user is not
   stuck forever.

---

## 1. Why this is built on Sepolia, and what it demonstrates

Rialo is a Layer 1 designed so smart contracts can reach the real world
directly. Its network is not public yet, so this project is built on **Ethereum
Sepolia** using workarounds — and the workarounds *are the point*.

Build it so the contrast is measurable:

| Rialo capability | What you must build on Sepolia instead |
|---|---|
| **Native webcalls** — a contract calls an HTTPS API in one line | A Chainlink Functions consumer contract, a funded subscription, LINK, CBOR-encoded request payloads, and manual consumer registration — all to make one GET request |
| **Native timers / reactive transactions** — a contract sleeps and wakes itself | A Chainlink Automation-compatible contract, a registered upkeep, and a LINK balance — all to fire one deadline |
| **On-chain reactive execution** — logic runs when an event occurs | A Node.js service polling for events 24/7, plus nonce management and crash recovery |
| **SCALE** — trustless agent payment with escrow, deadline, and quality judging | An off-chain signer holding a privileged role — the one real trust hole in the design |
| **Real-world identity** — email/SMS login | Wallet, seed phrase, and the user funding their own gas |
| **Configurable privacy** | Manual hashing of identifiers; evidence sits on public IPFS |

**Instrument this.** At the end, count the lines that exist only because of
middleware versus the lines that serve the user. A typical result is that
**over half the codebase is scaffolding**. That number is the deliverable.

Keep the agent pipeline in its own package with **zero Chainlink imports**, so a
future migration replaces only the outer layer.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Contracts | Solidity `^0.8.24`, **Foundry** | Not Hardhat |
| Contract libs | OpenZeppelin `v5.0.2`, Chainlink contracts `1.2.0` | See §11 for the tag-name trap |
| Shared agent pipeline | TypeScript, ESM, npm workspace package | No framework |
| LLM | Anthropic SDK (vision-capable model) | Any provider works; keep it behind one module |
| Backend service | Node 20+, Express, ethers v6 | Long-running event listener |
| Frontend | Next.js 14 App Router, TypeScript | |
| Wallet | RainbowKit + wagmi v2 + viem | |
| Styling | Tailwind CSS | |
| Storage | IPFS via Pinata | |
| Hosting | Vercel (frontend + serverless orchestrator) | |
| Testing | Foundry (`forge test`), Vitest | |

---

## 3. Repository layout

Use **npm workspaces**. The agent pipeline must be a shared package so the
long-running service and the serverless route run *the same code*, not two
copies that drift.

```
<repo>/
├── package.json                 # workspace root
├── vercel.json                  # build config for the monorepo
├── .env.example
│
├── contracts/                   # Foundry
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── src/
│   │   ├── AgreementManager.sol      # agreements, tiers, coverage accounting
│   │   ├── RequestRegistry.sol       # state machine + verdict verification
│   │   ├── PayoutVault.sol           # token reserve, gated transfers
│   │   ├── DeadlineAutomation.sol    # Chainlink Automation consumer
│   │   ├── ExternalVerifier.sol      # Chainlink Functions consumer
│   │   ├── interfaces/
│   │   └── libraries/
│   │       └── VerdictSignature.sol  # the hashing contract — read §5.3
│   ├── test/
│   │   ├── Base.t.sol                # shared fixture
│   │   ├── <PerContract>.t.sol
│   │   ├── FullFlow.t.sol            # integration
│   │   └── mocks/MockToken.sol
│   └── script/
│       ├── Deploy.s.sol
│       ├── FundVault.s.sol
│       ├── SeedAgreement.s.sol
│       └── SubmitTestRequest.s.sol
│
├── packages/pipeline/           # SHARED — no chain, no framework, no ambient env
│   ├── package.json             # name: @<scope>/pipeline
│   └── src/
│       ├── types.ts             # PipelineConfig, Logger, context
│       ├── agents/{extractor,verifier,estimator,judge}.ts
│       ├── services/{llm,ipfs,externalApi,metadata}.ts
│       ├── utils/{retry,signature}.ts
│       └── index.ts             # barrel export
│
├── backend/                     # long-running orchestrator
│   └── src/{index,config,contracts,orchestrator,pipelineContext}.ts
│       └── utils/{logger,txQueue}.ts
│
├── frontend/                    # Next.js
│   └── src/
│       ├── app/
│       │   ├── api/upload/route.ts        # IPFS pin proxy (server-only secret)
│       │   └── api/orchestrate/route.ts   # serverless orchestrator
│       ├── server/orchestrator.ts
│       ├── components/, hooks/, lib/, types/
│
└── scripts/{setup,preflight,deploy-all,seed}.sh
```

---

## 4. Phase 1 — Contracts

Build contracts first. The backend and frontend both depend on the ABIs.

### 4.1 `AgreementManager.sol`

Holds the agreements a user opens.

```
struct Agreement {
  address holder;
  bytes32 subjectHash;   // keccak256 of the identifier — never store it raw
  uint256 deposit;       // token, 6 decimals if USDC
  uint256 coverage;      // maximum total payout
  uint256 startTime;
  uint256 endTime;
  uint256 requestCount;
  uint256 totalPaidOut;
  bool active;
}
```

Requirements:

- Configurable **tiers** (deposit, coverage, duration) set in the constructor and
  extendable by an admin.
- `isActive(id)` returns false when expired **or** when `totalPaidOut >= coverage`.
- `remainingCoverage(id)` returns 0 for an inactive agreement — never underflow.
- `recordPayout(id, amount)` is callable **only** by the registry contract
  (`AccessControl` role), and deactivates the agreement once coverage is used up.
- Use `SafeERC20`. Do not assume `transfer` returns a bool.
- Expose `getTiers()` and `getAgreementsByHolder(address)` so the frontend needs
  one call, not N.

### 4.2 `PayoutVault.sol`

Holds the token reserve. Deliberately dumb.

- `fundReserve(amount)` — role-gated.
- `executePayout(to, amount)` — callable **only** by the registry role.
- Reverts on zero amount, zero address, and insufficient balance.
- `availableReserve()` reads the live token balance, not a cached counter.
- `emergencyWithdraw` for the admin only.
- `ReentrancyGuard` on every state-changing external function.

### 4.3 `RequestRegistry.sol`

The state machine. This is where the value moves, so it gets the most care.

```
enum Status {
  Submitted,   // 0
  Extracting,  // 1
  Verifying,   // 2
  Estimating,  // 3
  Judged,      // 4
  Paid,        // 5
  Rejected,    // 6
  Refunded,    // 7  (deadline fallback)
  Disputed     // 8  (reserved)
}
```

**`submitRequest(agreementId, evidenceURI, description)`**
- Reject empty evidence.
- Reject if the agreement is inactive.
- Reject if `msg.sender` is not the agreement holder.
- Set `deadline = block.timestamp + claimDeadline`.
- Push to an `activeIds` array (see the swap-and-pop note below).
- Emit `RequestSubmitted(id, agreementId, requester, evidenceURI)` — the backend
  keys off this.

**`updateStatus(id, newStatus)`** — oracle role only
- Forward-only. Revert on any status `<=` current.
- Revert if the target is past `Judged`; that path must go through `submitVerdict`.

**`submitVerdict(id, approved, amount, confidence, reasoning, signature)`** — oracle role only
- Revert if past the deadline.
- Revert if already finalized (`Paid`/`Rejected`/`Refunded`).
- Recompute the payload hash on-chain and recover the signer. Revert unless the
  signer holds the oracle role. **See §5.3 — this is the most common bug.**
- If approved: reject a zero amount, reject `amount > remainingCoverage`, set
  `Paid`, then call `recordPayout` and `executePayout`.
- If rejected: set `Rejected`, store the reasoning on-chain.
- Remove from the active set in both branches.

**`refundExpiredRequest(id)`** — automation role only
- Revert if the deadline has not passed.
- Revert if already finalized.
- Set `Refunded`.

**Make the deadline a constructor parameter, not a constant.** You will want to
deploy with a 5-minute deadline to demo the refund path without waiting 48 hours.

**Active-set bookkeeping — do not use a linear scan.** The automation contract
reads this array on every block. Removing by looping over it grows unbounded.
Use swap-and-pop with an index map:

```solidity
mapping(uint256 => uint256) private _activeIndexPlusOne; // 0 means absent

function _addToActive(uint256 id) internal {
    activeIds.push(id);
    _activeIndexPlusOne[id] = activeIds.length;
}

function _removeFromActive(uint256 id) internal {
    uint256 indexPlusOne = _activeIndexPlusOne[id];
    if (indexPlusOne == 0) return;
    uint256 index = indexPlusOne - 1;
    uint256 lastIndex = activeIds.length - 1;
    if (index != lastIndex) {
        uint256 moved = activeIds[lastIndex];
        activeIds[index] = moved;
        _activeIndexPlusOne[moved] = index + 1;
    }
    activeIds.pop();
    delete _activeIndexPlusOne[id];
}
```

### 4.4 `DeadlineAutomation.sol` — stands in for a native timer

Implements `AutomationCompatibleInterface`.

- `checkUpkeep` is `view`. Scan `getActiveRequests()`, collect those past their
  deadline and not finalized, **cap the batch** (e.g. 5) so the call stays within
  gas limits, and return `abi.encode(ids)`.
- `performUpkeep` decodes and calls `refundExpiredRequest` for each, wrapped in
  `try/catch` so one bad id cannot block the rest.
- Treat `performData` as untrusted — the registry re-validates the deadline and
  status anyway, which is what makes this safe.

### 4.5 `ExternalVerifier.sol` — stands in for a native webcall

A Chainlink Functions consumer. Inline JavaScript source that calls your external
API, `setArgs` for the parameter, `_sendRequest`, and a `fulfillRequest` callback
that stores the result keyed by request id.

Handle the error branch of `fulfillRequest` — store the error rather than writing
an empty success. Gate `requestVerification` to the owner so the subscription
cannot be drained.

> Write this contract even if you never wire it into the main flow. Its size and
> setup cost are the evidence for §1.

### 4.6 Tests — target 90%+ line coverage on `src/`

Write a `Base.t.sol` fixture that deploys the whole stack and wires the roles
exactly as the deploy script does. Then cover:

- Agreement: purchase, invalid tier, missing approval, expiry, coverage
  exhaustion, role-gating on `recordPayout`.
- Vault: funding, payout role-gating, insufficient reserve, zero amount/address.
- Registry: submit, non-holder rejected, inactive agreement rejected, status
  forward-only, **invalid signature rejected**, **tampered payload rejected**,
  amount over coverage rejected, verdict after deadline rejected, verdict on a
  finalized request rejected, refund role-gating, refund before deadline rejected.
- Full flow: approved path, rejected path, deadline-refund path, batch upkeep,
  coverage exhaustion blocking a second request.
- A fuzz test that `remainingCoverage` never underflows.

**Foundry gotcha:** put `vm.expectRevert(...)` **before** `vm.prank(...)`, not
after. The other order silently makes the test contract the caller and the
assertion passes for the wrong reason.

To test the Functions consumer without a live DON, `vm.mockCall` the router
address for `sendRequest`, then `vm.prank(router)` to invoke
`handleOracleFulfillment`.

### 4.7 Deploy script

One script that deploys all contracts, wires every role, and **writes the
addresses to a JSON file** the other packages read.

Role wiring — get this exactly right or the flow silently fails:

```
vault.grantRegistryRole(address(registry));
registry.grantOracleRole(oracleAddress);
registry.grantAutomationRole(address(automation));
agreementManager.grantRole(ADMIN_ROLE, address(registry));  // for recordPayout
```

Read the token address, oracle address, and deadline from env with sensible
defaults so a demo deploy can override the deadline.

**Verification step:** `forge test` green, coverage ≥ 90%, then deploy to a local
Anvil node and run the seed scripts against it before spending any testnet funds.

---

## 5. Phase 2 — The shared agent pipeline

This is a **standalone workspace package**. It must not import ethers-connected
singletons, read `process.env` directly, or depend on a logging framework.

### 5.1 Inject configuration, do not import it

The same code runs inside a long-lived service with validated config *and* inside
a serverless function with raw env vars. Neither may dictate the other.

```ts
export interface PipelineConfig {
  mockAI: boolean;              // run the whole pipeline with no LLM key
  llmApiKey?: string;
  llmModel: string;
  ipfsGateway: string;
  externalApiKey?: string;
}

export interface Logger {
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface PipelineContext { config: PipelineConfig; logger: Logger; }
```

Every agent takes `(input, ctx: PipelineContext)`. Export a `silentLogger` and a
`configFromEnv(env)` helper.

**`mockAI` is not a toy.** It is how the tests run without API keys, and it is the
fallback when the LLM provider rate-limits you during a live demo. Build it in
from the start.

### 5.2 The four agents

**Extractor** — the only agent that touches the raw evidence.
- Fetch from IPFS, detect the media type from magic bytes, base64-encode.
- Send to a vision model with `temperature: 0` and a strict JSON schema in the
  prompt.
- **Never trust the model's output shape.** Write a `normalizeExtracted()` that
  clamps numbers to range, coerces unknown enum values to a safe default, filters
  non-strings out of arrays, and returns a fully-typed object. A malformed field
  must not reach the chain.
- Strip markdown fences before parsing; models add them despite instructions.

**Verifier** — cross-checks the extracted data against the outside world.
- Start at score 100 and subtract explicit, named penalties.
- Return a list of human-readable `issues` alongside the score.
- Every external lookup is wrapped so a failure degrades the score rather than
  throwing away the whole request.
- **Weak signals must not be treated as fraud.** Missing photo metadata is normal
  — messaging apps strip it routinely. Record it as an issue with **zero** score
  penalty. Only an impossible signal (a future timestamp) should cost points.

**Estimator** — computes the amount.
- Rule-based table first, LLM only as a sanity check.
- **Clamp the LLM's adjustment.** If the model proposes a different number, bound
  it within a multiple of the rule-based range. A hallucinated number must not be
  able to inflate a payout.
- If the LLM call fails, log it and return the rule-based figure. The LLM is a
  check, not a dependency.

**Judge** — deterministic code, **not an LLM call**.
- This is the step that decides whether money moves, so it must be reproducible
  and auditable from the other three outputs alone.
- Ordered reject rules: fraud flags → unusable evidence → verification score
  below threshold → confidence below threshold → no computable amount.
- Overall confidence = `min(extractorConfidence, verifierScore)`.
- **Clamp the amount to remaining coverage** here as well as on-chain, so the
  contract revert is defence-in-depth rather than the primary control.
- Return a human-readable `reasoning` string — it is stored on-chain and will be
  read by strangers on a block explorer. Write it for them.

### 5.3 Verdict signing — read this twice

The single most common failure in this architecture is the off-chain signer and
the on-chain verifier hashing the payload differently. Nothing verifies, every
payout reverts, and the error message tells you nothing useful.

**Use `abi.encode`, never `abi.encodePacked`.** Packed encoding of a trailing
dynamic string is ambiguous — two different verdicts can produce the same bytes.

On-chain:

```solidity
library VerdictSignature {
    using MessageHashUtils for bytes32;

    function hash(
        uint256 id, bool approved, uint256 amount,
        uint8 confidence, string memory reasoning
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(id, approved, amount, confidence, reasoning));
    }

    function recoverSigner(bytes32 payloadHash, bytes memory signature)
        internal pure returns (address)
    {
        return ECDSA.recover(payloadHash.toEthSignedMessageHash(), signature);
    }
}
```

Off-chain — must mirror it exactly:

```ts
export function verdictPayloadHash(
  id: number | bigint, approved: boolean, amount: bigint,
  confidence: number, reasoning: string,
): string {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'bool', 'uint256', 'uint8', 'string'],
      [id, approved, amount, confidence, reasoning],
    ),
  );
}

export async function signVerdict(wallet: Wallet, ...args): Promise<string> {
  return wallet.signMessage(getBytes(verdictPayloadHash(...args)));
}
```

**Expose a public `verdictHashFor(...)` view on the registry** and assert in a
test that it equals the TypeScript hash for the same inputs. Then verify it
against the deployed contract with a CLI call before you trust the pipeline.

---

## 6. Phase 3 — The long-running orchestrator

A Node service that watches the chain and drives requests through the pipeline.

### 6.1 Poll blocks; do not subscribe over WebSocket

ethers v6 WebSocket reconnects drop events silently. A missed submission event
costs a real payout. Poll on an interval with `queryFilter(from, to)` and track
the last scanned block.

### 6.2 Serialize transactions and manage nonces yourself

Two requests can be in the pipeline at once, both writing from the same key. If
you let the library derive the nonce per call, the second send reuses the first's
nonce and fails with `nonce too low`. This *will* happen under concurrency and it
is easy to miss in single-request testing.

Build one queue with an explicit counter:

```ts
class OracleTxQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private nextNonce: number | null = null;

  async send(label, build: (nonce: number) => Promise<TxResponse>) {
    const run = this.tail.then(() => this.exec(label, build),
                              () => this.exec(label, build));
    this.tail = run.then(() => undefined, () => undefined); // keep the chain alive
    return run;
  }

  private async exec(label, build) {
    this.nextNonce ??= await this.wallet.getNonce('pending');
    const nonce = this.nextNonce;
    try {
      const tx = await build(nonce);
      this.nextNonce = nonce + 1;
      return await tx.wait();
    } catch (err) {
      this.nextNonce = null;  // may or may not have been consumed — resync
      throw err;
    }
  }
}
```

### 6.3 Other requirements

- **Crash recovery:** on startup, read the active set and resume anything not yet
  finalized.
- **Idempotency:** guard with an in-flight set, and skip early if the on-chain
  status is already terminal so a duplicate trigger costs no gas.
- **Retry with exponential backoff and jitter** around each agent call.
- **Structured JSON logging.** Debugging this pipeline is entirely log-driven.
- `GET /health` returning chain lag, in-flight ids, and the oracle address.
- Admin endpoints (retry a request, inspect runs) **gated behind an API key** —
  they trigger paid work.
- On pipeline failure, log and stop. The deadline automation is the safety net;
  do not invent a second recovery path.

---

## 7. Phase 4 — Frontend

### 7.1 Ground rules

- **The app must build and render with zero environment variables.** If contract
  addresses are unset, show a clear banner explaining what to configure — never
  let every read silently return nothing.
- Read addresses from `NEXT_PUBLIC_*` env with a checked-in deployment JSON as
  fallback, so a redeploy can repoint without a code change.
- Poll contract reads on an interval, and **stop polling once the request reaches
  a terminal state** so a finished tab does not hammer the RPC.
- Translate contract errors into plain language. Map custom error names and
  `user rejected` to sentences a non-developer understands; never surface raw ABI
  data.

### 7.2 Screens

| Route | Contents |
|---|---|
| `/` | Value proposition, the agent pipeline explained, and the Sepolia-vs-Rialo comparison from §1 |
| `/agreements` | Tier cards, purchase modal, the user's existing agreements |
| `/requests/new` | Agreement picker, evidence upload, description, submit |
| `/requests` | The user's requests with status badges |
| `/requests/[id]` | Live status tracker, final verdict with reasoning, explorer link |

### 7.3 Purchase flow

ERC-20 needs an allowance before the contract can pull the deposit. Check the
current allowance first, skip the approval if it already covers the amount, and
show the user which of the two transactions they are on.

### 7.4 Evidence upload

- Compress client-side before upload — phone photos are far too large for both
  the pin service and the vision model.
- Upload through a **server-side API route** so the pinning credential never
  reaches the browser.
- Validate media type and size on the server; do not trust the client.
- Read the new request id from the **transaction receipt's event log**, not from a
  `nextId` read — that races against other users.
- IPFS propagation is not instant. A pinned file can 404 on a gateway for ~20–30
  seconds. Try multiple gateways in order and do not treat the first failure as
  fatal.

### 7.5 Status tracker

Render one step per pipeline stage. Two traps:

- `done` and `active` must be **mutually exclusive**, or the final step renders
  as still-in-progress on a completed request.
- Rejected and refunded requests stop where they stopped — only the approved path
  lights up the final step.

---

## 8. Phase 5 — Serverless orchestrator

A long-running service needs a host. If you do not have one, run the *same*
pipeline from a serverless route so requests still complete.

This is **not a simulation** — it is the same agent code with a different
trigger. Do not build a fake result path and present it as a real one.

**The constraint:** a full run is ~5 chain transactions at ~15s of confirmation
each. That exceeds any serverless timeout.

**The design:** each invocation advances the request by **exactly one stage** and
returns. The client keeps calling until the request is terminal.

```
POST /api/orchestrate  { requestId }
  → read on-chain status
  → if terminal: return { done: true }
  → if status < Judged: advance status by one, return
  → if status == Judged: run all agents, sign, submit verdict, return
```

Requirements:

- The oracle key lives **only** in server-side env. This route is the only thing
  that can move a request forward.
- **Idempotent.** Calling it on a finalized request returns the terminal state
  instead of erroring.
- Return HTTP 409 with a `raced` flag when a concurrent caller won the stage —
  the registry's forward-only check makes this safe, and the next poll picks up
  the true state.
- Drive it from the request detail page with a hook that fires while the status is
  non-terminal, one call in flight at a time.
- **Show nothing about this in the UI.** The status tracker already reflects
  on-chain state; a second progress indicator for the same thing is noise.

---

## 9. Phase 6 — Deployment

### 9.1 Order of operations

1. Deploy contracts, verify on the block explorer.
2. **Verify the role wiring by reading it back from the chain** — do not trust the
   deploy log. Query `hasRole` for every role you granted.
3. Export ABIs and the address JSON into both packages.
4. Send the oracle wallet gas. It pays for every status update and verdict.
5. Fund the vault.
6. Set frontend env vars, redeploy.
7. Run one full end-to-end request through the **deployed** path.

### 9.2 Write a preflight script

Before spending anything, check and report: chain id, deployer balance in gas
token and payment token, oracle gas balance, and whether the vault holds at least
the cheapest tier's coverage. Print addresses and balances only — **never a
private key**.

### 9.3 Budget the reserve correctly

A request pays out `min(estimatedAmount, remainingCoverage)`, and the vault must
hold at least that. So:

```
vault balance  >=  the coverage of the cheapest tier you intend to demo
```

Otherwise the payout reverts with an insufficient-reserve error part-way through
your demo. Fund the vault first, then buy the agreement.

### 9.4 Secrets

- `.env` is git-ignored, `chmod 600`.
- Generate the oracle key locally with a wallet CLI and write it straight to the
  file — never print it.
- **Never paste a private key into a chat window**, including with an AI
  assistant. Put it in a local file and let the tooling read it from there.
- Deploy and oracle keys should be burner wallets holding only testnet funds.

---

## 10. Environment variables

```bash
# ── Contracts / deploy ──
DEPLOYER_PRIVATE_KEY=
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com   # no API key needed
ORACLE_ADDRESS=
ETHERSCAN_API_KEY=                 # optional, for source verification
DEADLINE_SECONDS=172800            # set to 300 to demo the refund path
FUND_AMOUNT=

# ── Orchestrator (service and serverless both) ──
RPC_URL=
ORACLE_PRIVATE_KEY=
MOCK_AI=true                       # run with no LLM key
LLM_API_KEY=
IPFS_GATEWAY=https://gateway.pinata.cloud
ADMIN_API_KEY=                     # gates the admin endpoints

# ── Frontend ──
NEXT_PUBLIC_WC_PROJECT_ID=
NEXT_PUBLIC_AGREEMENT_MANAGER=
NEXT_PUBLIC_REQUEST_REGISTRY=
NEXT_PUBLIC_PAYOUT_VAULT=
NEXT_PUBLIC_TOKEN=
IPFS_PIN_JWT=                      # server-only, never NEXT_PUBLIC_
```

---

## 11. Known traps

These cost real debugging time. Handle them up front.

**Signature mismatch.** `abi.encode` on-chain vs `solidityPackedKeccak256`
off-chain produces different hashes and every verdict reverts with an unhelpful
error. See §5.3. Assert equality in a test *and* against the deployed contract.

**Nonce collisions.** Concurrent requests from one signer. See §6.2. It only
appears under concurrency, so test with at least three simultaneous requests.

**`vm.envUint` requires the `0x` prefix.** A raw 64-character hex key is
perfectly valid and most CLI tools accept it, but Foundry's `vm.envUint` does not.
Normalize at the boundary — `export KEY="0x${KEY#0x}"` — rather than dictating
the file format.

**`vm.expectRevert` must come before `vm.prank`.** The reverse order makes the
test contract the caller and the test passes for the wrong reason.

**Chainlink contracts tag has no `v` prefix.** `1.2.0`, not `v1.2.0`. The repo is
also very large — use a shallow single-branch clone rather than a full install.

**Wallet libraries pull optional deps that have no browser build.** Expect
unresolved module errors from payment/analytics sub-packages. Add them to the
bundler's externals, and use an ignore-plugin with a regex for sub-path imports
that a plain externals list cannot match.

**A TypeScript workspace package needs bundler help.** ESM source uses `.js` in
relative imports; the bundler must be told those resolve to `.ts`:

```js
config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
```
plus adding the package to the framework's transpile list.

**Monorepo framework detection.** A deployment platform detects the framework from
the `package.json` at the deploy root. A workspace root has no framework
dependency, so detection fails. Declare it at the root, or point the project's
root directory at the app package.

**Do not run a production build while a dev server is running.** They share the
build output directory; the dev server then serves 404s for its own assets. If
styles vanish, clear the build directory and restart.

**Social-card image renderers support only a CSS subset.** Sized/positioned
radial gradients typically fail to parse. Use plain linear gradients there, even
if the site CSS uses something richer.

**Deposits paid to a treasury that is also the deployer are net-zero.** If you set
the treasury to the deployer address and test from that same wallet, balances will
not move as you expect. Not a bug — just confusing during verification.

---

## 12. Acceptance criteria

Do not call it done until every box is ticked.

**Contracts**
- [ ] Deployed and source-verified on the block explorer
- [ ] `forge coverage` ≥ 90% lines on `src/`
- [ ] Role wiring confirmed by reading `hasRole` back from the chain
- [ ] Invalid signature reverts; tampered payload reverts
- [ ] Payout above remaining coverage reverts
- [ ] Deadline-refund path passes

**Pipeline**
- [ ] Runs fully with `MOCK_AI=true` and no API keys
- [ ] Malformed LLM output cannot produce an invalid on-chain value
- [ ] Judge is deterministic — same inputs, same verdict, every time
- [ ] Off-chain hash asserted equal to the deployed contract's hash

**Orchestrator**
- [ ] Processes a request end-to-end in under 120s
- [ ] Three concurrent requests complete without nonce errors
- [ ] Resumes in-flight requests after a restart
- [ ] Health endpoint reports chain lag

**Frontend**
- [ ] Builds and renders with no environment variables configured
- [ ] Purchase flow completes both approve and deposit transactions
- [ ] Evidence uploads and is retrievable from a gateway
- [ ] Status tracker updates live and stops polling when terminal
- [ ] Errors read as sentences, not ABI dumps
- [ ] Responsive on mobile

**End-to-end on testnet**
- [ ] One full approved request through the **deployed** path, payout confirmed
      by reading balances on-chain
- [ ] One rejected request with the reason stored on-chain
- [ ] One deadline refund (deploy a short-deadline instance to test this)

**The comparison**
- [ ] Line counts measured: middleware vs. business logic
- [ ] The agent package has zero oracle-vendor imports
- [ ] A written note stating exactly which files disappear on a native-capability
      chain, and which trust assumption goes away with them

---

## 13. Build order summary

```
1. Contracts + tests            → forge test green, coverage ≥ 90%
2. Local Anvil deploy           → seed scripts run end-to-end, free
3. Shared pipeline package      → unit tests green with MOCK_AI
4. Hash parity check            → TS hash == deployed contract hash
5. Backend orchestrator         → full run against local Anvil
6. Frontend                     → builds with no env vars
7. Serverless orchestrator      → one stage per call, idempotent
8. Testnet deploy + verify      → roles read back from chain
9. One full run through prod    → payout confirmed on-chain
10. Measure the line counts     → write up the comparison
```

Work in this order. Skipping ahead to the frontend before the contracts are
tested means debugging three layers at once.
