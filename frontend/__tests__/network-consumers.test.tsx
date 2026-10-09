import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GENLAYER_CHAIN,
  GENLAYER_CHAIN_ID_HEX,
  GENLAYER_NETWORK,
} from "../lib/genlayer/network";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ readContract: vi.fn() })),
  createTransactionKit: vi.fn(() => ({ configured: true })),
}));

vi.mock("genlayer-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@genlayer/transaction-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@genlayer/transaction-kit")>()),
  createTransactionKit: mocks.createTransactionKit,
}));

import { AgentPayAdapter, getChainBinding } from "../lib/contract/adapter";
import {
  addGenLayerNetwork,
  switchToGenLayerNetwork,
} from "../lib/genlayer/client";
import { useTransactionKit } from "../lib/genlayer/kit";

const account = "0x1234567890123456789012345678901234567890";
const providerRequest = vi.fn();
const wallet = vi.hoisted(() => ({
  address: "0x1234567890123456789012345678901234567890" as string | null,
  provider: null as { request: ReturnType<typeof vi.fn> } | null,
  connectorId: "injected",
  chainId: "0xF21D",
}));

vi.mock("../lib/genlayer/WalletProvider", () => ({
  useWallet: () => wallet,
}));

describe("network consumers", () => {
  beforeEach(() => {
    mocks.createClient.mockClear();
    mocks.createTransactionKit.mockClear();
    providerRequest.mockReset();
    providerRequest.mockResolvedValue("0xF21D");
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F");
    const provider = {
      request: providerRequest,
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    wallet.address = account;
    wallet.provider = provider;
    wallet.connectorId = "injected";
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: provider,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("binds the adapter to the shared Studio Next chain without calling it", () => {
    const adapter = new AgentPayAdapter(account);
    adapter.updateAccount("0x0000000000000000000000000000000000000001");
    expect(getChainBinding()).toMatchObject({
      chainId: GENLAYER_CHAIN.id,
      chainName: GENLAYER_CHAIN.name,
      rpcUrl: GENLAYER_CHAIN.rpcUrls.default.http[0],
      methodsConfirmed: true,
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("does not confirm methods for an unrelated valid address", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", "0x1111111111111111111111111111111111111111");
    expect(getChainBinding().methodsConfirmed).toBe(false);
  });

  it("uses the same chain for Transaction Kit submissions", () => {
    renderHook(() => useTransactionKit(account));

    expect(mocks.createTransactionKit).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        chain: GENLAYER_CHAIN,
        provider: expect.objectContaining({ request: expect.any(Function) }),
        suggestions: expect.any(Object),
      }),
    );
  });

  it("submits native payouts with Studio Next's simulated message allocation", async () => {
    const allocation = {
      messageType: 0,
      recipient: account,
      parentIndex: 0n,
      budget: 150n,
      feeParams: "0x",
    };
    const distribution = { totalMessageFees: 150n, appealRounds: 3n, rotations: [1n, 1n, 1n, 1n] };
    const quote = { distribution, feeValue: 2000n, userValue: 0n };
    const baseEstimate = vi.fn().mockResolvedValue(quote);
    const baseSubmit = vi.fn();
    const estimateForWrite = vi.fn().mockResolvedValue({
      distribution,
      feeValue: 1000n,
      messageAllocations: [allocation],
    });
    const writeContract = vi.fn().mockResolvedValue(`0x${"a".repeat(64)}`);
    mocks.createTransactionKit.mockImplementationOnce(() => ({
      estimate: baseEstimate,
      submit: baseSubmit,
    }) as never);
    mocks.createClient.mockImplementationOnce(() => ({
      estimateTransactionFeesForWrite: estimateForWrite,
      writeContract,
    }) as never);

    const { result } = renderHook(() => useTransactionKit(account));
    const tx = {
      kind: "write" as const,
      address: "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F" as const,
      method: "withdraw_credit",
      args: ["m-1", "5000000000000000"],
    };
    const payoutQuote = await result.current!.estimate({ preset: "standard" }, tx);
    await result.current!.submit(payoutQuote, tx);

    expect(estimateForWrite).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "withdraw_credit",
      account: { address: account, type: "json-rpc" },
    }));
    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: "withdraw_credit",
      fees: expect.objectContaining({ messageAllocations: [allocation] }),
    }));
    expect(baseSubmit).not.toHaveBeenCalled();
  });

  it("blocks native payout signing when Studio Next returns no allocation", async () => {
    const baseEstimate = vi.fn();
    mocks.createTransactionKit.mockImplementationOnce(() => ({ estimate: baseEstimate }) as never);
    mocks.createClient.mockImplementationOnce(() => ({
      estimateTransactionFeesForWrite: vi.fn().mockResolvedValue({ messageAllocations: [] }),
    }) as never);
    const { result } = renderHook(() => useTransactionKit(account));
    await expect(result.current!.estimate({ preset: "standard" }, {
      kind: "write",
      address: "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F",
      method: "close_mandate",
      args: ["m-1"],
    })).rejects.toThrow(/did not return a native-transfer fee allocation/);
    expect(baseEstimate).not.toHaveBeenCalled();
  });

  it("does not create a signing kit without an account", () => {
    wallet.address = null;
    const { result } = renderHook(() => useTransactionKit(null));
    expect(result.current).toBeNull();
    expect(mocks.createTransactionKit).not.toHaveBeenCalled();
  });

  it("does not create a signing kit without a wallet provider", () => {
    wallet.provider = null;
    Object.defineProperty(window, "ethereum", { configurable: true, value: undefined });
    const { result } = renderHook(() => useTransactionKit(account));
    expect(result.current).toBeNull();
    expect(mocks.createTransactionKit).not.toHaveBeenCalled();
  });

  it("binds Transaction Kit to the selected provider, not window.ethereum", () => {
    const selected = { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    wallet.provider = selected;
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
    });
    renderHook(() => useTransactionKit(account));
    expect(mocks.createTransactionKit).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        chain: GENLAYER_CHAIN,
        provider: expect.objectContaining({ request: expect.any(Function) }),
      }),
    );
    const bound = mocks.createTransactionKit.mock.calls.at(0)?.at(0) as { provider?: unknown } | undefined;
    expect(bound?.provider).toBeTruthy();
    expect(bound?.provider).not.toBe(window.ethereum);
  });

  it("uses the shared wallet network for add and switch requests", async () => {
    await switchToGenLayerNetwork();
    expect(providerRequest).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
    });

    await addGenLayerNetwork();
    expect(providerRequest).toHaveBeenCalledWith({
      method: "wallet_addEthereumChain",
      params: [GENLAYER_NETWORK],
    });
  });
});
