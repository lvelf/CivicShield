# Deployments

## Ethereum Sepolia (chain 11155111) — first bring-up

Deployed to Ethereum Sepolia (not Base) to unblock end-to-end testing: Base Sepolia's
daily faucet quota was exhausted. The contract is chain-agnostic; **redeploy to Base Sepolia
for the LI.FI Composer integration** (Composer routes to Base) with the same script — see below.
Frontend reads only addresses, so the chain swap is a config change (B).

| Contract | Address |
|---|---|
| `CivicShieldPool` | [`0xd20B4c0f60543BEfEDC80B930ea52094d4ED682c`](https://sepolia.etherscan.io/address/0xd20B4c0f60543BEfEDC80B930ea52094d4ED682c) |
| `MockUSDC` (test stand-in, 6 dp) | [`0x5E9972027d4f03824AC0e5dA446f0AfB5BFfFcf5`](https://sepolia.etherscan.io/address/0x5E9972027d4f03824AC0e5dA446f0AfB5BFfFcf5) |

- **Owner / Relayer / seed verified recipient:** `0xFeeA88FB58342479fc8D5901f3f67740b39c9FaA`
- **Policy:** riskThreshold 75 · maxReleasePerEvent 500 USDC · dailyReleaseLimit 1000 USDC
- **Approved purposes:** emergency_shelter, medical_supplies, clean_water, evacuation_transport
- **Pool seeded with:** 100,000 mock USDC

### Live end-to-end verification (on-chain)
- Happy path: riskScore 82 → propose 300 USDC to verified recipient → `executeRelease` →
  **EXECUTED**, pool −300 USDC, verdict `(EXECUTED, true, NONE)`.
- Prompt-injection block (Act 3): propose 300 USDC to unverified `0x…dEaD` → `executeRelease` →
  **BLOCKED at rule 4**, pool unchanged, tx did not revert, verdict `(BLOCKED, false, RECIPIENT_NOT_VERIFIED)`.

## Redeploy (any chain)

```bash
cd contracts
# mock USDC, self-contained (any testnet you can fund):
PRIVATE_KEY=0x... USE_MOCK_USDC=true forge script script/Deploy.s.sol --rpc-url <network> --broadcast -vvvv

# real Circle USDC (e.g. Base Sepolia for LI.FI):
PRIVATE_KEY=0x... USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast -vvvv
```

Configured RPC aliases (`foundry.toml`): `base_sepolia`, `optimism_sepolia`, `arbitrum_sepolia`, `sepolia`.
