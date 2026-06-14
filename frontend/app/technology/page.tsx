"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

type Tone = "input" | "agent" | "core" | "released" | "human" | "blocked" | "log";

type Box = { key: string; title: string; sub: string; back: string; sponsor?: string; detail: string };

const TONE: Record<Tone, { face: string; chip: string; dot: string }> = {
  input: { face: "border-stone-300 bg-white text-stone-900", chip: "text-stone-500", dot: "bg-stone-400" },
  agent: { face: "border-rose-300 bg-rose-50 text-rose-900", chip: "text-rose-600", dot: "bg-rose-400" },
  core: { face: "border-teal-300 bg-teal-50 text-teal-900", chip: "text-teal-700", dot: "bg-teal-400" },
  released: { face: "border-emerald-300 bg-emerald-50 text-emerald-900", chip: "text-emerald-700", dot: "bg-emerald-400" },
  human: { face: "border-indigo-300 bg-indigo-50 text-indigo-900", chip: "text-indigo-700", dot: "bg-indigo-400" },
  blocked: { face: "border-red-400 bg-red-50 text-red-900", chip: "text-red-700", dot: "bg-red-400" },
  log: { face: "border-stone-300 bg-stone-100 text-stone-900", chip: "text-stone-500", dot: "bg-stone-400" },
};

const BOXES: Record<string, Box & { tone: Tone }> = {
  lifi: { key: "lifi", tone: "input", sponsor: "LI.FI Composer", title: "LI.FI Composer", sub: "ETH → USDC → donate()", back: "Money in — one signature", detail: "Donation intake. The frontend asks LI.FI's REST contractCalls endpoint for a quote that swaps the donor's ETH to USDC and calls donate(amount, donor) on the pool — one atomic transaction the wallet signs directly (no executor wiring). Any token, any chain. Proven live on Base mainnet." },
  cre: { key: "cre", tone: "input", sponsor: "Chainlink CRE", title: "Chainlink CRE", sub: "alerts → riskScore", back: "The release condition", detail: "A TypeScript CRE workflow pulls live NWS alerts from api.weather.gov and maps the CAP fields severity · urgency · certainty into a deterministic 0–100 riskScore — no LLM in the consensus path, nodes must agree. A relayer submits the score plus the event's attested scope on-chain via submitRiskScore. No qualifying real-world signal → no funds move." },
  agent: { key: "agent", tone: "agent", sponsor: "OpenAI multi-agent", title: "Multi-agent proposer", sub: "flood-risk-agent.eth", back: "AI proposes — never moves money", detail: "A cheap supervisor monitors the scope with the deterministic score; only on a real anomaly does it spawn an OpenAI assessor that judges severity and drafts a structured proposal (output clamped to policy limits). Its only on-chain power is proposeRelease (onlyAgent). A manipulated agent can only miss a disaster or get blocked — never cause a wrongful release." },
  pool: { key: "pool", tone: "core", sponsor: "CivicShieldPool · Base mainnet", title: "CivicShieldPool", sub: "escrow + policy · the only thing that moves funds", back: "6 deterministic rules · first failure wins", detail: "executeRelease checks six rules in order — 0 fundScope · 1 risk ≥ 75 · 2 amount ≤ cap · 3 daily limit (trace-level) · 4 verified recipient · 5 approved purpose — and reports the first failure. It never reverts on a policy failure: blocks are recorded on-chain (ActionEvaluated) so the attack is auditable. The only outflow is a certified release; there is no admin-drain path. Large amounts route to Ledger first." },
  shelter: { key: "shelter", tone: "released", title: "shelter-fund.eth", sub: "ENS subname · gets USDC", back: "Certified → paid out", detail: "When all six rules pass and the amount is below the review threshold, executeRelease transfers USDC straight to the verified recipient — identified on the allowlist by address, shown to donors by ENS name. Issuing the subname is issuing certification." },
  ledger: { key: "ledger", tone: "human", sponsor: "Ledger", title: "Ledger approval", sub: "human signs large $", back: "Device-certified human gate", detail: "A policy-clean proposal at or above reviewThreshold doesn't auto-pay — it enters PENDING_REVIEW until the approver, a Ledger hardware wallet, signs approveRelease. AI proposes, policy certifies, a human device authorizes the big ones. Demo scale: auto < $5 · Ledger review $5–$10 · blocked > $10." },
  blocked: { key: "blocked", tone: "blocked", title: "Blocked", sub: "attack logged on-chain", back: "Refused — and recorded", detail: "Any rule failure blocks the release and records it via ActionEvaluated — the attack itself becomes public, auditable history. A prompt-injected proposal to an unverified recipient, or a split-payment over the daily limit, dies here. The pool balance is untouched." },
  log: { key: "log", tone: "log", title: "Transparency log", sub: "every outcome (ActionEvaluated)", back: "The chain is the trace store", detail: "Every evaluation — release, Ledger-review, or block — emits ActionEvaluated. The frontend reads these events directly; the chain is the trace store, no database needed. Donors verify what moved, to whom, when, and which rule decided." },
};

