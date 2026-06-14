// CivicShield — Ledger human-in-the-loop approval of a large relief release.
//
// The AI agent only PROPOSES; a release at/above the review threshold is held on-chain as
// PENDING_REVIEW and cannot move until a Ledger device physically approves it. This script drives
// that approval: it asks the Ledger (real device or Speculos emulator) to sign `approveRelease(id)`,
// then broadcasts the signed transaction to Base. The private key never leaves the device.
//
//   npm run address              -> print the Ledger account address (set it as the pool approver)
//   npm run approve -- <id>      -> sign + broadcast approveRelease(<id>) from the Ledger
//
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DeviceActionStatus,
  DeviceStatus,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import { firstValueFrom, filter, take, timeout } from "rxjs";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  serializeTransaction,
  hexToBytes,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { dmk } from "./dmk";

const DEPLOYMENT = JSON.parse(
  readFileSync(resolve(__dirname, "../../contracts/deployments/base-mainnet.json"), "utf8"),
) as { CivicShieldPool: `0x${string}`; chainId: number };

const POOL = DEPLOYMENT.CivicShieldPool;
const RPC = process.env.RPC_URL ?? "https://base.publicnode.com";
const DERIVATION_PATH = process.env.DERIVATION_PATH ?? "44'/60'/0'/0/0";
const TIMEOUT_MS = 120_000;

const APPROVE_ABI = [
  { type: "function", name: "approveRelease", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
] as const;

const client = createPublicClient({ chain: base, transport: http(RPC) });

function log(msg: string) {
  process.stderr.write(`${msg}\n`);
}

// Drive any DMK signer observable to its output, printing the on-device prompt as it goes.
function runAction<T>(action: { observable: unknown }): Promise<T> {
  return new Promise((resolveP, rejectP) => {
    (action.observable as { subscribe: (o: object) => void }).subscribe({
      next: (state: { status: string; intermediateValue?: { requiredUserInteraction?: string }; output?: T; error?: unknown }) => {
        if (state.status === DeviceActionStatus.Pending) {
          const i = state.intermediateValue?.requiredUserInteraction;
          if (i === UserInteractionRequired.SignTransaction) log("⏳ Review & approve the release on your Ledger…");
          else if (i === UserInteractionRequired.UnlockDevice) log("🔓 Unlock your Ledger (enter PIN)…");
          else if (i === UserInteractionRequired.ConfirmOpenApp) log("⏳ Confirm opening the Ethereum app…");
        } else if (state.status === DeviceActionStatus.Completed) {
          resolveP(state.output as T);
        } else if (state.status === DeviceActionStatus.Error) {
          rejectP(state.error);
        } else if (state.status === DeviceActionStatus.Stopped) {
          rejectP(new Error("Cancelled on device"));
        }
      },
      error: (err: unknown) => rejectP(err),
    });
  });
}

async function connect(): Promise<string> {
  log("⏳ Connecting to Ledger (Speculos emulator or device)…");
  const devices = await firstValueFrom(
    dmk.listenToAvailableDevices({}).pipe(filter((l) => l.length > 0), timeout(TIMEOUT_MS)),
  );
  const sessionId = await dmk.connect({ device: devices[0]! });
  const st = await firstValueFrom(dmk.getDeviceSessionState({ sessionId }).pipe(take(1)));
  if (st.deviceStatus === DeviceStatus.LOCKED) {
    log("🔓 Device locked — unlock it…");
    await firstValueFrom(
      dmk.getDeviceSessionState({ sessionId }).pipe(filter((s) => s.deviceStatus !== DeviceStatus.LOCKED), take(1), timeout(TIMEOUT_MS)),
    );
  }
  log("✅ Connected.");
  return sessionId;
}

// Normalize a Ledger r/s component to a 0x-prefixed 32-byte hex string.
function hex32(v: string): Hex {
  const h = v.startsWith("0x") ? v.slice(2) : v;
  return `0x${h.padStart(64, "0")}` as Hex;
}

async function main() {
  const args = process.argv.slice(2);
  const addressOnly = args.includes("--address");
  const idArg = args.find((a) => /^\d+$/.test(a));

  const sessionId = await connect();
  const signer = new SignerEthBuilder({ dmk, sessionId }).build();

  // 1. Get the Ledger account address (this is the on-chain `approver`).
  const { address } = await runAction<{ address: string }>(
    signer.getAddress(DERIVATION_PATH, { checkOnDevice: false }),
  );
  log(`🔑 Ledger approver address: ${address}`);

  if (addressOnly) {
    console.log(address);
    await dmk.disconnect({ sessionId });
    return;
  }

  if (!idArg) throw new Error("Pass a proposal id, e.g. `npm run approve -- 0`");
  const id = BigInt(idArg);

  // 2. Build the unsigned approveRelease(id) transaction on Base.
  const data = encodeFunctionData({ abi: APPROVE_ABI, functionName: "approveRelease", args: [id] });
  const [nonce, fees, gas] = await Promise.all([
    client.getTransactionCount({ address: address as `0x${string}` }),
    client.estimateFeesPerGas(),
    client.estimateGas({ account: address as `0x${string}`, to: POOL, data }),
  ]);
  const unsigned = {
    chainId: base.id,
    type: "eip1559" as const,
    nonce,
    to: POOL,
    value: 0n,
    data,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  };
  log(`📝 approveRelease(${id})  pool=${POOL}  gas=${gas}  nonce=${nonce}`);

  // 3. Ledger signs (physical confirmation on device / Speculos screen). Key never leaves the device.
  const txBytes = hexToBytes(serializeTransaction(unsigned));
  const sig = await runAction<{ r: string; s: string; v: number }>(
    signer.signTransaction(DERIVATION_PATH, txBytes),
  );
  const yParity = Number(sig.v) <= 1 ? Number(sig.v) : Number(sig.v) % 2;
  const signed = serializeTransaction(unsigned, { r: hex32(sig.r), s: hex32(sig.s), yParity });

  // 4. Broadcast the device-signed transaction.
  const hash = await client.sendRawTransaction({ serializedTransaction: signed });
  log(`✅ Approved on-chain. ReleaseApproved tx:`);
  console.log(`https://basescan.org/tx/${hash}`);

  await dmk.disconnect({ sessionId });
}

main().catch((err) => {
  log(`❌ ${(err as Error)?.message ?? String(err)}`);
  process.exit(1);
});
