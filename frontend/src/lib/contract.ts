import type { Abi } from "viem";
import deployment from "@/src/deployments/base-mainnet.json";

// SINGLE SOURCE OF TRUTH: everything (address, ABI, chain, USDC) is read straight from the
// deployment artifact Nuo commits. When the contract is redeployed, just refresh that file
// (`npm run sync:deployment`) — no code edits, no hand-copying the address or ABI anywhere.
export const POOL_ADDRESS = deployment.CivicShieldPool as `0x${string}`;
export const POOL_ABI = deployment.abi as unknown as Abi;
export const POOL_CHAIN_ID = Number(deployment.chainId); // 8453 = Base mainnet
export const USDC_ADDRESS = deployment.USDC as `0x${string}`;

// true once a real address is present — flips the whole UI from mocks to on-chain reads.
export const IS_LIVE = /^0x[a-fA-F0-9]{40}$/.test(POOL_ADDRESS);

// ---- enum mappings (contract returns uints; mirror docs/INTERFACES.md) ----

// ProposalStatus enum order (contract): index 3 PENDING_REVIEW = policy-clean but awaiting
// Ledger approval for a large release.
export const STATUS = ["PENDING", "EXECUTED", "BLOCKED", "PENDING_REVIEW"] as const;

// FailReason enum order (contract). EVENT_SCOPE_MISMATCH was appended at index 6, so 0–5 are
// unchanged; it is CHECKED FIRST in _evaluate (scope/donor-intent before everything else).
export const FAIL_REASON_NAME = [
  "NONE",
  "RISK_BELOW_THRESHOLD",
  "AMOUNT_OVER_EVENT_CAP",
  "DAILY_LIMIT_EXCEEDED",
  "RECIPIENT_NOT_VERIFIED",
  "PURPOSE_NOT_APPROVED",
  "EVENT_SCOPE_MISMATCH",
] as const;

// purpose is stored on-chain as keccak256(string); reverse-map the known approved purposes
// so live mode can show readable labels. Hashes computed via viem keccak256 at module load.
export const APPROVED_PURPOSES = [
  "emergency_shelter",
  "medical_supplies",
  "clean_water",
  "evacuation_transport",
] as const;
