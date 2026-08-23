# Build Guide — Ship a Rialo-Thesis dApp on Ethereum Sepolia

> **How to use this file**
> Paste it into an AI coding assistant (Claude Code, Cursor, Copilot) as the
> project brief. Read Part 1–3 to decide *what* to build, then follow Part 4–7 to
> build, deploy and publish it.
>
> This guide does not prescribe one product. It teaches you to pick a project
> that showcases what Rialo is for, then build it on Sepolia in a way that makes
> the argument measurable.

---

# PART 1 — What Rialo is

## 1.1 The one-paragraph version

**Rialo** is a new Layer 1 blockchain built by **Subzero Labs** so that smart
contracts can reach the real world **directly** — call an HTTPS API, wake
themselves on a timer, react to events, handle private data — all native in the
protocol, with no oracle, keeper bot, indexer or bridge in between.

Its founding claim is not about speed. It is that crypto developers spend roughly
**90% of their time gluing middleware together and 10% writing the product**, and
that this — not TPS — is why crypto has millions of users while Web2 apps have
billions.

## 1.2 Who is behind it

| | |
|---|---|
| Company | Subzero Labs |
| CEO | Ade Adepoju (ex-Netflix, distributed systems) |
| Team from | Meta, Google, Netflix, Apple, Amazon, Uber, Robinhood, Solana, Near, EigenLayer, Diem, Parity, Magic Eden |
| Funding | $20M seed (announced 1 Aug 2025), led by **Pantera Capital** |
| Co-investors | Coinbase Ventures, Susquehanna, Variant, Hashed, Mirana, Fabric, Edge Capital, Mysten Labs |
| TradFi partners | **Nasdaq, NYSE, CBOE**, plus Predicate, DoubleZero, M0, Keplr |
| Status | Private DevNet. Public testnet and mainnet not yet released. RLO token not launched. |

Susquehanna (a top-tier HFT firm) and three of the world's largest exchanges
signing on is the signal that Rialo is aiming at **institutional finance**, not
just retail crypto.

## 1.3 The philosophy: supermodularity

Crypto has argued for years between **modular** (split the chain into layers) and
**monolithic** (keep it all in one). Rialo rejects both framings and proposes
**supermodularity**:

> Integrate into the base layer only the primitives whose value **increases** when
> combined with the others.

An oracle alone is worth X. An oracle plus native privacy is worth more, because
private data feeds become usable in DeFi without being front-run. Add reactive
execution and it compounds again.

The counterpart concept is **compound marginalization** — the cost of
over-modularizing. Every outsourced service (oracle, keeper, indexer, bridge)
adds its own fee, its own latency, and its own trust assumption. Stack five of
them and the user pays rent five times over, on a system that is five times more
fragile.

**This matters for your project.** The strongest submissions are the ones where
*combining* capabilities is the point — not a single feature demo.

## 1.4 Technical architecture

| Layer | Choice |
|---|---|
| Execution | **RISC-V** (not EVM bytecode) |
| VM compatibility | Solana VM (SVM) — Solana apps port with minimal changes |
| Consensus | Multiple Concurrent Proposers (MCP), sub-second finality |
| Upgrades | **Gauss** — seamless protocol upgrades without forking |
| Privacy | **REX** (Rialo Extended Execution) — MPC, FHE, TEE |
| Economics | RLO token, **Stake for Service** (stake yield pays for gas) |

RISC-V is the choice that unlocks the rest. It allows contracts to behave like
ordinary software — `async`/`await`, loops, sleeping and resuming **across
blocks**:

```rust
// Pseudo-code Rialo — impossible on the EVM
async fn liquidation_watcher() {
    loop {
        let price = Http::get("https://api.coinbase.com/price/eth").await?;
        if price < threshold {
            liquidate_position().await?;
        }
        sleep(30.seconds).await;
    }
}
```

On the EVM every call is atomic and stateless between invocations. A contract
cannot wait, cannot poll, cannot wake itself. That single limitation is why the
middleware industry exists.

## 1.5 The capabilities you will actually build against

Rialo publishes eleven "Real World" capabilities. Five of them determine what
you can build:

**1. Native webcalls** — a contract makes an HTTPS request in one line. No
oracle contract, no subscription, no LINK, no oracle tax. Verified through
consensus.

**2. Native timers and reactive transactions** — a contract schedules its own
future execution, or reacts to an event, with no off-chain keeper. No gas war, no
missed trigger during congestion.

**3. Real-world programmability** — `Future`, `Promise`, `.await`, randomness,
event-driven logic, sleeping across blocks.

