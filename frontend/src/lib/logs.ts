// Public Base RPCs cap eth_getLogs to a small block span (base.publicnode.com silently returns
// nothing past ~10k blocks). So we scan from a contract's deploy block to head in safe-sized
// chunks, fired in parallel, and concatenate. Keeps the map's event reads from coming back empty.
import type { AbiEvent, Address, PublicClient, GetLogsReturnType } from "viem";

const CHUNK = 9000n; // under the ~10k-block getLogs limit on public Base RPCs

// Only the two methods we need — avoids coupling to the client's chain-specific generics.
type LogClient = Pick<PublicClient, "getLogs" | "getBlockNumber">;

export async function getLogsChunked<TEvent extends AbiEvent>(
  client: LogClient,
  params: { address: Address; event: TEvent; fromBlock: bigint },
): Promise<GetLogsReturnType<TEvent>> {
  const latest = await client.getBlockNumber();
  const from = params.fromBlock > 0n ? params.fromBlock : 0n;

  const ranges: { from: bigint; to: bigint }[] = [];
  for (let start = from; start <= latest; start += CHUNK + 1n) {
    const end = start + CHUNK > latest ? latest : start + CHUNK;
    ranges.push({ from: start, to: end });
  }

  const batches = await Promise.all(
    ranges.map((r) =>
      client
        .getLogs({ address: params.address, event: params.event, fromBlock: r.from, toBlock: r.to })
        .catch(() => [] as GetLogsReturnType<TEvent>),
    ),
  );
  return batches.flat() as GetLogsReturnType<TEvent>;
}
