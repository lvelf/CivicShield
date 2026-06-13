"use client";

import { useState } from "react";
import {
  useAccount,
  useConnect,
  useConnectors,
  useSwitchChain,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { getDonateTx } from "@/src/lib/lifi";

type Phase = "idle" | "connecting" | "quoting" | "signing" | "pending" | "error";

const PRESETS = [1, 5, 10];

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

  // Tx confirmation is derived from the receipt, not stored — avoids setState-in-effect.
  const { isSuccess } = useWaitForTransactionReceipt({ hash, chainId: 8453 });
  const isDone = !!hash && isSuccess;
  const pendingTx = phase === "pending" && !isSuccess;
  const busy = phase === "connecting" || phase === "quoting" || phase === "signing" || pendingTx;

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
      const h = await sendTransactionAsync({ to: tx.to, data: tx.data, value: tx.value, gas: tx.gas, chainId: 8453 });
      setHash(h);
      setPhase("pending");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Donation failed";
      setError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      setPhase("error");
    }
  }

  const label =
    phase === "connecting" ? "Connecting wallet…" :
    phase === "quoting" ? "Routing via LI.FI…" :
    phase === "signing" ? "Confirm in wallet…" :
    pendingTx ? "Depositing…" :
    isDone ? "Donate again" :
    `Donate $${amount} — any token, one click`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="font-serif text-xl font-semibold text-stone-900">Fund the pool</h3>
      <p className="mt-1 text-sm text-stone-500">
        Pay ETH on Base — LI.FI Composer swaps to USDC and deposits into the pool in one signature.
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
        onClick={donate}
        disabled={busy}
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

      <p className="mt-3 text-center text-[11px] text-stone-400">
        {isConnected ? `${address?.slice(0, 6)}…${address?.slice(-4)} · Base` : "Wallet connects on donate"}
      </p>
    </div>
  );
}
