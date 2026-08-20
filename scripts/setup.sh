#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── Installing Foundry dependencies ──"
if ! command -v forge >/dev/null 2>&1; then
  echo "forge not found. Install Foundry first: https://book.getfoundry.sh/getting-started/installation"
  exit 1
fi

cd contracts
[ -d lib/forge-std ] || forge install foundry-rs/forge-std --no-git
[ -d lib/openzeppelin-contracts ] || forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-git
# The tag has no "v" prefix, and a full clone of this repo is very large.
[ -d lib/chainlink-brownie-contracts ] || git clone --depth 1 --branch 1.2.0 --single-branch \
  https://github.com/smartcontractkit/chainlink-brownie-contracts.git lib/chainlink-brownie-contracts
forge build
cd ..

echo "── Installing backend dependencies ──"
(cd backend && npm install)

echo "── Installing frontend dependencies ──"
(cd frontend && npm install)

echo
echo "✅ Setup complete."
echo "Next: cp .env.example .env, fill it in, then ./scripts/deploy-all.sh"
