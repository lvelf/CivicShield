// CivicShield relayer: the bridge between the CRE hazard workflow and the on-chain policy.
// Fetches live alerts, computes the top flood risk (same scoring as cre/src/score.ts), derives
// eventId + eventScope, and calls CivicShieldPool.submitRiskScore(eventId, score, eventScope).
//
//   PRIVATE_KEY=0x... POOL_ADDRESS=0x... RPC_URL=... AREA=IL npm run submit
//
// Scope comes from THIS trusted path (region|hazard), never from the agent's proposal.
import { createPublicClient, createWalletClient, http, keccak256, toBytes, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { topFloodRisk, type CapAlert } from '../../cre/src/score.ts'

const RPC = process.env.RPC_URL ?? 'https://mainnet.base.org'
const POOL = (process.env.POOL_ADDRESS ?? '0x8df17313f37f5418868f1c3c369bbde4dba9daa6') as Hex
const AREA = process.env.AREA ?? 'IL'
const SCOPE_STR = process.env.FUND_SCOPE ?? 'US|flood' // must match the pool's fundScope
const UA = 'CivicShield-relayer/1.0 (ETHGlobal hackathon; nuo.rosemary@gmail.com)'

const POOL_ABI = [
	{
		type: 'function',
		name: 'submitRiskScore',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'eventId', type: 'bytes32' },
			{ name: 'score', type: 'uint8' },
			{ name: 'eventScope', type: 'bytes32' },
		],
		outputs: [],
	},
	{ type: 'function', name: 'riskScoreOf', stateMutability: 'view', inputs: [{ name: 'e', type: 'bytes32' }], outputs: [{ type: 'uint8' }] },
	{ type: 'function', name: 'fundScope', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
] as const

async function fetchFloodAlerts(area: string): Promise<CapAlert[]> {
	const res = await fetch(`https://api.weather.gov/alerts/active?area=${area}&event=Flood%20Warning`, {
		headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
	})
	if (!res.ok) throw new Error(`weather.gov ${res.status}`)
	const data = (await res.json()) as { features: { properties: CapAlert }[] }
	return data.features.map((f) => f.properties)
}

async function main() {
	const pk = process.env.PRIVATE_KEY as Hex | undefined
	if (!pk) throw new Error('set PRIVATE_KEY (relayer key)')

	const top = topFloodRisk(await fetchFloodAlerts(AREA))
	if (!top) {
		console.log(`No active flood alert in ${AREA}; nothing to submit.`)
		return
	}

	const eventId = keccak256(toBytes(top.alert.id))
	const eventScope = keccak256(toBytes(SCOPE_STR))
	console.log(`Top flood: ${top.alert.event} | score=${top.riskScore} | id=${top.alert.id}`)
	console.log(`eventId=${eventId}`)
	console.log(`eventScope=keccak256("${SCOPE_STR}")=${eventScope}`)

	const account = privateKeyToAccount(pk)
	const pub = createPublicClient({ transport: http(RPC) })
	const chainId = await pub.getChainId()
	const chain = {
		id: chainId,
		name: `chain-${chainId}`,
		nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
		rpcUrls: { default: { http: [RPC] } },
	} as const

	// Sanity: relayer's scope must match the pool's fundScope, or every release will be blocked.
	const poolScope = await pub.readContract({ address: POOL, abi: POOL_ABI, functionName: 'fundScope' })
	if (poolScope.toLowerCase() !== eventScope.toLowerCase()) {
		throw new Error(`scope mismatch: pool.fundScope=${poolScope} but relayer scope=${eventScope}`)
	}

	const wallet = createWalletClient({ account, chain, transport: http(RPC) })
	const hash = await wallet.writeContract({
		address: POOL,
		abi: POOL_ABI,
		functionName: 'submitRiskScore',
		args: [eventId, top.riskScore, eventScope],
	})
	console.log(`submitRiskScore tx: ${hash}`)
	await pub.waitForTransactionReceipt({ hash })
	const onchain = await pub.readContract({ address: POOL, abi: POOL_ABI, functionName: 'riskScoreOf', args: [eventId] })
	console.log(`on-chain riskScore[eventId] = ${onchain}  (eventId is keccak256 of the NWS alert id)`)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
