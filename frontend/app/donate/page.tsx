"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DonateWidget } from "@/src/components/DonateWidget";
import { WorldMap } from "@/src/components/WorldMap";
import { TransparencyLog, formatUSDC } from "@/src/components/TransparencyLog";
import { useCivicShield } from "@/src/lib/useCivicShield";
import { HAZARD_ORDER, type HazardType } from "@/src/lib/hazards";

const FLOW = [
  { t: "Donate", d: "Any token, any chain → USDC into the pool (LI.FI Composer)." },
  { t: "Agent proposes", d: "The agent detects the hazard and drafts a release. No keys to funds." },
  { t: "Policy certifies", d: "6 deterministic on-chain rules check scope, risk, caps, recipient, purpose." },
  { t: "Small → auto-release", d: "Below the review threshold, a clean proposal pays out instantly." },
  { t: "Large → Ledger", d: "At or above the threshold it waits for a hardware-wallet signature." },
];

export default function DonatePage() {
  // useSearchParams must sit inside a Suspense boundary in the app router.
  return (
    <Suspense>
      <DonatePageInner />
    </Suspense>
  );
}

function DonatePageInner() {
  const { proposals, poolBalance, executed, blocked, totalReleased } = useCivicShield();
  const pendingReview = proposals.filter((p) => p.verdict.status === "PENDING_REVIEW").length;

  // Optional deep-link from the disasters page: /donate?hazard=wildfire focuses that layer first.
  const searchParams = useSearchParams();
  const hazardParam = searchParams.get("hazard");
  const initialHazards: HazardType[] | undefined = HAZARD_ORDER.includes(hazardParam as HazardType)
    ? [hazardParam as HazardType]
    : undefined;

  return (
    <main className="bg-[#fafaf9]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* header + donate */}
        <div className="grid items-start gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.2em] text-stone-400">Fund flood relief</p>
            <h1 className="mt-3 max-w-xl font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
              You fund the pool. The chain decides the rest.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-stone-600">
              Your donation lands in the escrow pool. From there, nobody — not us, not the AI — can
              move it except a policy-certified release tied to a real disaster.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "In escrow", value: formatUSDC(poolBalance), unit: "USDC", c: "text-stone-900" },
                { label: "Released", value: formatUSDC(totalReleased), unit: "USDC", c: "text-emerald-700" },
                { label: "Ledger review", value: String(pendingReview), unit: "", c: "text-indigo-700" },
                { label: "Blocked", value: String(blocked), unit: "", c: "text-rose-700" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className={`font-serif text-2xl font-semibold ${s.c}`}>
                    {s.value}
                    {s.unit && <span className="ml-1 text-sm font-medium text-stone-400">{s.unit}</span>}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <DonateWidget />
        </div>

        {/* the flow line */}
        <div className="mt-16">
          <h2 className="font-serif text-2xl font-semibold text-stone-900">What happens to your money</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {FLOW.map((f, i) => (
              <div key={f.t} className="relative rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                  {i + 1}
                </div>
                <div className="mt-3 text-sm font-semibold text-stone-900">{f.t}</div>
                <div className="mt-1 text-xs text-stone-500">{f.d}</div>
                {i < FLOW.length - 1 && (
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-stone-300 md:block">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* money map */}
        <div className="mt-16">
          <h2 className="font-serif text-2xl font-semibold text-stone-900">Where the money moves</h2>
          <p className="mt-2 max-w-2xl text-stone-600">
            Live from Base mainnet — {executed} released · {blocked} blocked. The outbound arc
            brightens once a real release executes.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 sm:p-8">
            <WorldMap executed={executed} blocked={blocked} initialHazards={initialHazards} />
          </div>
        </div>

        {/* transparency log */}
        <div className="mt-16">
          <h2 className="font-serif text-2xl font-semibold text-stone-900">What went to whom, when</h2>
          <p className="mt-2 max-w-2xl text-stone-600">
            Every evaluation on-chain — releases <em>and</em> blocks. Click any entry for the six policy checks.
          </p>
          <div className="mt-6">
            <TransparencyLog proposals={proposals} />
          </div>
        </div>
      </div>
    </main>
  );
}
