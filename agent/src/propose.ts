// Submits a proposal on-chain via CivicShieldPool.proposeRelease (onlyAgent). This is the ONLY
// on-chain power the agent has — it cannot move funds; executeRelease + policy decide that.
import { createPublicClient, createWalletClient, http, keccak256, parseEventLogs, toBytes, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
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
	const pk = process.env.PRIVATE_KEY as Hex | undefined
	if (!pk) throw new Error('set PRIVATE_KEY (agent key — must equal the pool.agent)')
	const rpc = process.env.RPC_URL ?? 'https://mainnet.base.org'
	const pool = (process.env.POOL_ADDRESS ?? '0xc8f383373b05243419281c5073c1bc39f4d9c7f4') as Hex

	const account = privateKeyToAccount(pk)
	const pub = createPublicClient({ transport: http(rpc) })
	const chainId = await pub.getChainId()
	const chain = {
		id: chainId,
		name: `chain-${chainId}`,
		nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
		rpcUrls: { default: { http: [rpc] } },
	} as const
	const wallet = createWalletClient({ account, chain, transport: http(rpc) })

	const hash = await wallet.writeContract({
		address: pool,
		abi: POOL_ABI,
		functionName: 'proposeRelease',
		args: [{ recipient: p.recipient, amount: p.amount, purpose: purposeHash(p.purpose), eventId: p.eventId, reasoning: p.reasoning }],
	})
	const receipt = await pub.waitForTransactionReceipt({ hash })
	// Read the id from the ProposalCreated event — robust against RPC read-after-write lag.
	const logs = parseEventLogs({ abi: POOL_ABI, eventName: 'ProposalCreated', logs: receipt.logs })
	const id = (logs[0]?.args as { id: bigint } | undefined)?.id ?? 0n
	return { hash, id }
}
