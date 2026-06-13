"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { keccak256, toBytes } from "viem";
import proposalsData from "@/src/mocks/proposals.json";
import {
  POOL_ABI,
  POOL_ADDRESS,
  POOL_CHAIN_ID,
  IS_LIVE,
  STATUS,
  FAIL_REASON_NAME,
  APPROVED_PURPOSES,
} from "./contract";

// ---- unified shape consumed by the UI (matches docs/INTERFACES.md getProposal) ----

export type FailReason = (typeof FAIL_REASON_NAME)[number];
export type Status = (typeof STATUS)[number];

export type ProposalRecord = {
  id: number;
  proposal: {
    recipient: string;
    recipientAddress: string;
    amount: string; // USDC base units
    purpose: string;
    eventId: string;
    reasoning: string;
  };
  verdict: { status: Status; passed: boolean; failReason: FailReason };
};

export type CivicShieldData = {
  proposals: ProposalRecord[];
  poolBalance: string; // USDC base units
  executed: number;
  blocked: number;
  totalReleased: string; // USDC base units
  isLive: boolean; // reading on-chain vs mock fixtures
  isLoading: boolean;
};

// reverse-map keccak256(purpose) -> readable name, computed once.
const PURPOSE_BY_HASH: Record<string, string> = Object.fromEntries(
  APPROVED_PURPOSES.map((p) => [keccak256(toBytes(p)).toLowerCase(), p]),
);

function purposeLabel(hash: string): string {
  return PURPOSE_BY_HASH[hash.toLowerCase()] ?? `${hash.slice(0, 10)}…`;
}

const MOCK = proposalsData as ProposalRecord[];

// Demo pool balance used only in mock mode (30 USDC). Live mode reads poolBalance().
const MOCK_POOL_BALANCE = "30000000";

function deriveStats(proposals: ProposalRecord[]) {
  const executed = proposals.filter((p) => p.verdict.passed).length;
  const blocked = proposals.length - executed;
  const totalReleased = proposals
    .filter((p) => p.verdict.passed)
    .reduce((sum, p) => sum + BigInt(p.proposal.amount || "0"), BigInt(0))
    .toString();
  return { executed, blocked, totalReleased };
}

const poolContract = { address: POOL_ADDRESS as `0x${string}`, abi: POOL_ABI, chainId: POOL_CHAIN_ID } as const;

/**
 * Single source of truth for the UI. Reads on-chain when NEXT_PUBLIC_POOL_ADDRESS is set,
 * otherwise returns the mock fixtures. Same shape either way, so components don't care.
 */
export function useCivicShield(): CivicShieldData {
  // pool balance + proposal count (only fire when live)
  const { data: poolBalanceRaw } = useReadContract({
    ...poolContract,
    functionName: "poolBalance",
    query: { enabled: IS_LIVE, refetchInterval: 5000 },
  });
  const { data: countRaw } = useReadContract({
    ...poolContract,
    functionName: "proposalCount",
    query: { enabled: IS_LIVE, refetchInterval: 5000 },
  });

  const count = IS_LIVE && typeof countRaw === "bigint" ? Number(countRaw) : 0;

  // batch getProposal(0..count-1)
  const { data: rawProposals, isLoading } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      ...poolContract,
      functionName: "getProposal" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: IS_LIVE && count > 0, refetchInterval: 5000 },
  });

  return useMemo<CivicShieldData>(() => {
    if (!IS_LIVE) {
      return { proposals: MOCK, poolBalance: MOCK_POOL_BALANCE, ...deriveStats(MOCK), isLive: false, isLoading: false };
    }

    const proposals: ProposalRecord[] = (rawProposals ?? [])
      .map((r, id): ProposalRecord | null => {
        if (r.status !== "success" || !r.result) return null;
        // getProposal returns [Proposal, Verdict]
        const [p, v] = r.result as [
          { recipient: string; amount: bigint; purpose: string; eventId: string; reasoning: string },
          { status: number; passed: boolean; failReason: number },
        ];
        return {
          id,
          proposal: {
            recipient: p.recipient,
            recipientAddress: p.recipient,
            amount: p.amount.toString(),
            purpose: purposeLabel(p.purpose),
            eventId: p.eventId,
            reasoning: p.reasoning,
          },
          verdict: {
            status: STATUS[v.status] ?? "PENDING",
            passed: v.passed,
            failReason: FAIL_REASON_NAME[v.failReason] ?? "NONE",
          },
        };
      })
      .filter((x): x is ProposalRecord => x !== null);

    const poolBalance = typeof poolBalanceRaw === "bigint" ? poolBalanceRaw.toString() : "0";
    return { proposals, poolBalance, ...deriveStats(proposals), isLive: true, isLoading };
  }, [rawProposals, poolBalanceRaw, isLoading]);
}
