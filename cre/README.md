# cre/ — Chainlink CRE hazard workflow

Connects a real-world hazard API (`api.weather.gov`) to CivicShield: pull active CAP alerts →
compute a deterministic `riskScore` (0–100) → deliver it on-chain, where it is the **release
condition** (`riskScore >= riskThreshold` of 75). No hard-coded scores.

## Files
- `src/score.ts` — pure, deterministic scoring: CAP `(severity, urgency, certainty)` → 0–100.
  Flood events only; `topFloodRisk()` picks the highest-risk active flood alert.
- `src/fetchAndScore.ts` — pulls LIVE alerts and runs the score (proof the value is real).

## Run the offchain proof (no CRE toolchain needed)
```bash
cd cre
npm run score -- NY      # or any US state code
```
Prints each active alert's score and the top flood risk. With Node 22+ (`--experimental-strip-types`).

## Scoring
`riskScore = round(0.5·severity + 0.3·urgency + 0.2·certainty)`, each CAP enum mapped to 0–100
(Extreme/Severe/Moderate/Minor, Immediate/Expected/Future/Past, Observed/Likely/Possible/Unlikely).
A Severe+Immediate flood clears 75; Minor/Moderate floods do not.

## On-chain delivery (the CRE workflow + relayer)
- **CRE workflow** (`@chainlink/cre-sdk`): same fetch+score, but using `cre.capabilities.HTTPClient`
  (native `fetch` is unavailable in CRE WASM) and `runtime.report()` to produce a signed report.
  Scaffolded via `cre init` and run through `cre` CLI simulation.
- **Relayer** (`relayer/`): takes the CRE simulation output and calls
  `submitRiskScore(eventId, score)` on `CivicShieldPool`, where `eventId = keccak256(alert.id)`.

Status: scoring core + live-data proof done. CRE-SDK workflow wrapper + relayer are next.
