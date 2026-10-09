import type { Eip6963ProviderDetail, EthereumProvider } from "./eip1193";

export type DiscoveredWallet = {
  id: string;
  name: string;
  rdns: string | null;
  icon: string | null;
  kind: "eip6963" | "legacy";
  provider: EthereumProvider;
};

function guessLegacyName(provider: EthereumProvider): string {
  if (provider.isRabby) return "Rabby";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isBraveWallet) return "Brave Wallet";
  if (provider.isMetaMask) return "MetaMask";
  return "Injected wallet";
}

export type ConnectTarget =
  | { type: "connector"; id: string }
  | { type: "provider"; wallet: DiscoveredWallet }
  | { type: "walletconnect" }
  | { type: "unconfigured" }
  | { type: "missing" };

export function resolveConnectTarget(
  optionId: string | undefined,
  connectorIds: string[],
  discovered: DiscoveredWallet[],
): ConnectTarget {
  if (!optionId) return { type: "missing" };
  if (optionId === "walletconnect") return { type: "walletconnect" };
  if (optionId === "walletconnect-unconfigured") return { type: "unconfigured" };
  if (connectorIds.includes(optionId)) return { type: "connector", id: optionId };
  const wallet = discovered.find(
    (item) => item.id === optionId || `discovered:${item.id}` === optionId,
  );
  if (wallet) return { type: "provider", wallet };
  return { type: "missing" };
}

export function discoverInjectedWallets(timeoutMs = 1200): Promise<DiscoveredWallet[]> {
  if (typeof window === "undefined") return Promise.resolve([]);

  return new Promise((resolve) => {
    const found = new Map<string, DiscoveredWallet>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (!detail?.info?.uuid || !detail.provider) return;
      found.set(detail.info.uuid, {
        id: detail.info.uuid,
        name: detail.info.name || "Browser wallet",
        rdns: detail.info.rdns || null,
        icon: detail.info.icon || null,
        kind: "eip6963",
        provider: detail.provider,
      });
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      if (found.size === 0) {
        const legacy = window.ethereum;
        if (legacy) {
          found.set("legacy-injected", {
            id: "legacy-injected",
            name: guessLegacyName(legacy),
            rdns: null,
            icon: null,
            kind: "legacy",
            provider: legacy,
          });
        }
      }
      resolve([...found.values()]);
    }, timeoutMs);
  });
}
