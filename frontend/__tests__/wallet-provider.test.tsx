import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, type ReactNode } from "react";
import type { EthereumProvider } from "../lib/genlayer/eip1193";
import { DISCONNECT_FLAG, LAST_WALLET } from "../lib/genlayer/WalletProvider";

const ADDR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ADDR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const mocks = vi.hoisted(() => {
  const account = {
    isConnected: false as boolean,
    address: undefined as string | undefined,
    chainId: undefined as number | undefined,
    connector: undefined as { uid: string; id: string; name: string } | undefined,
    status: "disconnected" as "connected" | "disconnected" | "reconnecting",
  };
  return {
    account,
    connectAsync: vi.fn(),
    disconnectAsync: vi.fn(async () => undefined),
    connectors: [] as Array<{ uid: string; id: string; name: string; type: string; getProvider: () => Promise<unknown> }>,
    discoverInjectedWallets: vi.fn(async () => [] as Array<{
      id: string;
      name: string;
      rdns: string | null;
      icon: string | null;
      kind: "eip6963" | "legacy";
      provider: EthereumProvider;
    }>),
    readAccounts: vi.fn(async () => [] as string[]),
    readChainId: vi.fn(async () => 61997 as number | null),
    requestAccounts: vi.fn(async (_injected?: EthereumProvider) => [ADDR_B]),
    requestAccountPicker: vi.fn(async () => ADDR_B),
    switchToStudioNextChain: vi.fn(async () => undefined),
    restoreWalletConnectSession: vi.fn(async () => null),
    connectWalletConnect: vi.fn(),
    isWalletConnectConfigured: vi.fn(() => false),
  };
});

vi.mock("wagmi", () => ({
  WagmiProvider: ({ children }: { children: ReactNode }) => children,
  useAccount: () => mocks.account,
  useConnect: () => ({ connectAsync: mocks.connectAsync, isPending: false }),
  useDisconnect: () => ({ disconnectAsync: mocks.disconnectAsync }),
  useConnectors: () => mocks.connectors,
}));

vi.mock("../lib/genlayer/wagmi", () => ({
  createAgentPayWagmiConfig: () => ({ chains: [], connectors: [] }),
}));

vi.mock("../lib/genlayer/discover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/genlayer/discover")>();
  return {
    ...actual,
    discoverInjectedWallets: mocks.discoverInjectedWallets,
  };
});

vi.mock("../lib/genlayer/chain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/genlayer/chain")>();
  return {
    ...actual,
    readAccounts: mocks.readAccounts,
    readChainId: mocks.readChainId,
    requestAccounts: mocks.requestAccounts,
    requestAccountPicker: mocks.requestAccountPicker,
    switchToStudioNextChain: mocks.switchToStudioNextChain,
  };
});

vi.mock("../lib/genlayer/walletconnect", () => ({
  connectWalletConnect: mocks.connectWalletConnect,
  restoreWalletConnectSession: mocks.restoreWalletConnectSession,
  isWalletConnectConfigured: mocks.isWalletConnectConfigured,
  getWalletConnectProjectId: () => undefined,
}));

import { useWallet, WalletProvider } from "../lib/genlayer/WalletProvider";

function provider(label: string, disconnect?: EthereumProvider["disconnect"]): EthereumProvider {
  return {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    disconnect,
    label,
  } as EthereumProvider & { label: string };
}

function Probe({ onWallet }: { onWallet: (wallet: ReturnType<typeof useWallet>) => void }) {
  const wallet = useWallet();
  useEffect(() => {
    onWallet(wallet);
  }, [wallet, onWallet]);
  return (
    <div>
      <span data-testid="address">{wallet.address ?? ""}</span>
      <span data-testid="name">{wallet.walletName ?? ""}</span>
      <span data-testid="loading">{wallet.isLoading ? "1" : "0"}</span>
    </div>
  );
}

function renderWallet(onWallet: (wallet: ReturnType<typeof useWallet>) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WalletProvider>
        <Probe onWallet={onWallet} />
      </WalletProvider>
    </QueryClientProvider>,
  );
}

const walletA = {
  id: "wallet-a",
  name: "MetaMask",
  rdns: "io.metamask",
  icon: null,
  kind: "eip6963" as const,
  provider: provider("A"),
};

const walletB = {
  id: "wallet-b",
  name: "Rabby",
  rdns: "io.rabby",
  icon: null,
  kind: "eip6963" as const,
  provider: provider("B"),
};

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  window.localStorage.clear();
  mocks.account.isConnected = false;
  mocks.account.address = undefined;
  mocks.account.chainId = undefined;
  mocks.account.connector = undefined;
  mocks.account.status = "disconnected";
  mocks.connectors.length = 0;
  mocks.discoverInjectedWallets.mockReset();
  mocks.readAccounts.mockReset();
  mocks.readChainId.mockReset();
  mocks.requestAccounts.mockReset();
  mocks.disconnectAsync.mockReset();
  mocks.disconnectAsync.mockResolvedValue(undefined);
  mocks.discoverInjectedWallets.mockResolvedValue([walletA, walletB]);
  mocks.readAccounts.mockResolvedValue([]);
  mocks.readChainId.mockResolvedValue(61997);
  mocks.requestAccounts.mockResolvedValue([ADDR_B]);
});

