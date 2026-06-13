// Orchestrator: supervisor (cheap monitor) -> assessor (OpenAI judgment) -> propose (on-chain).
// One pass; wrap in a loop/cron for continuous operation.
//
//   PRIVATE_KEY=0x... OPENAI_API_KEY=... POOL_ADDRESS=0x... AREA=IL npm run run
//
// The agent only PROPOSES. The on-chain policy (scope, risk, caps, recipient, purpose) decides.
import { monitorScope } from './supervisor.ts'
import { assess } from './assessor.ts'
import { submitProposal, eventIdOf } from './propose.ts'
import { checkRateLimit, recordProposal } from './ratelimit.ts'
import type { DraftProposal } from './types.ts'

const AREA = process.env.AREA ?? 'IL'
const SCOPE = process.env.FUND_SCOPE ?? 'US|flood'
const RECIPIENT = (process.env.VERIFIED_RECIPIENT ?? '0xFeeA88FB58342479fc8D5901f3f67740b39c9FaA') as `0x${string}`

async function main() {
	console.log(`[supervisor] monitoring scope: area=${AREA}, hazard=flood`)
	const candidate = await monitorScope(AREA)
	if (!candidate) {
		console.log('[supervisor] no qualifying flood activity — nothing to escalate. Done.')
		return
	}
	console.log(`[supervisor] anomaly detected: "${candidate.alert.event}" (${candidate.alert.areaDesc ?? ''}) deterministicScore=${candidate.deterministicScore}`)
	console.log('[supervisor] spawning assessor sub-agent...')

	const a = await assess(candidate.alert, candidate.deterministicScore)
	console.log(`[assessor] act=${a.act} amount=${a.amountUSDC} USDC purpose=${a.purpose}`)
	console.log(`[assessor] reasoning: ${a.reasoning}`)
	if (!a.act) {
		console.log('[assessor] below the bar — NOT proposing. Saved relayer/CRE/gas. Done.')
		return
	}

	// Rate limit: don't spam proposeRelease (dedupe events, per-scope cooldown, daily cap).
	const rl = checkRateLimit(SCOPE, candidate.alert.id)
	if (!rl.allowed) {
		console.log(`[ratelimit] skipping propose: ${rl.reason}`)
		return
	}

	const draft: DraftProposal = {
		recipient: RECIPIENT,
		amount: BigInt(a.amountUSDC) * 1_000_000n, // USDC 6 dp
		purpose: a.purpose,
		eventId: eventIdOf(candidate.alert.id),
		reasoning: a.reasoning,
	}
	console.log(`[propose] submitting proposeRelease: ${a.amountUSDC} USDC -> ${RECIPIENT}, eventId=${draft.eventId}`)
	const { hash, id } = await submitProposal(draft)
	recordProposal(SCOPE, candidate.alert.id)
	console.log(`[propose] proposal #${id} created. tx=${hash}`)
	console.log('Next: anyone can executeRelease(id); the policy (scope/risk/caps/recipient/purpose) decides.')
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
