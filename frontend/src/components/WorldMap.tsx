"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchHazard,
  declutter,
  RELEASE_THRESHOLD,
  HAZARD_ORDER,
  HAZARD_META,
  type Hazard,
  type HazardType,
} from "@/src/lib/hazards";
import { fetchDonations, type Donation } from "@/src/lib/donations";
import { fetchRegions, REGISTRY_ADDRESS } from "@/src/lib/registry";
import { POOL_ADDRESS } from "@/src/lib/contract";
import { CITIES, cityCoord } from "@/src/lib/cities";
import { useCached } from "@/src/lib/useCached";

// Equirectangular projection into a 360×180 viewBox (1 unit = 1°).
type LngLat = [number, number];
function project([lng, lat]: LngLat): [number, number] {
  return [lng + 180, 90 - lat];
}

// A fund-flow arc that bows northward, for the flowing-dash animation.
function arc(from: LngLat, to: LngLat): string {
  const [ax, ay] = project(from);
  const [bx, by] = project(to);
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dist = Math.hypot(bx - ax, by - ay);
  const cx = mx;
  const cy = my - dist * 0.25; // lift the control point up
  return `M${ax},${ay} Q${cx},${cy} ${bx},${by}`;
}

type Geometry =
  | { type: "Polygon"; coordinates: LngLat[][] }
  | { type: "MultiPolygon"; coordinates: LngLat[][][] };

