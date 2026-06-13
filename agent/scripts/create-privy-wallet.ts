// One-time: create a Privy server (agent) wallet and print its id + address.
//   PRIVY_APP_ID=... PRIVY_APP_SECRET=... node --experimental-strip-types scripts/create-privy-wallet.ts
// Then put PRIVY_WALLET_ID + PRIVY_WALLET_ADDRESS in .env and run setAgent(address) on the pool.
import { PrivyClient } from '@privy-io/server-auth'

const appId = process.env.PRIVY_APP_ID
const appSecret = process.env.PRIVY_APP_SECRET
if (!appId || !appSecret) throw new Error('set PRIVY_APP_ID and PRIVY_APP_SECRET')

const privy = new PrivyClient(appId, appSecret)
const wallet = await privy.walletApi.create({ chainType: 'ethereum' })

console.log('\n✓ Privy agent wallet created. Add to .env:\n')
console.log(`PRIVY_WALLET_ID=${wallet.id}`)
console.log(`PRIVY_WALLET_ADDRESS=${wallet.address}`)
console.log(`\nThen wire it on-chain:  setAgent(${wallet.address})\n`)
