"use client";

import { useState } from "react";
import { WorldMap } from "@/src/components/WorldMap";
import {
  useCivicShield,
  type ProposalRecord,
  type Status,
  type FailReason,
} from "@/src/lib/useCivicShield";

// The 5 policy rules, in evaluation order. FailReason maps 1:1 to a rule index.
const RULES: { reason: FailReason; label: string }[] = [
  { reason: "RISK_BELOW_THRESHOLD", label: "Risk ≥ threshold (riskScore ≥ 75)" },
  { reason: "AMOUNT_OVER_EVENT_CAP", label: "Amount ≤ per-event cap" },
  { reason: "DAILY_LIMIT_EXCEEDED", label: "Within daily limit (trace-level)" },
  { reason: "RECIPIENT_NOT_VERIFIED", label: "Recipient in ENS verified allowlist" },
  { reason: "PURPOSE_NOT_APPROVED", label: "Purpose in approved list" },
];

function formatUSDC(baseUnits: string): string {
  return `${(Number(baseUnits) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
function shortHex(s: string): string {
  if (!s.startsWith("0x") || s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
function ruleOutcomes(v: ProposalRecord["verdict"]) {
  const failIdx = RULES.findIndex((r) => r.reason === v.failReason);
  return RULES.map((r, i) => {
    if (v.passed) return { ...r, state: "pass" as const };
    if (i < failIdx) return { ...r, state: "pass" as const };
    if (i === failIdx) return { ...r, state: "fail" as const };
    return { ...r, state: "skip" as const };
  });
}

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    EXECUTED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    BLOCKED: "bg-rose-50 text-rose-700 ring-rose-600/20",
    PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}>
      {status}
    </span>
  );
}

// ---- nav over the cinematic hero ----

function Nav({ isLive }: { isLive: boolean }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-white">
        <span className="font-serif text-xl font-semibold tracking-tight">CivicShield</span>
        <nav className="hidden gap-8 text-sm text-white/80 sm:flex">
          <a href="#map" className="hover:text-white">Relief map</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#log" className="hover:text-white">Transparency</a>
          <a href="#verify" className="hover:text-white">Verify</a>
        </nav>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400"}`} />
          {isLive ? "Live · Base mainnet" : "Demo data"}
        </span>
      </div>
    </header>
  );
}

function Hero({ poolBalance }: { poolBalance: string }) {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/pic/nasa-5477L9Z5eqI-unsplash.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-stone-950/40 to-stone-950/85" />
      <div className="relative z-10 max-w-3xl px-6">
        <p className="font-sans text-sm uppercase tracking-[0.25em] text-white/70">
          On-chain disaster relief
        </p>
        <h1 className="mt-5 font-serif text-6xl font-semibold leading-[1.05] tracking-tight text-white sm:text-8xl">
          CivicShield
        </h1>
        <p className="mx-auto mt-6 max-w-xl font-serif text-2xl italic leading-snug text-white/90 sm:text-3xl">
          Real-world disaster unlocks relief.
        </p>
        <p className="mx-auto mt-4 max-w-lg text-base text-white/70">
          AI proposes, the chain certifies, donors verify. A verified flood signal — not a
          committee, not an unaccountable AI — is what releases the money.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#map"
            className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-white/90"
          >
            See relief in motion
          </a>
          <span className="font-mono text-sm text-white/70">
            {formatUSDC(poolBalance)} USDC in escrow
          </span>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/50">↓</div>
    </section>
  );
}

