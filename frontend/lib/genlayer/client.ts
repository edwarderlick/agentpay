"use client";

import { createClient } from "genlayer-js";
import { createWalletClient, custom, type WalletClient } from "viem";
import {
  GENLAYER_CHAIN,
  GENLAYER_CHAIN_ID,
  GENLAYER_CHAIN_ID_HEX,
  GENLAYER_NETWORK,
} from "./network";
import {
  addStudioNextChain,
  readAccounts,
  readChainId,
  requestAccounts as requestAccountsOnProvider,
  switchToStudioNextChain,
} from "./chain";
import type { EthereumProvider } from "./eip1193";

export {
  GENLAYER_CHAIN,
  GENLAYER_CHAIN_ID,
  GENLAYER_CHAIN_ID_HEX,
  GENLAYER_NETWORK,
} from "./network";
export type { EthereumProvider } from "./eip1193";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function getStudioUrl(): string {
  return GENLAYER_CHAIN.rpcUrls.default.http[0];
}

export function getContractAddress(): string {
  return process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
}

/** Legacy injected provider only. Prefer the selected wallet from useWallet(). */
export function getLegacyInjectedProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

/** @deprecated Use the selected provider from useWallet(). */
export function getEthereumProvider(): EthereumProvider | null {
  return getLegacyInjectedProvider();
}

function requireProvider(provider?: EthereumProvider | null): EthereumProvider {
  if (provider) return provider;
  const legacy = getLegacyInjectedProvider();
  if (!legacy) {
    throw new Error("No injected wallet is available in this browser.");
  }
  return legacy;
}

export async function requestAccounts(provider?: EthereumProvider | null): Promise<string[]> {
  return requestAccountsOnProvider(requireProvider(provider));
}

export async function getAccounts(provider?: EthereumProvider | null): Promise<string[]> {
  const resolved = provider ?? getLegacyInjectedProvider();
  if (!resolved) return [];
  return readAccounts(resolved);
}

export async function getCurrentChainId(provider?: EthereumProvider | null): Promise<string | null> {
  const resolved = provider ?? getLegacyInjectedProvider();
  if (!resolved) return null;
  const id = await readChainId(resolved);
  if (id === null) return null;
  return `0x${id.toString(16)}`;
}

export async function addGenLayerNetwork(provider?: EthereumProvider | null): Promise<void> {
  await addStudioNextChain(requireProvider(provider));
}

export async function switchToGenLayerNetwork(provider?: EthereumProvider | null): Promise<void> {
  await switchToStudioNextChain(requireProvider(provider));
}

export async function isOnGenLayerNetwork(provider?: EthereumProvider | null): Promise<boolean> {
  const resolved = provider ?? getLegacyInjectedProvider();
  if (!resolved) return false;
  const id = await readChainId(resolved);
  return id === GENLAYER_CHAIN_ID;
}

export function createWalletClientFromProvider(provider: EthereumProvider): WalletClient | null {
  try {
    return createWalletClient({
      chain: GENLAYER_CHAIN,
      transport: custom(provider),
    });
  } catch (error) {
    console.error("Error creating wallet client:", error);
    return null;
  }
}

export function createGenLayerClient(address?: string) {
  const config: { chain: typeof GENLAYER_CHAIN; account?: `0x${string}` } = {
    chain: GENLAYER_CHAIN,
  };
  if (address) {
    config.account = address as `0x${string}`;
  }
  try {
    return createClient(config);
  } catch (error) {
    console.error("Error creating GenLayer client:", error);
    return createClient({ chain: GENLAYER_CHAIN });
  }
}
