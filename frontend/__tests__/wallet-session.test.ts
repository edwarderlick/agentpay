import { describe, expect, it, vi } from "vitest";
import {
  acceptProvider,
  buildWalletOptions,
  kitBinding,
  replaceSession,
  viewSession,
  type WalletSession,
} from "../lib/genlayer/session";
import type { EthereumProvider } from "../lib/genlayer/eip1193";

const ADDR_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ADDR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const STUDIO = 61997;

function provider(label: string): EthereumProvider {
  return { request: vi.fn(), on: vi.fn(), removeListener: vi.fn(), label } as EthereumProvider & {
    label: string;
  };
}

describe("atomic wallet session", () => {
  it("keeps wagmi wallet A, then overlay wallet B, on B’s provider and chain", () => {
    const providerA = provider("A");
    const providerB = provider("B");
    let session: WalletSession | null = replaceSession(1, {
      source: "wagmi",
      address: ADDR_A,
      chainId: STUDIO,
      name: "MetaMask",
      connectorId: "mm",
      provider: providerA,
    });
    session = replaceSession(2, {
      source: "direct",
      address: ADDR_B,
      chainId: 1,
      name: "Rabby",
      connectorId: "discovered:rabby",
      provider: providerB,
    });
    const view = viewSession(session, STUDIO);
    expect(view.address).toBe(ADDR_B);
    expect(view.walletName).toBe("Rabby");
    expect(view.connectorId).toBe("discovered:rabby");
    expect(view.provider).toBe(providerB);
    expect(view.chainId).toBe(1);
    expect(view.isOnCorrectNetwork).toBe(false);
    expect(view.canWrite).toBe(false);
    expect(kitBinding(view)).toBeNull();
  });

  it("ignores a late wallet-A provider after B is selected", () => {
    const providerA = provider("A");
    const providerB = provider("B");
    let session: WalletSession | null = replaceSession(1, {
      source: "wagmi",
      address: ADDR_A,
      chainId: STUDIO,
      name: "MetaMask",
      connectorId: "mm",
      provider: null,
    });
    session = replaceSession(2, {
      source: "direct",
      address: ADDR_B,
      chainId: null,
      name: "Rabby",
      connectorId: "discovered:rabby",
      provider: providerB,
    });
    session = acceptProvider(session, 1, providerA);
    const view = viewSession(session, STUDIO);
    expect(view.provider).toBe(providerB);
    expect(view.address).toBe(ADDR_B);
    expect(view.chainId).toBeNull();
    expect(view.canWrite).toBe(false);
    expect(kitBinding(view)).toBeNull();
  });

  it("does not borrow wagmi’s chain when the active session chain is unknown", () => {
    const providerB = provider("B");
    const session = replaceSession(2, {
      source: "direct",
      address: ADDR_B,
      chainId: null,
      name: "Rabby",
      connectorId: "discovered:rabby",
      provider: providerB,
    });
    const view = viewSession(session, STUDIO);
    expect(view.chainId).toBeNull();
    expect(view.isOnCorrectNetwork).toBe(false);
    expect(view.canWrite).toBe(false);
  });

  it("blocks writes when B is on the wrong chain and keeps B’s chain", () => {
    const providerB = provider("B");
    const session = replaceSession(2, {
      source: "direct",
      address: ADDR_B,
      chainId: 1,
      name: "Rabby",
      connectorId: "discovered:rabby",
      provider: providerB,
    });
    const view = viewSession(session, STUDIO);
    expect(view.chainId).toBe(1);
    expect(view.provider).toBe(providerB);
    expect(view.canWrite).toBe(false);
    expect(kitBinding(view)).toBeNull();
  });

  it("clears the displayed session when B disconnects instead of falling back to A", () => {
    const providerB = provider("B");
    let session: WalletSession | null = replaceSession(2, {
      source: "direct",
      address: ADDR_B,
      chainId: STUDIO,
      name: "Rabby",
      connectorId: "discovered:rabby",
      provider: providerB,
    });
    session = null;
    const view = viewSession(session, STUDIO);
    expect(view.isConnected).toBe(false);
    expect(view.address).toBeNull();
    expect(view.provider).toBeNull();
    expect(view.canWrite).toBe(false);
    expect(kitBinding(view)).toBeNull();
  });

  it("binds Transaction Kit to the same session address, chain, and provider", () => {
    const providerB = provider("B");
    const session = replaceSession(3, {
      source: "direct",
      address: ADDR_B,
      chainId: STUDIO,
      name: "Rabby",
      connectorId: "discovered:rabby",
      provider: providerB,
    });
    const view = viewSession(session, STUDIO);
    expect(kitBinding(view)).toEqual({
      provider: providerB,
      address: ADDR_B,
      chainId: STUDIO,
    });
  });
});

describe("chooser options", () => {
  it("has no enabled injected row in a browser without an extension", () => {
    const options = buildWalletOptions(
      [
        {
          id: "injected",
          name: "Injected",
          rdns: null,
          icon: null,
          kind: "injected",
          provider: null,
        },
      ],
      [],
      false,
    );
    expect(options.filter((row) => row.kind === "injected" && row.ready)).toHaveLength(0);
    expect(options.find((row) => row.name === "Injected")).toBeUndefined();
    const wc = options.find((row) => row.name === "WalletConnect");
    expect(wc?.ready).toBe(false);
    expect(wc?.kind).toBe("unavailable");
  });

  it("shows named EIP-6963 wallets and skips a duplicate wagmi connector for the same provider", () => {
    const rabby = provider("rabby");
    const options = buildWalletOptions(
      [
        {
          id: "io.rabby",
          name: "Rabby",
          rdns: "io.rabby",
          icon: null,
          kind: "injected",
          provider: rabby,
        },
        {
          id: "injected",
          name: "Injected",
          rdns: null,
          icon: null,
          kind: "injected",
          provider: null,
        },
      ],
      [
        {
          id: "rabby-1",
          name: "Rabby",
          rdns: "io.rabby",
          icon: null,
          kind: "eip6963",
          provider: rabby,
        },
      ],
      false,
    );
    const injected = options.filter((row) => row.kind === "injected");
    expect(injected).toHaveLength(1);
    expect(injected[0]?.name).toBe("Rabby");
    expect(injected[0]?.ready).toBe(true);
    expect(options.find((row) => row.name === "WalletConnect")?.ready).toBe(false);
  });
});
