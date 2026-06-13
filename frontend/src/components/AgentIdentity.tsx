"use client";

import { useEffect, useState } from "react";
import { normalize } from "viem/ens";
import {
  ensClient,
  AGENT_ENS,
  RECIPIENT_ENS,
  AGENT_TEXT_KEYS,
  AGENT_FALLBACK,
} from "@/src/lib/ens";

type Resolved = {
  agentAddress: string | null;
  recipientAddress: string | null;
  records: Record<string, string | null>;
  live: boolean;
};

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function AgentIdentity() {
  const [data, setData] = useState<Resolved>({
    agentAddress: null,
    recipientAddress: null,
    records: {},
    live: false,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const agentName = normalize(AGENT_ENS);
        const recipientName = normalize(RECIPIENT_ENS);
        const [agentAddress, recipientAddress, ...recordValues] = await Promise.all([
          ensClient.getEnsAddress({ name: agentName }).catch(() => null),
          ensClient.getEnsAddress({ name: recipientName }).catch(() => null),
          ...AGENT_TEXT_KEYS.map((key) =>
            ensClient.getEnsText({ name: agentName, key }).catch(() => null),
          ),
        ]);
        if (!alive) return;
        const records: Record<string, string | null> = {};
        AGENT_TEXT_KEYS.forEach((key, i) => (records[key] = recordValues[i]));
        const live = Boolean(agentAddress || Object.values(records).some(Boolean));
        setData({ agentAddress, recipientAddress, records, live });
      } catch {
        /* leave as preview */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { agentAddress, recipientAddress, records, live } = data;
  const recordLabels: Record<string, string> = {
    "agent.hazards": "Monitors",
    "agent.dataSources": "Data source",
    "agent.proposalScope": "Scope",
    "agent.policyContract": "Policy contract",
  };

  return (
    <section id="agent" className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-sans text-sm uppercase tracking-[0.2em] text-stone-400">Verify who, by name</p>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          ENS is the <span className="italic">trust fabric.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
          Donors don&apos;t verify a hex blob — they verify a name. The agent&apos;s identity and the
          verified recipient are both ENS names, resolved live.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* agent identity card */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-7">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-400 text-2xl">
                🌊
              </div>
              <div>
                <div className="font-mono text-sm font-semibold text-stone-900">{AGENT_ENS}</div>
                <div className="text-xs text-stone-500">
                  {agentAddress ? shortAddr(agentAddress) : "ENSIP-26 agent · proposes only"}
                </div>
              </div>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                  live
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                    : "bg-amber-50 text-amber-700 ring-amber-600/20"
                }`}
              >
                {live ? "Live ENS" : "Preview"}
              </span>
            </div>
            <dl className="mt-6 space-y-3">
              {AGENT_TEXT_KEYS.map((key) => (
                <div key={key} className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wide text-stone-400">
                    {recordLabels[key] ?? key}
                  </dt>
                  <dd className="font-mono text-sm text-stone-700">
                    {records[key] ?? AGENT_FALLBACK[key]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* verified recipient card */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Verified recipient
            </h3>
            <div className="mt-4 font-mono text-lg font-semibold text-stone-900">{RECIPIENT_ENS}</div>
            <div className="mt-1 font-mono text-sm text-stone-500">
              {recipientAddress ? shortAddr(recipientAddress) : "register on ENS to resolve"}
            </div>
            <p className="mt-6 text-sm text-stone-600">
              A subname <em>is</em> the allowlist. The policy contract releases funds only to
              recipients verified by name — issuing a subname is issuing certification.
            </p>
            <p className="mt-4 text-xs text-stone-400">
              {live
                ? "Resolved live from Ethereum Sepolia."
                : "Names not registered yet — showing the intended identity."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
