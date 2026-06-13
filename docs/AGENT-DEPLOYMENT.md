# Running the agent + relayer on a server

The off-chain workers — the multi-agent **proposer** (`agent/`) and the **relayer** (`relayer/`) —
run on any normal server. They are **not security-critical to host** (the chain never trusts the
agent; worst case is a missed disaster or a policy-blocked proposal), so a plain VPS / cron is fine.
Key signing is delegated to a managed wallet (Privy / Dynamic) so the server never holds a raw key.

## Signing backends (per role)

Each worker picks a signer via env. Three roles, three wallets:

| Role | Worker | Signs | `*_SIGNER` | Backed by |
|---|---|---|---|---|
| agent | `agent/` | `proposeRelease` | `AGENT_SIGNER` | **Privy** Agent Wallet |
| relayer | `relayer/` | `submitRiskScore` | `RELAYER_SIGNER` | **Dynamic** Server Wallet |
| approver | (manual) | `approveRelease` | — | **Ledger** hardware wallet |

`*_SIGNER` ∈ `local | privy | dynamic`. `local` uses `PRIVATE_KEY` (dev only). The address each
managed wallet exposes must be wired on-chain once: `setAgent(privyAddr)`, `setRelayer(dynamicAddr)`,
`setApprover(ledgerAddr)`.

## Environment variables

```bash
# --- shared ---
RPC_URL=https://mainnet.base.org
POOL_ADDRESS=0x8df17313f37f5418868f1c3c369bbde4dba9daa6
AREA=IL                      # NWS area to monitor
FUND_SCOPE=US|flood          # must match the pool's fundScope

# --- agent (proposer) ---
AGENT_SIGNER=privy
OPENAI_API_KEY=sk-...        # assessor LLM
OPENAI_MODEL=gpt-4o-mini     # optional
MAX_RELEASE_USDC=10          # clamp; mirror maxReleasePerEvent
VERIFIED_RECIPIENT=0x...     # must be in the pool allowlist
PROPOSE_COOLDOWN_MS=600000   # rate limit: per-scope cooldown (10 min)
PROPOSE_MAX_PER_DAY=5        # rate limit: daily proposal cap

# --- relayer ---
RELAYER_SIGNER=dynamic

# --- Privy (agent wallet) ---  (run scripts/create-privy-wallet.ts to mint the wallet)
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
PRIVY_WALLET_ID=...
PRIVY_WALLET_ADDRESS=0x...

# --- Dynamic (server wallet) ---
DYNAMIC_ENV_ID=...
DYNAMIC_API_TOKEN=...
DYNAMIC_WALLET_ID=...

# --- local fallback (dev only) ---
PRIVATE_KEY=0x...
```

Keep secrets in a server `.env` (or a secret manager). With Privy/Dynamic you do **not** put a
raw key on the server — only the provider API credentials, which can be rotated.

## Run

```bash
# one-shot (good for cron)
cd agent   && bun install && node --experimental-strip-types src/run.ts
cd relayer && bun install && node --experimental-strip-types src/submit.ts
```

Continuous, two options:

**cron (simplest).** e.g. relayer + agent every 5 min:
```cron
*/5 * * * * cd /srv/civicshield/relayer && node --experimental-strip-types src/submit.ts >> /var/log/cs-relayer.log 2>&1
*/5 * * * * cd /srv/civicshield/agent   && node --experimental-strip-types src/run.ts    >> /var/log/cs-agent.log 2>&1
```
The agent's rate limiter (`agent/.agent-state.json`) dedupes events and enforces the cooldown /
daily cap across runs, so frequent cron ticks won't spam `proposeRelease`.

**long-running (PM2 / systemd).** Wrap `run.ts` in a `setInterval` loop, or use PM2:
```bash
pm2 start "node --experimental-strip-types src/run.ts" --name cs-agent --cron "*/5 * * * *"
```

**Free: GitHub Actions cron** (`.github/workflows/civicshield-agent.yml`). No server, no raw key —
the agent signs via Privy, so only Privy API creds + OpenAI key go in GitHub repo secrets.
1. Repo → Settings → Secrets and variables → Actions → add: `OPENAI_API_KEY`, `PRIVY_APP_ID`,
   `PRIVY_APP_SECRET`, `PRIVY_WALLET_ID`, `PRIVY_WALLET_ADDRESS`.
2. The workflow file must be on the **default branch** for the schedule to fire (scheduled
   Actions ignore non-default branches). `workflow_dispatch` gives a manual "Run workflow" button.
3. Rate-limiter state persists via `actions/cache`. The relayer step is included but commented —
   enable it only with a **dedicated** relayer key (never the owner key) in secrets.

## Why a normal server is fine
The agent is untrusted by design: the on-chain policy (scope, risk, caps, recipient, purpose) and
the Ledger review gate are the authority. A compromised agent host can only (a) miss a disaster, or
(b) submit a proposal the policy blocks — never move funds. So no TEE / decentralized compute is
required; managed wallets (Privy/Dynamic) cover key security. (Production hardening — TEE, multi-sig
approver — is in the README's Future Work.)