**4. Native privacy (REX)** — confidential computation alongside verifiable
execution, so sensitive inputs (credit scores, health data, order flow) can drive
on-chain logic without being published.

**5. Real-world identity** — email, SMS or social login as the Web3 passport.
2FA. Scheduled transactions. Programmable inheritance. No seed phrase.

## 1.6 SCALE — the AI agent framework

**SCALE = Simple Contracts for Agent Labor Execution**, modelled on YC's SAFE
note. It is a standard contract for paying an AI agent, with four terms:

1. **Prompt** — the work to be done
2. **Amount** — payment, escrowed on-chain automatically
3. **Deadline** — when it must be finished
4. **Judge agent** — a third agent that evaluates the result

```
User → mints SCALE task (4 terms, payment escrowed)
     → task dispatched over A2A protocol
     → Worker agent produces the result
     → Judge agent evaluates
         PASS → worker is paid
         FAIL → user is refunded
     → deadline missed → native timer refunds automatically
```

Rialo runs a live demo of this as a Twitter agent (`@chunliweb3`) and supports
Google's **A2A (Agent-to-Agent)** protocol so agents from different vendors can
interoperate.

If your project involves AI agents doing paid work, **SCALE is the shape you
should be imitating.**

---

# PART 2 — Choosing what to build

## 2.1 The selection test

Do not start from "what's a cool dApp". Start here:

> **Would this project be significantly worse, or outright impossible, without
> at least two of Rialo's native capabilities?**

If the answer is no, pick something else. A token swap, an NFT mint, or a staking
vault makes no argument — those already work fine everywhere.

Score your idea:

| Question | Weight |
|---|---|
| Does it need live data from an external API? | Webcalls |
| Does something have to happen *later*, without a user clicking? | Timers |
| Does it react to an off-chain event? | Reactivity |
| Does it involve data that should not be public? | REX |
| Would a mainstream user refuse to install a wallet for it? | Identity |
| Do autonomous agents get paid for work? | SCALE |

**Two or more ticks = a good project. Four or more = an excellent one.**

## 2.2 Project catalogue

Pick a lane. Each of these needs multiple capabilities by construction.

### A. Parametric insurance
Payout triggered by measurable external facts, not a claims adjuster.

- Flight-delay cover — settles from an airline API the moment a flight is late
- Crop insurance — pays out when a weather station reports rainfall below a threshold
- Shipment cover — GPS plus a customs API triggers the claim
- Cold-chain cover for perishables — IoT temperature sensor breaches the range

*Capabilities: webcalls + timers + reactivity.* The whole product **is** a
webcall plus a timer. On Sepolia this becomes a Chainlink Functions consumer plus
a registered Automation upkeep plus a service to run them.

### B. Prediction markets
Rialo argues it settles these better than existing designs because the outcome
data is native and settlement is reactive — no optimistic-oracle dispute window.

- Sports, elections, weather, token price at a date
- Resolution comes from an API, automatically, at the deadline

*Capabilities: webcalls + timers + reactivity.*

### C. Real-World Assets that actually live
Rialo's framing: today's RWA is a dead replica of an off-chain asset. A living
asset reacts to real data.

- A bond whose yield auto-adjusts to a published CPI figure
- An invoice token that settles when a payment processor confirms
- A tokenized property whose yield tracks live occupancy
- Carbon credits minted and expired by IoT sensor readings
- A royalty stream that splits automatically when a platform pays out

*Capabilities: webcalls + timers + reactivity (+ privacy for credit data).*

### D. AI agent economy — the SCALE shape
An agent, or a chain of agents, is hired to do work, judged, and paid.

- Multi-agent evaluation of a submission, with escrow and a deadline
- Autonomous research/trading agent that reports and is paid on quality
- Content or code generation with an adversarial judge agent
- An agent marketplace where agents subcontract to each other over A2A

*Capabilities: SCALE + webcalls + timers + programmability.* This is the lane
Rialo is most actively promoting.

### E. Private credit and consumer lending
Rialo says this is the first time consumer credit is genuinely feasible on-chain,
because the score can stay confidential.

- Loan approval against a credit score that never goes public
- Under-collateralized lending backed by verified off-chain income
- KYC-gated pools where the identity data stays private

*Capabilities: privacy + webcalls + identity.*

### F. Consumer apps that hide the chain
- Subscriptions that auto-renew from a contract timer
- A smart will that transfers assets after a proof-of-life timer expires
- Scheduled recurring payments
- Social-login onboarding with no seed phrase

