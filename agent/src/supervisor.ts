// Supervisor agent: cheap, continuous monitoring of ONE scope (region + hazard).
// It does the inexpensive deterministic pass (reuses cre/src/score.ts) and only escalates to the
// expensive LLM assessor when something is actually happening — the tiered-escalation pattern.
import { topFloodRisk, type CapAlert } from '../../cre/src/score.ts'

const UA = 'CivicShield-agent/1.0 (ETHGlobal hackathon; nuo.rosemary@gmail.com)'

export interface Candidate {
	alert: CapAlert
	deterministicScore: number // 0..100 from score.ts — the cheap pre-filter
}

async function fetchFloodAlerts(area?: string): Promise<CapAlert[]> {
	// Nationwide when area is empty / "US" / "ALL"; otherwise filter to that state.
	const nationwide = !area || area === 'US' || area === 'ALL'
	const url = nationwide
		? 'https://api.weather.gov/alerts/active?event=Flood%20Warning'
		: `https://api.weather.gov/alerts/active?area=${area}&event=Flood%20Warning`
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
	})
	if (!res.ok) throw new Error(`weather.gov ${res.status}`)
	const data = (await res.json()) as { features: { properties: CapAlert }[] }
	return data.features.map((f) => f.properties)
}

/**
 * Watch the scope. Returns the top flood candidate if the cheap pre-filter clears `minScore`,
 * else null (nothing worth spending an LLM call / gas on). `minScore` below the on-chain
 * threshold lets the assessor still look at borderline events; tune as needed.
 */
export async function monitorScope(area?: string, minScore = 50): Promise<Candidate | null> {
	const top = topFloodRisk(await fetchFloodAlerts(area))
	if (!top || top.riskScore < minScore) return null
	return { alert: top.alert, deterministicScore: top.riskScore }
}