beforeEach(() => {
  window.localStorage.clear();
  mocks.discoverInjectedWallets.mockResolvedValue([walletA, walletB]);
  mocks.readAccounts.mockResolvedValue([]);
  mocks.readChainId.mockResolvedValue(61997);
  mocks.requestAccounts.mockResolvedValue([ADDR_B]);
});

describe("mounted WalletProvider timing", () => {
  it("ignores a late restore of wallet A after the user selects wallet B", async () => {
    let resolveRestoreAccounts: (value: string[]) => void = () => undefined;
    window.localStorage.setItem(LAST_WALLET, JSON.stringify({ kind: "overlay", id: "wallet-a", name: "MetaMask" }));
    mocks.readAccounts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRestoreAccounts = resolve;
        }),
    );

    let wallet!: ReturnType<typeof useWallet>;
    renderWallet((next) => {
      wallet = next;
    });

    await waitFor(() => expect(wallet).toBeTruthy());
    await waitFor(() => expect(wallet.options.some((row) => row.id === "discovered:wallet-b")).toBe(true));

    mocks.requestAccounts.mockResolvedValue([ADDR_B]);
    mocks.readChainId.mockResolvedValue(61997);
    await act(async () => {
      await wallet.connectWallet("discovered:wallet-b");
    });

    await waitFor(() => expect(wallet.address).toBe(ADDR_B));
    expect(wallet.walletName).toBe("Rabby");

    await act(async () => {
      resolveRestoreAccounts([ADDR_A]);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(wallet.address).toBe(ADDR_B);
    expect(wallet.walletName).toBe("Rabby");
    expect(wallet.provider).toBe(walletB.provider);
  });

  it("does not stay stuck when the previous provider.disconnect never resolves", async () => {
    const hanging = provider("A", () => new Promise(() => undefined));
    const a = { ...walletA, provider: hanging };
    mocks.discoverInjectedWallets.mockResolvedValue([a, walletB]);
    mocks.requestAccounts.mockImplementation(async (injected?: EthereumProvider) => {
      if (injected === hanging) return [ADDR_A];
      return [ADDR_B];
    });

    let wallet!: ReturnType<typeof useWallet>;
    renderWallet((next) => {
      wallet = next;
    });
    await waitFor(() => expect(wallet.options.some((row) => row.id === "discovered:wallet-a")).toBe(true));

    await act(async () => {
      await wallet.connectWallet("discovered:wallet-a");
    });
    await waitFor(() => expect(wallet.address).toBe(ADDR_A));

    const started = Date.now();
    await act(async () => {
      await wallet.connectWallet("discovered:wallet-b");
    });
    expect(Date.now() - started).toBeLessThan(4000);
    await waitFor(() => expect(wallet.address).toBe(ADDR_B));
    expect(wallet.isLoading).toBe(false);
    expect(wallet.walletName).toBe("Rabby");
  });

  it("keeps a user approval that arrives after more than 8 seconds", async () => {
    let wallet!: ReturnType<typeof useWallet>;
    renderWallet((next) => {
      wallet = next;
    });
    await waitFor(() => expect(wallet.options.some((row) => row.id === "discovered:wallet-b")).toBe(true));

    mocks.requestAccounts.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([ADDR_B]), 9000);
        }),
    );

    vi.useFakeTimers();
    let finished: Promise<string | void> | undefined;
    await act(async () => {
      finished = wallet.connectWallet("discovered:wallet-b");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8500);
    });
    expect(wallet.address).not.toBe(ADDR_B);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
      await finished;
    });
    expect(wallet.address).toBe(ADDR_B);
    expect(wallet.isLoading).toBe(false);
    vi.useRealTimers();
  });

  it("does not restore a session after an explicit disconnect and refresh", async () => {
    let wallet!: ReturnType<typeof useWallet>;
    const view = renderWallet((next) => {
      wallet = next;
    });
    await waitFor(() => expect(wallet.options.some((row) => row.id === "discovered:wallet-b")).toBe(true));

    await act(async () => {
      await wallet.connectWallet("discovered:wallet-b");
    });
    await waitFor(() => expect(wallet.address).toBe(ADDR_B));
    expect(window.localStorage.getItem(LAST_WALLET)).toContain("wallet-b");

    act(() => {
      wallet.disconnectWallet();
    });
    await waitFor(() => expect(wallet.address).toBeNull());
    expect(window.localStorage.getItem(DISCONNECT_FLAG)).toBe("true");
    expect(window.localStorage.getItem(LAST_WALLET)).toBeNull();

    view.unmount();
    let restored!: ReturnType<typeof useWallet>;
    renderWallet((next) => {
      restored = next;
    });
    await waitFor(() => expect(restored).toBeTruthy());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(restored.address).toBeNull();
    expect(restored.isConnected).toBe(false);
  });
});