*Capabilities: identity + timers + usability.*

### G. Reactive DeFi
- An AMM whose curve adjusts to real-world volatility data
- Auto-rebalancing index funds driven by live market data
- Liquidation logic that watches a price feed itself instead of paying keepers

*Capabilities: webcalls + reactivity + privacy against MEV.*

## 2.3 Scoping rules

- **One domain, one flow, done properly.** A finished single flow beats three
  half-built ones.
- **Every project needs a state machine with a terminal state.** Something starts,
  progresses through stages, and definitively ends — paid, rejected, refunded,
  expired. This is what makes the demo legible.
- **Every project needs a deadline fallback.** If the off-chain half dies, the
  user must not be stuck. This is where you demonstrate the timer argument.
- **Money must actually move on-chain.** A demo with no value transfer proves
  nothing about escrow, caps or trust.

---

# PART 3 — Why build on Sepolia, not on Rialo

## 3.1 The practical reason

Rialo is on **Private DevNet**. There is no public testnet or mainnet, no public
RPC endpoint, no faucet, no explorer. You cannot deploy to it today.

## 3.2 The better reason

Building the workarounds **is the argument**.

Anyone can say "native webcalls would be easier". You will be able to say: *here
are the 86 lines of consumer contract, the CBOR encoding, the funded
subscription, and the manual registration step I needed — to make one GET
request.* That is not an opinion, it is an artifact.

So build it on Sepolia with the workarounds, **instrument the cost**, and present
the delta. Your project is the "before" photograph.

## 3.3 What this means concretely

1. Build the product properly on Sepolia. It must actually work.
2. Isolate every workaround so it is **visible and countable**.
3. Keep your core business logic in a package with **zero oracle-vendor imports**,
   so migration means replacing the outer layer only.
4. At the end, **count the lines** — middleware versus product — and write down
   which files disappear on Rialo, and which trust assumption goes with them.

A typical honest result is that **more than half the codebase is scaffolding**.

---

# PART 4 — Translating each Rialo capability to Sepolia

This is the core how-to. For each capability, here is what you build instead.

## 4.1 Native webcall → Chainlink Functions

**Rialo:** `let data = Http::get(url).await?;`

**Sepolia:** a `FunctionsClient` consumer contract with inline JavaScript,
CBOR-encoded arguments, a funded subscription, and a manual consumer
registration through a web dashboard.

