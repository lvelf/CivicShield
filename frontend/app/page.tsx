"use client";

import { useState } from "react";
import proposalsData from "@/src/mocks/proposals.json";

// ---- types (mirror docs/INTERFACES.md getProposal shape) ----

type FailReason =
  | "NONE"
  | "RISK_BELOW_THRESHOLD"
  | "AMOUNT_OVER_EVENT_CAP"
  | "DAILY_LIMIT_EXCEEDED"
  | "RECIPIENT_NOT_VERIFIED"
  | "PURPOSE_NOT_APPROVED";

type Status = "PENDING" | "EXECUTED" | "BLOCKED";

type ProposalRecord = {
  id: number;
  proposal: {
    recipient: string;
    recipientAddress: string;
    amount: string;
    purpose: string;
    eventId: string;
    reasoning: string;
  };
  verdict: { status: Status; passed: boolean; failReason: FailReason };
};

const proposals = proposalsData as ProposalRecord[];

// The 5 policy rules, in evaluation order. FailReason maps 1:1 to a rule index.
const RULES: { reason: FailReason; label: string }[] = [
  { reason: "RISK_BELOW_THRESHOLD", label: "Risk ≥ threshold (riskScore ≥ 75)" },
  { reason: "AMOUNT_OVER_EVENT_CAP", label: "Amount ≤ per-event cap" },
  { reason: "DAILY_LIMIT_EXCEEDED", label: "Within daily limit (trace-level)" },
  { reason: "RECIPIENT_NOT_VERIFIED", label: "Recipient in ENS verified allowlist" },
  { reason: "PURPOSE_NOT_APPROVED", label: "Purpose in approved list" },
];

// Demo-only figures not present in the mock fixtures.
// Mainnet, demo-scale: pool ≤ $30, per-event cap 5 USDC, daily cap 15 USDC.
const DEMO_POOL_BALANCE = "30000000"; // 30 USDC

// ---- helpers ----

function formatUSDC(baseUnits: string): string {
  return `${(Number(baseUnits) / 1_000_000).toLocaleString("en-US")}`;
}

function shortHex(s: string): string {
  if (!s.startsWith("0x") || s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

// Reconstruct per-rule outcomes from the final verdict, honoring "checks run in order,
// report the first failure": rules before the failing one pass, the failing one fails,
// rules after it are never evaluated.
function ruleOutcomes(v: ProposalRecord["verdict"]) {
  const failIdx = RULES.findIndex((r) => r.reason === v.failReason);
  return RULES.map((r, i) => {
    if (v.passed) return { ...r, state: "pass" as const };
    if (i < failIdx) return { ...r, state: "pass" as const };
    if (i === failIdx) return { ...r, state: "fail" as const };
    return { ...r, state: "skip" as const };
  });
}

// ---- derived stats ----

const executedCount = proposals.filter((p) => p.verdict.passed).length;
const blockedCount = proposals.length - executedCount;
const totalReleased = proposals
  .filter((p) => p.verdict.passed)
  .reduce((sum, p) => sum + Number(p.proposal.amount), 0)
  .toString();

// ---- small UI bits ----

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    EXECUTED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    BLOCKED: "bg-rose-50 text-rose-700 ring-rose-600/20",
    PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className={`text-3xl font-bold tracking-tight ${accent ?? "text-stone-900"}`}>
        {value}
        {unit && <span className="ml-1 text-base font-medium text-stone-400">{unit}</span>}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
    </div>
  );
}

// ---- sections ----

