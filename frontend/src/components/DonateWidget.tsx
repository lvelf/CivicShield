"use client";

import { useState } from "react";
import {
  useAccount,
  useBalance,
  useConnect,
  useConnectors,
  useSwitchChain,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther } from "viem";
import { getDonateTx } from "@/src/lib/lifi";
import { CITIES } from "@/src/lib/cities";
import { REGISTRY_ADDRESS, REGISTRY_ABI, REGISTRY_LIVE } from "@/src/lib/registry";

type Phase = "idle" | "connecting" | "quoting" | "signing" | "pending" | "error";

const PRESETS = [1, 5, 10];

function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const msg = raw.toLowerCase();
  // Only map errors we're CERTAIN about — everything else shows the raw message so we can debug.
  if (/user rejected|user denied|rejected the request/.test(msg)) return "You rejected the request in your wallet.";
  if (/insufficient funds/.test(msg)) return "Not enough ETH on Base mainnet to cover the donation + gas.";
  if (/no available quotes|no route|1002/.test(msg)) return "LI.FI couldn't find a route for this amount — try $5.";
  if (/no wallet/.test(msg)) return "No wallet found. Install MetaMask.";
  return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
}

export function DonateWidget() {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync } = useConnect();
  const connectors = useConnectors();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const [amount, setAmount] = useState(1);
  const [custom, setCustom] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);

  // Opt-in donor region: "" = stay anonymous. Stored on-chain via DonorRegistry.declare().
  const [region, setRegion] = useState("");
  const { writeContractAsync } = useWriteContract();
  const [regionHash, setRegionHash] = useState<`0x${string}` | undefined>();
  const [regionBusy, setRegionBusy] = useState(false);
  const { isSuccess: regionDone } = useWaitForTransactionReceipt({ hash: regionHash, chainId: 8453 });

  // Base-mainnet ETH balance — the donation pays real ETH on Base; testnet funds can't route.
  const { data: baseBalance } = useBalance({ address, chainId: 8453, query: { enabled: isConnected } });

  // Tx confirmation is derived from the receipt, not stored — avoids setState-in-effect.
  const { isSuccess } = useWaitForTransactionReceipt({ hash, chainId: 8453 });
  const isDone = !!hash && isSuccess;
  const pendingTx = phase === "pending" && !isSuccess;
  const busy = phase === "connecting" || phase === "quoting" || phase === "signing" || pendingTx;

  // Guard states: must be connected, on Base mainnet (8453), with real ETH to donate.
  const wrongNetwork = isConnected && chainId !== 8453;
  const noFunds = isConnected && chainId === 8453 && baseBalance !== undefined && baseBalance.value === BigInt(0);

  async function switchToBase() {
    setError(null);
    try {
      await switchChainAsync({ chainId: 8453 });
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function donate() {
    setError(null);
    setHash(undefined);
    if (!(amount > 0)) {
      setError("Enter an amount greater than 0.");
      setPhase("error");
      return;
    }
    try {
      let account = address;
      if (!isConnected) {
        setPhase("connecting");
        const connector = connectors.find((c) => c.id === "injected") ?? connectors[0];
        if (!connector) throw new Error("No wallet found. Install MetaMask.");
        const res = await connectAsync({ connector });
        account = res.accounts[0];
      }
      if (chainId !== 8453) await switchChainAsync({ chainId: 8453 });

      setPhase("quoting");
      const tx = await getDonateTx(account as `0x${string}`, amount);

      setPhase("signing");
      const h = await sendTransactionAsync({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gas: tx.gas,
        gasPrice: tx.gasPrice, // send LI.FI's legacy tx as-is (avoids EIP-1559 fee estimation)
        chainId: 8453,
      });
      setHash(h);
      setPhase("pending");
    } catch (e: unknown) {
      console.error("[donate] raw error:", e);
      setError(friendlyError(e));
      setPhase("error");
    }
  }

  async function declareRegion() {
    setError(null);
    setRegionHash(undefined);
    if (!region) return;
    try {
      setRegionBusy(true);
      if (!isConnected) {
        const connector = connectors.find((c) => c.id === "injected") ?? connectors[0];
        if (!connector) throw new Error("No wallet found. Install MetaMask.");
        await connectAsync({ connector });
      }
      if (chainId !== 8453) await switchChainAsync({ chainId: 8453 });
      const h = await writeContractAsync({
        address: REGISTRY_ADDRESS as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: "declare",
        args: [region],
        chainId: 8453,
      });
      setRegionHash(h);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRegionBusy(false);
    }
  }

  const label =
    phase === "connecting" ? "Connecting wallet…" :
    phase === "quoting" ? "Routing via LI.FI…" :
    phase === "signing" ? "Confirm in wallet…" :
    pendingTx ? "Depositing…" :
    wrongNetwork ? "Switch to Base mainnet" :
    noFunds ? "No Base ETH — top up to donate" :
    isDone ? "Donate again" :
    `Donate $${amount} — any token, one click`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="font-serif text-xl font-semibold text-stone-900">Fund the pool</h3>
      <p className="mt-1 text-sm text-stone-500">
        Pay ETH on Base — LI.FI Composer swaps to USDC and deposits into the pool in one signature.
      </p>
      <p className="mt-1 text-xs text-amber-700">
        Real ETH on Base mainnet. LI.FI Composer is mainnet-only — testnet funds can&apos;t be used.
      </p>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setCustom(false);
              setAmount(p);
            }}
            disabled={busy}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              !custom && amount === p
                ? "border-teal-600 bg-teal-50 text-teal-700"
                : "border-stone-200 text-stone-600 hover:border-stone-300"
            }`}
          >
            ${p}
          </button>
        ))}
        <button
          onClick={() => setCustom(true)}
          disabled={busy}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            custom
              ? "border-teal-600 bg-teal-50 text-teal-700"
              : "border-stone-200 text-stone-600 hover:border-stone-300"
          }`}
        >
          Other
        </button>
      </div>

      {custom && (
        <div className="mt-2 flex items-center rounded-lg border border-stone-200 px-3 focus-within:border-teal-600">
          <span className="text-sm text-stone-400">$</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            disabled={busy}
            autoFocus
            className="w-full bg-transparent px-2 py-2 text-sm text-stone-900 outline-none disabled:opacity-50"
            placeholder="Amount in USD"
          />
          <span className="text-xs text-stone-400">USDC</span>
        </div>
      )}

      <button
        onClick={wrongNetwork ? switchToBase : donate}
        disabled={busy || noFunds}
        className="mt-4 w-full rounded-lg bg-stone-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>

      {isDone && (
        <p className="mt-3 text-center text-sm text-emerald-700">
          ✓ Deposited.{" "}
          <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="underline">
            View on BaseScan
          </a>
        </p>
      )}
      {pendingTx && hash && (
        <p className="mt-3 text-center text-xs text-stone-400">
          <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="underline">
            tx {hash.slice(0, 10)}… confirming
          </a>
        </p>
      )}
      {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}

      {REGISTRY_LIVE && (
        <div className="mt-5 border-t border-stone-100 pt-4">
          <label className="text-xs font-medium text-stone-600">
            Show where you&apos;re donating from <span className="text-stone-400">(optional, on-chain)</span>
          </label>
          <div className="mt-2 flex gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={regionBusy}
              className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-teal-600 disabled:opacity-50"
            >
              <option value="">Stay anonymous</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={declareRegion}
              disabled={!region || regionBusy}
              className="shrink-0 rounded-lg border border-teal-600 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {regionBusy ? "Signing…" : "Pin on map"}
            </button>
          </div>
          {regionDone && regionHash && (
            <p className="mt-2 text-xs text-emerald-700">
              ✓ {region} pinned.{" "}
              <a href={`https://basescan.org/tx/${regionHash}`} target="_blank" rel="noopener noreferrer" className="underline">
                tx
              </a>
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-stone-400">
            Self-attested via DonorRegistry — anonymous by default. Use the same wallet you donate with.
          </p>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-stone-400">
        {!isConnected
          ? "Wallet connects on donate"
          : chainId === 8453
          ? `${address?.slice(0, 6)}…${address?.slice(-4)} · Base mainnet${
              baseBalance ? ` · ${Number(formatEther(baseBalance.value)).toFixed(4)} ETH` : ""
            }`
          : `${address?.slice(0, 6)}…${address?.slice(-4)} · wrong network`}
      </p>
    </div>
  );
}