```solidity
contract ExternalDataConsumer is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    address constant ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0; // Sepolia
    bytes32 constant DON_ID =
        0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;

    uint64 public subscriptionId;
    uint32 public gasLimit = 300_000;

    string public source =
        "const id = args[0];"
        "const res = await Functions.makeHttpRequest({ url: `https://api.example.com/${id}` });"
        "if (res.error) throw Error('API failed');"
        "return Functions.encodeString(JSON.stringify(res.data));";

    mapping(bytes32 => uint256) public requestToEntity;
    mapping(uint256 => string) public result;
    mapping(uint256 => bytes) public failure;

    function request(uint256 entityId, string calldata arg)
        external onlyOwner returns (bytes32 requestId)
    {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        string[] memory args = new string[](1);
        args[0] = arg;
        req.setArgs(args);
        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, gasLimit, DON_ID);
        requestToEntity[requestId] = entityId;
    }

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err)
        internal override
    {
        uint256 id = requestToEntity[requestId];
        if (err.length > 0) { failure[id] = err; return; }  // handle the error branch
        result[id] = string(response);
    }
}
```

Then, by hand: create a subscription at `functions.chain.link`, fund it with
LINK, deploy the consumer with the subscription id, and add the consumer address
to the subscription.

**Gate `request()` to the owner** or anyone can drain your LINK.

**Count this**: contract lines + registration steps + LINK cost.

## 4.2 Native timer → Chainlink Automation

**Rialo:** `sleep(48.hours).then(|| refund_user());`

**Sepolia:** an `AutomationCompatibleInterface` contract, a registered upkeep, and
a LINK balance that must never run dry.

```solidity
contract DeadlineAutomation is AutomationCompatibleInterface {
    IRegistry public immutable registry;
    uint256 public constant MAX_PER_UPKEEP = 5;  // cap the batch, gas is bounded

    function checkUpkeep(bytes calldata)
        external view override returns (bool, bytes memory)
    {
        uint256[] memory active = registry.getActiveIds();
        uint256[] memory expired = new uint256[](MAX_PER_UPKEEP);
        uint256 count;
        for (uint256 i = 0; i < active.length && count < MAX_PER_UPKEEP; i++) {
            (uint256 deadline, uint8 status) = registry.summary(active[i]);
            if (block.timestamp > deadline && status < FINALIZED) {
                expired[count++] = active[i];
            }
        }
        if (count == 0) return (false, "");
        uint256[] memory out = new uint256[](count);
        for (uint256 i = 0; i < count; i++) out[i] = expired[i];
        return (true, abi.encode(out));
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256[] memory ids = abi.decode(performData, (uint256[]));
        for (uint256 i = 0; i < ids.length; i++) {
            // performData is attacker-supplied in the general case; the registry
            // re-validates deadline and status, which is what makes this safe.
            try registry.expire(ids[i]) {} catch {}
        }
    }
}
```

Register at `automation.chain.link` → "Custom logic" → target contract, 500k gas
limit, 5 LINK starting balance.

**Deploy with a configurable deadline**, not a constant. You will want a 5-minute
deadline to demo the expiry path instead of waiting 48 hours.

## 4.3 Reactive execution → an off-chain service

**Rialo:** the contract reacts on-chain when the event fires.

**Sepolia:** a Node.js service that must run 24/7, watch for events, and drive the
next step. This is usually the single largest piece of middleware.

Three things it must get right:

**Poll blocks, do not use a WebSocket subscription.** ethers v6 WS reconnects drop
events silently, and a missed event costs a real payout.

```ts
setInterval(async () => {
  const head = await provider.getBlockNumber();
  if (head <= lastScanned) return;
  const logs = await contract.queryFilter(contract.filters.Submitted(), lastScanned + 1, head);
  lastScanned = head;
  for (const log of logs) void handle(log);
}, POLL_MS);
```

**Serialize transactions and manage nonces yourself.** Two items in flight from
one key means the second send reuses the first's nonce and fails with
`nonce too low`. This only appears under concurrency, so it is easy to miss.

```ts
class TxQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private next: number | null = null;

  async send(build: (nonce: number) => Promise<TxResponse>) {
    const run = this.tail.then(() => this.exec(build), () => this.exec(build));
    this.tail = run.then(() => undefined, () => undefined);  // keep the chain alive
    return run;
  }

  private async exec(build) {
    this.next ??= await this.wallet.getNonce('pending');
    const nonce = this.next;
    try {
      const tx = await build(nonce);
      this.next = nonce + 1;
      return await tx.wait();
    } catch (e) {
      this.next = null;   // may or may not have been consumed — resync
      throw e;
    }
  }
}
```

**Recover on restart.** On boot, read the active set and resume anything
unfinished. Guard with an in-flight set so a duplicate trigger costs no gas.

## 4.4 SCALE → a signed verdict from a privileged signer

**Rialo:** escrow, deadline and judging are protocol primitives. Trustless.

**Sepolia:** an off-chain signer holds a privileged role and submits the outcome.
**This is the one real trust hole in your design — do not hide it, explain it.**

Bound it three ways:

1. The outcome must carry a **signature** the contract verifies.
2. The contract **caps** the payout at the agreement's remaining balance.
3. The **deadline automation** refunds if the signer never responds.

### The signing trap — read this twice

The most common failure in this architecture is the off-chain signer and the
on-chain verifier hashing the payload differently. Nothing verifies, every payout
reverts, and the error tells you nothing.

**Use `abi.encode`, never `abi.encodePacked`.** Packed encoding of a trailing
dynamic string is ambiguous — two different payloads can produce the same bytes.

```solidity
library VerdictSignature {
    using MessageHashUtils for bytes32;

    function hash(uint256 id, bool approved, uint256 amount, uint8 confidence, string memory reason)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encode(id, approved, amount, confidence, reason));
    }

    function recoverSigner(bytes32 payloadHash, bytes memory sig)
        internal pure returns (address)
    {
        return ECDSA.recover(payloadHash.toEthSignedMessageHash(), sig);
    }
}
```

```ts
export function payloadHash(id, approved, amount: bigint, confidence, reason) {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'bool', 'uint256', 'uint8', 'string'],
      [id, approved, amount, confidence, reason],
    ),
  );
}
export const sign = (wallet, ...a) => wallet.signMessage(getBytes(payloadHash(...a)));
```

**Expose a public `hashFor(...)` view on your contract**, assert in a test that it
equals the TypeScript hash, and verify it against the *deployed* contract with a
CLI call before trusting the pipeline.

## 4.5 Native privacy → hashing and off-chain storage

**Rialo:** REX computes on confidential data.

**Sepolia:** you cannot. Approximate it — hash identifiers before storing
(`keccak256(plate)` instead of the plate), keep sensitive material off-chain, and
**state plainly in your write-up that this is a downgrade, not a solution.**

Honesty here is worth more than a fake privacy claim.

## 4.6 Real-world identity → a wallet, unfortunately

**Rialo:** email/SMS/social login, 2FA.

**Sepolia:** the user installs a wallet, safeguards a seed phrase, adds a test
network and funds their own gas. Note in your write-up how many users you lose at
each of those four steps.

---

# PART 5 — Reference architecture

Adapt the names to your domain. The shape holds for every project in Part 2.

```
<repo>/
├── package.json              # npm workspaces root
├── vercel.json               # monorepo build config
├── .env.example
│
├── contracts/                # Foundry
│   ├── src/
│   │   ├── AgreementManager.sol    # agreements, tiers, balance accounting
│   │   ├── Registry.sol            # state machine + signature verification
│   │   ├── PayoutVault.sol         # token reserve, role-gated transfers
│   │   ├── DeadlineAutomation.sol  # ← Chainlink Automation (workaround)
│   │   ├── ExternalConsumer.sol    # ← Chainlink Functions (workaround)
│   │   └── libraries/VerdictSignature.sol
│   ├── test/                       # Base.t.sol fixture + per-contract + FullFlow
│   └── script/                     # Deploy, FundVault, Seed, SubmitTest
│
├── packages/core/            # SHARED — no chain, no framework, no ambient env
│   └── src/{types,steps,services,utils}/
│
├── backend/                  # ← the 24/7 service (workaround)
│   └── src/{index,config,contracts,orchestrator}.ts
│
├── frontend/                 # Next.js 14 App Router
│   └── src/{app,components,hooks,lib,server}/
│
└── scripts/{setup,preflight,deploy-all}.sh
```

**Stack:** Solidity 0.8.24 + Foundry · OpenZeppelin v5.0.2 · Chainlink contracts
1.2.0 · TypeScript ESM · ethers v6 · Next.js 14 · wagmi v2 + viem + RainbowKit ·
Tailwind · Vitest · Vercel.

## 5.1 Contract requirements

**AgreementManager** — tiers, balances, expiry. `isActive` false when expired
**or** exhausted. `remainingBalance` returns 0 for inactive, never underflows.
`recordPayout` callable only by the registry role. Use `SafeERC20`.

**PayoutVault** — role-gated `executePayout`, reverts on zero amount, zero
address, insufficient balance. `availableReserve()` reads the live token balance,
not a cached counter.

**Registry** — the state machine:

```
Submitted → Processing… → Finalized → Paid | Rejected | Expired
```

- Forward-only status transitions; revert on any regression.
- Deadline as a **constructor parameter**.
- Verify the signature before moving any value.
- Cap the payout at the remaining balance.
- **Active-set removal must be swap-and-pop with an index map**, not a linear
  scan — the automation contract reads this array every block:

```solidity
mapping(uint256 => uint256) private _indexPlusOne;  // 0 = absent

