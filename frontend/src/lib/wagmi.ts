import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

// Read-only config: public HTTP transports for both chains. No wallet connector is needed
// to READ pool state / watch events. Add a connector later (injected/walletconnect) when the
// Donate / executeRelease buttons need to send transactions (M6a).
export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
    [base.id]: http("https://mainnet.base.org"),
  },
  ssr: true,
});
