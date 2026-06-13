// Submits a proposal on-chain via CivicShieldPool.proposeRelease (onlyAgent). This is the ONLY
// on-chain power the agent has — it cannot move funds; executeRelease + policy decide that.
// Signing goes through the Signer abstraction (local key / Privy Agent Wallet / Dynamic).
import { createPublicClient, encodeFunctionData, http, keccak256, parseEventLogs, toBytes, type Hex } from 'viem'
import { createSigner } from './signer.ts'
import type { DraftProposal } from './types.ts'

const POOL_ABI = [
	{
		type: 'function',
		name: 'proposeRelease',
		stateMutability: 'nonpayable',
		inputs: [
			{
				name: 'p',
				type: 'tuple',
				components: [
					{ name: 'recipient', type: 'address' },
					{ name: 'amount', type: 'uint256' },
					{ name: 'purpose', type: 'bytes32' },
					{ name: 'eventId', type: 'bytes32' },
					{ name: 'reasoning', type: 'string' },
				],
			},
		],
		outputs: [{ name: 'id', type: 'uint256' }],
	},
	{
		type: 'event',
		name: 'ProposalCreated',
		inputs: [
			{ name: 'id', type: 'uint256', indexed: true },
			{ name: 'recipient', type: 'address', indexed: true },
			{ name: 'amount', type: 'uint256', indexed: false },
			{ name: 'purpose', type: 'bytes32', indexed: false },
			{ name: 'eventId', type: 'bytes32', indexed: true },
		],
	},
] as const

export function purposeHash(purpose: string): Hex {
	return keccak256(toBytes(purpose))
}

export function eventIdOf(alertId: string): Hex {
	return keccak256(toBytes(alertId))
}

export async function submitProposal(p: DraftProposal): Promise<{ hash: Hex; id: bigint }> {
	const rpc = process.env.RPC_URL ?? 'https://mainnet.base.org'
	const pool = (process.env.POOL_ADDRESS ?? '0x8df17313f37f5418868f1c3c369bbde4dba9daa6') as Hex

	// agent role -> Privy by default in prod; local for dev. Set AGENT_SIGNER=local|privy|dynamic.
	const signer = await createSigner(process.env.AGENT_SIGNER ?? 'local', rpc)

	const data = encodeFunctionData({
		abi: POOL_ABI,
		functionName: 'proposeRelease',
		args: [{ recipient: p.recipient, amount: p.amount, purpose: purposeHash(p.purpose), eventId: p.eventId, reasoning: p.reasoning }],
	})
	const hash = await signer.sendTransaction({ to: pool, data })

	const pub = createPublicClient({ transport: http(rpc) })
	const receipt = await pub.waitForTransactionReceipt({ hash })
	const logs = parseEventLogs({ abi: POOL_ABI, eventName: 'ProposalCreated', logs: receipt.logs })
	const id = (logs[0]?.args as { id: bigint } | undefined)?.id ?? 0n
	return { hash, id }
}
