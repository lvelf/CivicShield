"use client";

import Link from "next/link";
import { useState } from "react";
import { useCivicShield, type ProposalRecord } from "@/src/lib/useCivicShield";
import { StatusPill, formatUSDC, shortHex } from "@/src/components/TransparencyLog";
import { POOL_ADDRESS, USDC_ADDRESS, POOL_DEPLOY_BLOCK, IS_LIVE } from "@/src/lib/contract";

const SCAN = "https://basescan.org";

// Proven on-chain artifacts (Base mainnet). Pool / USDC are single-sourced from the deployment
// file via contract.ts; the agent identity and a sample donation tx are documented here as
// verifiable BaseScan links — the whole point of this page is "don't trust us, follow the chain."
const AGENT = "0xc0ca0981b1fc2da9009eb8393ca2df935cff15c7";
const SAMPLE_DONATION_TX = "0x8d823db7d100ee5ee35df2fbe176bd3cac17f89910503038d74c84d4ffa7b711";

// Readable label for whichever rule a blocked proposal tripped.
const RULE_LABEL: Record<string, string> = {
  EVENT_SCOPE_MISMATCH: "Event scope matched the pool's mandate",
  RISK_BELOW_THRESHOLD: "Risk ≥ threshold (riskScore ≥ 75)",
  AMOUNT_OVER_EVENT_CAP: "Amount ≤ per-event cap",
  DAILY_LIMIT_EXCEEDED: "Within daily limit",
  RECIPIENT_NOT_VERIFIED: "Recipient in verified allowlist",
  PURPOSE_NOT_APPROVED: "Purpose in approved list",
};

// The three sponsor integrations — each backed by a real link on BaseScan.
const INTEGRATIONS = [
  {
    key: "lifi",
    track: "LI.FI Composer",
    tone: "text-rose-700 ring-rose-600/20 bg-rose-50",
    dot: "bg-rose-500",
    body: "Any token, one signature. We swap ETH→USDC and deposit into the pool in a single composed call.",
    href: `${SCAN}/tx/${SAMPLE_DONATION_TX}`,
    cta: "A real donation tx",
  },
  {
    key: "cre",
    track: "Chainlink CRE",
    tone: "text-teal-700 ring-teal-600/20 bg-teal-50",
    dot: "bg-teal-500",
    body: "Hazard alerts become an on-chain riskScore. The release threshold is checked against it — not against anyone's opinion.",
    href: `${SCAN}/address/${POOL_ADDRESS}#readContract`,
    cta: "riskScore on the pool",
  },
  {
    key: "agent",
    track: "Multi-agent proposer",
    tone: "text-amber-700 ring-amber-600/20 bg-amber-50",
    dot: "bg-amber-500",
    body: "An autonomous agent drafts the release. It can only propose — the onlyAgent role can never move funds by itself.",
    href: `${SCAN}/address/${AGENT}`,
    cta: "The agent identity",
  },
];

function dotColor(record: ProposalRecord): string {
  if (record.verdict.passed) return "bg-emerald-500";
  if (record.verdict.status === "PENDING_REVIEW") return "bg-indigo-500";
  if (record.verdict.status === "PENDING") return "bg-amber-500";
  return "bg-rose-500";
}

