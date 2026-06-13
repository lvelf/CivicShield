import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Public HTTP transports for reads + an injected (MetaMask/browser) connector so the
// Donate button (M6a, LI.FI Composer) can have the user sign the transaction.
export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [injected()],
  transports: {
    [base.id]: http("https://mainnet.base.org"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
