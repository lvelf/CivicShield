import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Public HTTP transports for reads + an injected (MetaMask/browser) connector so the
// Donate button (M6a, LI.FI Composer) can have the user sign the transaction.
export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [injected()],
  transports: {
    // publicnode is more reliable than the default mainnet.base.org (which rate-limits /
    // serves stale load-balanced nodes — surfaced as flaky log/balance reads).
    [base.id]: http("https://base.publicnode.com"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