type Kind = "in" | "out" | "log";
const EDGES: { from: string; to: string; kind: Kind; color: string; label?: string }[] = [
  { from: "lifi", to: "pool", kind: "in", color: "#a8a29e" },
  { from: "cre", to: "pool", kind: "in", color: "#a8a29e" },
  { from: "agent", to: "pool", kind: "in", color: "#fb7185", label: "proposeRelease()" },
  { from: "pool", to: "shelter", kind: "out", color: "#10b981", label: "release" },
  { from: "pool", to: "ledger", kind: "out", color: "#6366f1", label: "≥ threshold" },
  { from: "pool", to: "blocked", kind: "out", color: "#ef4444", label: "fail" },
  { from: "shelter", to: "log", kind: "log", color: "#10b981" },
  { from: "ledger", to: "log", kind: "log", color: "#6366f1" },
  { from: "blocked", to: "log", kind: "log", color: "#ef4444" },
];

function FlipBox({
  id,
  h,
  selected,
  onSelect,
  innerRef,
}: {
  id: string;
  h: string;
  selected: boolean;
  onSelect: (id: string) => void;
  innerRef?: (el: HTMLButtonElement | null) => void;
}) {
  const b = BOXES[id];
  const t = TONE[b.tone];
  return (
    <button
      ref={innerRef}
      data-box={id}
      onClick={() => onSelect(id)}
      className={`group relative isolate z-0 block w-full cursor-pointer rounded-xl [perspective:1000px] hover:z-20 focus:outline-none ${h} ${
        selected ? "ring-2 ring-stone-400 ring-offset-2" : ""
      }`}
    >
      <div className="relative h-full w-full transition-transform duration-300 ease-out [transform-style:preserve-3d] [-webkit-transform-style:preserve-3d] [will-change:transform] group-hover:[transform:rotateY(180deg)]">
        <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border px-4 text-center shadow-sm [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${t.face}`}>
          <div className="font-serif text-base font-semibold leading-tight sm:text-lg">{b.title}</div>
          <div className={`mt-1 text-[11px] sm:text-xs ${t.chip}`}>{b.sub}</div>
        </div>
        <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border px-4 text-center shadow-md [transform:rotateY(180deg)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${t.face}`}>
          <div className="text-xs font-medium sm:text-sm">{b.back}</div>
          <div className={`mt-1.5 text-[10px] uppercase tracking-wide ${t.chip}`}>click for detail →</div>
        </div>
      </div>
    </button>
  );
}

type Line = { d: string; color: string; label?: string; lx: number; ly: number };

