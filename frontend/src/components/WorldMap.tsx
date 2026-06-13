"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchFloods, declutter, RELEASE_THRESHOLD, type Flood } from "@/src/lib/floods";
import { fetchDonations, type Donation } from "@/src/lib/donations";
import { fetchRegions } from "@/src/lib/registry";
import { CITIES, cityCoord } from "@/src/lib/cities";

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
const RELIEF: LngLat = [-92, 30]; // US Gulf flood site / shelter-fund recipient
// Illustrative anchors for ANONYMOUS donors (those who didn't declare a region on-chain). Donors
// who self-declare a city via DonorRegistry are placed at their real coordinates instead.
const ANON_ANCHORS: LngLat[] = CITIES.map((c) => c.coord);

export function WorldMap({ executed, blocked }: { executed: number; blocked: number }) {
  const [land, setLand] = useState<string[]>([]);
  const [floods, setFloods] = useState<Flood[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [regions, setRegions] = useState<Record<string, string>>({});

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

  // Live nationwide flood monitoring — real NWS data, NOT hard-coded.
  useEffect(() => {
    let alive = true;
    fetchFloods()
      .then((f) => {
        if (alive) setFloods(f);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Real on-chain donations (Donated events) — one inbound arc per real donation.
  useEffect(() => {
    let alive = true;
    fetchDonations()
      .then((d) => {
        if (alive) setDonations(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Opt-in self-declared donor regions (DonorRegistry) — joined to donations by address below.
  useEffect(() => {
    let alive = true;
    fetchRegions()
      .then((r) => {
        if (alive) setRegions(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const [poolX, poolY] = project(POOL);
  const released = executed > 0;
  // The pool funds relief to the highest-risk active flood (falls back to a US point pre-load).
  const topFlood: LngLat = floods[0] ? [floods[0].lng, floods[0].lat] : RELIEF;
  const [reliefX, reliefY] = project(topFlood);
  const aboveThreshold = floods.filter((f) => f.score >= RELEASE_THRESHOLD).length;
  // Plot only a clean, spread subset (the full list still drives the counter).
  const markers = useMemo(() => declutter(floods), [floods]);
  // The pool radiates relief to the top few key (relief-eligible) flood regions.
  const reliefTargets = useMemo(() => {
    const eligible = markers.filter((f) => f.score >= RELEASE_THRESHOLD).slice(0, 4);
    return eligible.length ? eligible : markers.slice(0, 1);
  }, [markers]);

  // One inbound arc per REAL on-chain donation. If a donor self-declared a region on-chain
  // (DonorRegistry), the arc starts at that REAL city; otherwise the donor is anonymous and the
  // arc starts at an illustrative anchor. Either way the count + amount are real.
  const donorArcs = useMemo(() => {
    return donations.map((don, i) => {
      const region = regions[don.donor.toLowerCase()];
      const real = cityCoord(region);
      const coord = real ?? ANON_ANCHORS[i % ANON_ANCHORS.length];
      const known = !!real;
      return {
        id: i,
        donor: don.donor,
        amount: don.amountUsdc,
        region: known ? region : undefined,
        known,
        d: arc(coord, POOL),
        px: project(coord),
      };
    });
  }, [donations, regions]);

  return (
    <svg viewBox="0 0 360 180" className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* ocean */}
      <rect x="0" y="0" width="360" height="180" fill="#f5f5f4" />

      {/* land */}
      {land.map((d, i) => (
        <path key={i} d={d} fill="#e7e5e4" stroke="#d6d3d1" strokeWidth={0.2} />
      ))}

      {/* inbound donor arcs → pool (teal, flowing). Declared donors are brighter + labelled with
          their self-attested city; anonymous donors are faint with no label. */}
      {donorArcs.map((a, i) => (
        <g key={a.id}>
          <path
            d={a.d}
            fill="none"
            stroke="#0d9488"
            strokeWidth={a.known ? 0.45 : 0.3}
            className="arc-flow"
            opacity={a.known ? 0.8 : 0.4}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
          <circle cx={a.px[0]} cy={a.px[1]} r={a.known ? 1 : 0.7} fill="#0d9488" opacity={a.known ? 0.95 : 0.55} />
          {a.known && (
            <text x={a.px[0]} y={a.px[1] - 1.8} textAnchor="middle" fontSize={2.8} fill="#0f766e" className="font-sans">
              {a.region}
            </text>
          )}
        </g>
      ))}

      {/* Live US flood warnings (real NWS data) — a clean, de-cluttered subset, soft transparency */}
      {markers.map((f) => {
        const [fx, fy] = project([f.lng, f.lat]);
        const color = f.score >= RELEASE_THRESHOLD ? "#dc2626" : f.score >= 50 ? "#f59e0b" : "#a8a29e";
        return <circle key={f.id} cx={fx} cy={fy} r={0.8 + (f.score / 100) * 0.9} fill={color} opacity={0.5} />;
      })}

      {/* outbound pool → top key flood regions (emerald, brighter once a real release executed) */}
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

      {/* the funded flood (highest risk) — amber hazard pulse + label */}
      <circle cx={reliefX} cy={reliefY} r={1.4} fill="#f59e0b">
        <animate attributeName="r" values="1.4;5;1.4" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx={reliefX} cy={reliefY} r={1.3} fill="#d97706" />
      <text x={reliefX} y={reliefY + 5} textAnchor="middle" fontSize={3.4} fill="#78716c" className="font-sans">
        {floods[0] ? `flood · shelter-fund.eth · risk ${floods[0].score}` : "flood · shelter-fund.eth"}
      </text>

      {/* live monitoring counter — real volume */}
      {floods.length > 0 && (
        <>
          <text x={5} y={9} fontSize={4} fill="#44403c" fontWeight={600} className="font-sans">
            Monitoring {floods.length} active US flood warnings
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
  );
}
