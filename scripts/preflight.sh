#!/usr/bin/env bash
# Verifies the deployer wallet is ready before spending anything on-chain.
# Never prints any private key.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "❌ Missing .env"; exit 1; }
set -a; source .env; set +a

fail=0

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "❌ DEPLOYER_PRIVATE_KEY is empty — add it to .env"
  exit 1
fi

DEPLOYER=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
USDC=${USDC_ADDRESS:-0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238}

echo "Network:  $(cast chain-id --rpc-url "$SEPOLIA_RPC_URL") (expect 11155111)"
echo "Deployer: $DEPLOYER"
echo "Oracle:   $ORACLE_ADDRESS"
echo

ETH_WEI=$(cast balance "$DEPLOYER" --rpc-url "$SEPOLIA_RPC_URL")
ETH=$(cast from-wei "$ETH_WEI")
echo "ETH balance:  $ETH"
# Deploying five contracts plus the role wiring needs roughly 0.05 ETH.
if [ "$(echo "$ETH < 0.05" | bc -l)" = "1" ]; then
  echo "   ⚠️  Low. Get more at https://sepoliafaucet.com or https://faucets.chain.link"
  fail=1
fi

USDC_RAW=$(cast call "$USDC" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$SEPOLIA_RPC_URL" | awk '{print $1}')
echo "USDC balance: $(echo "scale=2; $USDC_RAW/1000000" | bc) USDC"
NEEDED=$(( (${FUND_AMOUNT_USDC:-200} + 5) * 1000000 ))
if [ "$USDC_RAW" -lt "$NEEDED" ]; then
  echo "   ⚠️  Need ~$(( NEEDED / 1000000 )) USDC to fund the payout vault and buy a demo policy."
  echo "      Mint test USDC at https://faucet.circle.com (choose Ethereum Sepolia)."
  fail=1
fi

ORACLE_ETH=$(cast from-wei "$(cast balance "$ORACLE_ADDRESS" --rpc-url "$SEPOLIA_RPC_URL")")
echo "Oracle ETH:   $ORACLE_ETH"
if [ "$(echo "$ORACLE_ETH < 0.02" | bc -l)" = "1" ]; then
  echo "   ℹ️  The oracle pays gas for status updates and verdicts."
  echo "      Send it ~0.05 ETH before running the backend:"
  echo "      cast send $ORACLE_ADDRESS --value 0.05ether --rpc-url \$SEPOLIA_RPC_URL --private-key \$DEPLOYER_PRIVATE_KEY"
fi

echo
[ "$fail" = "0" ] && echo "✅ Ready to deploy: ./scripts/deploy-all.sh" || echo "⚠️  Top up the balances above first."