function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#fafaf9]/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <span className="font-bold tracking-tight text-stone-900">CivicShield 🛡️</span>
        <nav className="hidden gap-6 text-sm text-stone-500 sm:flex">
          <a href="#how" className="hover:text-stone-900">How it works</a>
          <a href="#agent" className="hover:text-stone-900">Agent</a>
          <a href="#log" className="hover:text-stone-900">Transparency</a>
          <a href="#verify" className="hover:text-stone-900">Verify</a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  const [amount, setAmount] = useState(5);
  const presets = [1, 5, 10];
  return (
    <section className="mx-auto max-w-5xl px-6 pt-16 pb-12">
      <span className="inline-block rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        Demo data — reading mock fixtures until the contract is live
      </span>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        {/* left: pitch + stats */}
        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-stone-900 sm:text-5xl">
            Real-world disaster unlocks relief.
            <br />
            <span className="text-teal-700">AI proposes, the chain decides.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-stone-600">
            An on-chain relief fund where a verified flood signal — not a committee, not an
            unaccountable AI — is what releases money. Every release and every block is publicly
            auditable.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Pool balance" value={formatUSDC(DEMO_POOL_BALANCE)} unit="USDC" />
            <StatCard label="Released" value={formatUSDC(totalReleased)} unit="USDC" accent="text-emerald-700" />
            <StatCard label="Executed" value={String(executedCount)} accent="text-emerald-700" />
            <StatCard label="Blocked by policy" value={String(blockedCount)} accent="text-rose-700" />
          </div>
        </div>

        {/* right: donate widget (LI.FI Composer behind it) */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">Fund relief</h2>
          <p className="mt-1 text-sm text-stone-500">Any token, any chain — one signature.</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  amount === p
                    ? "border-teal-600 bg-teal-50 text-teal-700"
                    : "border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
              >
                ${p}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-500">
            <span>Pay with</span>
            <span className="font-medium text-stone-700">any token ▾</span>
          </div>
          <button
            disabled
            className="mt-4 w-full cursor-not-allowed rounded-lg bg-stone-900 py-3 text-sm font-semibold text-white opacity-50"
          >
            Donate ${amount} — LI.FI Composer (wiring up)
          </button>
          <p className="mt-2 text-center text-xs text-stone-400">
            M6a · swap + bridge + deposit into CivicShieldPool
          </p>
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
    "Funds arrive weeks later — opaque throughout",
  ];
  const civicshield = [
    "Real hazard signal (NWS, live)",
    "Policy contract certifies on-chain",
    "executeRelease() fires instantly",
    "Auditable on-chain — every outcome logged",
  ];
  return (
    <section id="how" className="border-y border-stone-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">
          Traditional relief vs CivicShield
        </h2>
        <p className="mt-2 text-stone-500">Same goal — fewer trust assumptions, no black box.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Traditional relief fund
            </h3>
            <ol className="mt-4 space-y-3">
              {traditional.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-stone-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-500">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              CivicShield
            </h3>
            <ol className="mt-4 space-y-3">
              {civicshield.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-stone-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentCard() {
  // ENSIP-26 text records — resolved live in production (M6b); static demo values here.
  const records = [
    ["agent.hazards", "flood"],
    ["agent.dataSources", "api.weather.gov/alerts/active"],
    ["agent.proposalScope", "US flood relief, mainnet demo-scale"],
    ["agent.policyContract", "0x… (CivicShieldPool)"],
  ];
  return (
    <section id="agent" className="mx-auto max-w-5xl px-6 py-14">
      <h2 className="text-2xl font-bold tracking-tight text-stone-900">The proposing agent</h2>
      <p className="mt-2 max-w-2xl text-stone-500">
        Holds no keys to funds — it can only <em>propose</em>. Donors verify who it is by name.
      </p>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-400 text-2xl">
            🌊
          </div>
          <div>
            <div className="font-semibold text-stone-900">flood-risk-agent.eth</div>
            <div className="text-sm text-stone-500">ENSIP-26 agent · proposes only</div>
          </div>
        </div>
        <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {records.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="font-mono text-xs text-stone-400">{k}</dt>
              <dd className="text-sm text-stone-700">{v}</dd>
            </div>
          ))}
        </dl>
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
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-stone-50"
      >
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            verdict.passed ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />
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
                <span
                  className={
                    o.state === "pass"
                      ? "text-emerald-600"
                      : o.state === "fail"
                      ? "text-rose-600"
                      : "text-stone-300"
                  }
                >
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

function TransparencyLog() {
  return (
    <section id="log" className="border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">Transparency log</h2>
            <p className="mt-2 max-w-2xl text-stone-500">
              Every evaluation, on-chain via <code className="rounded bg-stone-100 px-1">ActionEvaluated</code> —
              releases <em>and</em> blocks. Click any entry to see the five policy checks.
            </p>
          </div>
          <span className="hidden shrink-0 text-sm text-stone-400 sm:block">
            {executedCount} released · {blockedCount} blocked
          </span>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {proposals.map((r) => (
            <LogCard key={r.id} record={r} />
          ))}
        </div>
      </div>
    </section>
  );
}

function VerifyFooter() {
  const links = [
    ["CivicShieldPool (Base mainnet)", "0x… add after deploy"],
    ["Block explorer", "basescan.org/…"],
    ["GitHub", "github.com/…/civicshield"],
    ["Architecture", "docs/architecture.png"],
  ];
  return (
    <footer id="verify" className="border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-lg font-semibold text-stone-900">Verify us</h2>
        <p className="mt-1 text-sm text-stone-500">
          Don&apos;t trust — verify. Everything below is public.
        </p>
        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {links.map(([label, val]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-stone-400">{label}</dt>
              <dd className="font-mono text-sm text-stone-700">{val}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-sm text-stone-400">
          AI proposes. The chain decides. Donors verify. · ETHGlobal New York 2026
        </p>
      </div>
    </footer>
  );
}

// ---- page ----

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#fafaf9] text-stone-900">
      <Nav />
      <Hero />
      <HowItWorks />
      <AgentCard />
      <TransparencyLog />
      <VerifyFooter />
    </div>
  );
}
