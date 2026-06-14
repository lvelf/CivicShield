"use client";

import { useState } from "react";
import type { ProposalRecord, Status, FailReason } from "@/src/lib/useCivicShield";

// The 6 policy rules, in evaluation order (scope is checked first — donor intent).
const RULES: { reason: FailReason; label: string }[] = [
  { reason: "EVENT_SCOPE_MISMATCH", label: "Event scope matches the pool's mandate (region | hazard)" },
  { reason: "RISK_BELOW_THRESHOLD", label: "Risk ≥ threshold (riskScore ≥ 75)" },
  { reason: "AMOUNT_OVER_EVENT_CAP", label: "Amount ≤ per-event cap" },
  { reason: "DAILY_LIMIT_EXCEEDED", label: "Within daily limit (trace-level)" },
  { reason: "RECIPIENT_NOT_VERIFIED", label: "Recipient in verified allowlist" },
  { reason: "PURPOSE_NOT_APPROVED", label: "Purpose in approved list" },
];

export function formatUSDC(baseUnits: string): string {
  return `${(Number(baseUnits) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
export function shortHex(s: string): string {
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

export function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    EXECUTED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    BLOCKED: "bg-rose-50 text-rose-700 ring-rose-600/20",
    PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
    PENDING_REVIEW: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  };
  const text = status === "PENDING_REVIEW" ? "LEDGER REVIEW" : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}>
      {text}
    </span>
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
