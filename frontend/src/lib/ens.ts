import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { POOL_ADDRESS } from "./contract";

// ENS lives on Ethereum L1 (NOT Base). We resolve against Ethereum Sepolia, where the names
// are free to register. Switch `chain` to `mainnet` if you register on Ethereum mainnet instead.
export const ensClient = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
});

// The names to register on Sepolia (app.ens.domains, network = Sepolia).
export const AGENT_ENS = "flood-risk-agent.eth";
export const RECIPIENT_ENS = "shelter-fund.eth";

// ENSIP-26 agent text records to set on AGENT_ENS (key → what it means).
export const AGENT_TEXT_KEYS = [
  "agent.hazards",
  "agent.dataSources",
  "agent.proposalScope",
  "agent.policyContract",
] as const;

// Shown before the names are registered, so the card looks complete in preview.
export const AGENT_FALLBACK: Record<string, string> = {
  "agent.hazards": "flood",
  "agent.dataSources": "api.weather.gov/alerts/active",
  "agent.proposalScope": "US flood relief, mainnet demo-scale",
  "agent.policyContract": `${POOL_ADDRESS.slice(0, 6)}…${POOL_ADDRESS.slice(-4)}`,
};
