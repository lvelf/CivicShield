# Prior Art & Differentiation

The full competitive survey behind the short section in the [README](../README.md#prior-art--differentiation),
plus a judge-Q&A prep sheet.

**Bottom line:** someone has built every *part* of CivicShield; nobody has assembled the
*machine*. That's the best position for a pitch — the need is proven, the differentiation is clear.

> ⚠️ **Figures below are from team research and are not yet source-linked.** Verify each
> number against its primary source before quoting it in the public pitch, video, or README.
> The *qualitative* differentiation (the comparison table) is the defensible claim; the
> hard stats are supporting color, not load-bearing.

---

## Track 1 — Parametric insurance (closest to our "hazard-triggered release" mechanism)

- **Etherisc** (since 2016) — pioneer of parametric blockchain insurance; uses Chainlink
  oracles to feed real weather data into parametric crop insurance (e.g. automated payouts
  to Kenyan farmers). Mechanism is nearly isomorphic to ours: predefined trigger → oracle
  verification → smart-contract auto-payout, no human in the loop.
- **Arbol** — the most commercially successful. Smart-contract crop insurance on **NOAA**
  weather data (farmers in the US, Costa Rica, Cambodia). Same data class we use. Has reached
  the reinsurance layer: with RiskStream Collaborative, put parametric reinsurance trigger
  data on-chain ("dRe", a live on-chain reinsurance data tool).
- **Sovereign precedent (Web2):** CCRIF (Caribbean, 2007) and ARC (Africa, 2014) — rapid
  parametric payout lets governments/NGOs deploy relief fast. This is the real-world version
  of our future-work "parametric cat-bond" direction.
- ⚠️ **ETHGlobal history:** "Parametric Insurance for Natural Disasters" projects (Chainlink
  oracles auto-handling creation/trigger/payout) have appeared before — judges may have seen
  similar showcases. Lead with what's *different*, not the trigger mechanism itself.

**Difference:** insurance is a 1:1 policy-to-payout contract with hard-wired trigger logic.
We're a *public relief pool* with an AI proposal layer and a deterministic policy machine — a
different object.

## Track 2 — AI-predicted anticipatory cash relief (closest to our *narrative*)

This is the one to internalize — **GiveDirectly is the Web2 version of our story, already
validated at scale.**

- With Google.org support, GiveDirectly piloted village-level flood prediction that triggers
  *anticipatory* cash before disaster strikes. Their own framing maps onto our pitch almost
  verbatim: AI predicts where flooding will hit; when the risk threshold is met, payments
  release — they too have "riskScore over threshold → release".
- Reported result (Kogi, Nigeria): once the prediction threshold was met, 3,250+ households
  received ~$105 each within 48–72h → income doubled, food insecurity down ~90%, 93% of
  households felt more prepared. Threshold design echoes ours: define "20% of community area
  predicted flooded" as the trigger, monitor forecasts daily, cross-check with community
  observation. IRC is replicating this anticipatory-action model in northern Kenya and other
  regions that previously lacked flood-forecast data.

**Difference (our wedge):** GiveDirectly's entire trigger → approval → disbursement pipeline
is *institutional, off-chain, and not publicly verifiable*. A donor can only trust the
institution. **That is exactly our entry point.** And their outcome data is a gift: we don't
have to prove anticipatory cash works — Web2 already did. We prove it can exist *without
institutional trust*.

## Track 3 — Crypto disaster fundraising (closest to our *funding intake*)

- Ukraine DAO raised >$7M in crypto (2022); Ukraine's government posted wallet addresses
  directly and received >$100M in crypto within months (pro-Ukraine total ~$2.12B). Turkey
  Relief DAO set up wallets across 18 chains after the earthquake, working with government/NGOs.
- Platform layer: Endaoment (on-chain donation platform, ~$81M facilitated), Givepact, etc.

**Difference:** all of these solve *raising* and transparent *accounting* — none solves
*releasing*. Once funds hit a multisig, spending is still manual human discretion;
"transparency" stops at seeing a transfer. Turkey Relief DAO's 18-chain wallet sprawl is
exactly the problem LI.FI Composer intake collapses for us.

---

## Prior ETHGlobal hackathon work (judges may have seen these)

Naming these first — before a judge asks "isn't this just DAOsaster?" — reads as homework,
not blind spot.

1. **DAOsaster** — ETHGlobal SF 2024 finalist (top-10 of 223).
   [showcase](https://ethglobal.com/showcase/daosaster-ngboi) ·
   [code](https://github.com/soma9574/daosaster-response)
   Decentralized disaster *response*: a global/regional/local fleet of AI agents monitors
   hazard signals, then **confirms disasters by agent consensus and releases DAO funds by
   agent vote (quorum of 3, 1-day voting period** — visible in their
   `test_disaster_response_dao.py`). Breadth play: agents + drones (VLM) + TEE (Phala
   trusted-llm) + tokenized agents + Story/SKALE/Graph. Contract layer is thin (the
   `smart-contracts` README is the unmodified Foundry template; the test's mock-token
   bytecode is a `60806040…` placeholder, so it never ran).
   - **Our rebuttal (this is the strong one):** agent consensus does not survive *correlated*
     failure. A prompt injection that fools one LLM fools every copy of it — N identical
     voters share one weakness, so a quorum is false safety. And their TEE only proves a
     manipulated output was *faithfully computed*, not that it was *correct* — the live form
     of the PCE paper's "monitorability is not certifiability." They harden the **generator**
     ($M_G$); we harden the **certifier** ($M_\Pi$). They let agents vote; we let federal data
     and deterministic policy decide. **DAOsaster coordinates the response; CivicShield
     certifies the money** — complementary, theirs could run downstream of ours.

2. **OpenRelief** — ETHGlobal showcase.
   [showcase](https://ethglobal.com/showcase/openrelief-wg12g)
   A pool manager creates a relief fund on disaster; victims do one-time identity verification
   (Self) on mobile; donors give cross-chain (CCTP). Cites useful pain data: ~$13.6B aid lost
   to fraud yearly; ~70% of legitimate victims blocked by slow bureaucratic verification.
   - **Difference:** OpenRelief solves *who may receive* (victim anti-fraud identity); the
     release decision is still a manager creating funds by hand. We solve *when and on what
     basis funds move*. Complementary — their Self identity could become a future upgrade to
     our `verifiedRecipients`.

3. **Parametric Insurance for Natural Disasters** — ETHGlobal showcase.
   [showcase](https://ethglobal.com/showcase/parametric-insurance-yucbt)
   Chainlink oracles pull hurricane category / earthquake magnitude from NOAA, USGS, etc.;
   the contract auto-pays the policyholder when a predefined condition is met. Most isomorphic
   to our trigger (same NOAA-class data), but it's *insurance* (policy↔payout), with no AI
   proposal layer, no donation pool, and no firewall narrative.

**One-line for the README / Q&A:** *Prior ETHGlobal work — DAOsaster (agent-consensus
disaster response), OpenRelief (victim identity verification), parametric-insurance
prototypes. CivicShield differs by making the release decision itself trustless: no agent
consensus, no manager discretion — only deterministic policy over federal data.*

---

## Institutional deployments (real money — the most important reference)

Not hackathon demos — production systems moving hundreds of millions in real aid. They both
*validate adoption* and *reveal the gap*. (Figures from team research — verify before quoting.)

- **WFP Building Blocks** (2017–) — the largest humanitarian blockchain. ~6M crisis-affected
  people, >$760M transferred, 40M+ beneficiary redemptions, >$3.5M in bank fees saved (redirected
  to extra rations). Core function is *deduplication*: 80+ agencies in Ukraine prevent
  overlapping aid against a shared per-household cap (reportedly ~$270M double-payments
  prevented). Permissioned chain; the selling point is neutrality — all agencies co-own, no
  hierarchy.
- **UNHCR Stellar Aid Assist** (2022–, with Circle) — USDC sent straight to eligible Ukrainians'
  phones, cashed out at MoneyGram in minutes; won a blockchain social-impact award.
  **Takeaway: the UN + Circle already proved USDC is a legitimate aid-disbursement currency** —
  our USDC choice follows precedent, it isn't a crypto-toy decision.
- **Oxfam UnBlocked Cash** (2019–) — Vanuatu, post-cyclone Harold + COVID. DAI-backed token
  vouchers + NFC cards designed for low-connectivity. Registration time dropped from ~1hr to
  ~3.6 min; scaled to 35k+ recipients across 17 partners; EU Horizon 2020 social-good award.
- **Counter-example — Direct Cash Aid** (121-org consortium) *abandoned* blockchain, finding it
  redundant for their use case. Plus "blockchain in name only" critiques and persistent
  connectivity gaps. We must be able to answer this (see Q&A).

### The layer map — everyone is on the disbursement side; the decision layer is empty

| Layer | Who's there | What the chain does for them |
|---|---|---|
| Raise | Ukraine DAO, Endaoment | collect funds + account |
| **Decide — when / to whom / how much** | **nobody** | **← CivicShield** |
| Disburse / redeem | WFP, UNHCR, Oxfam | dedup, cut fees, speed delivery |
| Trigger (insurance form) | Etherisc, Arbol | policy → payout auto-trigger |

WFP logs *who already received*; UNHCR runs *how to get money to a phone*; Oxfam runs *how to
swipe a card on an island with no network*. But the decision *"should this money be released"*
is still made by humans inside each institution. Etherisc/Arbol touch decision-automation but
are locked in insurance-contract form. **The release-decision layer of a donation pool — real
signal + deterministic policy + AI firewall — has no precedent.** This is the final answer to
"what's actually new."

**Demo "nail number":** every landmark deployment has one quantified hook (WFP: $3.5M fees
saved; Oxfam: 1hr → 3.6 min; UNHCR: minutes to arrive). Ours should too — time it live:
*"federal flood warning → funds released: ~90 seconds, zero human discretion, fully auditable."*

---

## Competitive positioning table (Q&A-ready)

| Competitor | They have | They lack |
|---|---|---|
| Etherisc / Arbol | Real-data trigger + automatic release | It's *insurance* (1:1 policy↔payout), not a public pool; no AI proposal layer; trigger hard-wired |
| GiveDirectly | AI prediction + threshold trigger + proven at scale | Fully *off-chain*: donors can't verify trigger/approval/flow; trust is all in the institution |
| Ukraine/Turkey DAO, Endaoment | Crypto fundraising + on-chain *accounting* | No automated release; spend is manual multisig discretion; "transparency" = seeing a transfer |

**One-line positioning (memorize):**
> Etherisc proved parametric triggers work; GiveDirectly proved AI-predicted release saves
> lives; Ukraine DAO proved crypto relief has volume. CivicShield is the first to assemble all
> three into one closed loop — and to cage the AI behind on-chain policy. **GiveDirectly asks
> you to trust the institution; we let you verify the machine.**

---

## Judge Q&A prep — anticipated questions + crisp answers

**Q: How is this different from Etherisc / parametric insurance?**
Insurance is a private 1:1 contract with a hard-coded trigger. We're a public relief pool
where an AI does open-ended monitoring and *proposes*, and a separate policy machine certifies.
The novelty isn't the trigger — it's the proposal/certification split (PCE).

**Q: Isn't this just GiveDirectly on a blockchain?**
GiveDirectly proved the model works — and that's our evidence, not our competitor. The
difference is verifiability: their trigger, approval, and disbursement are inside one
institution and off-chain. Ours are public and deterministic. They ask for trust; we offer
verification.

**Q: Why does the AI need to exist at all if the chain makes the decision?**
The chain can't read NWS prose or weigh messy real-world signals. The AI's job is exactly the
open-ended part — turning ambiguous hazard data into a structured proposal. The split is the
point: AI handles ambiguity, the chain holds authority. Generation is not permission.

**Q: Why a blockchain instead of GiveDirectly's database?**
Three things a database can't give a donor: (1) verify the release condition without trusting
the operator, (2) donor-directed scoping enforced in policy (funds can only go where donors
funded), (3) composability — relief pools as public infrastructure, not one org's ledger.

**Q: Your riskScore is just three CAP fields summed — isn't that trivial / gameable?**
Deliberately simple *because* it must be deterministic and certifiable — the contribution is
the architecture, not scoring sophistication. The source is a live federal feed
(api.weather.gov), not a value we set. Production aggregates NOAA/USGS-class sources with
dispute windows (see Honest Limitations).

**Q: Hasn't someone done disaster parametric payout at ETHGlobal before?**
Parametric-insurance showcases exist. None combine an AI *proposal* layer, on-chain PCE
certification, any-chain/any-token intake, and ENS-based agent identity + recipient allowlist
into one auditable flow. The combination is the contribution.

**Q: Isn't this just DAOsaster (the SF 2024 finalist)?**
DAOsaster releases funds by *agent vote* — a quorum of 3 LLMs. We take the opposite stance:
three AIs that can be fooled by one sentence aren't safer than one, because the failure is
correlated — a single prompt injection flips every vote, so the quorum is false safety. Their
TEE only proves a manipulated output was faithfully computed, not that it was right. So we let
no AI vote: federal data confirms the disaster and deterministic policy certifies the release.
They coordinate the *response*; we certify the *money* — the layers are complementary, theirs
could run downstream of ours.

**Q: What stops the AI from being the single point of failure (prompt injection)?**
Nothing stops the AI from being fooled — and it doesn't matter. The AI holds no keys. A
malicious proposal still hits the policy machine and is blocked deterministically (Demo Act 3),
with the attack itself logged on-chain. We don't trust the AI's reasoning; we certify its
structured output.

**Q: A 121-org consortium (Direct Cash Aid) tried blockchain and dropped it as redundant — why are you different?**
On the *disbursement* side they're right — a plain database can dedup recipients, and that's
where most aid blockchains live. But the *decision* side is different: an unbypassable release
rule, a public audit trail of every release *and* block, and an AI that can never touch funds —
a database gives donors none of those. We're on the layer they weren't.

**Q: Last mile — how does USDC at `shelter-fund.eth` become aid in someone's hands?**
We stop at "a certified recipient received funds." The last mile — phones, NFC cards, local
cash-out — is exactly what mature networks (Oxfam/UNHCR-style) already do well. We're the
decision layer; they're the disbursement layer; the interface between them is
`verifiedRecipients`.

**Q: Will anyone actually use this?**
The hard market education is already done: UNHCR + Circle ran USDC aid for ~3 years
(award-winning), and WFP moved >$760M on-chain. Adoption-side feasibility is proven — what we
add is the verifiable *decision* layer none of them have.