function _remove(uint256 id) internal {
    uint256 ipo = _indexPlusOne[id];
    if (ipo == 0) return;
    uint256 i = ipo - 1;
    uint256 last = activeIds.length - 1;
    if (i != last) {
        uint256 moved = activeIds[last];
        activeIds[i] = moved;
        _indexPlusOne[moved] = i + 1;
    }
    activeIds.pop();
    delete _indexPlusOne[id];
}
```

## 5.2 Shared core package rules

- **Inject config and logger; never read `process.env` inside it.** The same code
  must run inside a validated long-running service and inside a serverless
  function without either dictating the other.
- Ship a **`MOCK` mode** that runs the whole flow with no external API keys. This
  is how your tests run, and it is your fallback when a provider rate-limits you
  mid-demo. Build it in from day one.
- **Never trust external/model output shape.** Normalize into a fully-typed
  object: clamp numbers to range, coerce unknown enums to a safe default, filter
  non-strings from arrays. A malformed field must not reach the chain.
- **The final decision step must be deterministic code, not an LLM call.** It is
  the step that moves money, so it must be reproducible and auditable from its
  inputs alone. Use the model for extraction and estimation; use plain code for
  the verdict.
- If a model proposes an amount, **clamp it** within a multiple of your
  rule-based range. A hallucinated number must not be able to inflate a payout.

## 5.3 Frontend rules

- **Must build and render with zero environment variables.** If addresses are
  unset, show a banner explaining what to configure — never let every read
  silently return nothing.
- Read addresses from `NEXT_PUBLIC_*` with a checked-in deployment JSON as
  fallback, so a redeploy can repoint without a code change.
- Poll contract reads on an interval and **stop polling at a terminal state**.
- Translate contract errors into sentences. Map custom error names and
  `user rejected` to plain language; never surface raw ABI data.
- Read a new entity id from the **transaction receipt's event log**, not from a
  `nextId` read — that races against other users.
- ERC-20 needs an allowance first. Check it, skip approval if sufficient, and show
  the user which of the two transactions they are on.
- Upload files through a **server-side route** so the storage credential never
  reaches the browser. Compress client-side first.

## 5.4 If you cannot host the 24/7 service

Run the same logic from a serverless route. **This is not a simulation** — it is
the same code with a different trigger. Never build a fake result path and present
it as real.

The constraint: a full run is several transactions at ~15s confirmation each,
which exceeds any serverless timeout. So **advance one stage per invocation** and
let the client keep calling until terminal.

```
POST /api/advance { id }
  → read on-chain status
  → terminal?          → return { done: true }
  → not yet finalized? → advance one stage, return
  → ready to finalize? → run the logic, sign, submit, return
