// Live nationwide multi-hazard monitoring for the map. Every point is REAL, fetched in the browser
// (all sources are CORS-open), NOT hard-coded:
//   flood / wildfire / hurricane  -> NWS api.weather.gov active alerts (just a different event= set)
//   earthquake                    -> USGS earthquake GeoJSON feed (filtered to a US bounding box)
// Each alert is scored 0–100 so the map mirrors the same risk language the on-chain pool uses.

export type HazardType = "flood" | "wildfire" | "hurricane" | "earthquake";

export interface Hazard {
  id: string;
  type: HazardType;
  lng: number;
  lat: number;
  score: number; // 0–100 (same scale as the on-chain riskScore)
  event: string;
  area: string;
}

export const RELEASE_THRESHOLD = 75; // mirrors the contract's riskThreshold (flood is the funded scope)

// Display order + label + marker color per hazard. Color is by TYPE so the multi-hazard map reads
// clearly; marker size still scales with the per-event score.
export const HAZARD_META: Record<HazardType, { label: string; color: string }> = {
  flood: { label: "Flood", color: "#2563eb" },
  wildfire: { label: "Wildfire", color: "#ea580c" },
  hurricane: { label: "Hurricane", color: "#7c3aed" },
  earthquake: { label: "Earthquake", color: "#b45309" },
};

export const HAZARD_ORDER: HazardType[] = ["flood", "wildfire", "hurricane", "earthquake"];

// NWS alert event names that belong to each weather-driven hazard.
const NWS_EVENTS: Record<Exclude<HazardType, "earthquake">, string[]> = {
  flood: ["Flood Warning"],
  wildfire: ["Red Flag Warning", "Fire Warning"],
  hurricane: ["Hurricane Warning", "Tropical Storm Warning", "Hurricane Watch"],
};

// CAP severity/urgency/certainty -> 0–100, identical weights to cre/src/score.ts.
const SEVERITY: Record<string, number> = { Extreme: 100, Severe: 80, Moderate: 55, Minor: 30, Unknown: 15 };
const URGENCY: Record<string, number> = { Immediate: 100, Expected: 65, Future: 35, Past: 10, Unknown: 15 };
const CERTAINTY: Record<string, number> = { Observed: 100, Likely: 70, Possible: 40, Unlikely: 15, Unknown: 15 };

function scoreAlert(sev: string, urg: string, cer: string): number {
  return Math.round(0.5 * (SEVERITY[sev] ?? 15) + 0.3 * (URGENCY[urg] ?? 15) + 0.2 * (CERTAINTY[cer] ?? 15));
}

// Magnitude -> 0–100. M2.5≈32, M5≈65, M6≈78, M7≈91, M7.7+→100.
function scoreQuake(mag: number): number {
  return Math.round(Math.min(100, Math.max(0, mag * 13)));
}

// Average of the first polygon ring — good enough to place a marker.
function centroid(
  geometry: { type: string; coordinates: number[][][] | number[][][][] } | null,
): [number, number] | null {
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

async function fetchNws(type: Exclude<HazardType, "earthquake">): Promise<Hazard[]> {
  const out: Hazard[] = [];
  const seen = new Set<string>();
  // One targeted request per event name (server-side filtered, small payloads), then merge.
  await Promise.all(
    NWS_EVENTS[type].map(async (eventName) => {
      const url = `https://api.weather.gov/alerts/active?event=${encodeURIComponent(eventName)}`;
      const res = await fetch(url, { headers: { Accept: "application/geo+json" } }).catch(() => null);
      if (!res || !res.ok) return;
      const data = (await res.json()) as {
        features: { geometry: { type: string; coordinates: number[][][] } | null; properties: Record<string, string> }[];
      };
      for (const f of data.features ?? []) {
        const c = centroid(f.geometry);
        if (!c) continue;
        const p = f.properties ?? {};
        const id = p.id ?? `${eventName}-${c[0]},${c[1]}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          type,
          lng: c[0],
          lat: c[1],
          score: scoreAlert(p.severity, p.urgency, p.certainty),
          event: p.event ?? eventName,
          area: p.areaDesc ?? "",
        });
      }
    }),
  );
  return out;
}

// Rough US (+ AK/HI) bounding box — keeps the earthquake layer consistent with the fund's US scope.
function inUS(lng: number, lat: number): boolean {
  return lat >= 18 && lat <= 72 && lng >= -170 && lng <= -64;
}

async function fetchQuakes(): Promise<Hazard[]> {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return [];
  const data = (await res.json()) as {
    features: { id: string; geometry: { coordinates: number[] } | null; properties: { mag: number; place: string } }[];
  };
  const out: Hazard[] = [];
  for (const f of data.features ?? []) {
    const c = f.geometry?.coordinates;
    if (!c) continue;
    const [lng, lat] = c;
    if (!inUS(lng, lat)) continue;
    out.push({
      id: f.id,
      type: "earthquake",
      lng,
      lat,
      score: scoreQuake(f.properties?.mag ?? 0),
      event: `M${f.properties?.mag ?? "?"} earthquake`,
      area: f.properties?.place ?? "",
    });
  }
  return out;
}

/** Fetch one hazard layer's live points, highest risk first. */
export async function fetchHazard(type: HazardType): Promise<Hazard[]> {
  const list = type === "earthquake" ? await fetchQuakes() : await fetchNws(type);
  return list.sort((a, b) => b.score - a.score);
}

/**
 * De-clutter for the map: collapse nearby points onto a coarse grid (keep the highest-risk one per
 * cell) and cap the count, so the map stays clean instead of one blob. The full list still drives
 * the "monitoring N" counter. Operates across whatever hazard mix is passed in.
 */
export function declutter(items: Hazard[], maxPoints = 12, gridDeg = 4): Hazard[] {
  const best = new Map<string, Hazard>();
  for (const f of items) {
    const key = `${f.type}:${Math.round(f.lng / gridDeg)},${Math.round(f.lat / gridDeg)}`;
    const cur = best.get(key);
    if (!cur || f.score > cur.score) best.set(key, f);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, maxPoints);
}
