import type { TrackedStatus } from "@genlayer/transaction-kit-react";
import { STUDIO_NEXT } from "../constants";
import { safeGet, safeRemove, safeSet } from "../safe-storage";
import { readTransactionLifecycle, readView } from "./readClient";
import { executionOkFromStatus, txHashFromStatus } from "./payout";
import type { PreparedWrite } from "./types";

export type CreatedRecordKind = "mandate" | "invoice" | "decision";

export type CreatedWriteScope = {
  wallet: string;
  chainId: number;
  contractAddress: string;
};

export type CreatedWrite = {
  kind: CreatedRecordKind;
  id: string;
  href: string;
  txHash: string | null;
  wallet: string;
  chainId: number;
  contractAddress: string;
};

export type CreatedWriteVerifyReason =
  | "missing_tx"
  | "not_finalized"
  | "failed_execution"
  | "missing_record"
  | "read_error"
  | "wrong_contract"
  | "wrong_sender"
  | "wrong_id";

export type CreatedWriteVerifyResult =
  | { ok: true }
  | { ok: false; reason: CreatedWriteVerifyReason };

export const OPEN_CREATED_RECORD_LABEL = "Open created record";
export const VERIFICATION_PENDING_TITLE = "Verification pending";
export const RETRY_VERIFICATION_LABEL = "Retry verification";
export const CREATED_WRITE_STORAGE_KEY = "agentpay.created-write.v1";
export const CREATED_WRITE_ARCHIVE_KEY = "agentpay.created-write.archive.v1";

const INCONCLUSIVE_REASONS: CreatedWriteVerifyReason[] = [
  "read_error",
  "missing_record",
  "not_finalized",
  "missing_tx",
];

type CreatedWriteStoreV2 = {
  version: 2;
  entries: Record<string, CreatedWrite>;
};

export function createdRecordHref(kind: CreatedRecordKind, id: string): string {
  if (kind === "mandate") return `/mandates/${id}`;
  if (kind === "invoice") return `/invoices/${id}`;
  return `/decisions/${id}`;
}

