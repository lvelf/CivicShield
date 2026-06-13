import { createClient, getContractCallsQuote } from "@lifi/sdk";
import { encodeFunctionData } from "viem";
import { POOL_ABI } from "./contract";

// LI.FI Composer donation into the live Base-mainnet pool. Same flow Nuo proved on-chain
// (tx 0x75ed2d4d…): pay native ETH on Base → LI.FI swaps to USDC and calls donate() in one
// atomic transaction. We only ask LI.FI for the transactionRequest and let the browser wallet
// sign it — no executor/provider wiring, which keeps it stable.

const POOL = "0x5e9972027d4f03824ac0e5da446f0afb5bfffcf5";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NATIVE = "0x0000000000000000000000000000000000000000"; // ETH on Base
const BASE = 8453;

const lifi = createClient({ integrator: "civicshield" });

/** Returns the LI.FI transactionRequest the wallet should sign to donate `amountUsdc` USDC. */
export async function getDonateTx(account: `0x${string}`, amountUsdc: number) {
  const amount = BigInt(Math.round(amountUsdc * 1_000_000)).toString(); // USDC base units (6 dp)

  // NOTE (pitfall 1 — needs Nuo's redeploy): when called via LI.FI, msg.sender inside donate()
  // is the LI.FI executor, NOT the donor. The live contract emits Donated(msg.sender), so
  // LI.FI donations all log the executor address. Once the contract is redeployed as
  // donate(uint256 amount, address donor) emitting Donated(donor), add `account` as the 2nd arg:
  //   args: [BigInt(amount), account]
  const donateCalldata = encodeFunctionData({
    abi: POOL_ABI,
    functionName: "donate",
    args: [BigInt(amount)],
  });

  const step = await getContractCallsQuote(lifi, {
    fromChain: BASE,
    fromToken: NATIVE,
    fromAddress: account,
    toChain: BASE,
    toToken: USDC_BASE,
    toAmount: amount, // ask LI.FI to deliver at least this much USDC to the contract call
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
  });

  // Pitfall 2 — slippage guard. donate() pulls exactly `amount`; the swap output floats between
  // quote and execution. If the guaranteed floor (toAmountMin) is below what donate() will pull,
  // the executor's transferFrom would revert and the user wastes a signature. Fail fast instead.
  if (BigInt(step.estimate.toAmountMin) < BigInt(amount)) {
    throw new Error("Slippage too high right now — please try again.");
  }

  const tr = step.transactionRequest;
  if (!tr || !tr.to || !tr.data) throw new Error("LI.FI returned no executable transaction");
  return {
    to: tr.to as `0x${string}`,
    data: tr.data as `0x${string}`,
    value: tr.value ? BigInt(tr.value) : BigInt(0),
    gas: tr.gasLimit ? BigInt(tr.gasLimit) : undefined,
  };
}
