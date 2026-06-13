// Signer abstraction so the agent (proposeRelease) and relayer (submitRiskScore) can be backed by
// a raw key (dev), a Privy Agent Wallet, or a Dynamic Server Wallet — without changing call sites.
//
//   provider = 'local'   -> PRIVATE_KEY via viem (works out of the box; for dev/testing)
//   provider = 'privy'   -> Privy Agent Wallet  (set PRIVY_APP_ID/PRIVY_APP_SECRET/PRIVY_WALLET_ID)
//   provider = 'dynamic' -> Dynamic Server Wallet (set DYNAMIC_ENV_ID/DYNAMIC_API_TOKEN/DYNAMIC_WALLET_ID)
//
// Each backend exposes the same minimal surface: getAddress() + sendTransaction({to,data,value}).
// Call sites build calldata with viem encodeFunctionData and stay provider-agnostic.
import { createPublicClient, createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export interface SignerTx {
	to: Hex
	data: Hex
	value?: bigint
}

export interface Signer {
	getAddress(): Promise<Hex>
	sendTransaction(tx: SignerTx): Promise<Hex> // returns the tx hash
}

function req(name: string): string {
	const v = process.env[name]
	if (!v) throw new Error(`missing env ${name}`)
	return v.trim() // CI secrets often carry a trailing newline; trim so creds/headers stay valid
}

async function chainOf(rpc: string) {
	const pub = createPublicClient({ transport: http(rpc) })
	const id = await pub.getChainId()
	return {
		pub,
		id,
		chain: {
			id,
			name: `chain-${id}`,
			nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
			rpcUrls: { default: { http: [rpc] } },
		} as const,
	}
}

// --- local: raw private key via viem (default; for dev/testing) --------------
function localSigner(rpc: string): Signer {
	const pk = req('PRIVATE_KEY') as Hex
	const account = privateKeyToAccount(pk.startsWith('0x') ? pk : (`0x${pk}` as Hex))
	return {
		async getAddress() {
			return account.address
		},
		async sendTransaction(tx) {
			const { chain } = await chainOf(rpc)
			const wallet = createWalletClient({ account, chain, transport: http(rpc) })
			return wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n })
		},
	}
}

// --- Privy Agent Wallet (@privy-io/server-auth v1.32) ------------------------
// Create a wallet first: `node --experimental-strip-types scripts/create-privy-wallet.ts`,
// then set PRIVY_WALLET_ID + PRIVY_WALLET_ADDRESS. Privy signs+broadcasts server-side.
async function privySigner(rpc: string): Promise<Signer> {
	const appId = req('PRIVY_APP_ID')
	const appSecret = req('PRIVY_APP_SECRET')
	const walletId = req('PRIVY_WALLET_ID')
	const address = req('PRIVY_WALLET_ADDRESS') as Hex
	const { PrivyClient } = await import('@privy-io/server-auth') // dynamic: only loaded if selected
	const privy = new PrivyClient(appId, appSecret)
	const { id: chainId } = await chainOf(rpc)
	return {
		async getAddress() {
			return address
		},
		async sendTransaction(tx) {
			const res = await privy.walletApi.ethereum.sendTransaction({
				walletId,
				caip2: `eip155:${chainId}`,
				// Privy reads tx fields under `transaction` (see ethereum.mjs).
				transaction: {
					to: tx.to,
					data: tx.data,
					value: tx.value !== undefined ? (`0x${tx.value.toString(16)}` as Hex) : '0x0',
					chainId,
				},
			})
			return res.hash as Hex
		},
	}
}

// --- Dynamic Server Wallet (skeleton — wire to your Dynamic server-wallet API) ---
// Dynamic exposes server (TSS) wallets via API. Fill in the sign+broadcast call for your setup:
//   https://docs.dynamic.xyz/server-wallets/server-wallets
async function dynamicSigner(rpc: string): Promise<Signer> {
	const envId = req('DYNAMIC_ENV_ID')
	const token = req('DYNAMIC_API_TOKEN')
	const walletId = req('DYNAMIC_WALLET_ID')
	const { id: chainId } = await chainOf(rpc)
	const base = `https://app.dynamicauth.com/api/v0/environments/${envId}/wallets/${walletId}`
	const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
	return {
		async getAddress() {
			const r = await fetch(base, { headers })
			if (!r.ok) throw new Error(`Dynamic getWallet ${r.status}`)
			return ((await r.json()) as { address: Hex }).address
		},
		async sendTransaction(tx) {
			// TODO(verify): confirm the sign-and-send endpoint + body for your Dynamic plan.
			const r = await fetch(`${base}/transactions`, {
				method: 'POST',
				headers,
				body: JSON.stringify({ chainId, to: tx.to, data: tx.data, value: (tx.value ?? 0n).toString() }),
			})
			if (!r.ok) throw new Error(`Dynamic sendTransaction ${r.status}: ${await r.text()}`)
			return ((await r.json()) as { hash: Hex }).hash
		},
	}
}

export async function createSigner(provider: string, rpc: string): Promise<Signer> {
	switch (provider) {
		case 'local':
			return localSigner(rpc)
		case 'privy':
			return privySigner(rpc)
		case 'dynamic':
			return dynamicSigner(rpc)
		default:
			throw new Error(`unknown signer provider "${provider}" (use local | privy | dynamic)`)
	}
}
