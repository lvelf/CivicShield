// Keeper: the backend process that SETTLES proposals by calling executeRelease — the piece that
// makes "release" automatic instead of manual. executeRelease is permissionless by design (the
// policy guards the money, not the caller), so the keeper is just a poker with no special power:
//
//   - fresh PENDING proposals      -> executeRelease (clean+small pays now; clean+large -> PENDING_REVIEW; bad -> BLOCKED)
//   - PENDING_REVIEW that a Ledger has approved (ReleaseApproved event) -> executeRelease (pays out)
//
// Two modes:
//   sweep (default, cron-friendly): one pass over all proposals + recent approvals, then exit.
//   --watch (long-running server):  subscribe to ProposalCreated + ReleaseApproved and settle live.
//
//   KEEPER_SIGNER=local|privy|dynamic  (executeRelease is permissionless — any funded key works)
import { createPublicClient, encodeFunctionData, http, parseAbiItem, type Hex } from 'viem'
import { createSigner } from './signer.ts'

const RPC = process.env.RPC_URL ?? 'https://mainnet.base.org'
const POOL = (process.env.POOL_ADDRESS ?? '0x8df17313f37f5418868f1c3c369bbde4dba9daa6') as Hex
const STATUS = ['PENDING', 'EXECUTED', 'BLOCKED', 'PENDING_REVIEW'] as const

const POOL_ABI = [
	{ type: 'function', name: 'proposalCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
	{
		type: 'function',
		name: 'getProposal',
		stateMutability: 'view',
		inputs: [{ name: 'id', type: 'uint256' }],
		outputs: [
			{ type: 'tuple', components: [
				{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' },
				{ name: 'purpose', type: 'bytes32' }, { name: 'eventId', type: 'bytes32' }, { name: 'reasoning', type: 'string' },
			] },
			{ type: 'tuple', components: [
				{ name: 'status', type: 'uint8' }, { name: 'passed', type: 'bool' }, { name: 'failReason', type: 'uint8' },
			] },
		],
	},
	{ type: 'function', name: 'executeRelease', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }], outputs: [] },
] as const

const RELEASE_APPROVED = parseAbiItem('event ReleaseApproved(uint256 indexed id, address indexed approver)')
const PROPOSAL_CREATED = parseAbiItem('event ProposalCreated(uint256 indexed id, address indexed recipient, uint256 amount, bytes32 purpose, bytes32 indexed eventId)')

const pub = createPublicClient({ transport: http(RPC) })

async function statusOf(id: bigint): Promise<number> {
	const [, verdict] = (await pub.readContract({ address: POOL, abi: POOL_ABI, functionName: 'getProposal', args: [id] })) as [unknown, { status: number }]
	return verdict.status
}

// Send executeRelease(id) and report the resulting status. Never throws on policy outcome — the
// contract records BLOCKED/PENDING_REVIEW on-chain instead of reverting.
async function settle(signer: { sendTransaction: (tx: { to: Hex; data: Hex }) => Promise<Hex> }, id: bigint) {
	const data = encodeFunctionData({ abi: POOL_ABI, functionName: 'executeRelease', args: [id] })
	const hash = await signer.sendTransaction({ to: POOL, data })
	await pub.waitForTransactionReceipt({ hash })
	const after = await statusOf(id)
	console.log(`[keeper] executeRelease(${id}) -> ${STATUS[after] ?? after}  tx=${hash}`)
	return after
}

async function getSigner() {
	return createSigner(process.env.KEEPER_SIGNER ?? 'local', RPC)
}

// One pass: settle fresh PENDING proposals, then settle any PENDING_REVIEW that a Ledger approved.
export async function sweep() {
	const signer = await getSigner()
	const count = Number(await pub.readContract({ address: POOL, abi: POOL_ABI, functionName: 'proposalCount' }))
	console.log(`[keeper] sweep: ${count} proposals`)

	// 1. fresh PENDING -> execute (small clean pays; large clean -> PENDING_REVIEW; bad -> BLOCKED)
	for (let i = 0; i < count; i++) {
		const id = BigInt(i)
		if ((await statusOf(id)) === 0) await settle(signer, id)
	}

	// 2. Ledger-approved large releases -> execute (pays out). We learn which are approved from the
	//    ReleaseApproved events; we only act on ones still held as PENDING_REVIEW (idempotent).
	const latest = await pub.getBlockNumber()
	const fromBlock = latest > 9000n ? latest - 9000n : 0n
	const approved = await pub.getLogs({ address: POOL, event: RELEASE_APPROVED, fromBlock, toBlock: latest })
	const ids = [...new Set(approved.map((l) => (l.args as { id: bigint }).id))]
	for (const id of ids) {
		if ((await statusOf(id)) === 3) await settle(signer, id)
	}
	console.log('[keeper] sweep done')
}

// Long-running: settle proposals the moment they are created or approved.
export async function watch() {
	const signer = await getSigner()
	console.log('[keeper] watching ProposalCreated + ReleaseApproved…')
	pub.watchEvent({
		address: POOL,
		event: PROPOSAL_CREATED,
		onLogs: (logs) => logs.forEach((l) => settle(signer, (l.args as { id: bigint }).id).catch((e) => console.error('[keeper]', e))),
	})
	pub.watchEvent({
		address: POOL,
		event: RELEASE_APPROVED,
		onLogs: (logs) => logs.forEach((l) => settle(signer, (l.args as { id: bigint }).id).catch((e) => console.error('[keeper]', e))),
	})
}

async function main() {
	await sweep() // always do one settling pass first
	if (process.argv.includes('--watch')) {
		await watch()
		await new Promise(() => {}) // keep the process alive
	}
}

main().catch((e) => {
	console.error('[keeper] fatal', e)
	process.exit(1)
})
