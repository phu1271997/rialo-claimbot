# ClaimBot

AI-powered micro-insurance claim processor for motorbikes, running on Ethereum Sepolia.

> Submit a motorbike insurance claim in 90 seconds instead of 2–4 weeks. Four AI agents
> verify, estimate and judge automatically. Payout settles on-chain in USDC.

Built as a working demonstration of the problem [Rialo](https://rialo.io) is designed to
solve. Every piece of middleware here — Chainlink Functions, Chainlink Automation, an
off-chain Node.js orchestrator — exists only because today's chains cannot reach the real
world on their own. See [Why this exists](#why-this-exists).

---

## What it does

1. A rider buys a policy, paying the premium in test USDC.
2. After a crash they upload damage photos and submit a claim on-chain.
3. The backend picks up the `ClaimSubmitted` event and runs four agents in sequence:

   | Agent | Job |
   |---|---|
   | **Extractor** | Claude Vision reads the photo: vehicle type, plate, damaged parts, severity |
   | **Verifier** | Cross-checks the DMV registry, EXIF metadata, and weather at the scene |
   | **Estimator** | Prices the repair against a Vietnamese parts table, LLM-sanity-checked |
   | **Judge** | Aggregates the three, applies reject rules, signs a verdict |

4. The signed verdict goes on-chain. If approved, `PayoutVault` transfers USDC to the rider.
5. If the pipeline never finishes, Chainlink Automation refunds the claim at the 48h deadline.

## Live deployment

Contracts are live on **Ethereum Sepolia**, verified on Etherscan:

| Contract | Address |
|---|---|
| PolicyManager | [`0x06E1000f17ed4df83940A0b403D69D292188F2b0`](https://sepolia.etherscan.io/address/0x06E1000f17ed4df83940A0b403D69D292188F2b0#code) |
| ClaimRegistry | [`0x5B67353D25817f5A58415EDA386c98eF9d7a1B08`](https://sepolia.etherscan.io/address/0x5B67353D25817f5A58415EDA386c98eF9d7a1B08#code) |
| PayoutVault | [`0xd898EF839DE88dE38113f0560F8fEBEff73D09c8`](https://sepolia.etherscan.io/address/0xd898EF839DE88dE38113f0560F8fEBEff73D09c8#code) |
| ClaimAutomation | [`0x9A39788df5d93b3b868b13BBa67434b116a938AA`](https://sepolia.etherscan.io/address/0x9A39788df5d93b3b868b13BBa67434b116a938AA#code) |
| USDC (Circle test) | [`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |

Frontend: **https://rialo-claimbot.vercel.app**

The backend orchestrator is not hosted yet, so a submitted claim stays in
`Submitted` until an oracle process picks up the event. Everything up to that
point — buying a policy, uploading evidence, writing the claim on-chain — works
from the deployed frontend today.

## Repository layout

```
contracts/    Foundry project — PolicyManager, ClaimRegistry, PayoutVault, Chainlink consumers
backend/      Node.js + TypeScript orchestrator running the 4-agent pipeline
frontend/     Next.js 14 app — wallet, purchase, claim submission, live status
scripts/      Setup, deploy, and seeding helpers
```

## Quick start

Requires Node 20+, [Foundry](https://book.getfoundry.sh/getting-started/installation), and `jq`.

```bash
./scripts/setup.sh
cp .env.example .env    # then fill it in
```

### Contracts

```bash
cd contracts
forge test
forge coverage --no-match-coverage "(script|test)"
```

Deploy to Sepolia — this also exports ABIs to the backend and frontend, copies the
addresses into the frontend, and funds the payout vault:

```bash
./scripts/deploy-all.sh
```

### Backend

```bash
cd backend
npm test          # 26 tests, no API keys needed
npm run dev
```

The orchestrator needs `contracts/deployments/sepolia.json` (written by the deploy script)
or explicit `CLAIM_REGISTRY_ADDRESS` / `POLICY_MANAGER_ADDRESS` env vars.

Set `MOCK_AI=true` to run the whole pipeline with no Anthropic key. This is what the tests
use, and it doubles as the demo-day fallback if the API is rate limited.

Endpoints:

- `GET /health` — chain lag, in-flight claims, oracle address
- `GET /admin/runs` — recent pipeline runs (requires `x-admin-key`)
- `POST /admin/retry/:claimId` — re-run a failed pipeline (requires `x-admin-key`)

### Frontend

```bash
cd frontend
npm run dev
```

The app builds and runs with no environment variables at all — it shows a banner
explaining that contracts are not configured yet, rather than failing silently. Set
`NEXT_PUBLIC_POLICY_MANAGER` and `NEXT_PUBLIC_CLAIM_REGISTRY` to point it at a deployment.

## Testing against a local chain

The full flow runs on Anvil without spending Sepolia ETH:

```bash
anvil --port 8555 &

cd contracts
export DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export ORACLE_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

USDC=$(forge create test/mocks/MockUSDC.sol:MockUSDC --rpc-url http://127.0.0.1:8555 \
  --private-key $DEPLOYER_PRIVATE_KEY --broadcast --json | jq -r .deployedTo)

USDC_ADDRESS=$USDC forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8555 --broadcast

cast send $USDC "mint(address,uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 1000000000 \
  --rpc-url http://127.0.0.1:8555 --private-key $DEPLOYER_PRIVATE_KEY

forge script script/FundVault.s.sol   --rpc-url http://127.0.0.1:8555 --broadcast
forge script script/SeedPolicy.s.sol  --rpc-url http://127.0.0.1:8555 --broadcast
forge script script/SubmitTestClaim.s.sol --rpc-url http://127.0.0.1:8555 --broadcast
```

Then run the backend against it with the Anvil oracle key and `MOCK_AI=true`.

## Chainlink setup

Automation and Functions both need a subscription registered through their web UI.
See [`scripts/register-chainlink.md`](scripts/register-chainlink.md).

## Deployment

- **Frontend** → Vercel. Root directory `frontend`. Set the `NEXT_PUBLIC_*` vars plus
  `PINATA_JWT` (server-only, used by `/api/upload`).
- **Backend** → Railway, Fly.io, or any Docker host. `backend/Dockerfile` is a
  multi-stage build. It must run continuously to catch `ClaimSubmitted` events.

## Design notes

A few decisions worth calling out, because they differ from the obvious approach:

**The verdict hash uses `abi.encode`, not `abi.encodePacked`.** Packed encoding of a
trailing dynamic string is ambiguous, which would let two different verdicts share a hash.
`VerdictSignature.sol` and `backend/src/utils/signature.ts` must stay byte-identical;
`ClaimRegistry.verdictHashFor` exists so this can be asserted from either side.

**The oracle serialises its transactions through a nonce queue.** Two claims can be in the
pipeline at once and both write status updates from the same key. Letting ethers derive the
nonce per call makes the second send reuse the first's nonce. `backend/src/utils/txQueue.ts`
assigns nonces explicitly from a single queue.

**The backend polls blocks instead of subscribing over WebSocket.** ethers v6 WebSocket
reconnects drop events silently, and a missed `ClaimSubmitted` costs a real payout.

**The Judge is deterministic code, not an LLM call.** It is the step that decides whether
money moves, so it has to be reproducible and auditable from the three agent outputs alone.

**The active-claims set uses swap-and-pop with an index map.** Chainlink Automation reads
this array every block; a linear scan on removal would grow unbounded with claim volume.

**Missing EXIF is not treated as fraud.** WhatsApp, Messenger and Zalo all strip it, so it
is recorded as an issue but carries no score penalty. Only a future-dated timestamp does.

## Why this exists

The same product, on two platforms:

| | Sepolia (today) | Rialo |
|---|---|---|
| External API calls | Chainlink Functions consumer + subscription + DON | Native webcall, one line |
| Scheduled work | Chainlink Automation upkeep + LINK balance | Native timer inside the contract |
| Orchestration | Node.js service running 24/7 | Reactive on-chain execution |
| Trust surface | Backend holds `ORACLE_ROLE` | SCALE program, trustless |
| Rough size | ~2000 lines, 5 services | ~500 lines, 1 service |

The trust model here is honest about its weak point: the backend holds `ORACLE_ROLE` and
can submit verdicts. That is bounded by three things — verdicts require a valid signature,
the contract caps any payout at the policy's remaining coverage, and Chainlink Automation
refunds the claim if the backend dies. On Rialo this layer disappears entirely.

## Status

- Contracts: 59 Foundry tests, 97% line coverage
- Backend: 26 Vitest tests, full pipeline verified end-to-end against Anvil
- Frontend: builds clean, all routes render

Deploying to Sepolia requires a funded deployer key and API keys for Anthropic, Pinata,
Alchemy and WalletConnect. Fill in `.env` and run `./scripts/deploy-all.sh`.

## License

MIT
