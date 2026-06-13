// CivicShield hazard scoring — pure, deterministic, NO hard-coded scores.
// Maps an NWS/CAP alert's (severity, urgency, certainty) to a 0–100 riskScore.
// This is the release condition: the policy contract requires riskScore >= riskThreshold (75).

export type Severity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
export type Urgency = "Immediate" | "Expected" | "Future" | "Past" | "Unknown";
export type Certainty = "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";

export interface CapAlert {
  id: string;
  event: string;
  severity: Severity;
  urgency: Urgency;
  certainty: Certainty;
  areaDesc?: string;
}

// CAP enum -> 0..100. Standard NWS ordering; higher = more dangerous/imminent/confident.
const SEVERITY: Record<string, number> = { Extreme: 100, Severe: 80, Moderate: 55, Minor: 30, Unknown: 15 };
const URGENCY: Record<string, number> = { Immediate: 100, Expected: 65, Future: 35, Past: 10, Unknown: 15 };
const CERTAINTY: Record<string, number> = { Observed: 100, Likely: 70, Possible: 40, Unlikely: 15, Unknown: 15 };

// Weights sum to 1. Severity dominates; urgency and certainty modulate.
const W_SEVERITY = 0.5;
const W_URGENCY = 0.3;
const W_CERTAINTY = 0.2;

/** Deterministic 0–100 risk score for a single alert. */
export function scoreAlert(a: Pick<CapAlert, "severity" | "urgency" | "certainty">): number {
  const s = SEVERITY[a.severity] ?? 15;
  const u = URGENCY[a.urgency] ?? 15;
  const c = CERTAINTY[a.certainty] ?? 15;
  return Math.round(W_SEVERITY * s + W_URGENCY * u + W_CERTAINTY * c);
}

/** True if the CAP event is flood-related (the hazard CivicShield funds relief for). */
export function isFloodEvent(event: string): boolean {
  return /flood/i.test(event);
}

/**
 * Given a list of active CAP alerts, pick the highest-risk flood alert and return it with its
 * score. The on-chain eventId is derived from this alert's `id` (keccak256) by the relayer.
 * Returns null if there is no qualifying flood alert.
 */
export function topFloodRisk(alerts: CapAlert[]): { alert: CapAlert; riskScore: number } | null {
  let best: { alert: CapAlert; riskScore: number } | null = null;
  for (const a of alerts) {
    if (!isFloodEvent(a.event)) continue;
    const riskScore = scoreAlert(a);
    if (!best || riskScore > best.riskScore) best = { alert: a, riskScore };
  }
  return best;
}