function ChainBlock({ record, n }: { record: ProposalRecord; n: number }) {
  const [open, setOpen] = useState(false);
  const { id, proposal, verdict } = record;
  return (
    <li className="relative pl-12">
      {/* node on the spine */}
      <span
        className={`absolute left-4 top-6 h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-4 ring-[#fafaf9] ${dotColor(record)}`}
      />
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <button onClick={() => setOpen((o) => !o)} className="w-full p-4 text-left hover:bg-stone-50">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-stone-400">block #{id}</span>
            <StatusPill status={verdict.status} />
          </div>
          <div className="mt-1.5 text-sm font-medium text-stone-900">
            {formatUSDC(proposal.amount)} USDC → {shortHex(proposal.recipient)}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {verdict.passed
              ? "Policy certified — funds released."
              : `Blocked — failed rule: ${RULE_LABEL[verdict.failReason] ?? verdict.failReason}.`}
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-stone-400">
            event {shortHex(proposal.eventId)} · {open ? "hide" : "show"} detail
          </p>
        </button>
        {open && (
          <div className="border-t border-stone-100 bg-stone-50 px-4 py-3 text-xs">
            <p className="text-stone-500">
              Purpose: <span className="text-stone-700">{proposal.purpose}</span>
            </p>
            <p className="mt-2 italic text-stone-500">
              Agent reasoning (logged, not trusted): “{proposal.reasoning}”
            </p>
            <a
              href={`${SCAN}/address/${POOL_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-stone-500 underline hover:text-stone-800"
            >
              Verify on BaseScan ↗
            </a>
          </div>
        )}
      </div>
      {/* counter on the right gutter */}
      <span className="pointer-events-none absolute right-2 top-6 hidden font-serif text-2xl text-stone-200 sm:block">
        {String(n).padStart(2, "0")}
      </span>
    </li>
  );
}

export default function Product() {
  const { proposals, poolBalance, executed, blocked } = useCivicShield();

  return (
    <main className="min-h-screen bg-[#fafaf9]">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        {/* header */}
        <header>
          <p className="font-sans text-sm uppercase tracking-[0.25em] text-stone-400">Product</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            Everything we shipped, on-chain.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-stone-600">
            Don&apos;t trust us — follow the chain. Every integration, every proposal, every release is a
            real transaction on Base mainnet. Click anything to verify it yourself on BaseScan.
          </p>

          {/* live stats */}
          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { label: "In the pool", value: `${formatUSDC(poolBalance)} USDC` },
              { label: "Released", value: String(executed) },
              { label: "Blocked", value: String(blocked) },
              { label: "Status", value: IS_LIVE ? "Live · Base" : "Demo" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-stone-200 bg-white px-4 py-2">
                <div className="text-lg font-semibold text-stone-900">{s.value}</div>
                <div className="text-[11px] uppercase tracking-wide text-stone-400">{s.label}</div>
              </div>
            ))}
          </div>
        </header>

        {/* integrations — the three sponsor tracks, each a real link */}
        <section className="mt-12">
          <h2 className="font-serif text-xl font-semibold text-stone-900">The integrations</h2>
          <p className="mt-1 text-sm text-stone-500">Three sponsors, wired end to end. Each card opens its proof.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {INTEGRATIONS.map((it) => (
              <a
                key={it.key}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-5 transition-colors hover:border-stone-300"
              >
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${it.tone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${it.dot}`} />
                  {it.track}
                </span>
                <p className="mt-3 flex-1 text-sm text-stone-600">{it.body}</p>
                <span className="mt-4 text-sm font-medium text-stone-900 group-hover:underline">{it.cta} ↗</span>
              </a>
            ))}
          </div>
        </section>

        {/* the chain — genesis pool block, then the live proposal blocks */}
        <section className="mt-12">
          <h2 className="font-serif text-xl font-semibold text-stone-900">The chain</h2>
          <p className="mt-1 text-sm text-stone-500">
            The pool, then every release the AI proposed and the policy certified — newest reads at the bottom.
          </p>

          <div className="relative mt-6">
            {/* the spine */}
            <div className="absolute left-4 top-2 bottom-2 w-px -translate-x-1/2 bg-stone-200" />

            <ol className="space-y-4">
              {/* genesis */}
              <li className="relative pl-12">
                <span className="absolute left-4 top-6 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-stone-900 ring-4 ring-[#fafaf9]" />
                <div className="rounded-xl border border-stone-300 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] text-stone-400">genesis</span>
                    <span className="inline-flex items-center rounded-full bg-stone-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                      DEPLOYED
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-stone-900">CivicShieldPool — escrow + policy engine</div>
                  <p className="mt-1 text-xs text-stone-500">
                    Six deterministic rules. The agent proposes, this contract certifies, releases ≥ threshold need a
                    Ledger. Deployed at block {POOL_DEPLOY_BLOCK.toLocaleString("en-US")}.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                    <a href={`${SCAN}/address/${POOL_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-stone-500 underline hover:text-stone-800">
                      pool {shortHex(POOL_ADDRESS)} ↗
                    </a>
                    <a href={`${SCAN}/address/${USDC_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-stone-500 underline hover:text-stone-800">
                      USDC {shortHex(USDC_ADDRESS)} ↗
                    </a>
                  </div>
                </div>
              </li>

              {/* proposal blocks */}
              {proposals.map((r, i) => (
                <ChainBlock key={r.id} record={r} n={i + 1} />
              ))}

              {proposals.length === 0 && (
                <li className="relative pl-12">
                  <span className="absolute left-4 top-6 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-stone-300 ring-4 ring-[#fafaf9]" />
                  <p className="rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-400">
                    No releases proposed on-chain yet — the chain starts at the pool above.
                  </p>
                </li>
              )}
            </ol>
          </div>
        </section>

        <p className="mt-12 border-t border-stone-200 pt-6 text-center font-serif text-sm italic text-stone-400">
          Generation is not permission. The chain is the gate.{" "}
          <Link href="/technology" className="not-italic underline hover:text-stone-700">
            See how it&apos;s built →
          </Link>
        </p>
      </div>
    </main>
  );
}
