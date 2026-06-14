"use client";

import { useState } from "react";
import type { ProposalRecord, Status, FailReason } from "@/src/lib/useCivicShield";

// The 6 policy rules, in evaluation order (scope is checked first — donor intent). `check` is the
// positive condition shown in the per-proposal checklist; `fail` is the reason phrased for a block.
const RULES: { reason: FailReason; check: string; fail: string }[] = [
  { reason: "EVENT_SCOPE_MISMATCH", check: "Event scope matches the pool's mandate (region | hazard)", fail: "Event scope doesn't match the pool's mandate" },
  { reason: "RISK_BELOW_THRESHOLD", check: "Risk ≥ threshold (riskScore ≥ 75)", fail: "Risk below the threshold (riskScore < 75)" },
  { reason: "AMOUNT_OVER_EVENT_CAP", check: "Amount ≤ per-event cap", fail: "Amount over the per-event cap" },
  { reason: "DAILY_LIMIT_EXCEEDED", check: "Within the daily limit (trace-level)", fail: "Daily limit exceeded (trace-level)" },
  { reason: "RECIPIENT_NOT_VERIFIED", check: "Recipient in the verified allowlist", fail: "Recipient not in the verified allowlist" },
  { reason: "PURPOSE_NOT_APPROVED", check: "Purpose in the approved list", fail: "Purpose not in the approved list" },
];

// Per-status presentation: accent dot, pill colors, label, and the one-line summary.
const STATUS_META: Record<Status, { dot: string; pill: string; label: string }> = {
  EXECUTED: { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", label: "EXECUTED" },
  BLOCKED: { dot: "bg-rose-500", pill: "bg-rose-50 text-rose-700 ring-rose-600/20", label: "BLOCKED" },
  PENDING: { dot: "bg-amber-400", pill: "bg-amber-50 text-amber-700 ring-amber-600/20", label: "PENDING" },
  PENDING_REVIEW: { dot: "bg-indigo-500", pill: "bg-indigo-50 text-indigo-700 ring-indigo-600/20", label: "LEDGER REVIEW" },
};

export function formatUSDC(baseUnits: string): string {
  return `${(Number(baseUnits) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
export function shortHex(s: string): string {
  if (!s.startsWith("0x") || s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

// One-line outcome per status. Fixes the old bug where PENDING/PENDING_REVIEW rendered as
// "Blocked — NONE" simply because the verdict hadn't passed yet.
function summaryOf(v: ProposalRecord["verdict"]): string {
  switch (v.status) {
    case "EXECUTED":
      return "Certified on-chain and released";
    case "BLOCKED":
      return `Blocked — ${RULES.find((r) => r.reason === v.failReason)?.fail ?? "policy rule failed"}`;
    case "PENDING_REVIEW":
      return "Policy-clean — awaiting Ledger approval";
    case "PENDING":
    default:
      return "Awaiting execution — anyone can call executeRelease";
  }
}

function ruleOutcomes(v: ProposalRecord["verdict"]) {
  const failIdx = RULES.findIndex((r) => r.reason === v.failReason);
  // Not yet executed (PENDING / PENDING_REVIEW): rules haven't been evaluated on-chain.
  const evaluated = v.status === "EXECUTED" || v.status === "BLOCKED";
  return RULES.map((r, i) => {
    if (!evaluated) return { ...r, state: "pending" as const };
    if (v.passed || i < failIdx) return { ...r, state: "pass" as const };
    if (i === failIdx) return { ...r, state: "fail" as const };
    return { ...r, state: "skip" as const };
  });
}

export function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${m.pill}`}>
      {m.label}
    </span>
  );
}

function LogCard({ record }: { record: ProposalRecord }) {
  const [open, setOpen] = useState(false);
  const { id, proposal, verdict } = record;
  const meta = STATUS_META[verdict.status];
  const outcomes = ruleOutcomes(verdict);

  return (
    <div className="group overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-stone-50/80"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-lg font-semibold tabular-nums text-stone-900">
              {formatUSDC(proposal.amount)}
            </span>
            <span className="text-xs font-medium text-stone-400">USDC</span>
            <span className="text-stone-300">→</span>
            <span className="truncate font-mono text-sm text-stone-600" title={proposal.recipient}>
              {shortHex(proposal.recipient)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-stone-500">{summaryOf(verdict)}</p>
        </div>

        <StatusPill status={verdict.status} />

        <span className="shrink-0 font-mono text-[11px] text-stone-400">#{id}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:text-stone-400 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-stone-100 bg-stone-50/70 px-4 py-4">
          <p className="mb-2.5 font-sans text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            Policy Π — six on-chain checks, in order
          </p>
          <ul className="space-y-1.5">
            {outcomes.map((o, i) => {
              const tone =
                o.state === "pass" ? "text-emerald-600" : o.state === "fail" ? "text-rose-600" : "text-stone-300";
              const mark = o.state === "pass" ? "✓" : o.state === "fail" ? "✕" : "○";
              const text = o.state === "fail" ? o.fail : o.check;
              return (
                <li key={o.reason} className="flex items-start gap-2.5 text-sm">
                  <span className={`mt-0.5 font-semibold ${tone}`}>{mark}</span>
                  <span className={o.state === "pass" || o.state === "fail" ? "text-stone-700" : "text-stone-400"}>
                    <span className="text-stone-400">Rule {i + 1} · </span>
                    {text}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 pt-3 font-mono text-[11px] text-stone-400">
            <span>proposal #{id}</span>
            <span>event {shortHex(proposal.eventId)}</span>
          </div>

          {proposal.reasoning && (
            <p className="mt-2 text-xs italic text-stone-500">
              Agent reasoning (logged, never trusted): “{proposal.reasoning}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TransparencyLog({ proposals }: { proposals: ProposalRecord[] }) {
  return (
    <div className="flex flex-col gap-3">
      {proposals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">
          No proposals on-chain yet — donate to set a relief event in motion.
        </p>
      ) : (
        proposals.map((r) => <LogCard key={r.id} record={r} />)
      )}
    </div>
  );
}
