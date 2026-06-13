import { encodeFunctionData } from "viem";
import { POOL_ABI, POOL_ADDRESS, USDC_ADDRESS, POOL_CHAIN_ID } from "./contract";

// LI.FI Composer donation into the live Base-mainnet pool. Same flow Nuo proved on-chain
// (tx 0x75ed2d4d…): pay native ETH on Base → LI.FI swaps to USDC and calls donate() in one
// atomic transaction. We call the LI.FI REST API directly (proven to return a valid
// transactionRequest) and let the browser wallet sign it — no @lifi/sdk client, no executor
// wiring, fewest moving parts. Pool/USDC/chain come from the deployment file via contract.ts.

const POOL = POOL_ADDRESS;
const USDC_BASE = USDC_ADDRESS;
const NATIVE = "0x0000000000000000000000000000000000000000"; // ETH on Base
const BASE = String(POOL_CHAIN_ID);

/** Returns the LI.FI transactionRequest the wallet should sign to donate `amountUsdc` USDC. */
export async function getDonateTx(account: `0x${string}`, amountUsdc: number) {
  const amount = BigInt(Math.round(amountUsdc * 1_000_000)).toString(); // USDC base units (6 dp)

  // donate(uint256 amount, address donor): pass the connected wallet as `donor` so the Donated
  // event records the real donor, not the LI.FI executor (which is msg.sender during the call).
  const donateCalldata = encodeFunctionData({
    abi: POOL_ABI,
    functionName: "donate",
    args: [BigInt(amount), account],
  });

  const body = {
    fromChain: BASE,
    fromToken: NATIVE,
    fromAddress: account,
    toChain: BASE,
    toToken: USDC_BASE,
    toAmount: amount, // LI.FI delivers this much USDC to the contract call (its fromAmount)
    integrator: "civicshield",
    contractCalls: [
      {
        fromAmount: amount,
        fromTokenAddress: USDC_BASE,
        toContractAddress: POOL,
        toContractCallData: donateCalldata,
        toContractGasLimit: "120000",
      },
    ],
  };

  const res = await fetch("https://li.quest/v1/quote/contractCalls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `LI.FI quote failed (HTTP ${res.status})`);
  }

  const step = await res.json();
  const tr = step.transactionRequest;
  if (!tr || !tr.to || !tr.data) throw new Error("LI.FI returned no executable transaction");
  // LI.FI returns a complete LEGACY tx (gasPrice + gasLimit). Send it faithfully so viem doesn't
  // re-derive EIP-1559 fees via RPC methods the wallet's Base node may not support (which surfaces
  // as "Version of JSON-RPC protocol is not supported").
  return {
    to: tr.to as `0x${string}`,
    data: tr.data as `0x${string}`,
    value: tr.value ? BigInt(tr.value) : BigInt(0),
    gas: tr.gasLimit ? BigInt(tr.gasLimit) : undefined,
    gasPrice: tr.gasPrice ? BigInt(tr.gasPrice) : undefined,
  };
}
