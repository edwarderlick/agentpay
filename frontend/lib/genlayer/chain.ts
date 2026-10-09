import { GENLAYER_CHAIN, GENLAYER_CHAIN_ID, GENLAYER_CHAIN_ID_HEX, GENLAYER_NETWORK } from "./network";
import { mapWalletError } from "./errors";
import {
  INTERACTIVE_RPC_TIMEOUT_MS,
  SILENT_RPC_TIMEOUT_MS,
  normalizeChainId,
  providerRequest,
  type EthereumProvider,
} from "./eip1193";

export { GENLAYER_CHAIN, GENLAYER_CHAIN_ID, GENLAYER_CHAIN_ID_HEX, GENLAYER_NETWORK };

export async function readAccounts(
  provider: EthereumProvider,
  timeoutMs = SILENT_RPC_TIMEOUT_MS,
): Promise<string[]> {
  try {
    const accounts = await providerRequest<string[]>(
      provider,
      { method: "eth_accounts" },
      timeoutMs,
    );
    return Array.isArray(accounts) ? accounts.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function requestAccounts(provider: EthereumProvider): Promise<string[]> {
  try {
    const accounts = await providerRequest<string[]>(
      provider,
      { method: "eth_requestAccounts" },
      INTERACTIVE_RPC_TIMEOUT_MS,
    );
    if (!accounts?.length) throw new Error("No account returned by the wallet.");
    return accounts;
  } catch (err) {
    const mapped = mapWalletError(err);
    throw new Error(mapped.message);
  }
}

export async function readChainId(
  provider: EthereumProvider,
  timeoutMs = SILENT_RPC_TIMEOUT_MS,
): Promise<number | null> {
  try {
    const value = await providerRequest<string>(provider, { method: "eth_chainId" }, timeoutMs);
    return normalizeChainId(value);
  } catch {
    return null;
  }
}

export async function addStudioNextChain(provider: EthereumProvider): Promise<void> {
  try {
    await providerRequest(
      provider,
      {
        method: "wallet_addEthereumChain",
        params: [GENLAYER_NETWORK],
      },
      INTERACTIVE_RPC_TIMEOUT_MS,
    );
  } catch (err) {
    const mapped = mapWalletError(err);
    throw new Error(mapped.message);
  }
}

export async function switchToStudioNextChain(provider: EthereumProvider): Promise<void> {
  try {
    await providerRequest(
      provider,
      {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
      },
      INTERACTIVE_RPC_TIMEOUT_MS,
    );
  } catch (err) {
    const mapped = mapWalletError(err);
    if (mapped.code === 4902) {
      await addStudioNextChain(provider);
      await providerRequest(
        provider,
        {
          method: "wallet_switchEthereumChain",
          params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
        },
        INTERACTIVE_RPC_TIMEOUT_MS,
      );
      return;
    }
    if (mapped.code === "unknown" && /not implemented|unsupported/i.test(mapped.message)) {
      throw new Error(
        "This wallet cannot switch to Studio Next (chain 61997). Open the wallet’s network settings, add the chain, then retry.",
      );
    }
    throw new Error(mapped.message);
  }
}

export async function requestAccountPicker(provider: EthereumProvider): Promise<string> {
  try {
    await providerRequest(
      provider,
      {
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      },
      INTERACTIVE_RPC_TIMEOUT_MS,
    );
    const accounts = await requestAccounts(provider);
    return accounts[0];
  } catch (err) {
    const mapped = mapWalletError(err);
    throw new Error(mapped.message);
  }
}