export function recordIdFromPrepared(prepared: PreparedWrite | null | undefined): string | null {
  const id = prepared?.args[0];
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function parseCreatedWriteChainId(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? Number.parseInt(trimmed, 16) : Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function createdWriteScope(input: {
  wallet?: string | null;
  chainId?: string | number | null;
  contractAddress?: string | null;
}): CreatedWriteScope | null {
  const wallet = (input.wallet ?? "").trim();
  const chainId = parseCreatedWriteChainId(input.chainId);
  const contractAddress = (input.contractAddress ?? "").trim();
  if (!isHexAddress(wallet) || chainId === null || !isHexAddress(contractAddress)) return null;
  return {
    wallet: wallet.toLowerCase(),
    chainId,
    contractAddress: contractAddress.toLowerCase(),
  };
}

export function commitCreatedWrite(
  kind: CreatedRecordKind,
  prepared: PreparedWrite | null | undefined,
  status: TrackedStatus,
  scope?: CreatedWriteScope | null,
): CreatedWrite | null {
  if (status.phase !== "finalized" || !executionOkFromStatus(status)) return null;
  const id = recordIdFromPrepared(prepared);
  if (!id) return null;
  return {
    kind,
    id,
    href: createdRecordHref(kind, id),
    txHash: txHashFromStatus(status),
    wallet: scope?.wallet ?? "",
    chainId: scope?.chainId ?? 0,
    contractAddress: scope?.contractAddress ?? "",
  };
}

export function createdWriteBlocksPrepare(created: CreatedWrite | null | undefined): boolean {
  return Boolean(created);
}

export function createdWriteLockReason(kind: CreatedRecordKind): string {
  const noun = kind === "mandate" ? "mandate" : kind === "invoice" ? "invoice" : "payment request";
  return `This ${noun} already finalized on chain. Open the created record. Do not submit this prepared write again.`;
}

export function createdWriteRecoveringReason(): string {
  return "A finalized create is being verified with a read-only Studio Next check. This prepared write stays locked. It will not be signed or submitted again.";
}

export function createdWriteKeepsLock(reason: CreatedWriteVerifyReason): boolean {
  return reason !== "failed_execution";
}

export function createdWriteIsInconclusive(reason: CreatedWriteVerifyReason): boolean {
  return INCONCLUSIVE_REASONS.includes(reason);
}

export function createdWritePendingCopy(reason: CreatedWriteVerifyReason): {
  kicker: string;
  title: string;
  body: string;
} {
  const title = VERIFICATION_PENDING_TITLE;
  const kicker = "On-chain check";
  if (reason === "wrong_contract") {
    return {
      kicker,
      title,
      body: "This transaction is addressed to a different contract than the stored AgentPay product. The form stays locked. Retry verification, or unlock only if you accept the duplicate-submission risk.",
    };
  }
  if (reason === "wrong_sender") {
    return {
      kicker,
      title,
      body: "This transaction sender does not match the stored wallet. The form stays locked. Retry verification, or unlock only if you accept the duplicate-submission risk.",
    };
  }
  if (reason === "wrong_id") {
    return {
      kicker,
      title,
      body: "This transaction’s created id does not match the stored record. The form stays locked. Retry verification, or unlock only if you accept the duplicate-submission risk.",
    };
  }
  if (reason === "not_finalized") {
    return {
      kicker,
      title,
      body: "Studio Next has not finalized this transaction yet. The form stays locked and will not mint a new ID. Retry verification.",
    };
  }
  if (reason === "missing_record") {
    return {
      kicker,
      title,
      body: "The transaction is still being confirmed; the created record is not readable yet. The form stays locked and will not mint a new ID. Retry verification.",
    };
  }
  return {
    kicker,
    title,
    body: "A read-only Studio Next check could not confirm this create. The form stays locked and will not mint a new ID. Retry verification.",
  };
}

export function createdWriteAbandonCopy(): {
  title: string;
  description: string;
  confirmLabel: string;
  triggerLabel: string;
} {
  return {
    title: "Unlock this form?",
    description:
      "Verification has not confirmed the created record. Unlocking lets this form mint a new ID. If the original create already landed, that second write can duplicate or fail while you still pay fees.",
    confirmLabel: "Unlock and risk a duplicate write",
    triggerLabel: "Unlock form anyway",
  };
}

export function matchesCreatedWriteScope(
  record: Pick<CreatedWrite, "wallet" | "chainId" | "contractAddress">,
  scope: CreatedWriteScope,
): boolean {
  return (
    record.chainId === scope.chainId &&
    record.wallet.toLowerCase() === scope.wallet.toLowerCase() &&
    record.contractAddress.toLowerCase() === scope.contractAddress.toLowerCase()
  );
}

export function sessionOwnsCreatedWrite(
  record: CreatedWrite | null | undefined,
  scope: CreatedWriteScope | null | undefined,
  kind?: CreatedRecordKind,
): record is CreatedWrite {
  if (!record || !scope) return false;
  if (kind && record.kind !== kind) return false;
  return matchesCreatedWriteScope(record, scope);
}

export function isPersistableCreatedWrite(record: CreatedWrite): boolean {
  return (
    Boolean(record.id) &&
    Boolean(record.txHash) &&
    record.chainId === STUDIO_NEXT.chainId &&
    isHexAddress(record.wallet) &&
    isHexAddress(record.contractAddress)
  );
}

export function createdWriteEntryKey(
  record: Pick<CreatedWrite, "chainId" | "contractAddress" | "wallet" | "kind">,
): string {
  return [
    record.chainId,
    record.contractAddress.toLowerCase(),
    record.wallet.toLowerCase(),
    record.kind,
  ].join(":");
}

export function createdWriteIdentityMatch(
  stored: CreatedWrite,
  target: Pick<CreatedWrite, "id" | "txHash" | "kind" | "wallet" | "chainId" | "contractAddress">,
): boolean {
  if (stored.kind !== target.kind) return false;
  if (!matchesCreatedWriteScope(stored, target)) return false;
  const sameId = stored.id === target.id;
  const sameTx = Boolean(stored.txHash) && stored.txHash === target.txHash;
  return sameId || sameTx;
}

export function persistCreatedWrite(record: CreatedWrite): boolean {
  try {
    if (!isPersistableCreatedWrite(record)) return false;
    const store = readStore();
    const next = normalizeCreatedWrite(record);
    store.entries[createdWriteEntryKey(next)] = next;
    return writeStore(store);
  } catch {
    return false;
  }
}

export function loadCreatedWrite(
  kind: CreatedRecordKind,
  scope?: CreatedWriteScope | null,
): CreatedWrite | null {
  try {
    if (!scope) return null;
    const stored = readStore().entries[createdWriteEntryKey({ ...scope, kind })];
    return stored ? normalizeCreatedWrite(stored) : null;
  } catch {
    return null;
  }
}

export function listCreatedWrites(): CreatedWrite[] {
  try {
    return Object.values(readStore().entries).map(normalizeCreatedWrite);
  } catch {
    return [];
  }
}

export function archiveCreatedWrite(target: CreatedWrite): void {
  try {
    const store = readStore();
    const key = createdWriteEntryKey(target);
    const entry = store.entries[key];
    if (!entry || !createdWriteIdentityMatch(entry, target)) return;
    delete store.entries[key];
    writeStore(store);
    const archive = readArchive();
    archive.unshift({ ...normalizeCreatedWrite(entry), archivedAt: Date.now() });
    safeSet(CREATED_WRITE_ARCHIVE_KEY, JSON.stringify(archive.slice(0, 20)));
  } catch {
    /* ignore */
  }
}

export function clearCreatedWriteStorage(): void {
  try {
    safeRemove(CREATED_WRITE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function verifyCreatedWrite(
  record: CreatedWrite,
  deps: {
    readLifecycle?: typeof readTransactionLifecycle;
    readRecord?: (kind: CreatedRecordKind, id: string, contract: string) => Promise<Record<string, unknown> | null>;
  } = {},
): Promise<CreatedWriteVerifyResult> {
  if (!record.txHash) return { ok: false, reason: "missing_tx" };
  const readLifecycle = deps.readLifecycle ?? readTransactionLifecycle;
  const readRecord = deps.readRecord ?? defaultReadRecord;
  const expectedContract = record.contractAddress.toLowerCase();
  const expectedWallet = record.wallet.toLowerCase();
  try {
    const life = await readLifecycle(record.txHash);
    if (!life.finalized) return { ok: false, reason: "not_finalized" };
    if (!life.executionOk) return { ok: false, reason: "failed_execution" };
    if (!life.contractAddress) return { ok: false, reason: "read_error" };
    if (life.contractAddress.toLowerCase() !== expectedContract) {
      return { ok: false, reason: "wrong_contract" };
    }
    if (life.sender && life.sender.toLowerCase() !== expectedWallet) {
      return { ok: false, reason: "wrong_sender" };
    }
    const createdIds = life.createdIds ?? [];
    if (createdIds.length > 0 && !createdIds.includes(record.id)) {
      return { ok: false, reason: "wrong_id" };
    }
  } catch {
    return { ok: false, reason: "read_error" };
  }
  try {
    const raw = await readRecord(record.kind, record.id, record.contractAddress);
    const onChainId = raw && typeof raw.id === "string" ? raw.id : "";
    if (!onChainId || onChainId !== record.id) return { ok: false, reason: "missing_record" };
  } catch {
    return { ok: false, reason: "read_error" };
  }
  return { ok: true };
}

async function defaultReadRecord(
  kind: CreatedRecordKind,
  id: string,
  contract: string,
): Promise<Record<string, unknown> | null> {
  const method = kind === "mandate" ? "get_mandate" : kind === "invoice" ? "get_invoice" : "get_request";
  const raw = await readView<Record<string, unknown>>(method, [id], contract);
  return raw ?? null;
}

function isHexAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isCreatedRecordKind(value: unknown): value is CreatedRecordKind {
  return value === "mandate" || value === "invoice" || value === "decision";
}

function normalizeCreatedWrite(record: CreatedWrite): CreatedWrite {
  return {
    kind: record.kind,
    id: record.id,
    href: record.href || createdRecordHref(record.kind, record.id),
    txHash: record.txHash,
    wallet: record.wallet.toLowerCase(),
    chainId: record.chainId,
    contractAddress: record.contractAddress.toLowerCase(),
  };
}

function parseStoredCreatedWrite(value: unknown): CreatedWrite | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isCreatedRecordKind(raw.kind)) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  const txHash = typeof raw.txHash === "string" && raw.txHash ? raw.txHash : null;
  const wallet = typeof raw.wallet === "string" ? raw.wallet : "";
  const chainId = parseCreatedWriteChainId(raw.chainId as string | number | null);
  const contractAddress = typeof raw.contractAddress === "string" ? raw.contractAddress : "";
  if (!txHash || chainId === null || !isHexAddress(wallet) || !isHexAddress(contractAddress)) return null;
  return {
    kind: raw.kind,
    id: raw.id,
    href: typeof raw.href === "string" && raw.href ? raw.href : createdRecordHref(raw.kind, raw.id),
    txHash,
    wallet,
    chainId,
    contractAddress,
  };
}

function emptyStore(): CreatedWriteStoreV2 {
  return { version: 2, entries: {} };
}

function migrateCreatedWriteStore(parsed: unknown): CreatedWriteStoreV2 {
  if (!parsed || typeof parsed !== "object") return emptyStore();
  const raw = parsed as Record<string, unknown>;
  const entries: Record<string, CreatedWrite> = {};
  const ingest = (value: unknown) => {
    const entry = parseStoredCreatedWrite(value);
    if (!entry) return;
    const next = normalizeCreatedWrite(entry);
    entries[createdWriteEntryKey(next)] = next;
  };
  if (raw.version === 2 && raw.entries && typeof raw.entries === "object" && !Array.isArray(raw.entries)) {
    for (const value of Object.values(raw.entries as Record<string, unknown>)) ingest(value);
    return { version: 2, entries };
  }
  for (const kind of ["mandate", "invoice", "decision"] as const) ingest(raw[kind]);
  return { version: 2, entries };
}

function readStore(): CreatedWriteStoreV2 {
  const raw = safeGet(CREATED_WRITE_STORAGE_KEY);
  if (!raw) return emptyStore();
  try {
    return migrateCreatedWriteStore(JSON.parse(raw) as unknown);
  } catch {
    return emptyStore();
  }
}

function writeStore(store: CreatedWriteStoreV2): boolean {
  return safeSet(CREATED_WRITE_STORAGE_KEY, JSON.stringify(store));
}

function readArchive(): Array<CreatedWrite & { archivedAt: number }> {
  const raw = safeGet(CREATED_WRITE_ARCHIVE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