```

Idempotent. Return 409 on a concurrent race — the forward-only status check makes
it safe. Keep the signer key server-side only. Show nothing about this in the UI.

## 5.5 Build order

```
1. Contracts + tests           → forge test green, coverage ≥ 90%
2. Local Anvil deploy          → seed scripts run end-to-end, free
3. Shared core package         → unit tests green in MOCK mode
4. Hash parity check           → TS hash == deployed contract hash
5. Backend orchestrator        → full run against local Anvil
6. Frontend                    → builds with no env vars
7. Serverless route (if needed)
8. Testnet deploy + verify     → read roles back from chain
9. One full run through prod   → payout confirmed on-chain
10. Measure the line counts
```

Do not jump to the frontend before the contracts are tested, or you will debug
three layers at once.

---

# PART 6 — Deploy to Sepolia, Vercel and GitHub

## 6.1 Get testnet funds first

| Need | Where | Amount |
|---|---|---|
| Sepolia ETH | `sepoliafaucet.com`, `faucets.chain.link` | ~0.5 |
| Test USDC | `faucet.circle.com` (choose Ethereum Sepolia) | 30+ |
| LINK | `faucets.chain.link` | 10+ if using Chainlink |

Sepolia USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

A public RPC works and needs no API key:
`https://ethereum-sepolia-rpc.publicnode.com`

## 6.2 Secrets — non-negotiable

- `.env` is git-ignored and `chmod 600`.
- Generate the service signer key locally and write it **straight to the file** —
  never print it to a terminal.
- **Never paste a private key into a chat window, including with an AI
  assistant.** Put it in a local file and let the tooling read it from there.
- Use burner wallets holding only testnet funds.
- If an API key ever appears in a chat, **rotate it** afterwards.

## 6.3 Write a preflight script

Before spending anything, check and print: chain id, deployer gas balance,
deployer token balance, signer gas balance, and whether the vault holds at least
the largest payout you intend to demo. Print **addresses and balances only**.

```bash
#!/usr/bin/env bash
set -euo pipefail
set -a; source .env; set +a

# A raw private key is 64 hex chars; the 0x prefix is a convention and both are
# valid. Foundry's vm.envUint is the strict one — normalise here.
export DEPLOYER_PRIVATE_KEY="0x${DEPLOYER_PRIVATE_KEY#0x}"

DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
echo "Chain:    $(cast chain-id --rpc-url "$RPC_URL")"
echo "Deployer: $DEPLOYER"
echo "ETH:      $(cast from-wei "$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL")")"
```

## 6.4 Deploy the contracts

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" --broadcast \
  --verify --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Then **verify the role wiring by reading it back from the chain** — do not trust
the deploy log:

```bash
cast call $REGISTRY "hasRole(bytes32,address)(bool)" \
  $(cast keccak "ORACLE_ROLE") $SIGNER_ADDRESS --rpc-url "$RPC_URL"
```

Every role you granted should return `true`. Then:

