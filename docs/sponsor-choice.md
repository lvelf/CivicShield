# Sponsor Choice

Why CivicShield targets the sponsors it does, why it cuts the rest, and the one open
decision (settlement chain). Scope is locked to three deep integrations — every SDK does
real work in the architecture, nothing is bolted on to qualify.

See also: [PLAN.md](PLAN.md) (build plan), [INTERFACES.md](INTERFACES.md) (module contract).

---

## 1. Sponsor priority matrix

| Priority | Sponsor | Role in CivicShield | Track entered | Reachable prize | Status |
|---|---|---|---|---|---|
| **P0** | **LI.FI** | Donation intake: any-chain / any-token → swap + bridge → USDC into the pool in one deposit | Most Innovative Composer Application ($4K) | ~$4K | ✅ Locked |
| **P0** | **Chainlink** | CRE workflow pulls live weather/hazard API → `riskScore` → the release trigger condition | Best workflow with CRE ($6K, up to 3 teams × $2K) | ~$2K | ✅ Locked |
| **P0** | **ENS** | `flood-risk-agent.eth` agent identity (ENSIP-26 text records) + `shelter-fund.eth` subname certifies the recipient | Best ENS Integration for AI Agents ($5K) + Integrate ENS pool ($6K split) | ~$1–2.5K + pool split | ✅ Locked |
| **P1** | **Settlement chain** | Where the conditional-escrow pool (policy contract) deploys | Base **mainnet** (see §4) | — | ✅ Locked — Base mainnet (LI.FI is mainnet-only) |
| **P3** | Blink | (egg only) one-click pull-payment donation entry | Best consumer app — Scratch ($3K) | ~$1.5K | 🎲 only if Saturday-night slack |

---

## 2. Why these three (deep, not bolted on)

- **LI.FI** *is* the reason a crypto-novice can fund relief in one click — it owns the entire Act 1 donation experience. Remove it and the "donate any token, any chain" pitch collapses.
- **Chainlink CRE** *is* the release condition. The `riskScore` is not decoration — no qualifying real-world hazard signal, no funds move. Remove it and there is no trustless trigger.
- **ENS** *is* the trust fabric — agent identity and the verified-recipient allowlist are both ENS names. Remove it and "donors verify *who*" has no answer.

Each one is load-bearing; cutting any of the three changes what the product *is*.

---

## 3. Sponsors we deliberately cut

| Sponsor | Reason for cutting |
|---|---|
| **Dynamic / Privy / Blink** (as mainline) | All wallet / on-ramp layer — function overlaps LI.FI = doing the same thing twice |
| **Ledger** | Human-in-the-loop is one line of "future work" in the pitch; no code needed |
| **Hedera / Sui-Walrus / Canton** | Swapping the whole stack (separate chain / Move / Daml) — negative ROI for two people in two days |
| **World / Google Cloud / Uniswap / 1inch / Unlink** | No intersection with the architecture, or Continuity-only (we are a scratch team) |
| **Chainlink Confidential AI** | Cut together with the distressed-credit direction — do not revisit |

> **Google Cloud note (Best On-Chain Agent Economy, $5K):** evaluated and rejected as a
> mainline target. It requires BigQuery over mainnet ERC-8004 data + a reputation-ranking
> tool around x402 — effectively a *different product* (an agent analytics dashboard) on a
> separate front, diluting the three integrations that are already deep. Single team, $5K,
> low expected value. Only conceivable add: upgrade agent identity from ENS-only to
> ENS + ERC-8004 with a read-only reputation panel — and only if the mainline is fully
> stable before H20.

---

## 4. Settlement chain: Base vs Arc

> **RESOLVED → Base mainnet.** The go/no-go landed when we confirmed **LI.FI Composer routes
> only on mainnets** — testnet was never actually available. Arc is doubly out (LI.FI doesn't
> route there either). Both README and this section now read mainnet; the table below is kept
> as the decision record.

|  | **Route A: Base mainnet (CHOSEN)** | Route B: Arc |
|---|---|---|
| Pool deployment | Base mainnet, demo-scale real funds (pool ≤ $30, caps 5/15 USDC) | Arc testnet |
| LI.FI demo | ✅ any-token, one click, straight into the pool — and it's *real money*, which strengthens the firewall story | ⚠️ LI.FI doesn't route to Arc at all — not an option |
| Extra prize | — | + "Advanced Stablecoin Logic" $3.5K (unreachable without routing) |
| Extra risk | real funds in an unaudited contract — mitigated by tiny caps + no admin-withdrawal path | new-chain unknowns + no LI.FI routing |
| CRE / ENS / policy contract | unchanged | unchanged |

**Recommendation (executed):** Base mainnet. LI.FI being mainnet-only forced the question, and
running on small real money turned out to be a *narrative upgrade*, not a compromise — "real
dollars, real federal data, real firewall" beats a testnet demo. Architecture stays
chain-portable; Arc remains a future-work path if LI.FI ever adds routing.

---

## 5. Stretch-only exception: Blink

The single egg exception: **Blink — "Best consumer app — Scratch" ($3K, 2 teams × $1.5K).**
A one-click pull-payment SDK that claims a few-minute integration, usable as a
*supplementary* donation entry alongside LI.FI (**not** a replacement).

**Trigger condition:** touch it **only if** all three demo acts are fully working at the
**Saturday 18:00 checkpoint**. Otherwise, do not touch it.

---

## 6. Sunday submission checklist (by sponsor)

- [ ] **LI.FI** — working demo + source + copy that states explicitly: "Composer powers donation intake: any-token any-chain → USDC → CivicShieldPool deposit"
- [ ] **Chainlink** — successful CRE simulation record (or live deploy) + project description spelling out which API the workflow pulls and how `riskScore` becomes the release condition
- [ ] **ENS** — video / live demo link + open-source repo + verifiable ENSIP-26 text records + **Sunday-morning booth presentation (owner: ______)**
- [ ] **(if Arc)** — architecture diagram (mandatory) + video + runnable front+back end + GitHub + declare entry into "Advanced Stablecoin Logic"
- [ ] **All-sponsor** — keep a normal commit cadence (1inch states in writing "no single-commit entries on the final day"; other sponsors apply the same lens informally)
- [ ] Record a rough cut of the video Saturday night; only reshoot on Sunday. **Hard submission deadline Sunday 09:00 AM — everything in by 08:45.**
