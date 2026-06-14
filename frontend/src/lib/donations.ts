// Real on-chain donations, read from the pool's `Donated` events. The map draws ONE inbound arc
// per real donation (not a fixed list of cities). On-chain donors are pseudonymous addresses with
// no gelocation, so the arc *positions* are illustrative — but the count, donor, and amount are real.
import { createPublicClient, http, parseAbiItem, formatUnits } from "viem";
import { base } from "viem/chains";
import { POOL_ADDRESS, POOL_DEPLOY_BLOCK } from "./contract";
import { getLogsChunked } from "./logs";

const client = createPublicClient({ chain: base, transport: http("https://base.publicnode.com") });
const DONATED = parseAbiItem("event Donated(address indexed from, uint256 amount, bytes32 indexed scope)");

export interface Donation {
  donor: `0x${string}`;
  amountUsdc: number;
}

export async function fetchDonations(): Promise<Donation[]> {
  try {
    const logs = await getLogsChunked(client, {
      address: POOL_ADDRESS,
      event: DONATED,
      fromBlock: BigInt(POOL_DEPLOY_BLOCK),
    });
    return logs.map((l) => ({
      donor: (l.args.from ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      amountUsdc: Number(formatUnits((l.args.amount ?? 0n) as bigint, 6)),
    }));
  } catch {
    return [];
  }
}