function ReliefMap({
  poolBalance,
  totalReleased,
  executed,
  blocked,
}: {
  poolBalance: string;
  totalReleased: string;
  executed: number;
  blocked: number;
}) {
  const stats = [
    { label: "In escrow", value: `${formatUSDC(poolBalance)}`, unit: "USDC", accent: "text-stone-900" },
    { label: "Released", value: `${formatUSDC(totalReleased)}`, unit: "USDC", accent: "text-emerald-700" },
    { label: "Executed", value: String(executed), unit: "", accent: "text-emerald-700" },
    { label: "Blocked by policy", value: String(blocked), unit: "", accent: "text-rose-700" },
  ];
  return (
    <section id="map" className="bg-[#fafaf9]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-sans text-sm uppercase tracking-[0.2em] text-stone-400">Relief in motion</p>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Money moves <span className="italic">toward</span> the disaster.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
          Donors fund the pool from any chain; a verified hazard signal is what sends relief out.
          The figures below are live from Base mainnet — the outbound arc brightens once a real
          release has executed. Donor origins are illustrative (any chain, any country).
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-8">
          <WorldMap executed={executed} blocked={blocked} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-stone-200 bg-white p-5">
              <div className={`font-serif text-3xl font-semibold ${s.accent}`}>
                {s.value}
                {s.unit && <span className="ml-1 text-base font-medium text-stone-400">{s.unit}</span>}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const traditional = [
    "Disaster strikes",
    "Institution assesses damage",
    "Committee reviews & approves",
    "Manual disbursement",
    "Funds arrive weeks later — opaque",
  ];
  const civicshield = [
    "Live hazard signal (NWS, federal)",
    "Policy contract certifies on-chain",
    "executeRelease() fires instantly",
    "Every outcome auditable — release and block alike",
  ];
  return (
    <section id="how" className="relative overflow-hidden border-y border-stone-200">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.07]"
        style={{ backgroundImage: "url('/pic/kelly-sikkema-_whs7FPfkwQ-unsplash.jpg')" }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-2xl font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          The gate is <span className="italic">simple on purpose.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
          Generation is not permission. The AI can propose; only the chain can release.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-white/80 p-7 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Traditional relief fund</h3>
            <ol className="mt-5 space-y-3">
              {traditional.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-stone-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-500">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-7 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-700">CivicShield</h3>
            <ol className="mt-5 space-y-3">
              {civicshield.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-stone-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function LogCard({ record }: { record: ProposalRecord }) {
  const [open, setOpen] = useState(false);
  const { id, proposal, verdict } = record;
  const outcomes = ruleOutcomes(verdict);
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-stone-50">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${verdict.passed ? "bg-emerald-500" : "bg-rose-500"}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-stone-900">
              {formatUSDC(proposal.amount)} USDC → {proposal.recipient}
            </span>
            <StatusPill status={verdict.status} />
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {verdict.passed
              ? "Certified and released"
              : `Blocked — ${RULES.find((r) => r.reason === verdict.failReason)?.label ?? verdict.failReason}`}
          </p>
          <p className="mt-1 font-mono text-[11px] text-stone-400">
            proposal #{id} · event {shortHex(proposal.eventId)} · {open ? "hide" : "show"} policy checks
          </p>
        </div>
      </button>
      {open && (
        <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
          <ul className="space-y-1.5">
            {outcomes.map((o, i) => (
              <li key={o.reason} className="flex items-center gap-2 text-sm">
                <span className={o.state === "pass" ? "text-emerald-600" : o.state === "fail" ? "text-rose-600" : "text-stone-300"}>
                  {o.state === "pass" ? "✓" : o.state === "fail" ? "✕" : "—"}
                </span>
                <span className={o.state === "skip" ? "text-stone-400" : "text-stone-700"}>
                  Rule {i + 1}: {o.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-stone-200 pt-2 text-xs italic text-stone-500">
            Agent reasoning (logged, not trusted): “{proposal.reasoning}”
          </p>
        </div>
      )}
    </div>
  );
}

function TransparencyLog({ proposals, executed, blocked }: { proposals: ProposalRecord[]; executed: number; blocked: number }) {
  return (
    <section id="log" className="bg-[#fafaf9]">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.2em] text-stone-400">Don&apos;t trust — verify</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">Transparency log</h2>
            <p className="mt-4 max-w-2xl text-lg text-stone-600">
              Every evaluation, on-chain — releases <em>and</em> blocks. Click any entry to see the five policy checks.
            </p>
          </div>
          <span className="hidden shrink-0 text-sm text-stone-400 sm:block">{executed} released · {blocked} blocked</span>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {proposals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">
              No proposals on-chain yet.
            </p>
          ) : (
            proposals.map((r) => <LogCard key={r.id} record={r} />)
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const POOL = "0x5e9972027d4f03824ac0e5da446f0afb5bfffcf5";
  const links: [string, string, string][] = [
    ["CivicShieldPool (Base mainnet)", shortHex(POOL), `https://basescan.org/address/${POOL}`],
    ["Block explorer", "basescan.org", `https://basescan.org/address/${POOL}`],
    ["Architecture", "docs/architecture.png", "#"],
  ];
  return (
    <footer id="verify" className="border-t border-stone-200 bg-stone-900 text-stone-300">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-serif text-2xl font-semibold text-white">Verify us</h2>
        <p className="mt-1 text-sm text-stone-400">Everything below is public and on-chain.</p>
        <dl className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-3">
          {links.map(([label, val, href]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
              <dd>
                <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-teal-400 hover:text-teal-300">
                  {val}
                </a>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-12 font-serif text-lg italic text-stone-400">
          AI proposes. The chain decides. Donors verify.
        </p>
        <p className="mt-1 text-xs text-stone-500">ETHGlobal New York 2026</p>
      </div>
    </footer>
  );
}

export default function Home() {
  const { proposals, poolBalance, executed, blocked, totalReleased, isLive } = useCivicShield();
  return (
    <div className="flex flex-1 flex-col bg-[#fafaf9] text-stone-900">
      <Nav isLive={isLive} />
      <Hero poolBalance={poolBalance} />
      <ReliefMap poolBalance={poolBalance} totalReleased={totalReleased} executed={executed} blocked={blocked} />
      <HowItWorks />
      <TransparencyLog proposals={proposals} executed={executed} blocked={blocked} />
      <Footer />
    </div>
  );
}