export default function TechnologyPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ? BOXES[selected] : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [lines, setLines] = useState<Line[]>([]);

  useLayoutEffect(() => {
    function measure() {
      const c = containerRef.current;
      if (!c) return;
      const cr = c.getBoundingClientRect();
      const rect = (id: string) => {
        const el = refs.current[id];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { cx: r.left + r.width / 2 - cr.left, top: r.top - cr.top, bottom: r.bottom - cr.top };
      };
      const out: Line[] = [];
      for (const e of EDGES) {
        const s = rect(e.from);
        const d = rect(e.to);
        if (!s || !d) continue;
        let sx: number, sy: number, ex: number, ey: number;
        if (e.kind === "in") { sx = s.cx; sy = s.bottom; ex = s.cx; ey = d.top; }
        else if (e.kind === "out") { sx = d.cx; sy = s.bottom; ex = d.cx; ey = d.top; }
        else { sx = s.cx; sy = s.bottom; ex = d.cx; ey = d.top; }
        out.push({ d: `M${sx},${sy} L${ex},${ey}`, color: e.color, label: e.label, lx: (sx + ex) / 2, ly: (sy + ey) / 2 });
      }
      setSize({ w: cr.width, h: cr.height });
      setLines(out);
    }
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => measure());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const setRef = useCallback((el: HTMLButtonElement | null) => {
    if (el?.dataset.box) refs.current[el.dataset.box] = el;
  }, []);

  return (
    <main className="min-h-screen bg-[#fafaf9]">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-10">
        <p className="font-sans text-sm uppercase tracking-[0.2em] text-stone-400">How it&apos;s built</p>
        <h1 className="mt-2 max-w-3xl font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          The architecture, live.
        </h1>

        {/* two-column explorer: diagram left, detail panel right */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* diagram */}
          <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 lg:col-span-7">
            <div ref={containerRef} className="relative">
              <svg
                className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                <defs>
                  <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
                  </marker>
                </defs>
                {lines.map((l, i) => (
                  <g key={i}>
                    <path d={l.d} fill="none" stroke={l.color} strokeWidth={1.4} markerEnd="url(#ah)" opacity={0.85} />
                    {l.label && (
                      <text x={l.lx + 6} y={l.ly} fill={l.color} fontSize={10} dominantBaseline="middle" className="font-sans">
                        {l.label}
                      </text>
                    )}
                  </g>
                ))}
              </svg>

              <div className="relative z-10">
                <div className="grid grid-cols-3 gap-4">
                  <FlipBox id="lifi" h="h-20" selected={selected === "lifi"} onSelect={setSelected} innerRef={setRef} />
                  <FlipBox id="cre" h="h-20" selected={selected === "cre"} onSelect={setSelected} innerRef={setRef} />
                  <FlipBox id="agent" h="h-20" selected={selected === "agent"} onSelect={setSelected} innerRef={setRef} />
                </div>
                <div className="h-10" />
                <FlipBox id="pool" h="h-28" selected={selected === "pool"} onSelect={setSelected} innerRef={setRef} />
                <div className="h-10" />
                <div className="grid grid-cols-3 gap-4">
                  <FlipBox id="shelter" h="h-20" selected={selected === "shelter"} onSelect={setSelected} innerRef={setRef} />
                  <FlipBox id="ledger" h="h-20" selected={selected === "ledger"} onSelect={setSelected} innerRef={setRef} />
                  <FlipBox id="blocked" h="h-20" selected={selected === "blocked"} onSelect={setSelected} innerRef={setRef} />
                </div>
                <div className="h-10" />
                <div className="mx-auto max-w-sm">
                  <FlipBox id="log" h="h-16" selected={selected === "log"} onSelect={setSelected} innerRef={setRef} />
                </div>
              </div>
            </div>

            <p className="mt-6 text-center font-serif text-sm italic text-stone-400">
              Generation is not permission: the agent can propose a release, but only the
              CivicShieldPool can certify and execute it.
            </p>
          </div>

          {/* detail panel */}
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              {sel ? (
                <div className={`rounded-3xl border bg-white p-8 ${TONE[sel.tone].face.replace(/bg-\S+/, "bg-white")}`}>
                  {sel.sponsor && (
                    <div className={`text-xs font-semibold uppercase tracking-wide ${TONE[sel.tone].chip}`}>{sel.sponsor}</div>
                  )}
                  <h2 className="mt-1 font-serif text-3xl font-semibold text-stone-900">{sel.title}</h2>
                  <div className="mt-1 text-sm text-stone-500">{sel.sub}</div>
                  <p className="mt-6 text-[15px] leading-relaxed text-stone-700">{sel.detail}</p>
                  <button
                    onClick={() => setSelected(null)}
                    className="mt-8 text-xs font-medium uppercase tracking-wide text-stone-400 hover:text-stone-700"
                  >
                    ← back to overview
                  </button>
                </div>
              ) : (
                <div className="rounded-3xl border border-stone-200 bg-white p-8">
                  <h2 className="font-serif text-2xl font-semibold text-stone-900">Five parts, one principle</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
                    Money in, a real hazard signal, an AI that can only propose, a deterministic policy
                    that decides, and a human device for the big ones. Click any block to read exactly
                    what it does.
                  </p>
                  <div className="mt-8 space-y-2.5">
                    {([
                      ["agent", "AI proposes only"],
                      ["pool", "On-chain trust core"],
                      ["ledger", "Human gate (Ledger)"],
                      ["shelter", "Released"],
                      ["blocked", "Blocked"],
                    ] as const).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setSelected(k)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-stone-600 hover:bg-stone-50"
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${TONE[BOXES[k].tone].dot}`} />
                        {label}
                        <span className="ml-auto text-stone-300">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