```bash
# Export ABIs into both packages
for c in AgreementManager Registry PayoutVault; do
  jq '.abi' out/$c.sol/$c.json > ../backend/src/abis/$c.json
  cp ../backend/src/abis/$c.json ../frontend/src/lib/abis/$c.json
done
cp deployments/sepolia.json ../frontend/src/lib/deployments.json

# Fund the signer's gas and the payout reserve
cast send $SIGNER --value 0.05ether --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY"
forge script script/FundVault.s.sol --rpc-url "$RPC_URL" --broadcast
```

**Budget the reserve correctly.** A payout is
`min(computedAmount, remainingBalance)`, and the vault must hold at least that:

```
vault balance  >=  the coverage of the cheapest tier you intend to demo
```

Otherwise the payout reverts with an insufficient-reserve error part-way through
your demo. Fund the vault **before** buying the agreement.

## 6.5 Verify contracts on Etherscan

Get a free key at `etherscan.io/apis`. If `--verify` failed during deploy:

```bash
forge verify-contract $ADDRESS src/Registry.sol:Registry \
  --chain-id 11155111 --compiler-version 0.8.24 --num-of-optimizations 200 \
  --constructor-args "$(cast abi-encode 'c(address,address,uint256)' $A $B 172800)" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" --watch
```

Confirm through the API rather than by eye:

```bash
curl -s "https://api.etherscan.io/v2/api?chainid=11155111&module=contract\
&action=getsourcecode&address=$ADDRESS&apikey=$KEY" | jq -r '.result[0].ContractName'
```

## 6.6 Push to GitHub

```bash
git init -b main
git add -A

# Confirm no secrets are staged — do this before the first commit, not after
git ls-files | grep -E '\.env$|\.vercel' && echo "STOP: secret staged" || echo "clean"

git commit -m "feat: <what it does>"
gh repo create <name> --public --source=. --remote=origin \
  --description "<one line>" --push
```

`.gitignore` must cover at minimum:

```
node_modules/
.env
.env*.local
.vercel
contracts/{out,cache,broadcast,lib}/
frontend/{.next,next-env.d.ts}
backend/dist/
*.tsbuildinfo
```

## 6.7 Deploy the frontend to Vercel

```bash
npm i -g vercel
vercel login
vercel link --yes --project <name>
```

### If you used npm workspaces

Vercel detects the framework from the `package.json` at the **deploy root**. A
workspace root has no framework dependency, so detection fails with
*"No Next.js version detected"*.

Two fixes — pick one:

**A.** Declare it at the root (npm dedupes, it is not a second install):
```json
{ "workspaces": ["packages/*", "backend", "frontend"],
  "dependencies": { "next": "14.2.23" } }
```

**B.** Set the project's Root Directory to `frontend` in the Vercel dashboard.

With option A, add `vercel.json` at the repo root:

```json
{
  "framework": "nextjs",
  "installCommand": "npm install",
  "buildCommand": "npm run build --workspace frontend",
  "outputDirectory": "frontend/.next"
}
```

Your bundler also needs help resolving TypeScript sources from the workspace,
since ESM relative imports carry a `.js` extension:

```js
// next.config.mjs
const nextConfig = {
  transpilePackages: ['@yourscope/core'],
  webpack: (config, { webpack }) => {
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // Wallet libraries pull optional payment sub-packages with no browser build.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
};
export default nextConfig;
```

### Environment variables

```bash
printf '%s' "$VALUE" | vercel env add NEXT_PUBLIC_REGISTRY production
```

Set the public addresses **and** any server-only secrets your API routes need
(the signer key, storage credentials). Never prefix a secret with
`NEXT_PUBLIC_` — that publishes it to the browser.

Then deploy and confirm:

```bash
vercel --prod --yes
curl -s -o /dev/null -w "%{http_code}\n" https://<project>.vercel.app
```

**Env vars only take effect on a new deployment.** Adding one to an existing
deployment changes nothing until you redeploy.

## 6.8 Register the Chainlink services

These require the web dashboards and cannot be scripted.

**Automation** — `automation.chain.link` → Register new Upkeep → Custom logic →
target = your automation contract, gas limit 500000, starting balance 5 LINK,
check data `0x`.

**Functions** — `functions.chain.link` → Create subscription → fund with LINK →
deploy your consumer with the subscription id → **Add consumer** → paste the
consumer address.

Test the Functions round-trip before relying on it:

```bash
cast send $CONSUMER "request(uint256,string)" 1 "test-arg" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY"
sleep 45
cast call $CONSUMER "result(uint256)(string)" 1 --rpc-url "$RPC_URL"
```

If the callback never fires, check in this order: consumer registered on the
subscription, subscription has LINK, DON id correct for the network.

