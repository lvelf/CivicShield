"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import Reveal from "@/src/components/Reveal";
import { useCivicShield } from "@/src/lib/useCivicShield";
import { formatUSDC, shortHex } from "@/src/components/TransparencyLog";
import { POOL_ADDRESS, IS_LIVE } from "@/src/lib/contract";

const SCAN = "https://basescan.org";
const SAMPLE_DONATION_TX = "0x8d823db7d100ee5ee35df2fbe176bd3cac17f89910503038d74c84d4ffa7b711";

/* ─── step visuals (the left panel, one per numbered tab) ─────────────────── */

function Pill({ children, tone = "stone" }: { children: ReactNode; tone?: string }) {
  const map: Record<string, string> = {
    stone: "border-stone-200 bg-white text-stone-700",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return <span className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${map[tone]}`}>{children}</span>;
}
const Arrow = () => <span className="text-stone-300">→</span>;

// 01 — LI.FI Composer: any token in, one signature out
function TokenFlowVisual() {
  return (
    <div className="w-full max-w-[440px]">
      <div className="flex items-center justify-center gap-3">
        <Pill>Any token</Pill>
        <Arrow />
        <Pill tone="teal">USDC</Pill>
        <Arrow />
        <Pill tone="emerald">Pool</Pill>
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-stone-400">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        LI.FI Composer · swap + deposit in one signature
      </div>
    </div>
  );
}

// 02 — Chainlink CRE: a verified hazard, scored
function RiskVisual() {
  const score = 82;
  const threshold = 75;
  return (
    <div className="w-full max-w-[440px]">
      <div className="text-center font-mono text-xs text-stone-400">event NWS-FL-0612 · flood</div>
      <div className="relative mt-4 h-3 rounded-full bg-stone-200">
        <div className="absolute inset-y-0 left-0 rounded-full bg-teal-500" style={{ width: `${score}%` }} />
        <div className="absolute inset-y-[-5px] w-px bg-rose-400" style={{ left: `${threshold}%` }} />
        <span className="absolute top-3 -translate-x-1/2 text-[10px] text-rose-500" style={{ left: `${threshold}%` }}>
          threshold {threshold}
        </span>
      </div>
      <div className="mt-7 text-center">
        <span className="font-serif text-3xl font-semibold text-stone-900">riskScore {score}</span>
        <span className="ml-2 text-sm text-emerald-600">≥ {threshold} ✓</span>
      </div>
    </div>
  );
}

// 03 — a multi-agent swarm proposes, across the trust boundary
function ProposeVisual() {
  return (
    <div className="w-full max-w-[460px]">
      {/* the external feed the supervisor watches */}
      <div className="flex items-center justify-center gap-2 text-xs">
        <span className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-mono text-stone-600">disaster API</span>
        <span className="text-teal-600">⟳ live</span>
      </div>
      <div className="mx-auto my-1.5 h-3 w-px bg-stone-300" />

      {/* the untrusted agent swarm */}
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3">
        <div className="flex items-center gap-2 text-[11px] font-medium text-stone-500">
          <span className="h-2 w-2 rounded-full bg-stone-400" /> multi-agent system · untrusted
        </div>
        <div className="mt-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-center text-xs font-medium text-stone-800">
          Supervisor agent <span className="font-normal text-stone-400">· watches the API</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {["flood", "hurricane", "earthquake"].map((w) => (
            <span key={w} className="rounded-md border border-stone-200 bg-white px-1 py-1 text-center text-[11px] text-stone-600">
              {w}
            </span>
          ))}
        </div>
        <div className="mt-2 text-center text-[11px] text-stone-500">
          Assessor → <span className="text-teal-700">Chainlink CRE riskScore</span>
        </div>
      </div>

      {/* the trust boundary they hand the proposal across */}
      <div className="my-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-teal-400" />
        <span className="text-[10px] uppercase tracking-wider text-stone-400">proposes · trust boundary</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-teal-400" />
      </div>

      <div className="flex items-center justify-center gap-2 text-xs font-medium text-teal-700">
        <span className="h-2 w-2 rounded-full bg-teal-500" /> on-chain · the chain certifies
      </div>
    </div>
  );
}

const GATES = [
  "Event scope in mandate",
  "Risk ≥ threshold (75)",
  "Amount ≤ per-event cap",
  "Within daily limit",
  "Recipient verified",
  "Purpose approved",
];

// 04 — the six policy rules, certifying in sequence (gentle loop)
function GatesVisual() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s >= GATES.length + 1 ? 0 : s + 1)), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="w-full max-w-[440px] space-y-1.5">
      {GATES.map((g, i) => {
        const state = i < step ? "pass" : i === step ? "run" : "idle";
        return (
          <div
            key={g}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              state === "pass" ? "bg-emerald-50" : "bg-stone-50"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white transition-colors ${
                state === "pass" ? "bg-emerald-500" : state === "run" ? "animate-pulse bg-teal-500" : "bg-stone-200"
              }`}
            >
              {state === "pass" ? "✓" : ""}
            </span>
            <span className="text-stone-700">
              Rule {i + 1}: {g}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// 05 — large release escalates to a hardware wallet
function LedgerVisual() {
  return (
    <div className="w-full max-w-[400px] text-center">
      <Pill>4,500 USDC</Pill>
      <div className="my-3 text-stone-300">↓ above auto-release cap</div>
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="mx-auto flex h-12 w-20 items-center justify-center rounded-md border-2 border-indigo-300 bg-white">
          <span className="text-[10px] font-medium text-indigo-500">LEDGER</span>
        </div>
        <p className="mt-3 text-sm font-medium text-indigo-700">Awaiting hardware signature</p>
        <p className="mt-1 text-xs text-indigo-500/80">Policy-clean, but a human device must sign.</p>
      </div>
    </div>
  );
}

/* ─── the steps ───────────────────────────────────────────────────────────── */

const STEPS: { n: string; title: string; desc: string; visual: ReactNode }[] = [
  {
    n: "01",
    title: "Any token, one signature",
    desc: "A donor pays ETH on Base; LI.FI Composer swaps to USDC and deposits into the pool in a single signed call.",
    visual: <TokenFlowVisual />,
  },
  {
    n: "02",
    title: "A verified hazard, not an opinion",
    desc: "Chainlink CRE turns a real disaster alert into an on-chain riskScore. Nothing releases unless it clears the threshold.",
    visual: <RiskVisual />,
  },
  {
    n: "03",
    title: "A multi-agent system",
    desc: "A supervisor agent watches the disaster API in real time and dispatches worker agents — one per hazard — that do the assessment work for it. It scores severity through Chainlink CRE and drafts a release. The system can only propose; the chain certifies.",
    visual: <ProposeVisual />,
  },
  {
    n: "04",
    title: "The chain certifies — six rules",
    desc: "An on-chain machine checks six deterministic rules in order: scope, risk, cap, daily limit, recipient, purpose. All pass, or it blocks.",
    visual: <GatesVisual />,
  },
  {
    n: "05",
    title: "Big releases need a human device",
    desc: "A policy-clean release at or above the cap can't move on its own — it waits for a Ledger hardware wallet to sign.",
    visual: <LedgerVisual />,
  },
];

/* ─── page ────────────────────────────────────────────────────────────────── */

export default function Product() {
  const { poolBalance, executed, blocked } = useCivicShield();
  const [active, setActive] = useState(0);

  // gentle auto-advance; resets whenever `active` changes (incl. manual clicks)
  useEffect(() => {
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), 5200);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <main className="min-h-screen bg-[#fafaf9]">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        {/* header */}
        <Reveal as="header">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-teal-700">Product</p>
          <h1 className="mt-3 font-serif text-4xl font-normal leading-[1.08] tracking-tight text-stone-900 sm:text-6xl">
            Generation is not permission.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
            From a donor&apos;s first token to a certified release, every step is deterministic and on-chain.
            The AI proposes — the chain decides.
          </p>
        </Reveal>

        {/* the horizontal showcase */}
        <Reveal delay={80}>
          <div className="mt-14 grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            {/* left: cross-fading visual */}
            <div className="relative grid h-[300px] place-items-center overflow-hidden rounded-[28px] border border-stone-200 bg-white p-8 sm:h-[340px]">
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  className={`col-start-1 row-start-1 w-full transition-all duration-500 ${
                    i === active ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-2 opacity-0"
                  }`}
                >
                  <div className="flex justify-center">{s.visual}</div>
                </div>
              ))}
            </div>

            {/* right: numbered tab list */}
            <div>
              <h2 className="font-serif text-[clamp(24px,3vw,36px)] font-normal leading-[1.12] tracking-tight text-stone-900">
                The product, end to end.
              </h2>
              <ul className="mt-7">
                {STEPS.map((s, i) => {
                  const on = i === active;
                  return (
                    <li key={s.n}>
                      <button
                        onClick={() => setActive(i)}
                        className={`flex w-full items-start gap-4 border-l-2 py-4 pl-5 text-left transition-colors ${
                          on ? "border-teal-600" : "border-stone-100 hover:border-stone-300"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border font-mono text-[12px] transition-colors ${
                            on ? "border-teal-600 bg-teal-600 text-white" : "border-stone-200 text-stone-400"
                          }`}
                        >
                          {s.n}
                        </span>
                        <span>
                          <span className={`block text-[17px] transition-colors ${on ? "font-semibold text-stone-900" : "text-stone-400"}`}>
                            {s.title}
                          </span>
                          <span
                            className={`grid overflow-hidden transition-all duration-300 ${
                              on ? "mt-1.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            }`}
                          >
                            <span className="overflow-hidden text-[14px] leading-[1.6] text-stone-600">{s.desc}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* it's live, not a slideshow */}
        <Reveal>
          <section className="mt-20 rounded-3xl border border-stone-200 bg-white p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-normal text-stone-900">This isn&apos;t a slideshow.</h2>
                <p className="mt-1.5 text-sm text-stone-500">
                  The same machine runs live on Base mainnet. Donate, and you trigger a real evaluation.
                </p>
              </div>
              <a
                href={`${SCAN}/address/${POOL_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:border-stone-400"
              >
                Contract {shortHex(POOL_ADDRESS)} ↗
              </a>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "In the pool", value: `${formatUSDC(poolBalance)} USDC` },
                { label: "Released", value: String(executed) },
                { label: "Blocked", value: String(blocked) },
                { label: "Status", value: IS_LIVE ? "Live · Base" : "Demo" },
              ].map((st) => (
                <div key={st.label} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-lg font-semibold text-stone-900">{st.value}</div>
                  <div className="text-[11px] uppercase tracking-wide text-stone-400">{st.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { t: "LI.FI Composer", b: "Any token, one signature → USDC into the pool.", href: `${SCAN}/tx/${SAMPLE_DONATION_TX}`, cta: "A real donation tx", dot: "bg-rose-500" },
                { t: "Chainlink CRE", b: "Hazard alerts become an on-chain riskScore.", href: `${SCAN}/address/${POOL_ADDRESS}#readContract`, cta: "riskScore on-chain", dot: "bg-teal-500" },
              ].map((it) => (
                <a
                  key={it.t}
                  href={it.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-xl border border-stone-200 p-4 transition-colors hover:border-stone-300"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
                    <span className={`h-1.5 w-1.5 rounded-full ${it.dot}`} />
                    {it.t}
                  </span>
                  <p className="mt-2 flex-1 text-xs text-stone-500">{it.b}</p>
                  <span className="mt-3 text-xs font-medium text-stone-700 group-hover:underline">{it.cta} ↗</span>
                </a>
              ))}
            </div>
          </section>
        </Reveal>

        <p className="mt-16 text-center font-serif text-sm italic text-stone-400">
          The chain is the gate.{" "}
          <Link href="/technology" className="not-italic underline hover:text-stone-700">
            See how it&apos;s built →
          </Link>
        </p>
      </div>
    </main>
  );
}
