// Assessor sub-agent: the expensive judgment, spawned by the supervisor only when there's a
// candidate. Uses an LLM (OpenAI) to read the alert and decide whether to act, how much to
// release, and for what purpose. Its output is ONLY a proposal — the chain, not this LLM, decides.
import OpenAI from 'openai'
import type { Assessment, CapAlert } from './types.ts'

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const APPROVED_PURPOSES = ['emergency_shelter', 'medical_supplies', 'clean_water', 'evacuation_transport']
const MAX_USDC = Number(process.env.MAX_RELEASE_USDC ?? 500) // mirror maxReleasePerEvent

const SYSTEM = `You are the assessor sub-agent for CivicShield, an on-chain flood-relief fund.
You receive ONE active US National Weather Service flood alert. Decide whether it is severe enough
to warrant an emergency relief release, how large (whole USDC, max ${MAX_USDC}), and the purpose
(one of: ${APPROVED_PURPOSES.join(', ')}). Be conservative: only act on genuinely dangerous,
imminent, observed flooding. Minor/advisory-level events should NOT act. Your decision only drafts
a proposal; an on-chain policy makes the final call, so never assume your output releases funds.`

export async function assess(alert: CapAlert, deterministicScore: number): Promise<Assessment> {
	const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

	const completion = await client.chat.completions.create({
		model: MODEL,
		messages: [
			{ role: 'system', content: SYSTEM },
			{
				role: 'user',
				content: `Alert:
  event: ${alert.event}
  severity: ${alert.severity}
  urgency: ${alert.urgency}
  certainty: ${alert.certainty}
  area: ${alert.areaDesc ?? ''}
  deterministic riskScore (0-100): ${deterministicScore}

Respond ONLY as JSON: {"act": boolean, "amountUSDC": number, "purpose": string, "reasoning": string}`,
			},
		],
		response_format: { type: 'json_object' },
		temperature: 0,
	})

	const raw = completion.choices[0]?.message?.content ?? '{}'
	const parsed = JSON.parse(raw) as Partial<Assessment>

	// Clamp/validate so a bad LLM response can't produce an out-of-policy draft.
	const amountUSDC = Math.max(0, Math.min(MAX_USDC, Math.floor(Number(parsed.amountUSDC ?? 0))))
	const purpose = APPROVED_PURPOSES.includes(parsed.purpose ?? '') ? parsed.purpose! : 'emergency_shelter'
	return {
		act: Boolean(parsed.act) && amountUSDC > 0,
		amountUSDC,
		purpose,
		reasoning: String(parsed.reasoning ?? '').slice(0, 500),
	}
}
