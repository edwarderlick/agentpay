import { GENLAYER_CHAIN } from "../genlayer/client";
import { getConfiguredContractAddress } from "./config";

export type DeliveryPhase =
  | "none"
  | "credit_approved"
  | "tx_submitted"
  | "tx_finalized"
  | "native_delivered"
  | "unresolved";

export type PayoutKind = "withdraw" | "refund";

export type PayoutRecord = {
  id: string;
  chainId: number;
  contractAddress: string;
  txHash: string | null;
  recipient: string;
  kind: PayoutKind;
  mandateId: string;
  amountWei: string;
  contractBefore: string;
  recipientBefore: string;
  finalized: boolean;
  executionOk: boolean;
  settled: boolean;
  deliveryChecked: boolean;
  deliveryVerified: boolean;
  contractDrop: string | null;
  recipientGain: string | null;
  updatedAt: number;
};

const STORAGE_KEY = "agentpay.payouts.v2";
const liveDeliveryIds = new Set<string>();

export function markDeliveryLive(id: string): void {
  liveDeliveryIds.add(id);
}

export function clearDeliveryLive(id?: string): void {
  if (id) liveDeliveryIds.delete(id);
  else liveDeliveryIds.clear();
}

export function isDeliveryLive(id: string): boolean {
  return liveDeliveryIds.has(id);
}

export function payoutScope(): { chainId: number; contractAddress: string } {
  return {
    chainId: GENLAYER_CHAIN.id,
    contractAddress: getConfiguredContractAddress().toLowerCase(),
  };
}

export function isCurrentPayoutScope(record: PayoutRecord): boolean {
  const scope = payoutScope();
  return (
    record.chainId === scope.chainId &&
    record.contractAddress.toLowerCase() === scope.contractAddress &&
    Boolean(scope.contractAddress)
  );
}

export function payoutIdentity(record: Pick<PayoutRecord, "chainId" | "contractAddress" | "txHash" | "recipient" | "kind" | "mandateId">): string {
  return [
    record.chainId,
    record.contractAddress.toLowerCase(),
    record.txHash?.toLowerCase() || "draft",
    record.recipient.toLowerCase(),
    record.kind,
    record.mandateId,
  ].join(":");
}

export function deliveryLabel(phase: DeliveryPhase): string {
  switch (phase) {
    case "credit_approved":
      return "Approved credit";
    case "tx_submitted":
      return "Withdrawal submitted";
    case "tx_finalized":
      return "Transaction finalized";
    case "native_delivered":
      return "Native delivery confirmed";
    case "unresolved":
      return "Delivery unresolved";
    default:
      return "No payout";
  }
}

export function phaseFromRecord(
  creditWei: bigint,
  record: PayoutRecord | null,
): DeliveryPhase {
  if (record?.deliveryVerified && record.settled && isDeliveryLive(record.id)) return "native_delivered";
  if (record?.deliveryChecked && record.finalized && !record.deliveryVerified) return "unresolved";
  if (record?.finalized) return "tx_finalized";
  if (record?.txHash && !record.finalized) return "tx_submitted";
  if (creditWei > 0n) return "credit_approved";
  return "none";
}

export function isNativeDelivered(expected: bigint, contractDrop: bigint, recipientGain: bigint): boolean {
  return contractDrop === expected && recipientGain > 0n && recipientGain <= expected;
}

export function loadPayouts(): PayoutRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PayoutRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadScopedPayouts(recipient?: string): PayoutRecord[] {
  return loadPayouts().filter((item) => {
    if (!isCurrentPayoutScope(item)) return false;
    if (recipient && item.recipient.toLowerCase() !== recipient.toLowerCase()) return false;
    return true;
  });
}

export function savePayouts(records: PayoutRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function upsertPayout(record: PayoutRecord, previousId?: string): PayoutRecord[] {
  const next = loadPayouts().filter(
    (item) => item.id !== record.id && item.id !== previousId,
  );
  next.unshift(record);
  savePayouts(next.slice(0, 50));
  return next;
}

export function listPayouts(mandateId: string, kind?: PayoutKind, recipient?: string): PayoutRecord[] {
  return loadScopedPayouts(recipient)
    .filter((item) => item.mandateId === mandateId && (!kind || item.kind === kind))
    .sort((a, b) => {
      if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
      return (a.txHash || a.id).localeCompare(b.txHash || b.id);
    });
}

export function findPayout(mandateId: string, kind: PayoutKind, recipient?: string): PayoutRecord | null {
  return listPayouts(mandateId, kind, recipient)[0] ?? null;
}
