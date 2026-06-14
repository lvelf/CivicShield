"use client";

import { useState } from "react";

type Module = {
  key: string;
  name: string;
  sponsor: string;
  role: string;
  detail: string;
  accent: string;
};

const MODULES: Module[] = [
  {
    key: "lifi",
    name: "Donation intake",
    sponsor: "LI.FI Composer",
    role: "Money in — any token, any chain → USDC into the pool in one signature.",
    detail:
      "The frontend requests a LI.FI contractCalls quote (REST) that swaps the donor's ETH to USDC and calls donate(amount, donor) on the pool — one atomic transaction. The wallet signs the returned transactionRequest directly (no executor wiring). Proven live on Base mainnet.",
    accent: "border-sky-200 bg-sky-50/40",
  },
  {
    key: "cre",
    name: "Hazard oracle",
    sponsor: "Chainlink CRE",
    role: "The release condition — real federal weather data → deterministic riskScore.",
    detail:
      "A TypeScript CRE workflow pulls live NWS alerts from api.weather.gov and maps the CAP fields severity · urgency · certainty into a fixed-weight riskScore (0–100). No LLM in the consensus path — nodes must agree. A relayer submits the score and the event's attested scope on-chain via submitRiskScore. Verified by a CRE simulation: a real Illinois flood → 90.",
    accent: "border-amber-200 bg-amber-50/40",
  },
  {
    key: "agent",
    name: "Multi-agent proposer",
    sponsor: "OpenAI",
    role: "AI proposes — and can never move money.",
    detail:
      "A cheap supervisor monitors one scope with the deterministic score; only on a real anomaly does it spawn an OpenAI assessor that judges severity and drafts a structured proposal (output clamped to policy limits). The agent's only on-chain power is proposeRelease (onlyAgent). A manipulated agent can only miss a disaster or get blocked — never cause a wrongful release. The release-deciding riskScore comes from CRE, not the agent.",
    accent: "border-rose-200 bg-rose-50/40",
  },
  {
    key: "pool",
    name: "Permissibility Machine",
    sponsor: "CivicShieldPool (Base)",
    role: "The chain decides — 6 deterministic rules, no admin withdrawal.",
    detail:
      "executeRelease checks six rules in order — scope match, riskThreshold, per-event cap, trace-level daily limit, verified recipient, approved purpose — and reports the first failure. It never reverts on a policy failure: blocks are recorded on-chain (ActionEvaluated) so the attack itself is auditable. The only outflow is a policy-certified release; there is no admin-drain path.",
    accent: "border-teal-200 bg-teal-50/40",
  },
  {
    key: "ledger",
    name: "Human-in-the-loop",
    sponsor: "Ledger",
    role: "Large releases need a device-signed human.",
    detail:
      "A policy-clean proposal at or above reviewThreshold doesn't auto-execute — it enters PENDING_REVIEW and waits for the approver, a Ledger hardware wallet, to sign approveRelease. The AI proposes, the policy certifies, and a human device authorizes high-value transfers. Demo scale: auto < $5 · Ledger review $5–$10 · blocked > $10.",
    accent: "border-indigo-200 bg-indigo-50/40",
  },
];

export default function TechnologyPage() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <main className="bg-[#fafaf9]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="font-sans text-sm uppercase tracking-[0.2em] text-stone-400">How it&apos;s built</p>
        <h1 className="mt-3 max-w-2xl font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          The architecture.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
          Five parts, one principle: AI proposes, the chain certifies, a human device authorizes the
          big ones. Click any module for the technical detail.
        </p>

        {/* overview diagram */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/architecture.png" alt="CivicShield architecture" className="mx-auto w-full max-w-3xl" />
        </div>

        {/* clickable modules */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {MODULES.map((m) => {
            const isOpen = open === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setOpen(isOpen ? null : m.key)}
                className={`rounded-2xl border p-6 text-left transition-all ${m.accent} ${
                  isOpen ? "ring-2 ring-stone-300" : "hover:ring-1 hover:ring-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{m.sponsor}</span>
                  <span className="text-stone-400">{isOpen ? "−" : "+"}</span>
                </div>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-stone-900">{m.name}</h2>
                <p className="mt-1 text-sm text-stone-600">{m.role}</p>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? "mt-4 max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="border-t border-stone-200/70 pt-4 text-sm leading-relaxed text-stone-700">{m.detail}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
