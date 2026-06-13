import {
	ConsensusAggregationByFields,
	type CronPayload,
	cre,
	type HTTPSendRequester,
	identical,
	median,
	type Runtime,
} from '@chainlink/cre-sdk'
import { z } from 'zod'

export const configSchema = z.object({
	schedule: z.string(),
	url: z.string(), // api.weather.gov active-alerts endpoint
	userAgent: z.string(), // weather.gov requires a User-Agent or returns 403
	riskThreshold: z.number(), // mirrors CivicShieldPool.riskThreshold (75)
})

export type Config = z.infer<typeof configSchema>

// CAP enum -> 0..100. Mirrors cre/src/score.ts (the canonical scoring spec).
const SEVERITY: Record<string, number> = { Extreme: 100, Severe: 80, Moderate: 55, Minor: 30, Unknown: 15 }
const URGENCY: Record<string, number> = { Immediate: 100, Expected: 65, Future: 35, Past: 10, Unknown: 15 }
const CERTAINTY: Record<string, number> = { Observed: 100, Likely: 70, Possible: 40, Unlikely: 15, Unknown: 15 }

const scoreAlert = (severity: string, urgency: string, certainty: string): number =>
	Math.round(
		0.5 * (SEVERITY[severity] ?? 15) + 0.3 * (URGENCY[urgency] ?? 15) + 0.2 * (CERTAINTY[certainty] ?? 15),
	)

interface HazardResult {
	riskScore: number // 0..100, highest active flood alert
	alertId: string // NWS CAP id; eventId = keccak256(alertId) on-chain
	event: string // CAP event name (e.g. "Flood Warning")
}

// Runs on each CRE node: fetch live alerts and compute the top flood risk. Pure + deterministic
// so all nodes converge on the same value under consensus.
export const fetchAndScore = (sendRequester: HTTPSendRequester, config: Config): HazardResult => {
	const response = sendRequester
		.sendRequest({
			method: 'GET',
			url: config.url,
			headers: { 'User-Agent': config.userAgent, Accept: 'application/geo+json' },
		})
		.result()

	if (response.statusCode !== 200) {
		throw new Error(`weather.gov HTTP ${response.statusCode}`)
	}

	const text = Buffer.from(response.body).toString('utf-8')
	const data = JSON.parse(text) as { features: { properties: Record<string, string> }[] }

	let best: HazardResult = { riskScore: 0, alertId: '', event: 'none' }
	for (const f of data.features ?? []) {
		const p = f.properties
		if (!/flood/i.test(p.event ?? '')) continue
		const s = scoreAlert(p.severity, p.urgency, p.certainty)
		if (s > best.riskScore) best = { riskScore: s, alertId: p.id ?? '', event: p.event }
	}
	return best
}

const doHazard = (runtime: Runtime<Config>): string => {
	runtime.log(`Fetching hazard data: ${runtime.config.url}`)

	const http = new cre.capabilities.HTTPClient()
	const result = http
		.sendRequest(
			runtime,
			fetchAndScore,
			ConsensusAggregationByFields<HazardResult>({
				riskScore: median, // numeric: consensus by median
				alertId: identical, // string: all nodes must agree
				event: identical,
			}),
		)(runtime.config)
		.result()

	runtime.log(`Top flood risk: event="${result.event}" riskScore=${result.riskScore} alertId=${result.alertId}`)
	const unlocked = result.riskScore >= runtime.config.riskThreshold
	runtime.log(
		unlocked
			? `riskScore ${result.riskScore} >= threshold ${runtime.config.riskThreshold}: RELEASE UNLOCKED`
			: `riskScore ${result.riskScore} < threshold ${runtime.config.riskThreshold}: no release`,
	)

	// The relayer (relayer/) reads this output and calls CivicShieldPool.submitRiskScore(
	//   keccak256(alertId), riskScore). Live on-chain write from CRE is the next layer.
	return JSON.stringify(result)
}

export const onCronTrigger = (runtime: Runtime<Config>, _payload: CronPayload): string => {
	runtime.log('Running CivicShield hazard scoring workflow')
	return doHazard(runtime)
}

export function initWorkflow(config: Config) {
	const cronTrigger = new cre.capabilities.CronCapability()
	return [cre.handler(cronTrigger.trigger({ schedule: config.schedule }), onCronTrigger)]
}
