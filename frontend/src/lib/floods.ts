// Live nationwide US flood monitoring for the map. Fetches active NWS Flood Warnings directly in
// the browser (api.weather.gov is CORS-open; the browser supplies its own User-Agent) and scores
// each alert with the SAME CAP logic as cre/src/score.ts — so the map shows the real breadth the
// agent monitors, not one hard-coded point.

export interface Flood {
  id: string;
  lng: number;
  lat: number;
  score: number; // 0–100 (same scoring as the on-chain riskScore)
  event: string;
  area: string;
}

export const RELEASE_THRESHOLD = 75; // mirrors the contract's riskThreshold

const SEVERITY: Record<string, number> = { Extreme: 100, Severe: 80, Moderate: 55, Minor: 30, Unknown: 15 };
const URGENCY: Record<string, number> = { Immediate: 100, Expected: 65, Future: 35, Past: 10, Unknown: 15 };
const CERTAINTY: Record<string, number> = { Observed: 100, Likely: 70, Possible: 40, Unlikely: 15, Unknown: 15 };

function scoreAlert(sev: string, urg: string, cer: string): number {
  return Math.round(0.5 * (SEVERITY[sev] ?? 15) + 0.3 * (URGENCY[urg] ?? 15) + 0.2 * (CERTAINTY[cer] ?? 15));
}

// Average of the first ring — good enough to place a marker.
function centroid(geometry: { type: string; coordinates: number[][][] | number[][][][] } | null): [number, number] | null {
  if (!geometry) return null;
  const ring = (geometry.type === "Polygon"
    ? (geometry.coordinates as number[][][])[0]
    : (geometry.coordinates as number[][][][])[0]?.[0]) as number[][] | undefined;
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return [lng / ring.length, lat / ring.length];
}

/**
 * De-clutter for the map: collapse nearby alerts onto a coarse grid (keep the highest-risk one
 * per cell) and cap the count, so we plot a clean, spread set of points instead of one blob.
 * The full list is still used for the "monitoring N" counter.
 */
export function declutter(floods: Flood[], maxPoints = 9, gridDeg = 4): Flood[] {
  const best = new Map<string, Flood>();
  for (const f of floods) {
    const key = `${Math.round(f.lng / gridDeg)},${Math.round(f.lat / gridDeg)}`;
    const cur = best.get(key);
    if (!cur || f.score > cur.score) best.set(key, f);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, maxPoints);
}

/** All active US flood warnings, scored, with a marker coordinate, highest risk first. */
export async function fetchFloods(): Promise<Flood[]> {
  const res = await fetch("https://api.weather.gov/alerts/active?event=Flood%20Warning", {
    headers: { Accept: "application/geo+json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features: { geometry: { type: string; coordinates: number[][][] } | null; properties: Record<string, string> }[];
  };
  const out: Flood[] = [];
  for (const f of data.features ?? []) {
    const c = centroid(f.geometry);
    if (!c) continue;
    const p = f.properties ?? {};
    out.push({
      id: p.id ?? "",
      lng: c[0],
      lat: c[1],
      score: scoreAlert(p.severity, p.urgency, p.certainty),
      event: p.event ?? "Flood Warning",
      area: p.areaDesc ?? "",
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
