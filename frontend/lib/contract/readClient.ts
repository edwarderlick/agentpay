import { createClient } from "genlayer-js";
import { createPublicClient, http, type Address } from "viem";
import { GENLAYER_CHAIN } from "../genlayer/client";
import { getConfiguredContractAddress } from "./config";

const BUSY = /Server busy|retry later|-32006/i;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getReadClient() {
  return createClient({ chain: GENLAYER_CHAIN });
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 8, delayMs = 1500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < retries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const text = error instanceof Error ? error.message : String(error);
      if (!BUSY.test(text) || i === retries - 1) throw error;
      await sleep(delayMs);
    }
  }
  throw last;
}

export async function readView<T = unknown>(
  functionName: string,
  args: unknown[] = [],
  address = getConfiguredContractAddress(),
): Promise<T> {
  if (!address) {
    throw new Error("Contract address is not configured");
  }
  const client = getReadClient();
  return withRetry(() =>
    client.readContract({
      address: address as Address,
      functionName,
      args: args as never,
      jsonSafeReturn: true,
    }),
  ) as Promise<T>;
}

export async function readNativeBalance(address: string): Promise<bigint> {
  const client = createPublicClient({
    chain: GENLAYER_CHAIN,
    transport: http(GENLAYER_CHAIN.rpcUrls.default.http[0]),
  });
  return withRetry(() => client.getBalance({ address: address as Address }));
}

export type ObservedTransfer = {
  from: string | null;
  to: string | null;
  value: bigint | null;
  isEthSend: boolean | null;
};

export type TransactionLifecycle = {
  finalized: boolean;
  executionOk: boolean;
  statusName: string;
  executionName: string;
  contractAddress: string | null;
  sender: string | null;
  createdIds: string[];
  transfers: ObservedTransfer[];
};

function asAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function asWei(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return null;
}

function parseTransfer(raw: unknown): ObservedTransfer | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const nested =
    item.message && typeof item.message === "object"
      ? (item.message as Record<string, unknown>)
      : item;
  const to = asAddress(nested.recipient ?? nested.to ?? nested.address ?? nested.destination);
  const from = asAddress(nested.sender ?? nested.from ?? nested.contract ?? nested.origin);
  const value = asWei(nested.value ?? nested.amount ?? nested.value_wei);
  const isEthSend = asBoolean(nested.is_eth_send ?? nested.isEthSend ?? item.is_eth_send ?? item.isEthSend);
  if (!to && value === null && from === null && isEthSend === null) return null;
  return { from, to, value, isEthSend };
}

function collectTransfers(tx: Record<string, unknown>): ObservedTransfer[] {
  const found: ObservedTransfer[] = [];
  const pushAll = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      const parsed = parseTransfer(item);
      if (parsed) found.push(parsed);
    }
  };
  pushAll(tx.messages);
  const consensus = tx.consensus_data;
  const leaders =
    consensus && typeof consensus === "object"
      ? (consensus as Record<string, unknown>).leader_receipt
      : undefined;
  const receipts = Array.isArray(leaders) ? leaders : leaders ? [leaders] : [];
  for (const receipt of receipts) {
    if (!receipt || typeof receipt !== "object") continue;
    const row = receipt as Record<string, unknown>;
    pushAll(row.pending_transactions);
    pushAll(row.messages);
  }
  const data = tx.data;
  if (data && typeof data === "object") {
    pushAll((data as Record<string, unknown>).messages);
  }
  return found;
}

export async function readTransactionLifecycle(hash: string): Promise<TransactionLifecycle> {
  const client = getReadClient();
  const tx = await withRetry(() =>
    client.getTransaction({ hash: hash as `0x${string}` & { length: 66 } }),
  );
  const raw = tx as unknown as Record<string, unknown>;
  const statusName = String(tx.statusName ?? tx.status ?? "");
  const executionName = String(tx.txExecutionResultName ?? "");
  const finalized = statusName.toUpperCase() === "FINALIZED";
  const executionOk = executionName === "FINISHED_WITH_RETURN";
  return {
    finalized,
    executionOk,
    statusName,
    executionName,
    contractAddress: asAddress(tx.to_address ?? tx.recipient),
    sender: asAddress(tx.from_address ?? tx.sender),
    createdIds: createdIdsFromDecoded(tx.txDataDecoded ?? tx.data),
    transfers: collectTransfers(raw),
  };
}

const CREATED_ID_RE = /^(m|inv|req)-[A-Za-z0-9-]+$/;

export function createdIdsFromDecoded(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (CREATED_ID_RE.test(trimmed) && !found.includes(trimmed)) found.push(trimmed);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) createdIdsFromDecoded(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      createdIdsFromDecoded(item, found);
    }
  }
  return found;
}
