"use client";

import { useEffect, useMemo, useState } from "react";

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
const DONORS: { name: string; coord: LngLat }[] = [
  { name: "London", coord: [-0.1, 51.5] },
  { name: "Berlin", coord: [13.4, 52.5] },
  { name: "Tokyo", coord: [139.7, 35.7] },
  { name: "Singapore", coord: [103.8, 1.35] },
  { name: "São Paulo", coord: [-46.6, -23.5] },
  { name: "Mumbai", coord: [72.8, 19] },
  { name: "Sydney", coord: [151.2, -33.9] },
];

export function WorldMap({ executed, blocked }: { executed: number; blocked: number }) {
  const [land, setLand] = useState<string[]>([]);

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

  const [poolX, poolY] = project(POOL);
  const [reliefX, reliefY] = project(RELIEF);
  const released = executed > 0;

  const donorArcs = useMemo(() => DONORS.map((d) => ({ ...d, d: arc(d.coord, POOL), px: project(d.coord) })), []);

  return (
    <svg viewBox="0 0 360 180" className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* ocean */}
      <rect x="0" y="0" width="360" height="180" fill="#f5f5f4" />

      {/* land */}
      {land.map((d, i) => (
        <path key={i} d={d} fill="#e7e5e4" stroke="#d6d3d1" strokeWidth={0.2} />
      ))}

      {/* inbound donor arcs → pool (teal, flowing) */}
      {donorArcs.map((a, i) => (
        <g key={a.name}>
          <path d={a.d} fill="none" stroke="#0d9488" strokeWidth={0.35} className="arc-flow" opacity={0.65} style={{ animationDelay: `${i * 0.15}s` }} />
          <circle cx={a.px[0]} cy={a.px[1]} r={0.8} fill="#0d9488" opacity={0.8} />
        </g>
      ))}

      {/* outbound pool → relief (emerald, brighter once a real release has executed) */}
      <path
        d={arc(POOL, RELIEF)}
        fill="none"
        stroke={released ? "#059669" : "#a8a29e"}
        strokeWidth={released ? 0.7 : 0.4}
        className="arc-flow-out"
        opacity={released ? 0.95 : 0.5}
      />

      {/* relief site — amber hazard pulse */}
      <circle cx={reliefX} cy={reliefY} r={1.4} fill="#f59e0b">
        <animate attributeName="r" values="1.4;5;1.4" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx={reliefX} cy={reliefY} r={1.3} fill="#d97706" />
      <text x={reliefX} y={reliefY + 5} textAnchor="middle" fontSize={3.4} fill="#78716c" className="font-sans">
        flood · shelter-fund.eth
      </text>

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
