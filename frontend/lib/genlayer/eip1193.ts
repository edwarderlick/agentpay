export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  disconnect?: () => Promise<void> | void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  providers?: EthereumProvider[];
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export type Eip6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: EthereumProvider;
};

export const SILENT_RPC_TIMEOUT_MS = 2500;
export const INTERACTIVE_RPC_TIMEOUT_MS = 120_000;
export const DISCONNECT_TIMEOUT_MS = 1500;

export function isInteractiveRpcMethod(method: string): boolean {
  return (
    method === "eth_requestAccounts" ||
    method === "wallet_addEthereumChain" ||
    method === "wallet_switchEthereumChain" ||
    method === "wallet_requestPermissions" ||
    method === "eth_sendTransaction" ||
    method === "eth_signTransaction" ||
    method === "eth_sign" ||
    method === "personal_sign" ||
    method === "eth_signTypedData" ||
    method === "eth_signTypedData_v3" ||
    method === "eth_signTypedData_v4" ||
    method.startsWith("wallet_send")
  );
}

export function timeoutForMethod(method: string): number {
  return isInteractiveRpcMethod(method) ? INTERACTIVE_RPC_TIMEOUT_MS : SILENT_RPC_TIMEOUT_MS;
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function providerRequest<T>(
  provider: EthereumProvider,
  args: { method: string; params?: unknown[] | object },
  timeoutMs = timeoutForMethod(args.method),
): Promise<T> {
  return withTimeout(
    Promise.resolve(provider.request(args) as Promise<T> | T),
    timeoutMs,
    `Wallet request timed out (${args.method}). Retry from the wallet button.`,
  );
}

export async function boundedDisconnect(
  provider: EthereumProvider | null | undefined,
  timeoutMs = DISCONNECT_TIMEOUT_MS,
): Promise<void> {
  if (!provider?.disconnect) return;
  try {
    await withTimeout(Promise.resolve(provider.disconnect()), timeoutMs, "Wallet disconnect timed out.");
  } catch {
    /* continue; a hung extension must not block the next session */
  }
}

export function normalizeChainId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = text.startsWith("0x") || text.startsWith("0X") ? parseInt(text, 16) : Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function isWriteRpcMethod(method: string): boolean {
  return (
    method === "eth_sendTransaction" ||
    method === "eth_signTransaction" ||
    method === "eth_sign" ||
    method === "personal_sign" ||
    method === "eth_signTypedData" ||
    method === "eth_signTypedData_v3" ||
    method === "eth_signTypedData_v4" ||
    method.startsWith("wallet_send")
  );
}

export function createGuardedProvider(
  provider: EthereumProvider,
  expected: { address: string; chainId: number },
): EthereumProvider {
  const request = async (args: { method: string; params?: unknown[] | object }) => {
    if (isWriteRpcMethod(args.method)) {
      const [accounts, chainHex] = await Promise.all([
        providerRequest<string[]>(provider, { method: "eth_accounts" }, SILENT_RPC_TIMEOUT_MS),
        providerRequest<string>(provider, { method: "eth_chainId" }, SILENT_RPC_TIMEOUT_MS),
      ]);
      const current = accounts?.[0];
      if (!sameAddress(current, expected.address)) {
        throw new Error(
          "Connected wallet account changed. Reconnect the wallet shown in the header before signing.",
        );
      }
      const chainId = normalizeChainId(chainHex);
      if (chainId !== expected.chainId) {
        throw new Error(
          `Wrong network for this write. Switch the selected wallet to chain ${expected.chainId}.`,
        );
      }
    }
    return provider.request(args);
  };
  return {
    ...provider,
    request,
    on: provider.on?.bind(provider),
    removeListener: provider.removeListener?.bind(provider),
    disconnect: provider.disconnect?.bind(provider),
  };
}
