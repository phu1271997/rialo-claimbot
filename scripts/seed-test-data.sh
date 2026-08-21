#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Missing .env"; exit 1; }
set -a; source .env; set +a

# A raw private key is just 64 hex characters; the 0x prefix is a convention and
# both forms are valid. Foundry's vm.envUint is the strict one — it only parses
# hex with the prefix — so normalise here rather than dictating the .env format.
if [ -n "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  export DEPLOYER_PRIVATE_KEY="0x${DEPLOYER_PRIVATE_KEY#0x}"
fi
if [ -n "${ORACLE_PRIVATE_KEY:-}" ]; then
  export ORACLE_PRIVATE_KEY="0x${ORACLE_PRIVATE_KEY#0x}"
fi

cd contracts
echo "── Buying a demo policy ──"
forge script script/SeedPolicy.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast

echo "── Submitting a test claim ──"
forge script script/SubmitTestClaim.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast

echo "✅ Done. Watch the backend logs for the pipeline run."
