import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverInjectedWallets, resolveConnectTarget } from "../lib/genlayer/discover";
import { createGuardedProvider, withTimeout } from "../lib/genlayer/eip1193";
import { mapWalletError } from "../lib/genlayer/errors";
import {
  getWalletConnectProjectId,
  isWalletConnectConfigured,
  restoreWalletConnectSession,
} from "../lib/genlayer/walletconnect";
import { requestAccounts, switchToGenLayerNetwork } from "../lib/genlayer/client";
import { LAST_WALLET, DISCONNECT_FLAG, shouldReconnectWagmi } from "../lib/genlayer/WalletProvider";
import {
  INTERACTIVE_RPC_TIMEOUT_MS,
  SILENT_RPC_TIMEOUT_MS,
  timeoutForMethod,
} from "../lib/genlayer/eip1193";

afterEach(() => {
  vi.unstubAllEnvs();
  window.localStorage.clear();
  Object.defineProperty(window, "ethereum", { configurable: true, value: undefined });
});

describe("wallet error mapping", () => {
  it("maps 4001 to a rejected request", () => {
    expect(mapWalletError({ code: 4001, message: "denied" }).code).toBe(4001);
  });

  it("maps -32002 to a pending request", () => {
    expect(mapWalletError({ code: -32002 }).message).toMatch(/already open/i);
  });
});

describe("rpc timeouts", () => {
  it("uses a short timeout for silent reads and a long timeout for user prompts", () => {
    expect(timeoutForMethod("eth_accounts")).toBe(SILENT_RPC_TIMEOUT_MS);
    expect(timeoutForMethod("eth_chainId")).toBe(SILENT_RPC_TIMEOUT_MS);
    expect(timeoutForMethod("eth_requestAccounts")).toBe(INTERACTIVE_RPC_TIMEOUT_MS);
    expect(timeoutForMethod("wallet_switchEthereumChain")).toBe(INTERACTIVE_RPC_TIMEOUT_MS);
    expect(timeoutForMethod("wallet_addEthereumChain")).toBe(INTERACTIVE_RPC_TIMEOUT_MS);
    expect(timeoutForMethod("wallet_requestPermissions")).toBe(INTERACTIVE_RPC_TIMEOUT_MS);
    expect(INTERACTIVE_RPC_TIMEOUT_MS).toBeGreaterThan(8000);
  });
});

describe("wagmi restore gate", () => {
  it("does not reconnect without an explicit previously approved wallet record", () => {
    window.localStorage.clear();
    expect(shouldReconnectWagmi()).toBe(false);
  });

  it("reconnects wagmi only when the last approved record is a wagmi wallet", () => {
    window.localStorage.setItem(LAST_WALLET, JSON.stringify({ kind: "wagmi", id: "mm" }));
    expect(shouldReconnectWagmi()).toBe(true);
    window.localStorage.setItem(LAST_WALLET, JSON.stringify({ kind: "overlay", id: "rabby" }));
    expect(shouldReconnectWagmi()).toBe(false);
    window.localStorage.setItem(DISCONNECT_FLAG, "true");
    window.localStorage.setItem(LAST_WALLET, JSON.stringify({ kind: "wagmi", id: "mm" }));
    expect(shouldReconnectWagmi()).toBe(false);
  });
});

describe("provider request timeout", () => {
  it("rejects when a provider hangs", async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 20, "Wallet request timed out (eth_accounts)."),
    ).rejects.toThrow(/timed out/i);
  });
});

describe("injected discovery", () => {
  it("collects EIP-6963 wallets and does not require isMetaMask", async () => {
    const provider = { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const announce = () => {
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: { uuid: "rabby-1", name: "Rabby", icon: "", rdns: "io.rabby" },
            provider,
          },
        }),
      );
    };
    window.addEventListener("eip6963:requestProvider", announce);
    const wallets = await discoverInjectedWallets(30);
    window.removeEventListener("eip6963:requestProvider", announce);
    expect(wallets).toEqual([
      expect.objectContaining({ name: "Rabby", rdns: "io.rabby", kind: "eip6963" }),
    ]);
  });

  it("falls back to a legacy injected provider when nothing announces", async () => {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { request: vi.fn(), isBraveWallet: true },
    });
    const wallets = await discoverInjectedWallets(20);
    expect(wallets[0]?.kind).toBe("legacy");
    expect(wallets[0]?.name).toBe("Brave Wallet");
  });
});

describe("selected-provider writes", () => {
  it("rejects a write when the selected account changed", async () => {
    const provider = {
      request: vi.fn(async (args: { method: string }) => {
        if (args.method === "eth_accounts") return ["0x1111111111111111111111111111111111111111"];
        if (args.method === "eth_chainId") return "0xF21D";
        return "0xok";
      }),
    };
    const guarded = createGuardedProvider(provider, {
      address: "0x2222222222222222222222222222222222222222",
      chainId: 61997,
    });
    await expect(
      guarded.request({ method: "eth_sendTransaction", params: [] }),
    ).rejects.toThrow(/account changed/i);
  });

  it("rejects a write on the wrong chain", async () => {
    const provider = {
      request: vi.fn(async (args: { method: string }) => {
        if (args.method === "eth_accounts") return ["0x2222222222222222222222222222222222222222"];
        if (args.method === "eth_chainId") return "0x1";
        return "0xok";
      }),
    };
    const guarded = createGuardedProvider(provider, {
      address: "0x2222222222222222222222222222222222222222",
      chainId: 61997,
    });
    await expect(
      guarded.request({ method: "eth_sendTransaction", params: [] }),
    ).rejects.toThrow(/Wrong network/i);
  });
});

describe("connect target selection", () => {
  it("binds a discovered wallet to that exact provider option", () => {
    const rabby = {
      id: "rabby-1",
      name: "Rabby",
      rdns: "io.rabby",
      icon: null,
      kind: "eip6963" as const,
      provider: { request: vi.fn() },
    };
    expect(resolveConnectTarget("discovered:rabby-1", ["injected"], [rabby])).toEqual({
      type: "provider",
      wallet: rabby,
    });
  });

  it("keeps a wagmi connector id on the connector path", () => {
    expect(resolveConnectTarget("abc-uid", ["abc-uid"], [])).toEqual({
      type: "connector",
      id: "abc-uid",
    });
  });

  it("marks WalletConnect as unconfigured when that option is selected", () => {
    expect(resolveConnectTarget("walletconnect-unconfigured", [], [])).toEqual({
      type: "unconfigured",
    });
  });
});

describe("WalletConnect configuration", () => {
  it("is disabled when the public project ID is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
    expect(getWalletConnectProjectId()).toBeUndefined();
    expect(isWalletConnectConfigured()).toBe(false);
  });

  it("does not open a QR modal when restoring without a project ID", async () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
    await expect(restoreWalletConnectSession()).resolves.toBeNull();
  });
});

describe("legacy client helpers", () => {
  it("maps 4001 on requestAccounts", async () => {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { request: vi.fn().mockRejectedValue({ code: 4001, message: "denied" }) },
    });
    await expect(requestAccounts()).rejects.toThrow(/rejected/i);
  });

  it("maps 4001 when switching networks", async () => {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { request: vi.fn().mockRejectedValue({ code: 4001, message: "denied" }) },
    });
    await expect(switchToGenLayerNetwork()).rejects.toThrow(/rejected/i);
  });
});