## 6.9 Prove it end-to-end

Do not claim it works until you have run the whole flow through the **deployed**
site and confirmed the result by reading the chain:

```bash
cast call $REGISTRY "get(uint256)" 1 --rpc-url "$RPC_URL"          # terminal status?
cast call $TOKEN "balanceOf(address)(uint256)" $USER --rpc-url "$RPC_URL"  # moved?
cast call $VAULT "totalPaidOut()(uint256)" --rpc-url "$RPC_URL"
```

Record three runs: **one approved, one rejected, one expired**. Deploy a
short-deadline instance to test expiry rather than waiting two days.

---

# PART 7 — Known traps

These cost real debugging time. Handle them up front.

**Signature mismatch.** `abi.encode` on-chain vs packed encoding off-chain →
every payout reverts with an unhelpful error. See §4.4.

**Nonce collisions.** Concurrent items from one signer. See §4.3. Only appears
under concurrency — test with at least three simultaneous items.

**`vm.envUint` requires the `0x` prefix.** A raw 64-char hex key is valid and most
CLI tools accept it, but Foundry's `vm.envUint` does not. Normalize at the
boundary rather than dictating the file format.

**`vm.expectRevert` must come before `vm.prank`.** The reverse order makes the
test contract the caller, and the test passes for the wrong reason.

**Chainlink contracts tag has no `v` prefix** — `1.2.0`, not `v1.2.0`. The repo is
also large; use a shallow single-branch clone.

**Chainlink `checkUpkeep` must be `view`** and must return bounded work. An
unbounded loop over a growing array will eventually exceed the gas limit.

**Do not run a production build while a dev server is running.** They share the
build output directory and the dev server then serves 404s for its own assets. If
styles vanish, clear the build directory and restart.

**IPFS propagation is not instant.** A freshly pinned file can 404 on a gateway
for 20–30 seconds. Try multiple gateways and do not treat the first failure as
fatal.

**Missing file metadata is not fraud.** Messaging apps strip EXIF routinely.
Record it as a note with **zero** penalty; only an impossible value (a future
timestamp) should count against a submission.

**A treasury set to the deployer makes deposits net-zero.** If you test from the
same wallet that receives deposits, balances will not move as you expect. Not a
bug, just confusing during verification.

**Social-card image renderers support only a CSS subset.** Sized or positioned
radial gradients typically fail to parse; use plain linear gradients there.

---

# PART 8 — Deliverables checklist

**Working software**
- [ ] Contracts deployed and source-verified on Sepolia Etherscan
- [ ] `forge coverage` ≥ 90% lines on `src/`
- [ ] Role wiring confirmed by reading `hasRole` back from the chain
- [ ] Invalid signature reverts; tampered payload reverts
- [ ] Payout above the remaining balance reverts
- [ ] Frontend live on Vercel, builds with no env vars configured
- [ ] Repo public on GitHub, no secrets in history
- [ ] Three recorded runs: approved, rejected, expired
- [ ] A backup demo video — testnets fail during live demos

**The Rialo argument** — this is what distinguishes your submission
- [ ] Line counts measured: middleware vs. product logic
- [ ] Core package has **zero** oracle-vendor imports
- [ ] A written table: each Rialo capability → what you built instead → what it cost
- [ ] A named list of the exact files that **disappear** on Rialo
- [ ] The trust assumption you had to accept, stated plainly, and how Rialo removes it
- [ ] Onboarding steps a mainstream user must complete today vs. with social login

**Write-up structure**

1. What the product does, in one sentence a non-crypto person understands
2. The flow, in five steps
3. The capability-to-workaround table with real numbers
4. The line-count delta
5. What migrating to Rialo removes — files, services, and the trust hole

> A working demo makes you a builder. The measured delta makes you someone who
> understands *why the chain matters*. Do both.

---

## Reference

- Rialo — `rialo.io` · docs at `rialo.io/docs` · blog at `rialo.io/blog`
- Key posts: *Making the Agent Economy Simple and Safe with Rialo*,
  *How Rialo Secures Prediction Markets*, *Bringing Private Credit Onchain*
- Foundry Book — `book.getfoundry.sh`
- wagmi — `wagmi.sh` · viem — `viem.sh`
- Chainlink Functions — `docs.chain.link/chainlink-functions`
- Chainlink Automation — `docs.chain.link/chainlink-automation`

*Rialo facts in Part 1 reflect publicly announced information as of early 2026.
Verify current status at `rialo.io` before publishing claims — the network, token
and programme details are all still moving.*
