# Deployments

## Base Mainnet (chain 8453) — MAIN LINE (LI.FI Composer + CRE + ENS)

The coherent product. LI.FI Composer's destination-deposit feature is **mainnet-only** (no
testnets), so the donation→certify→release flow lives here on real (tiny) money.

| Contract | Address |
|---|---|
| `CivicShieldPool` (current) | [`0x8df17313f37f5418868f1c3c369bbde4dba9daa6`](https://basescan.org/address/0x8df17313f37f5418868f1c3c369bbde4dba9daa6) |
| Real Circle USDC (6 dp) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

ABI + address for the frontend: `contracts/deployments/base-mainnet.json`.

- **Owner / Agent / Relayer / seed verified recipient:** `0xFeeA88FB58342479fc8D5901f3f67740b39c9FaA`
- **fundScope:** `keccak256("US|flood")` — all-US flood relief. Donor intent enforced on-chain.
- **Policy:** scope match (rule 0) · riskThreshold 75 · maxReleasePerEvent 500 USDC · dailyReleaseLimit 1000 USDC · verified recipient · approved purpose
- **`proposeRelease` is onlyAgent** (prevents proposal-list spam/DoS); `executeRelease` stays permissionless.
- **`donate(uint256 amount, address donor)`** — `donor` (not msg.sender) is logged; on a LI.FI
  Composer deposit msg.sender is LI.FI's executor (`0x4DaC9d17…`), so the frontend encodes the
  connected wallet as `donor`. `Donated` also carries the pool's scope.
- **`submitRiskScore(eventId, score, eventScope)`** — relayer attests score AND scope; the agent
  cannot claim an event is in-scope. Mismatch → `EVENT_SCOPE_MISMATCH`.
- LI.FI Composer `contractCalls` confirmed routable to Base mainnet — see
  [lifi-composer-findings.md](./lifi-composer-findings.md). Composer link proven live on an earlier
  pool (tx 0x75ed2d4d…); re-run on the current pool for a clean log.

> **Predecessors:** `0x5e99…fcf5` (pre donor-fix), `0xc0ca0981b1fc2da9009eb8393ca2df935cff15c7`
> (pre scope/onlyAgent). Both superseded by the current address above.

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
