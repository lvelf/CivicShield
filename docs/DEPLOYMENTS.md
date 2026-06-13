# Deployments

## Base Mainnet (chain 8453) — MAIN LINE (LI.FI Composer + CRE + ENS)

The coherent product. LI.FI Composer's destination-deposit feature is **mainnet-only** (no
testnet, and not Arc), so the donation→certify→release flow lives here on real (tiny) money.

| Contract | Address |
|---|---|
| `CivicShieldPool` | [`0x5e9972027d4f03824ac0e5da446f0afb5bfffcf5`](https://basescan.org/address/0x5e9972027d4f03824ac0e5da446f0afb5bfffcf5) |
| Real Circle USDC (6 dp) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

- **Owner / Relayer / seed verified recipient:** `0xFeeA88FB58342479fc8D5901f3f67740b39c9FaA`
- **Policy:** riskThreshold 75 · maxReleasePerEvent 500 USDC · dailyReleaseLimit 1000 USDC
- **Full coherent flow proven live on mainnet:**
  1. **LI.FI Composer donation** — swap ETH → USDC + `donate()` into the pool in one Flow
     ([tx 0x75ed2d4d…](https://basescan.org/tx/0x75ed2d4daedaffaf3fd61882933c855042b53ae3c2caf01b7dcebda7ad8d63f6));
     1 USDC landed via LI.FI executor `0x4DaC9d17…`.
  2. relayer submitted riskScore 82.
  3. **Blocked**: 0.5 USDC to unverified `0x…dEaD` → `BLOCKED / RECIPIENT_NOT_VERIFIED`, pool unchanged.
  4. **Released**: 0.5 USDC to verified recipient → `EXECUTED`, pool 1.0 → 0.5 USDC.
- LI.FI Composer `contractCalls` confirmed routable to Base mainnet (and to Arc only as a plain
  bridge, not a deposit) — see [lifi-composer-findings.md](./lifi-composer-findings.md).

## Arc Testnet (chain 5042002) — BONUS (Circle/Arc conditional-escrow prize)

Circle's Arc L1. **Native gas token is USDC** (6 dp). The pool holds real Circle testnet USDC
(`0x3600…`, a standard ERC-20), so this satisfies the Arc "advanced stablecoin logic /
conditional escrow" bounty directly. LI.FI routes **Arbitrum Sepolia → Arc** (LI.FI Intents),
so a donor on Arbitrum Sepolia funds the Arc pool via Composer in one Flow.

| Contract | Address |
|---|---|
| `CivicShieldPool` | [`0x5E9972027d4f03824AC0e5dA446f0AfB5BFfFcf5`](https://testnet.arcscan.app/address/0x5E9972027d4f03824AC0e5dA446f0AfB5BFfFcf5) |
| Real Circle USDC (gas + escrow token, 6 dp) | `0x3600000000000000000000000000000000000000` |

- **Owner / Relayer / seed verified recipient:** `0xFeeA88FB58342479fc8D5901f3f67740b39c9FaA`
- **Policy:** riskThreshold 75 · maxReleasePerEvent 500 USDC · dailyReleaseLimit 1000 USDC
- RPC `https://rpc.testnet.arc.network` · explorer `testnet.arcscan.app` · faucet `faucet.circle.com`
- **Verified live with REAL USDC:** funded pool 5 USDC → released 2 USDC to verified recipient
  (`EXECUTED`); blocked 2 USDC to unverified `0x…dEaD` (`BLOCKED / RECIPIENT_NOT_VERIFIED`), pool unchanged.



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
