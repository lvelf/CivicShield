# LI.FI Composer — routing findings (tested 2026-06-12)

Tested via the LI.FI public API (`li.quest/v1`). Source of truth for the decision below.

## What works
- **Basic bridging to Arc Testnet (5042002)**: `GET /v1/quote` from **Arbitrum Sepolia (421614)**
  → Arc returns a route via **LI.FI Intents**. Delivers USDC to the recipient address.

## What does NOT work
- **Composer destination contract calls (`POST /v1/quote/contractCalls`) on testnets**:
  no route for Arc, OP Sepolia, or Arbitrum Sepolia destinations ("No available quotes", code 1002).
- LI.FI docs list destination-call support on **mainnets only**: Polygon, BSC, Optimism,
  Ethereum, Avalanche, Arbitrum, Base, Gnosis, Linea, Fantom. **No testnets. No Arc.**

## Implication
The "one Flow: swap+bridge+**deposit into the pool**, one signature" (LI.FI Deposit /
Composer) — the core LI.FI bounty narrative — **cannot be demoed on testnet**, and **cannot
target Arc at all** (Arc is not a Composer destination-call chain). So the LI.FI Composer
prize and the Circle/Arc prize cannot be unified in a single donation flow.

- Arc/Circle bounty: **independent and already proven** (pool live on Arc, real USDC conditional escrow).
- LI.FI Composer bounty: needs a **mainnet** pool on a Composer-supported chain (Base/Optimism/
  Arbitrum), with a tiny real-USDC `LI.FI Deposit` into it.

## Options for the LI.FI Composer bounty
1. **Mainnet Composer demo (recommended):** deploy the same `CivicShieldPool` to a cheap
   Composer-supported mainnet (Optimism/Base), do a tiny real-USDC (~$0.50) Composer "LI.FI
   Deposit" into it. Real, cheap, squarely hits "Most Innovative Composer Application" +
   "LI.FI Deposit into escrow-style contract". Keep Arc pool for Circle; keep policy/CRE/ENS
   demos on testnet.
2. **Testnet plain-bridge only:** keep everything on testnet, use basic LI.FI bridging (not
   Composer destination-deposit). Weakens/forfeits the Composer-specific prize.
3. **Ask LI.FI reps at the event** whether a testnet Composer environment exists for the
   hackathon before committing to mainnet.
