import type { Abi } from "viem";
import abi from "@/src/abi/CivicShieldPool.json";

// CivicShieldPool ABI (extracted from Nuo's compiled contract — OnChain branch).
export const POOL_ABI = abi as unknown as Abi;

// Deployed address comes from the environment. Until Nuo deploys, this is unset and the
// app falls back to mock fixtures. Set NEXT_PUBLIC_POOL_ADDRESS in .env.local to go live.
export const POOL_ADDRESS = (process.env.NEXT_PUBLIC_POOL_ADDRESS ?? "") as `0x${string}` | "";

// true once a real address is configured — flips the whole UI from mocks to on-chain reads.
export const IS_LIVE = /^0x[a-fA-F0-9]{40}$/.test(POOL_ADDRESS);

// Which chain the pool is deployed on. 84532 = Base Sepolia (rehearsal), 8453 = Base mainnet.
export const POOL_CHAIN_ID = Number(process.env.NEXT_PUBLIC_POOL_CHAIN_ID ?? "84532");

// ---- enum mappings (contract returns uints; mirror docs/INTERFACES.md) ----

export const STATUS = ["PENDING", "EXECUTED", "BLOCKED"] as const;
export const FAIL_REASON_NAME = [
  "NONE",
  "RISK_BELOW_THRESHOLD",
  "AMOUNT_OVER_EVENT_CAP",
  "DAILY_LIMIT_EXCEEDED",
  "RECIPIENT_NOT_VERIFIED",
  "PURPOSE_NOT_APPROVED",
] as const;

// purpose is stored on-chain as keccak256(string); reverse-map the known approved purposes
// so live mode can show readable labels. Hashes computed via viem keccak256 at module load.
export const APPROVED_PURPOSES = [
  "emergency_shelter",
  "medical_supplies",
  "clean_water",
  "evacuation_transport",
] as const;