function geometryToPath(geom: Geometry): string {
  const rings: LngLat[][] = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  let d = "";
  for (const ring of rings) {
    ring.forEach((pt, i) => {
      const [x, y] = project(pt);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    d += "Z";
  }
  return d;
}

// --- the scene: where relief moves ---
const POOL: LngLat = [-74, 40.7]; // CivicShieldPool (Base) — anchored at NYC for the demo
const RELIEF: LngLat = [-92, 30]; // fallback US point before any hazard data loads
// Illustrative anchors for ANONYMOUS donors (those who didn't declare a region on-chain). Donors
// who self-declare a city via DonorRegistry are placed at their real coordinates instead.
const ANON_ANCHORS: LngLat[] = CITIES.map((c) => c.coord);

// Stable fallbacks + cache keys for the cached donor reads. Keys are namespaced by contract address
// so a redeploy (new POOL/REGISTRY) invalidates stale cached donations rather than showing them.
const EMPTY_DONATIONS: Donation[] = [];
const EMPTY_REGIONS: Record<string, string> = {};
const DONATIONS_KEY = `donations:${POOL_ADDRESS}`;
const REGIONS_KEY = `regions:${REGISTRY_ADDRESS}`;

export function WorldMap({
  executed,
  blocked,
  initialHazards,
}: {
  executed: number;
  blocked: number;
  initialHazards?: HazardType[];
}) {
  const [land, setLand] = useState<string[]>([]);
  const [byType, setByType] = useState<Record<HazardType, Hazard[]>>({
    flood: [],
    wildfire: [],
    hurricane: [],
    earthquake: [],
  });
  const [active, setActive] = useState<Set<HazardType>>(
    () => new Set(initialHazards && initialHazards.length ? initialHazards : HAZARD_ORDER),
  );
  // Stale-while-revalidate: paint the last-known donors/regions from localStorage instantly, then
  // refresh from chain in the background. Kills the cold getLogs wait that delayed donors each load.
  const donations = useCached<Donation[]>(DONATIONS_KEY, fetchDonations, EMPTY_DONATIONS);
  const regions = useCached<Record<string, string>>(REGIONS_KEY, fetchRegions, EMPTY_REGIONS);

  useEffect(() => {
    let alive = true;
    fetch("/land.geojson")
      .then((r) => r.json())
      .then((geo: { features: { geometry: Geometry }[] }) => {
        if (alive) setLand(geo.features.map((f) => geometryToPath(f.geometry)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Live nationwide multi-hazard monitoring — real NWS + USGS data, NOT hard-coded. Fetch every
  // layer once on mount; toggling a checkbox just filters what's already loaded (no refetch).
  useEffect(() => {
    let alive = true;
    HAZARD_ORDER.forEach((type) => {
      fetchHazard(type)
        .then((list) => {
          if (alive) setByType((prev) => ({ ...prev, [type]: list }));
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, []);

  function toggle(type: HazardType) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const [poolX, poolY] = project(POOL);
  const released = executed > 0;

  // All points across the currently-selected hazard layers, highest risk first.
  const merged = useMemo(
    () => HAZARD_ORDER.filter((t) => active.has(t)).flatMap((t) => byType[t]).sort((a, b) => b.score - a.score),
    [byType, active],
  );
  const aboveThreshold = merged.filter((f) => f.score >= RELEASE_THRESHOLD).length;
  // Plot only a clean, spread subset (the full list still drives the counter).
  const markers = useMemo(() => declutter(merged), [merged]);

  // The pool radiates relief to the top few key (relief-eligible) regions among selected hazards.
  const reliefTargets = useMemo(() => {
    const eligible = markers.filter((f) => f.score >= RELEASE_THRESHOLD).slice(0, 4);
    return eligible.length ? eligible : markers.slice(0, 1);
  }, [markers]);

  // The single highest-risk point gets the pulsing hazard ring + label.
  const top = merged[0];
  const topCoord: LngLat = top ? [top.lng, top.lat] : RELIEF;
  const [reliefX, reliefY] = project(topCoord);

  // One inbound arc per REAL on-chain donation. Declared donors (DonorRegistry) start at their REAL
  // city; anonymous donors at an illustrative anchor. Count + amount are always real.
  const donorArcs = useMemo(() => {
    return donations.map((don, i) => {
      const region = regions[don.donor.toLowerCase()];
      const real = cityCoord(region);
      const coord = real ?? ANON_ANCHORS[i % ANON_ANCHORS.length];
      const known = !!real;
      return { id: i, donor: don.donor, amount: don.amountUsdc, region: known ? region : undefined, known, d: arc(coord, POOL), px: project(coord) };
    });
  }, [donations, regions]);

  return (
    <div>
      {/* hazard toggles — double as the color legend, with live per-layer counts */}
      <div className="mb-4 flex flex-wrap gap-2">
        {HAZARD_ORDER.map((type) => {
          const on = active.has(type);
          const meta = HAZARD_META[type];
          const count = byType[type].length;
          return (
            <button
              key={type}
              onClick={() => toggle(type)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                on ? "border-stone-300 bg-white text-stone-800" : "border-stone-200 bg-stone-50 text-stone-400"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: on ? meta.color : "#d6d3d1" }}
              />
              {meta.label}
              <span className={on ? "text-stone-400" : "text-stone-300"}>{count}</span>
            </button>
          );
        })}
      </div>

      <svg viewBox="0 0 360 180" className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* ocean */}
        <rect x="0" y="0" width="360" height="180" fill="#f5f5f4" />

        {/* land */}
        {land.map((d, i) => (
          <path key={i} d={d} fill="#e7e5e4" stroke="#d6d3d1" strokeWidth={0.2} />
        ))}

        {/* inbound donor arcs → pool (teal, flowing). Declared donors are brighter + labelled. */}
        {donorArcs.map((a, i) => (
          <g key={a.id}>
            <path d={a.d} fill="none" stroke="#0d9488" strokeWidth={a.known ? 0.45 : 0.3} className="arc-flow" opacity={a.known ? 0.8 : 0.4} style={{ animationDelay: `${i * 0.15}s` }} />
            <circle cx={a.px[0]} cy={a.px[1]} r={a.known ? 1 : 0.7} fill="#0d9488" opacity={a.known ? 0.95 : 0.55} />
            {a.known && (
              <text x={a.px[0]} y={a.px[1] - 1.8} textAnchor="middle" fontSize={2.8} fill="#0f766e" className="font-sans">
                {a.region}
              </text>
            )}
          </g>
        ))}

        {/* Live hazard signals (real NWS + USGS data) — de-cluttered subset, colored by hazard type */}
        {markers.map((f) => {
          const [fx, fy] = project([f.lng, f.lat]);
          return <circle key={f.id} cx={fx} cy={fy} r={0.8 + (f.score / 100) * 0.9} fill={HAZARD_META[f.type].color} opacity={0.55} />;
        })}

        {/* outbound pool → top key regions (emerald, brighter once a real release executed) */}
        {reliefTargets.map((f, i) => (
          <path
            key={f.id}
            d={arc(POOL, [f.lng, f.lat])}
            fill="none"
            stroke={released ? "#059669" : "#a8a29e"}
            strokeWidth={i === 0 ? (released ? 0.7 : 0.45) : 0.35}
            className="arc-flow-out"
            opacity={i === 0 ? (released ? 0.95 : 0.6) : 0.45}
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}

        {/* the top hazard — pulsing ring + label */}
        <circle cx={reliefX} cy={reliefY} r={1.4} fill={top ? HAZARD_META[top.type].color : "#f59e0b"} opacity={0.5}>
          <animate attributeName="r" values="1.4;5;1.4" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx={reliefX} cy={reliefY} r={1.3} fill={top ? HAZARD_META[top.type].color : "#d97706"} />
        <text x={reliefX} y={reliefY + 5} textAnchor="middle" fontSize={3.4} fill="#78716c" className="font-sans">
          {top
            ? top.type === "flood"
              ? `flood · shelter-fund.eth · risk ${top.score}`
              : `${HAZARD_META[top.type].label.toLowerCase()} · risk ${top.score}`
            : "flood · shelter-fund.eth"}
        </text>

        {/* live monitoring counter — real volume across selected hazards */}
        {merged.length > 0 && (
          <>
            <text x={5} y={9} fontSize={4} fill="#44403c" fontWeight={600} className="font-sans">
              Monitoring {merged.length} active US hazard signals
            </text>
            <text x={5} y={14.5} fontSize={3.3} fill="#dc2626" className="font-sans">
              {aboveThreshold} ≥ riskThreshold {RELEASE_THRESHOLD} — relief-eligible
            </text>
          </>
        )}

        {/* pool node — dark, with a red ring if anything was blocked */}
        {blocked > 0 && (
          <circle cx={poolX} cy={poolY} r={2.2} fill="none" stroke="#e11d48" strokeWidth={0.5}>
            <animate attributeName="r" values="2.2;4.5;2.2" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite" />
          </circle>
        )}
        <circle cx={poolX} cy={poolY} r={1.8} fill="#1c1917" />
        <circle cx={poolX} cy={poolY} r={0.9} fill="#14b8a6" />
        <text x={poolX} y={poolY - 4} textAnchor="middle" fontSize={3.6} fill="#1c1917" fontWeight={600} className="font-sans">
          CivicShieldPool
        </text>
      </svg>
    </div>
  );
}
