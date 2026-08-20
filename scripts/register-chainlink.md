# Chainlink registration — manual steps

Both Chainlink products need a funded subscription registered through their web UI,
so these steps cannot be scripted. Get testnet LINK at <https://faucets.chain.link>.

## 1. Automation — 48h deadline refund

The `ClaimAutomation` contract is what makes a dead backend degrade into a refund
instead of a stuck claim.

1. Open <https://automation.chain.link> and connect a Sepolia wallet.
2. **Register new Upkeep** → trigger type **Custom logic**.
3. Fill in:
   - Target contract: the `claimAutomation` address from `contracts/deployments/sepolia.json`
   - Upkeep name: `ClaimBot Deadline Refund`
   - Gas limit: `500000`
   - Starting balance: `5 LINK`
   - Check data: `0x`
4. Confirm and note the Upkeep ID.

To test without waiting two days, redeploy with a short deadline:

```bash
CLAIM_DEADLINE_SECONDS=300 ./scripts/deploy-all.sh
```

Submit a claim, stop the backend, and wait ~5 minutes. The claim should land in
`Refunded` (status 7).

## 2. Functions — vehicle verification

`VehicleVerifier` is the stand-in for a Rialo native webcall.

1. Open <https://functions.chain.link> and connect a Sepolia wallet.
2. **Create Subscription**, then fund it with ~10 LINK.
3. Note the subscription ID and deploy the consumer:

```bash
cd contracts
FUNCTIONS_SUBSCRIPTION_ID=<your-id> forge script script/DeployVerifier.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```

4. Back on the subscription page: **Add consumer** → paste the `VehicleVerifier` address.
5. Test it:

```bash
cast send <verifier> "requestVerification(uint256,string)" 1 "51-A1-2345" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY"

# Wait ~30s for the DON callback, then:
cast call <verifier> "claimVerification(uint256)(string)" 1 --rpc-url "$SEPOLIA_RPC_URL"
```

If the callback never fires, check in this order: the consumer is registered, the
subscription has LINK, and the DON ID matches `fun-ethereum-sepolia-1`.

## 3. Test USDC

Circle Sepolia USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

Mint from <https://faucet.circle.com> (choose Ethereum Sepolia). Fund the payout
vault with at least 200 USDC before a demo:

```bash
cd contracts
FUND_AMOUNT_USDC=200 forge script script/FundVault.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```
