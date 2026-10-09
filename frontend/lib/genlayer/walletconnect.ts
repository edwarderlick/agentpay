import { GENLAYER_CHAIN_ID } from "./network";
import type { EthereumProvider } from "./eip1193";

export function getWalletConnectProjectId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  return id || undefined;
}

export function isWalletConnectConfigured(): boolean {
  return Boolean(getWalletConnectProjectId());
}

type WalletConnectSession = {
  provider: EthereumProvider;
  address: string;
  chainId: number | null;
};

async function initWalletConnectProvider() {
  const projectId = getWalletConnectProjectId();
  if (!projectId) {
    throw new Error("WalletConnect is not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.");
  }
  const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");
  return EthereumProvider.init({
    projectId,
    chains: [GENLAYER_CHAIN_ID],
    optionalChains: [1, GENLAYER_CHAIN_ID],
    showQrModal: true,
    metadata: {
      name: "AgentPay",
      description: "Spending mandates for agents on GenLayer Studio Next.",
      url: typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
      icons: [],
    },
  });
}

function sessionFromProvider(provider: {
  accounts?: string[];
  chainId?: number;
}): WalletConnectSession | null {
  const address = (provider.accounts ?? [])[0];
  if (!address) return null;
  return {
    provider: provider as unknown as EthereumProvider,
    address,
    chainId: provider.chainId ?? null,
  };
}

/** Restore an existing WalletConnect pairing. Does not open the QR modal. */
export async function restoreWalletConnectSession(): Promise<WalletConnectSession | null> {
  if (!isWalletConnectConfigured()) return null;
  const provider = await initWalletConnectProvider();
  if (!provider.session) return null;
  const session = sessionFromProvider(provider);
  return session;
}

export async function connectWalletConnect(): Promise<WalletConnectSession> {
  const provider = await initWalletConnectProvider();
  await provider.connect();
  const session = sessionFromProvider(provider);
  if (!session) throw new Error("WalletConnect did not return an account.");
  return session;
}
