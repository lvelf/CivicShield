# agent/ — multi-agent proposer

Off-chain. Turns real hazard signals into on-chain **proposals**. The agent has **no power to move
funds** — it can only `proposeRelease` (`onlyAgent`); the chain's policy decides everything else.

## Flow (tiered escalation)
```
supervisor.ts  cheap, continuous: poll weather.gov for the scope; deterministic pre-filter (score.ts).
   │ only escalates when something is happening
assessor.ts    expensive: OpenAI reads the alert, decides act / amount / purpose. Gates low-severity
   │ noise before it costs gas. Output is clamped to policy (max amount, approved purposes).
propose.ts     if act: proposeRelease(proposal) on-chain with the agent key.
run.ts         orchestrates one pass.
```

## Trust model
The LLM's judgment is **never trusted on-chain**. A wrong/manipulated assessor can only (a) *miss* a
disaster, or (b) propose junk that the policy blocks — **never** cause a wrongful release. The
authoritative `riskScore` + scope come from Chainlink CRE via the relayer, not the agent.

## Run
```bash
cd agent && bun install
PRIVATE_KEY=0x<agent key, = pool.agent> OPENAI_API_KEY=sk-... \
  POOL_ADDRESS=0x... RPC_URL=https://mainnet.base.org AREA=IL npm run run
```
Env: `OPENAI_MODEL` (default `gpt-4o-mini`), `MAX_RELEASE_USDC` (mirror `maxReleasePerEvent`),
`VERIFIED_RECIPIENT` (must be in the pool's allowlist).

Verified live on Base mainnet: supervisor saw an Illinois Severe/Immediate/Observed flood
(deterministic 90) → assessor (OpenAI) returned act=true, 500 USDC, emergency_shelter →
`proposeRelease` created proposal #0, bound to the same eventId the relayer scored.

Future: supervisor → HTTP-trigger CRE; per-scope regionalized agents; on-chain agent identity (ERC-8004).
