// Off-chain rate limiting for the agent: don't spam proposeRelease (gas) even though onlyAgent
// already blocks outsiders. Three guards, all tunable via env. State persists to a JSON file so
// limits survive across cron runs. (On-chain dailyReleaseLimit is the authoritative cap; this just
// keeps the agent itself well-behaved.)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '.agent-state.json')
const COOLDOWN_MS = Number(process.env.PROPOSE_COOLDOWN_MS ?? 600_000) // 10 min between proposals per scope
const MAX_PER_DAY = Number(process.env.PROPOSE_MAX_PER_DAY ?? 5) // max proposals per UTC day

interface State {
	seenEventIds: string[] // dedupe: never propose the same hazard event twice
	lastByScope: Record<string, number> // scope -> last-proposal epoch ms (cooldown)
	day: string // UTC date of the count window
	dayCount: number
}

function load(): State {
	if (!existsSync(STATE_FILE)) return { seenEventIds: [], lastByScope: {}, day: '', dayCount: 0 }
	try {
		return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as State
	} catch {
		return { seenEventIds: [], lastByScope: {}, day: '', dayCount: 0 }
	}
}

function save(s: State): void {
	writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))
}

function today(): string {
	return new Date().toISOString().slice(0, 10)
}

/** Returns whether the agent is allowed to propose now, and why not if blocked. */
export function checkRateLimit(scope: string, eventId: string): { allowed: boolean; reason?: string } {
	const s = load()
	if (s.day !== today()) {
		s.day = today()
		s.dayCount = 0
	}
	if (s.seenEventIds.includes(eventId)) return { allowed: false, reason: 'already proposed this hazard event' }
	if (s.dayCount >= MAX_PER_DAY) return { allowed: false, reason: `daily proposal cap (${MAX_PER_DAY}) reached` }
	const since = Date.now() - (s.lastByScope[scope] ?? 0)
	if (since < COOLDOWN_MS) {
		return { allowed: false, reason: `scope cooldown — ${Math.ceil((COOLDOWN_MS - since) / 60000)} min left` }
	}
	save(s) // persist any day-rollover reset
	return { allowed: true }
}

/** Record a successful proposal so the limits advance. */
export function recordProposal(scope: string, eventId: string): void {
	const s = load()
	if (s.day !== today()) {
		s.day = today()
		s.dayCount = 0
	}
	if (!s.seenEventIds.includes(eventId)) s.seenEventIds.push(eventId)
	s.lastByScope[scope] = Date.now()
	s.dayCount += 1
	save(s)
}
