"use client";

import { createConfig, createStorage, http, type Config } from "wagmi";
import { injected } from "@wagmi/connectors";
import { GENLAYER_CHAIN } from "./network";
import { browserStorageOrMemory } from "../safe-storage";

export { getWalletConnectProjectId, isWalletConnectConfigured } from "./walletconnect";

export function createAgentPayWagmiConfig(): Config {
  return createConfig({
    chains: [GENLAYER_CHAIN],
    connectors: [
      injected({
        shimDisconnect: true,
      }),
    ],
    transports: {
      [GENLAYER_CHAIN.id]: http(GENLAYER_CHAIN.rpcUrls.default.http[0]),
    },
    ssr: true,
    multiInjectedProviderDiscovery: true,
    storage: createStorage({ storage: browserStorageOrMemory() }),
  });
}
