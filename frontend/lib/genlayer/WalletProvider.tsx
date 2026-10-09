"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import type { Connector } from "wagmi";
import { GENLAYER_CHAIN_ID } from "./network";
import { createAgentPayWagmiConfig } from "./wagmi";
import { connectWalletConnect, isWalletConnectConfigured, restoreWalletConnectSession } from "./walletconnect";
import { discoverInjectedWallets, resolveConnectTarget, type DiscoveredWallet } from "./discover";
import { readAccounts, readChainId, requestAccountPicker, requestAccounts, switchToStudioNextChain } from "./chain";
import { mapWalletError } from "./errors";
import { boundedDisconnect, DISCONNECT_TIMEOUT_MS, type EthereumProvider, withTimeout } from "./eip1193";
import {
  acceptProvider,
  buildWalletOptions,
  emptySessionView,
  patchActiveSession,
  replaceSession,
  viewSession,
  type ProbedConnector,
  type WalletOption,
  type WalletSession,
} from "./session";
import { safeGet, safeRemove, safeSet } from "../safe-storage";
import { error, userRejected, warning } from "../utils/toast";

export type { WalletOption };

export const DISCONNECT_FLAG = "agentpay.wallet.disconnected";
export const LAST_WALLET = "agentpay.wallet.last";
const HYDRATE_MS = 2500;
const PROVIDER_WAIT_MS = 2500;
const PROBE_WAIT_MS = 800;
const RECONNECT_GIVE_UP_MS = 4000;

type LastWallet = { kind: "wagmi" | "overlay" | "walletconnect"; id: string; name?: string };

function readLastWallet(): LastWallet | null {
  const raw = safeGet(LAST_WALLET);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastWallet;
    if (parsed.kind === "wagmi" || parsed.kind === "overlay" || parsed.kind === "walletconnect") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeLastWallet(value: LastWallet) {
  safeSet(LAST_WALLET, JSON.stringify(value));
}

export function shouldReconnectWagmi(): boolean {
  if (safeGet(DISCONNECT_FLAG) === "true") return false;
  const last = readLastWallet();
  return last?.kind === "wagmi";
}

export interface WalletState {
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isHydrating: boolean;
  isOnCorrectNetwork: boolean;
  canWrite: boolean;
  walletName: string | null;
  connectorId: string | null;
  provider: EthereumProvider | null;
  hasInjectedWallet: boolean;
  walletConnectConfigured: boolean;
  discoveryError: string | null;
}

interface WalletContextValue extends WalletState {
  options: WalletOption[];
  chooserOpen: boolean;
  openChooser: () => void;
  closeChooser: () => void;
  connectWallet: (optionId?: string) => Promise<string | void>;
  disconnectWallet: () => void;
  switchWalletAccount: () => Promise<string | void>;
  switchToStudioNext: () => Promise<void>;
  retryDiscovery: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export async function providerFromConnector(
  connector: Connector | undefined,
  timeoutMs = PROVIDER_WAIT_MS,
): Promise<EthereumProvider | null> {
  if (!connector) return null;
  try {
    const provider = (await Promise.race([
      connector.getProvider(),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("timed out")), timeoutMs);
      }),
    ])) as EthereumProvider | undefined;
    return provider ?? null;
  } catch {
    return null;
  }
}

