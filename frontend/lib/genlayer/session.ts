import { GENLAYER_CHAIN_ID } from "./network";
import type { EthereumProvider } from "./eip1193";
import type { DiscoveredWallet } from "./discover";

export type SessionSource = "wagmi" | "direct";

export type WalletSession = {
  source: SessionSource;
  generation: number;
  address: string;
  chainId: number | null;
  name: string;
  connectorId: string;
  provider: EthereumProvider | null;
};

export type SessionView = {
  address: string | null;
  chainId: number | null;
  chainIdHex: string | null;
  walletName: string | null;
  connectorId: string | null;
  provider: EthereumProvider | null;
  isConnected: boolean;
  isOnCorrectNetwork: boolean;
  canWrite: boolean;
};

export type WalletOption = {
  id: string;
  name: string;
  rdns: string | null;
  icon: string | null;
  kind: "injected" | "walletconnect" | "unavailable";
  ready: boolean;
  hint?: string;
};

export type ProbedConnector = {
  id: string;
  name: string;
  rdns: string | null;
  icon: string | null;
  kind: "injected" | "walletconnect";
  provider: EthereumProvider | null;
};

export function chainIdHex(id: number | null): string | null {
  if (id === null) return null;
  return `0x${id.toString(16)}`;
}

export function emptySessionView(): SessionView {
  return {
    address: null,
    chainId: null,
    chainIdHex: null,
    walletName: null,
    connectorId: null,
    provider: null,
    isConnected: false,
    isOnCorrectNetwork: false,
    canWrite: false,
  };
}

/** Displayed address, chain, name, connector, and provider come from one session. */
export function viewSession(
  session: WalletSession | null,
  expectedChainId: number = GENLAYER_CHAIN_ID,
): SessionView {
  if (!session) return emptySessionView();
  const chainKnown = session.chainId !== null;
  const isOnCorrectNetwork = session.chainId === expectedChainId;
  return {
    address: session.address,
    chainId: session.chainId,
    chainIdHex: chainIdHex(session.chainId),
    walletName: session.name,
    connectorId: session.connectorId,
    provider: session.provider,
    isConnected: true,
    isOnCorrectNetwork,
    canWrite: Boolean(session.provider && session.address && chainKnown && isOnCorrectNetwork),
  };
}

export function replaceSession(
  generation: number,
  payload: Omit<WalletSession, "generation">,
): WalletSession {
  return { ...payload, generation };
}

/** Ignore a provider that belongs to a superseded connection. */
export function acceptProvider(
  session: WalletSession | null,
  generation: number,
  provider: EthereumProvider | null,
): WalletSession | null {
  if (!session || session.generation !== generation) return session;
  return { ...session, provider };
}

export function patchActiveSession(
  session: WalletSession | null,
  generation: number,
  patch: Partial<Pick<WalletSession, "address" | "chainId" | "provider" | "name">>,
): WalletSession | null {
  if (!session || session.generation !== generation) return session;
  return { ...session, ...patch };
}

export function kitBinding(view: SessionView): {
  provider: EthereumProvider;
  address: string;
  chainId: number;
} | null {
  if (!view.canWrite || !view.provider || !view.address || view.chainId === null) return null;
  return { provider: view.provider, address: view.address, chainId: view.chainId };
}

function isGenericInjectedName(name: string): boolean {
  return /^injected$/i.test(name.trim()) || /^browser wallet$/i.test(name.trim());
}

function alreadySeen(
  seenProviders: Set<EthereumProvider>,
  seenRdns: Set<string>,
  seenNames: Set<string>,
  provider: EthereumProvider | null,
  rdns: string | null,
  name: string,
): boolean {
  if (provider && seenProviders.has(provider)) return true;
  if (rdns && seenRdns.has(rdns.toLowerCase())) return true;
  if (!isGenericInjectedName(name) && seenNames.has(name.toLowerCase())) return true;
  return false;
}

function remember(
  seenProviders: Set<EthereumProvider>,
  seenRdns: Set<string>,
  seenNames: Set<string>,
  provider: EthereumProvider | null,
  rdns: string | null,
  name: string,
) {
  if (provider) seenProviders.add(provider);
  if (rdns) seenRdns.add(rdns.toLowerCase());
  seenNames.add(name.toLowerCase());
}

/**
 * Named installed wallets only. A generic Injected connector without a live
 * provider is omitted so a no-extension browser has no enabled injected row.
 */
export function buildWalletOptions(
  connectors: ProbedConnector[],
  discovered: DiscoveredWallet[],
  walletConnectConfigured: boolean,
): WalletOption[] {
  const rows: WalletOption[] = [];
  const seenProviders = new Set<EthereumProvider>();
  const seenRdns = new Set<string>();
  const seenNames = new Set<string>();

  for (const wallet of discovered) {
    if (alreadySeen(seenProviders, seenRdns, seenNames, wallet.provider, wallet.rdns, wallet.name)) {
      continue;
    }
    remember(seenProviders, seenRdns, seenNames, wallet.provider, wallet.rdns, wallet.name);
    rows.push({
      id: `discovered:${wallet.id}`,
      name: wallet.name,
      rdns: wallet.rdns,
      icon: wallet.icon,
      kind: "injected",
      ready: true,
    });
  }

  for (const connector of connectors) {
    if (connector.kind === "walletconnect") continue;
    if (!connector.provider) continue;
    if (alreadySeen(seenProviders, seenRdns, seenNames, connector.provider, connector.rdns, connector.name)) {
      continue;
    }
    remember(seenProviders, seenRdns, seenNames, connector.provider, connector.rdns, connector.name);
    rows.push({
      id: connector.id,
      name: isGenericInjectedName(connector.name) ? "Browser wallet" : connector.name,
      rdns: connector.rdns,
      icon: connector.icon,
      kind: "injected",
      ready: true,
    });
  }

  if (walletConnectConfigured) {
    rows.push({
      id: "walletconnect",
      name: "WalletConnect",
      rdns: null,
      icon: null,
      kind: "walletconnect",
      ready: true,
    });
  } else {
    rows.push({
      id: "walletconnect-unconfigured",
      name: "WalletConnect",
      rdns: null,
      icon: null,
      kind: "unavailable",
      ready: false,
      hint: "Needs a Reown project ID",
    });
  }

  return rows;
}
