# CivicShield 🛡️

**An on-chain disaster-relief fund driven by real-world hazard signals — where AI can propose, but only the chain can release money.**

> **Generation is not permission.** AI proposes, the chain certifies, donors verify.

Anyone can donate any token from any chain in one click. Real-world flood risk — not a human committee, not an unaccountable AI — is what unlocks relief funds. Every release and every block is publicly auditable on-chain.

Built in 36 hours at **ETHGlobal New York 2026** by a team of two.

---

## 🔗 Quick Links

| | |
|---|---|
| 🎥 **Demo Video** | [LINK — add before submission] |
| 🌐 **Live Demo** | [LINK — add before submission] |
| 📜 **CivicShieldPool (Base mainnet)** | [`0x8df17313f37f5418868f1c3c369bbde4dba9daa6`](https://basescan.org/address/0x8df17313f37f5418868f1c3c369bbde4dba9daa6) |
| 🗺️ **Architecture Diagram** | [`docs/architecture.png`](docs/architecture.png) — see below |
| 📁 **Deployments & Notes** | [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md) |

---

## The Problem

Disaster-relief funding is slow, opaque, and trust-heavy. Money sits in accounts while bureaucracies decide; donors can't see where it went; and the emerging answer — "let an AI agent manage the fund" — replaces one black box with another. Giving an LLM direct control of public money is a prompt injection away from disaster.

## Our Answer

CivicShield separates **proposing** from **executing**:

- A **multi-agent system** monitors real-world hazard data and **proposes** fund releases (only the designated agent can enqueue a proposal — `onlyAgent` — to prevent spam). The agents hold no keys to move money.
- A **policy contract** (the escrow pool) deterministically certifies every proposal against six on-chain rules: **scope match** (the event's region|hazard must match this pool's `fundScope` — donor intent), risk threshold, per-event cap, trace-level daily limit, verified recipients, approved purposes.
- Only certified proposals execute. Everything else is blocked — and both outcomes are logged on-chain (`ActionEvaluated`) for donors to verify. The chain *is* the trace store; no database needed.
- **Large releases need a human.** A policy-clean proposal at or above `reviewThreshold` doesn't auto-execute — it enters `PENDING_REVIEW` and waits for an **`approver` (a Ledger hardware wallet)** to sign `approveRelease`. Below the threshold → auto; above the per-event cap → blocked. Device-certified human-in-the-loop for high-value actions.

For a normal DeFi agent, risk is the brake. For a relief fund, **disaster risk is the accelerator** — a verified flood signal is precisely what *unlocks* funds. In both cases, the decision lives in the on-chain policy, never in the AI.

---

## Architecture

![CivicShield architecture flow](docs/architecture.png)

```
  DONATION INTAKE                          HAZARD ORACLE (trust-minimized)
  Donor — any token, any chain             Chainlink CRE workflow (TS):
       │                                   api.weather.gov alerts → riskScore
       │  LI.FI Composer:                        │
       │  swap → USDC → donate()  (1 sig)        │  relayer submits on-chain:
       ▼                                         ▼  submitRiskScore(eventId, score, scope)
 ┌─────────────────────────────────────────────────────────────────────────┐
 │  CivicShieldPool   ·   escrow + policy   ·   Base mainnet                 │
 │                                                                          │
 │  Policy Π — checked in order, first failure wins, EVERY outcome logged:   │
 │   0 fundScope (donor intent)   1 riskThreshold ≥ 75   2 maxReleasePerEvent│
 │   3 dailyReleaseLimit (trace)  4 verifiedRecipient    5 approvedPurpose   │
 │                                                                          │
 │  executeRelease(): all rules pass →                                       │
 │     amount ≥ reviewThreshold → PENDING_REVIEW (await Ledger)              │
 │     else                      → transfer USDC to the verified recipient   │
 │  → emits ActionEvaluated (pass OR block) → Transparency Log               │
 └──▲──────────────────▲───────────────────▲────────────────────┬──────────┘
    │ proposeRelease()  │ executeRelease()   │ approveRelease()    │ USDC out
    │ onlyAgent         │ PERMISSIONLESS     │ onlyApprover        ▼
 ┌──┴─────────────┐ ┌───┴────────────┐ ┌─────┴────────┐  ┌────────────────────┐
 │ Multi-agent    │ │ Keeper          │ │ Ledger device │  │ verified recipient  │
 │ proposer       │ │ (cron/--watch)  │ │ human-in-the- │  │ shelter-fund.eth    │
 │ supervisor →   │ │ settles fresh   │ │ loop for      │  │ (ENS subname)       │
 │ assessor(OpenAI)│ │ PENDING + auto- │ │ large         │  └────────────────────┘
 │ Privy Wallet · │ │ settles on      │ │ releases      │
 │ cron · no key  │ │ ReleaseApproved │ └───────────────┘
 └────────────────┘ └─────────────────┘
   proposes only      no special power —      human authorizes
                      anyone could call;      the large ones
                      the keeper guarantees
                      someone always does
```

**Settlement chain: Base mainnet** — LI.FI Composer's one-Flow contract deposit is mainnet-only, so the full *donate → certify → release* path runs here on tiny real USDC (demo scale: auto < \$5 · Ledger review \$5–\$10 · blocked > \$10). The contract is chain-portable. The chain's authority is never delegated: the agent only *proposes*, the CRE-attested `riskScore` (not the agent) is the release condition, and a manipulated agent can at worst miss a disaster — never cause a wrongful release. Live addresses + proven end-to-end flow: [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md); LI.FI routing findings: [`docs/lifi-composer-findings.md`](docs/lifi-composer-findings.md).

### System components (the full backend)

| Layer | Module | Tech | Role | Status |
|---|---|---|---|---|
| Escrow + policy | `contracts/` `CivicShieldPool` | Solidity · Foundry · **Base mainnet** | 6-rule certification (scope→risk→cap→daily→recipient→purpose) + tiered Ledger approval + `ActionEvaluated` transparency log | ✅ live · 19 tests |
| Hazard oracle | `cre/` + `hazard-workflow/` | Chainlink **CRE** (TS) | `api.weather.gov` → deterministic `riskScore` (consensus, no LLM) | ✅ simulated |
| Score delivery | `relayer/` | viem | submit `riskScore` + attested scope on-chain | ✅ verified |
| Proposer (AI) | `agent/` | OpenAI + **Privy** Agent Wallet · GitHub Actions cron | supervisor → assessor → `proposeRelease`, rate-limited, no raw key | ✅ live on free cron |
| Settler (keeper) | `agent/keeper.ts` | viem · cron / `--watch` | calls **permissionless** `executeRelease` so settlement is automatic, not manual: settles fresh `PENDING`, and settles `PENDING_REVIEW` the moment a Ledger `ReleaseApproved` fires | ✅ built |
| Approval | `ledger/` | **Ledger** DMK + Ethereum signer · Speculos | `approveRelease` for large releases — human signs on the device; Clear Signing (ERC-7730) descriptor included | ✅ end-to-end on-chain |
| Donation intake | `frontend/` | Next.js · wagmi · **LI.FI Composer** | one-click: any token → swap + `donate()` in one signature | ✅ live |

**Who calls what (no manual steps in production):** the **agent** only `proposeRelease` (it holds no fund keys). Settlement is *permissionless by design* — the policy guards the money, not the caller — so a **keeper** (`agent/keeper.ts`, a cron or `--watch` daemon) is what actually calls `executeRelease`. A clean small proposal settles instantly; a large one is held as `PENDING_REVIEW`; once a human signs `approveRelease` on a **Ledger**, the keeper sees the `ReleaseApproved` event and settles it automatically. No trusted operator, no manual poking — anyone *could* call `executeRelease`, the keeper just guarantees someone always does.

**End-to-end flow:** donor → LI.FI Composer → pool · weather.gov → CRE → relayer → on-chain `riskScore` · supervisor → assessor(OpenAI) → Privy-signed `proposeRelease` · **keeper** → `executeRelease` → 6-rule policy → release, or `PENDING_REVIEW` → Ledger `approveRelease` → keeper auto-settles on `ReleaseApproved`. Every outcome logged on-chain.

---

## Theoretical Framing: Proposal–Certification–Execution

CivicShield implements on-chain the **Proposal–Certification–Execution (PCE)** architecture formalized in *"No Certificate, No Execution: Certified Traces as a Foundation for Trustworthy AI Agents"* (Liu et al., 2026, incl. A. Capponi, Columbia; [arXiv:2605.24462](https://arxiv.org/abs/2605.24462)):

| PCE component | In the paper | In CivicShield |
|---|---|---|
| $M_G$ — generating machine | Probabilistically proposes candidate execution traces | LLM agent generating structured `proposeRelease` proposals |
| $M_\Pi$ — Permissibility Machine | Certifies traces under policy system $\Pi$ | Deterministic checks in the policy contract |
| $\Pi$ — policy system | Rules defining what is permissible | `fundScope` (donor-intent), `riskThreshold`, `maxReleasePerEvent`, `dailyReleaseLimit`, `verifiedRecipients`, `approvedPurposes` |
| Execution | Only certified traces execute | `executeRelease()` transfers USDC only when every check passes |

The paper argues that monitorability is not certifiability — seeing an AI's reasoning doesn't prove its action is permissible. CivicShield doesn't trust the AI's explanations; it trusts deterministic on-chain certification of structured proposals. The paper also shows that individually permissible actions can compose into an impermissible trace; our `dailyReleaseLimit` certifies at the trace level, blocking split-payment composition attacks that pass every single-action check.

The paper is a position paper — no implementation. CivicShield is a live, on-chain Permissibility Machine governing real relief funds on Base mainnet.

---

## Sponsor Integrations

Every SDK below does real work in the architecture — nothing is bolted on to qualify.

### LI.FI — *Most Innovative Composer Application*
Composer powers the entire donation intake: any-token, any-chain → swap + bridge + deposit into `CivicShieldPool` as **one atomic Flow with one signature**. The pool is an escrow-style deposit contract — exactly the destination type LI.FI Deposit was built for, used as an arbitrary on-chain destination with no registration required. Composer is the reason a crypto-novice can fund disaster relief in one click.

### Chainlink — *Best workflow with CRE*
A CRE workflow (TypeScript SDK) connects Base to the **U.S. National Weather Service alerts API** (`https://api.weather.gov/alerts/active` — free, keyless, near-real-time federal hazard alerts). The workflow filters active flood alerts and maps the NWS CAP fields `severity`, `urgency`, and `certainty` into a 0–100 `riskScore`, then delivers it on-chain (relayer pattern; simulation via CRE CLI). The score is not decoration — it is **the release condition**: no qualifying real-world signal, no funds move. No mock APIs, no hard-coded values — the trigger is a live federal data feed.

**riskScore is deterministic.** Each CAP field contributes a fixed weight; the score is their sum, clamped to 0–100. The same alert always produces the same score — which is what makes the on-chain certification reproducible.

| CAP field | Value | Points |
|---|---|---:|
| `severity` | Extreme | 40 |
| | Severe | 30 |
| | Moderate | 15 |
| | Minor | 5 |
| `urgency` | Immediate | 30 |
| | Expected | 20 |
| | Future | 10 |
| `certainty` | Observed | 30 |
| | Likely | 20 |
| | Possible | 10 |

`riskScore = min(100, severityPts + urgencyPts + certaintyPts)`

> **Worked example:** a *Severe* (30) + *Immediate* (30) + *Likely* (20) flood warning → **80**, above the `75` threshold → funds eligible. An *Extreme* + *Observed* + *Immediate* alert saturates at 100; a *Minor* / *Future* / *Possible* advisory scores 25 and unlocks nothing. Reference implementation: [`cre/src/score.ts`](cre/src/score.ts).

### ENS — *Best ENS Integration for AI Agents* + *Integrate ENS* pool
Two genuine integrations:
1. **Agent identity:** `flood-risk-agent.eth` carries [ENSIP-26](https://docs.ens.domains/ensip/26/) agent text records — monitored hazard types, data sources, proposal scope — resolved live by the frontend.
2. **Subnames as access tokens:** `shelter-fund.eth` and sibling subnames *are* the verified-recipient allowlist. The policy contract resolves `verifiedRecipients` from ENS; issuing a subname is issuing certification.

ENS is the trust fabric: donors can verify *who* the agent is and *who* can receive funds, by name.

### Privy — *Best AI agent built with Privy*
The proposer agent signs `proposeRelease` with a **Privy Agent Wallet** (server wallet) — created via
the Privy server SDK, custodied by Privy, so no raw key ever lives on our server or in CI. The agent
performs a real on-chain action (submitting a structured relief proposal) entirely through its Privy
wallet, and the wallet address is the contract's `onlyAgent` principal. This is what lets the agent
run unattended (GitHub Actions cron) without a private key sitting in a secret.

### Ledger — *AI Agents x Ledger*
A manipulated or buggy AI must never move large public money unchecked. CivicShield makes a **Ledger** hardware wallet the `approver`: any release ≥ `reviewThreshold` is frozen in `PENDING_REVIEW` until the Ledger device signs `approveRelease`. The device-held key is the central gate on high-value autonomous actions — the AI proposes, the policy certifies, and a human device authorizes the large ones. **Generation is not permission: the AI can draft a transfer, but only the hardware-held human key releases it.**

Concrete use of Ledger primitives (`ledger/`), not wallet branding:
- **Device Management Kit (DMK)** + `device-signer-kit-ethereum` drive the signing flow (`ledger/src/approve-release.ts`): connect → review → sign `approveRelease` → broadcast. The key never leaves the device.
- **Clear Signing (ERC-7730)** descriptor (`ledger/clear-signing/civicshield-pool.erc7730.json`) so the device shows *"Approve disaster-relief release · Proposal #N"* instead of raw hex.
- **Proven end-to-end on Base mainnet via the Speculos emulator** (no physical device needed for the demo — swap one transport line for real hardware): agent proposed → held `PENDING_REVIEW` → device signed `approveRelease` ([`ReleaseApproved`](https://basescan.org/tx/0x309d45f4fba109aca79e9f0a52d561ad6277990fcd07ba6707882f149c60cb69)) → keeper settled → [`EXECUTED`](https://basescan.org/tx/0x9eda5767b240b79073164220f69e3c3179b340930774eeb763776e2d1f50f2a0).
- Developer-experience feedback on the DMK docs & SDKs: [`ledger/LEDGER-FEEDBACK.md`](ledger/LEDGER-FEEDBACK.md).

---

## Repository Structure

```
contracts/        CivicShieldPool.sol — escrow + 6-rule policy + ActionEvaluated events (Foundry)
cre/              score.ts — deterministic CAP→riskScore core + offchain proof
hazard-workflow/  Chainlink CRE workflow (TS): api.weather.gov → riskScore (cre simulate)
relayer/          Submits CRE score + attested scope on-chain (submitRiskScore)
agent/            Multi-agent proposer (supervisor + assessor → proposeRelease) + keeper.ts (auto executeRelease)
ledger/           Ledger human-in-the-loop approval: DMK signer + Clear Signing (ERC-7730) + Speculos
frontend/         Donate · Agent Proposals · Approve/Block · Transparency Log
docs/             DEPLOYMENTS.md, lifi-composer-findings.md, INTERFACES.md
```

## Running Locally

```bash
# contracts (Foundry)
cd contracts && forge test                      # 19 tests, full policy-path coverage
forge script script/Deploy.s.sol --rpc-url base_mainnet --broadcast   # deploy (needs .env)

# CRE hazard workflow (real weather.gov → riskScore)
cd hazard-workflow && cre workflow simulate ./hazard

# relayer (submit CRE score + scope on-chain)
cd relayer && bun install && PRIVATE_KEY=0x... npm run submit

# offchain scoring proof (no toolchain needed)
cd cre && npm run score -- IL
```

Live deployment addresses (Base mainnet), the proven end-to-end flow, and the demo video are in [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md).

---

## Honest Limitations

- The `riskScore` reaches the contract via a relayer submitting CRE simulation output; a live CRE network deployment is the production path (Chainlink deploys successful simulations to live CRE during the event).
- Hazard scoring uses a single source (NWS active alerts); production would aggregate NOAA/USGS-class sources with dispute windows.
- **Single scope (US|flood).** Donor intent *is* enforced on-chain now (`fundScope` + the `EVENT_SCOPE_MISMATCH` rule + relayer-attested event scope), but this deployment is one scope. Multi-scope (per-region pools, regionalized agents) is Future Work.
- The on-chain guarantee ends at the verified recipient's wallet: the chain proves funds only reach a vetted relief org, for an approved purpose, within limits, tied to a real in-scope disaster — what the org does *after* receiving USDC is off-chain (future: milestone-based release / on-chain receipts).
- Adoption framing is deliberately *public-goods funds and relief DAOs* — crypto-native pools that exist today — rather than direct municipal procurement.

## Future Work

- **Multi-scope factory:** a `CivicShieldPoolFactory` deploying one pool per scope (NY-flood, FL-hurricane, …), each with its own balance, recipient allowlist, and a **regionalized agent** monitoring only its scope. The single-scope pool here is the building block.
- **Richer approval policy:** the tiered human-in-the-loop (Ledger `approveRelease` for releases ≥ `reviewThreshold`) is **implemented**; extend it to multi-sig / M-of-N approver sets and dynamic, scope-aware thresholds.
- **Count-based trace limits:** beyond the value-based `dailyReleaseLimit`, cap the *number* of releases per scope per day; excess routes to human review. (The chain already stores the full trace via `ActionEvaluated` — no database needed for auditability; an off-chain DB is only for agent-side orchestration/analytics.)
- **ZK certificates:** prove "policy Π satisfied" without exposing sensitive recipient data — the privacy–certification tension the PCE paper highlights; a bridge to ProveKit / Confidential AI.
- **Live CRE deployment:** promote the CRE workflow from simulation to the live CRE network for fully decentralized, trust-minimized score delivery.

## Team

Two builders: Nuo Chen, Rosemary (Yanxi) Li

---

*AI proposes. The chain decides. Donors verify.*