function WalletSessionView({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const account = useAccount();
  const { connectAsync, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const connectors = useConnectors();
  const [session, setSession] = useState<WalletSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredWallet[]>([]);
  const [probedConnectors, setProbedConnectors] = useState<ProbedConnector[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [reconnectGaveUp, setReconnectGaveUp] = useState(false);
  const listenersRef = useRef<{
    provider: EthereumProvider | null;
    handlers: Array<[string, (...args: unknown[]) => void]>;
  }>({
    provider: null,
    handlers: [],
  });
  const sessionKeyRef = useRef<string>("");
  const generationRef = useRef(0);
  const sessionRef = useRef<WalletSession | null>(null);
  const connectingRef = useRef(false);
  sessionRef.current = session;
  connectingRef.current = connecting;

  const bumpGeneration = useCallback(() => {
    generationRef.current += 1;
    return generationRef.current;
  }, []);

  const view = viewSession(session, GENLAYER_CHAIN_ID);
  const walletConnectConfigured = isWalletConnectConfigured();

  const options = useMemo(
    () => buildWalletOptions(probedConnectors, discovered, walletConnectConfigured),
    [probedConnectors, discovered, walletConnectConfigured],
  );

  const hasInjectedWallet = options.some((row) => row.kind === "injected" && row.ready);

  const loadDiscovery = useCallback(async () => {
    try {
      const wallets = await discoverInjectedWallets(1200);
      setDiscovered(wallets);
      setDiscoveryError(null);
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : "Wallet discovery failed.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), HYDRATE_MS);
    void loadDiscovery();
    if (account.status === "connected" || account.status === "disconnected") {
      setHydrated(true);
    }
    return () => window.clearTimeout(timer);
  }, [account.status, loadDiscovery]);

  useEffect(() => {
    if (account.status !== "reconnecting" && !isPending) {
      setReconnectGaveUp(false);
      return;
    }
    const timer = window.setTimeout(() => setReconnectGaveUp(true), RECONNECT_GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [account.status, isPending]);

  const connectorKey = connectors.map((item) => item.uid || item.id).join("|");

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      const rows: ProbedConnector[] = [];
      for (const connector of connectors) {
        const wc = connector.id === "walletConnect" || connector.type === "walletConnect";
        const provider = await providerFromConnector(connector, PROBE_WAIT_MS);
        if (cancelled) return;
        rows.push({
          id: connector.uid || connector.id,
          name: connector.name || (wc ? "WalletConnect" : "Injected"),
          rdns: connector.type === "injected" ? connector.id : null,
          icon: connector.icon ?? null,
          kind: wc ? "walletconnect" : "injected",
          provider,
        });
      }
      if (!cancelled) setProbedConnectors(rows);
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, [connectorKey, connectors]);

  useEffect(() => {
    let cancelled = false;
    const restoreGen = generationRef.current;

    const restoreStillCurrent = () =>
      !cancelled &&
      generationRef.current === restoreGen &&
      !connectingRef.current &&
      safeGet(DISCONNECT_FLAG) !== "true";

    async function restoreApproved() {
      if (!restoreStillCurrent()) return;
      const last = readLastWallet();
      if (!last) return;
      const wallets = await discoverInjectedWallets(1200);
      if (!restoreStillCurrent()) return;
      setDiscovered(wallets);
      if (last.kind === "walletconnect" && walletConnectConfigured) {
        try {
          const restored = await withTimeout(
            restoreWalletConnectSession(),
            4000,
            "WalletConnect restore timed out.",
          );
          if (!restoreStillCurrent() || !restored) return;
          setSession(
            replaceSession(restoreGen, {
              source: "direct",
              address: restored.address,
              chainId: restored.chainId,
              name: "WalletConnect",
              connectorId: "walletconnect",
              provider: restored.provider,
            }),
          );
        } catch {
          /* keep the chooser usable */
        }
        return;
      }
      if (last.kind === "overlay") {
        const wallet = wallets.find((item) => item.id === last.id || `discovered:${item.id}` === last.id);
        if (!wallet) return;
        const accounts = await readAccounts(wallet.provider);
        if (!restoreStillCurrent() || accounts.length === 0) return;
        const chainId = await readChainId(wallet.provider);
        if (!restoreStillCurrent()) return;
        setSession(
          replaceSession(restoreGen, {
            source: "direct",
            address: accounts[0],
            chainId,
            name: wallet.name,
            connectorId: `discovered:${wallet.id}`,
            provider: wallet.provider,
          }),
        );
      }
    }
    void restoreApproved();
    return () => {
      cancelled = true;
    };
  }, [walletConnectConfigured]);

  useEffect(() => {
    if (connectingRef.current) return;
    if (sessionRef.current?.source === "direct") return;
    if (!account.isConnected || !account.address) {
      setSession((prev) => (prev?.source === "wagmi" ? null : prev));
      return;
    }
    const connectorId = account.connector?.uid || account.connector?.id || "wagmi";
    setSession((prev) => {
      if (prev?.source === "direct") return prev;
      const generation = prev?.source === "wagmi" ? prev.generation : generationRef.current || bumpGeneration();
      return replaceSession(generation, {
        source: "wagmi",
        address: account.address as string,
        chainId: typeof account.chainId === "number" ? account.chainId : null,
        name: account.connector?.name ?? "Wallet",
        connectorId,
        provider: prev?.source === "wagmi" && prev.connectorId === connectorId ? prev.provider : prev?.source === "wagmi" ? null : null,
      });
    });
  }, [account.isConnected, account.address, account.chainId, account.connector, bumpGeneration]);

  useEffect(() => {
    if (connectingRef.current) return;
    if (session?.source !== "wagmi") return;
    const gen = session.generation;
    let cancelled = false;
    void providerFromConnector(account.connector).then((next) => {
      if (cancelled) return;
      setSession((prev) => acceptProvider(prev, gen, next));
    });
    return () => {
      cancelled = true;
    };
  }, [session?.source, session?.generation, session?.connectorId, account.connector]);

  useEffect(() => {
    const current = session?.provider ?? null;
    const gen = session?.generation;
    const prev = listenersRef.current;
    for (const [event, handler] of prev.handlers) {
      prev.provider?.removeListener?.(event, handler);
    }
    listenersRef.current = { provider: current, handlers: [] };
    if (!current?.on || !current.removeListener || gen === undefined) return;

    const handleAccounts = (...args: unknown[]) => {
      const accounts = (args[0] as string[]) || [];
      if (accounts.length === 0) {
        safeSet(DISCONNECT_FLAG, "true");
        setSession((active) => (active?.generation === gen ? null : active));
      } else {
        safeRemove(DISCONNECT_FLAG);
        setSession((active) => patchActiveSession(active, gen, { address: accounts[0] }));
      }
    };
    const handleChain = (...args: unknown[]) => {
      const next = args[0];
      const parsed =
        typeof next === "number"
          ? next
          : typeof next === "string"
            ? Number.parseInt(next, next.startsWith("0x") ? 16 : 10)
            : null;
      setSession((active) => patchActiveSession(active, gen, { chainId: parsed }));
    };
    const handleDisconnect = () => {
      safeSet(DISCONNECT_FLAG, "true");
      setSession((active) => (active?.generation === gen ? null : active));
    };
    current.on("accountsChanged", handleAccounts);
    current.on("chainChanged", handleChain);
    current.on("disconnect", handleDisconnect);
    listenersRef.current.handlers = [
      ["accountsChanged", handleAccounts],
      ["chainChanged", handleChain],
      ["disconnect", handleDisconnect],
    ];
    return () => {
      current.removeListener?.("accountsChanged", handleAccounts);
      current.removeListener?.("chainChanged", handleChain);
      current.removeListener?.("disconnect", handleDisconnect);
    };
  }, [session?.provider, session?.generation]);

  useEffect(() => {
    const key = `${view.connectorId ?? ""}:${view.address ?? ""}:${view.chainId ?? ""}`;
    if (!sessionKeyRef.current) {
      sessionKeyRef.current = key;
      return;
    }
    if (sessionKeyRef.current === key) return;
    sessionKeyRef.current = key;
    void queryClient.invalidateQueries();
  }, [view.connectorId, view.address, view.chainId, queryClient]);

  const clearActiveConnection = useCallback(
    async (gen: number) => {
      const current = sessionRef.current;
      if (generationRef.current === gen) {
        setSession(null);
      }
      await Promise.all([
        boundedDisconnect(current?.provider),
        withTimeout(
          Promise.resolve(disconnectAsync()),
          DISCONNECT_TIMEOUT_MS,
          "Wallet disconnect timed out.",
        ).catch(() => undefined),
      ]);
    },
    [disconnectAsync],
  );

  const connectWallet = useCallback(
    async (optionId?: string) => {
      if (!optionId) {
        setChooserOpen(true);
        return;
      }
      const connectorIds = connectors.map((item) => item.uid || item.id);
      const target = resolveConnectTarget(optionId, connectorIds, discovered);
      if (target.type === "unconfigured") {
        warning("WalletConnect is not configured", {
          description: "Injected wallets still work. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for QR/mobile wallets.",
        });
        return;
      }
      if (target.type === "missing") {
        error("That wallet is not available in this browser.");
        return;
      }
      const gen = bumpGeneration();
      setConnecting(true);
      try {
        await clearActiveConnection(gen);
        if (generationRef.current !== gen) return;
        if (target.type === "walletconnect") {
          const next = await connectWalletConnect();
          if (generationRef.current !== gen) return;
          setSession(
            replaceSession(gen, {
              source: "direct",
              address: next.address,
              chainId: next.chainId,
              name: "WalletConnect",
              connectorId: "walletconnect",
              provider: next.provider,
            }),
          );
          writeLastWallet({ kind: "walletconnect", id: "walletconnect", name: "WalletConnect" });
          safeRemove(DISCONNECT_FLAG);
          setChooserOpen(false);
          return next.address;
        }
        if (target.type === "provider") {
          const accounts = await requestAccounts(target.wallet.provider);
          if (generationRef.current !== gen) return;
          const chainId = await readChainId(target.wallet.provider);
          if (generationRef.current !== gen) return;
          setSession(
            replaceSession(gen, {
              source: "direct",
              address: accounts[0],
              chainId,
              name: target.wallet.name,
              connectorId: `discovered:${target.wallet.id}`,
              provider: target.wallet.provider,
            }),
          );
          writeLastWallet({
            kind: "overlay",
            id: target.wallet.id,
            name: target.wallet.name,
          });
          safeRemove(DISCONNECT_FLAG);
          setChooserOpen(false);
          return accounts[0];
        }
        const selectedConnector = connectors.find((item) => (item.uid || item.id) === target.id);
        if (!selectedConnector) {
          throw new Error("That wallet is not available in this browser.");
        }
        if (safeGet(DISCONNECT_FLAG) === "true") safeRemove(DISCONNECT_FLAG);
        const result = await connectAsync({ connector: selectedConnector });
        if (generationRef.current !== gen) return;
        const nextProvider = await providerFromConnector(selectedConnector);
        if (generationRef.current !== gen) return;
        const chainId = nextProvider ? await readChainId(nextProvider) : null;
        if (generationRef.current !== gen) return;
        setSession(
          replaceSession(gen, {
            source: "wagmi",
            address: result.accounts[0],
            chainId,
            name: selectedConnector.name,
            connectorId: selectedConnector.uid || selectedConnector.id,
            provider: nextProvider,
          }),
        );
        writeLastWallet({
          kind: "wagmi",
          id: selectedConnector.uid || selectedConnector.id,
          name: selectedConnector.name,
        });
        setChooserOpen(false);
        return result.accounts[0];
      } catch (err) {
        const mapped = mapWalletError(err);
        if (mapped.code === 4001) userRejected("Connection cancelled");
        else if (mapped.code === -32002) warning("Wallet request pending", { description: mapped.message });
        else if (mapped.code === "timeout") {
          warning("Wallet request timed out", {
            description: "That request will not attach to a later session. Retry from the wallet button.",
          });
        } else error("Failed to connect wallet", { description: mapped.message });
      } finally {
        if (generationRef.current === gen) setConnecting(false);
      }
    },
    [bumpGeneration, clearActiveConnection, connectAsync, connectors, discovered],
  );

  const disconnectWallet = useCallback(() => {
    safeSet(DISCONNECT_FLAG, "true");
    const gen = bumpGeneration();
    setChooserOpen(false);
    safeRemove(LAST_WALLET);
    void clearActiveConnection(gen);
    warning("App session disconnected", {
      description:
        "AgentPay dropped this wallet session. Browser extensions may keep their own permission until you revoke it in the wallet.",
    });
  }, [bumpGeneration, clearActiveConnection]);

  const switchWalletAccount = useCallback(async () => {
    const active = sessionRef.current;
    if (!active?.provider) {
      error("Connect a wallet first.");
      return;
    }
    const gen = active.generation;
    try {
      setConnecting(true);
      const next = await requestAccountPicker(active.provider);
      if (generationRef.current !== gen) return;
      safeRemove(DISCONNECT_FLAG);
      setSession((current) => patchActiveSession(current, gen, { address: next }));
      return next;
    } catch (err) {
      const mapped = mapWalletError(err);
      if (mapped.code === 4001) userRejected("Account switch cancelled");
      else error("Could not switch account", { description: mapped.message });
    } finally {
      if (generationRef.current === gen) setConnecting(false);
    }
  }, []);

  const switchToStudioNext = useCallback(async () => {
    const active = sessionRef.current;
    if (!active?.provider) {
      error("No wallet selected", {
        description: "Connect a wallet, then switch it to Studio Next (chain 61997).",
      });
      return;
    }
    const gen = active.generation;
    try {
      await switchToStudioNextChain(active.provider);
      if (generationRef.current !== gen) return;
      const chainId = await readChainId(active.provider);
      if (generationRef.current !== gen) return;
      setSession((current) => patchActiveSession(current, gen, { chainId }));
    } catch (err) {
      const mapped = mapWalletError(err);
      if (mapped.code === 4001) userRejected("Network switch cancelled");
      else {
        error("Could not switch network", {
          description: mapped.message,
        });
      }
    }
  }, []);

  const value: WalletContextValue = {
    address: view.address,
    chainId: view.chainIdHex,
    isConnected: view.isConnected,
    isLoading:
      connecting ||
      (!reconnectGaveUp && (isPending || (!hydrated && account.status === "reconnecting"))),
    isHydrating: !hydrated,
    isOnCorrectNetwork: view.isOnCorrectNetwork,
    canWrite: view.canWrite,
    walletName: view.walletName,
    connectorId: view.connectorId,
    provider: view.provider,
    hasInjectedWallet,
    walletConnectConfigured,
    discoveryError,
    options,
    chooserOpen,
    openChooser: () => setChooserOpen(true),
    closeChooser: () => setChooserOpen(false),
    connectWallet,
    disconnectWallet,
    switchWalletAccount,
    switchToStudioNext,
    retryDiscovery: loadDiscovery,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

const idleView = emptySessionView();
const idleWallet: WalletContextValue = {
  address: idleView.address,
  chainId: idleView.chainIdHex,
  isConnected: idleView.isConnected,
  isLoading: false,
  isHydrating: true,
  isOnCorrectNetwork: idleView.isOnCorrectNetwork,
  canWrite: idleView.canWrite,
  walletName: idleView.walletName,
  connectorId: idleView.connectorId,
  provider: idleView.provider,
  hasInjectedWallet: false,
  walletConnectConfigured: isWalletConnectConfigured(),
  discoveryError: null,
  options: [],
  chooserOpen: false,
  openChooser: () => undefined,
  closeChooser: () => undefined,
  connectWallet: async () => undefined,
  disconnectWallet: () => undefined,
  switchWalletAccount: async () => undefined,
  switchToStudioNext: async () => undefined,
  retryDiscovery: async () => undefined,
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [config] = useState(() => createAgentPayWagmiConfig());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return <WalletContext.Provider value={idleWallet}>{children}</WalletContext.Provider>;
  }
  return (
    <WagmiProvider config={config} reconnectOnMount={shouldReconnectWagmi()}>
      <WalletSessionView>{children}</WalletSessionView>
    </WagmiProvider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

export function useOptionalWallet(): WalletContextValue | null {
  return useContext(WalletContext) ?? null;
}
