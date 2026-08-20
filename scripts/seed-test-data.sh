#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Missing .env"; exit 1; }
set -a; source .env; set +a

cd contracts
echo "── Buying a demo policy ──"
forge script script/SeedPolicy.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast

echo "── Submitting a test claim ──"
forge script script/SubmitTestClaim.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast

echo "✅ Done. Watch the backend logs for the pipeline run."
