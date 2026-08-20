#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Missing .env — copy .env.example first."; exit 1; }
set -a; source .env; set +a

: "${SEPOLIA_RPC_URL:?SEPOLIA_RPC_URL is required}"
: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY is required}"
: "${ORACLE_ADDRESS:?ORACLE_ADDRESS is required}"

echo "── 1/4 Deploying contracts to Sepolia ──"
cd contracts
VERIFY_ARGS=()
if [ -n "${ETHERSCAN_API_KEY:-}" ]; then
  VERIFY_ARGS=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
else
  echo "   (no ETHERSCAN_API_KEY — skipping verification)"
fi
forge script script/Deploy.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast \
  "${VERIFY_ARGS[@]}"

echo "── 2/4 Exporting ABIs to backend and frontend ──"
mkdir -p ../backend/src/abis ../frontend/src/lib/abis
for c in PolicyManager ClaimRegistry PayoutVault ClaimAutomation; do
  jq '.abi' "out/$c.sol/$c.json" > "../backend/src/abis/$c.json"
  cp "../backend/src/abis/$c.json" "../frontend/src/lib/abis/$c.json"
done

echo "── 3/4 Copying deployment addresses to the frontend ──"
cp deployments/sepolia.json ../frontend/src/lib/deployments.json

echo "── 4/4 Funding the payout vault ──"
forge script script/FundVault.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast
cd ..

echo
echo "✅ Deploy complete:"
jq . contracts/deployments/sepolia.json
echo
echo "Now set these on Vercel (frontend) and Railway (backend):"
jq -r '"NEXT_PUBLIC_POLICY_MANAGER=" + .policyManager,
       "NEXT_PUBLIC_CLAIM_REGISTRY=" + .claimRegistry,
       "NEXT_PUBLIC_PAYOUT_VAULT="   + .payoutVault,
       "NEXT_PUBLIC_USDC="           + .usdc' contracts/deployments/sepolia.json
