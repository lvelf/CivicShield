// DonorRegistry: opt-in, self-attested donor regions. The map joins on-chain `Donated` amounts with
// `regionOf` locations by donor address. Donors who never call declare() stay anonymous.
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import deployment from "@/src/deployments/base-mainnet.json";
import { getLogsChunked } from "./logs";

export const REGISTRY_ADDRESS = (deployment.DonorRegistry ?? "") as string;
export const REGISTRY_LIVE = /^0x[a-fA-F0-9]{40}$/.test(REGISTRY_ADDRESS);
const REGISTRY_DEPLOY_BLOCK = Number((deployment as { DonorRegistryBlock?: number }).DonorRegistryBlock ?? 0);

export const REGISTRY_ABI = [
  {
    type: "function",
    name: "declare",
    stateMutability: "nonpayable",
    inputs: [{ name: "region", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "regionOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "event",
    name: "RegionDeclared",
    inputs: [
      { name: "donor", type: "address", indexed: true },
      { name: "region", type: "string", indexed: false },
    ],
  },
] as const;

const client = createPublicClient({ chain: base, transport: http("https://base.publicnode.com") });
const DECLARED = parseAbiItem("event RegionDeclared(address indexed donor, string region)");

/** Latest declared region per donor address (lowercased keys). Empty if the registry isn't live. */
export async function fetchRegions(): Promise<Record<string, string>> {
  if (!REGISTRY_LIVE) return {};
  try {
    const logs = await getLogsChunked(client, {
      address: REGISTRY_ADDRESS as `0x${string}`,
      event: DECLARED,
      fromBlock: BigInt(REGISTRY_DEPLOY_BLOCK),
    });
    // Last write wins — logs are returned in ascending block/log order.
    const out: Record<string, string> = {};
    for (const l of logs) {
      const donor = (l.args.donor ?? "").toString().toLowerCase();
      const region = (l.args.region ?? "").toString();
      if (donor) out[donor] = region;
    }
    return out;
  } catch {
    return {};
  }
}
