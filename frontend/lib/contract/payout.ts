import { getConfiguredContractAddress } from "./config";
import {
  clearDeliveryLive,
  findPayout,
  isNativeDelivered,
  loadScopedPayouts,
  markDeliveryLive,
  payoutIdentity,
  payoutScope,
  phaseFromRecord,
  type DeliveryPhase,
  type PayoutKind,
  type PayoutRecord,
  upsertPayout,
} from "./delivery";
import {
  readNativeBalance,
  readTransactionLifecycle,
  type TransactionLifecycle,
} from "./readClient";

export const PAYOUT_POLL = { attempts: 20, delayMs: 2000 };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function matchesOutboundTransfer(
  life: Pick<TransactionLifecycle, "contractAddress" | "transfers">,
  expected: { contract: string; recipient: string; amountWei: bigint },
): boolean {
  const contract = expected.contract.toLowerCase();
  const recipient = expected.recipient.toLowerCase();
  const txContract = life.contractAddress?.toLowerCase() ?? null;
  if (txContract && txContract !== contract) return false;
  return life.transfers.some((transfer) => {
    if (transfer.isEthSend === false) return false;
    if (!transfer.to || transfer.to !== recipient) return false;
    if (transfer.value !== expected.amountWei) return false;
    const fromContract = transfer.from === contract || txContract === contract;
    return fromContract;
  });
}

export function hasOutboundTransferEvidence(
  life: Pick<TransactionLifecycle, "transfers">,
): boolean {
  return life.transfers.some(
    (transfer) => Boolean(transfer.to) && transfer.value !== null && transfer.isEthSend !== false,
  );
}

export async function snapshotBalances(recipient: string): Promise<{
  contractBefore: bigint;
  recipientBefore: bigint;
}> {
  const contract = getConfiguredContractAddress();
  const [contractBefore, recipientBefore] = await Promise.all([
    readNativeBalance(contract),
    readNativeBalance(recipient),
  ]);
  return { contractBefore, recipientBefore };
}

export function startPayout(input: {
  kind: PayoutKind;
  mandateId: string;
  recipient: string;
  amountWei: bigint;
  contractBefore: bigint;
  recipientBefore: bigint;
}): PayoutRecord {
  const scope = payoutScope();
  const record: PayoutRecord = {
    id: payoutIdentity({
      chainId: scope.chainId,
      contractAddress: scope.contractAddress,
      txHash: null,
      recipient: input.recipient,
      kind: input.kind,
      mandateId: input.mandateId,
    }),
    chainId: scope.chainId,
    contractAddress: scope.contractAddress,
    txHash: null,
    recipient: input.recipient,
    kind: input.kind,
    mandateId: input.mandateId,
    amountWei: input.amountWei.toString(),
    contractBefore: input.contractBefore.toString(),
    recipientBefore: input.recipientBefore.toString(),
    finalized: false,
    executionOk: false,
    settled: false,
    deliveryChecked: false,
    deliveryVerified: false,
    contractDrop: null,
    recipientGain: null,
    updatedAt: Date.now(),
  };
  upsertPayout(record);
  return record;
}

export function markPayoutSubmitted(record: PayoutRecord, txHash: string | null): PayoutRecord {
  const next: PayoutRecord = {
    ...record,
    txHash,
    id: payoutIdentity({ ...record, txHash }),
    updatedAt: Date.now(),
  };
  upsertPayout(next, record.id);
  return next;
}

export async function confirmPayoutDelivery(
  record: PayoutRecord,
  opts: { finalized: boolean; executionOk: boolean },
): Promise<PayoutRecord> {
  let next: PayoutRecord = {
    ...record,
    finalized: opts.finalized,
    executionOk: opts.executionOk,
    deliveryChecked: false,
    deliveryVerified: false,
    settled: false,
    updatedAt: Date.now(),
  };
  upsertPayout(next);
  clearDeliveryLive(next.id);

  if (!opts.finalized || !opts.executionOk || !record.txHash) {
    if (opts.finalized) {
      next = { ...next, deliveryChecked: true, deliveryVerified: false, settled: false };
      upsertPayout(next);
    }
    return next;
  }

  const expected = BigInt(record.amountWei);
  const contract = record.contractAddress || getConfiguredContractAddress();
  const beforeContract = BigInt(record.contractBefore);
  const beforeRecipient = BigInt(record.recipientBefore);

  for (let i = 0; i < PAYOUT_POLL.attempts; i += 1) {
    const [contractNow, recipientNow, life] = await Promise.all([
      readNativeBalance(contract),
      readNativeBalance(record.recipient),
      readTransactionLifecycle(record.txHash),
    ]);
    const contractDrop = beforeContract > contractNow ? beforeContract - contractNow : 0n;
    const recipientGain = recipientNow > beforeRecipient ? recipientNow - beforeRecipient : 0n;
    const balancesOk = isNativeDelivered(expected, contractDrop, recipientGain);
    const transferOk = matchesOutboundTransfer(life, {
      contract,
      recipient: record.recipient,
      amountWei: expected,
    });
    const verified = Boolean(life.finalized && life.executionOk && transferOk && balancesOk);
    next = {
      ...next,
      finalized: life.finalized,
      executionOk: life.executionOk,
      contractDrop: contractDrop.toString(),
      recipientGain: recipientGain.toString(),
      deliveryChecked: true,
      deliveryVerified: verified,
      settled: verified,
      updatedAt: Date.now(),
    };
    upsertPayout(next);
    if (verified) {
      markDeliveryLive(next.id);
      return next;
    }
    if (hasOutboundTransferEvidence(life) && !transferOk) {
      return next;
    }
    await sleep(PAYOUT_POLL.delayMs);
  }
  return next;
}

export async function resumePayouts(recipient?: string): Promise<PayoutRecord[]> {
  const open = loadScopedPayouts(recipient).filter((item) => item.txHash);
  const updated: PayoutRecord[] = [];
  for (const record of open) {
    if (!record.txHash) continue;
    try {
      const life = await readTransactionLifecycle(record.txHash);
      const next = {
        ...record,
        finalized: life.finalized,
        executionOk: life.executionOk,
        updatedAt: Date.now(),
      };
      if (!life.finalized) {
        const submitted: PayoutRecord = {
          ...next,
          deliveryChecked: false,
          deliveryVerified: false,
          settled: false,
        };
        upsertPayout(submitted);
        clearDeliveryLive(submitted.id);
        updated.push(submitted);
        continue;
      }
      updated.push(
        await confirmPayoutDelivery(next, {
          finalized: life.finalized,
          executionOk: life.executionOk,
        }),
      );
    } catch {
      updated.push(record);
    }
  }
  return updated;
}

export function payoutPhase(
  creditWei: bigint,
  mandateId: string,
  kind: PayoutKind,
  recipient?: string,
): { phase: DeliveryPhase; record: PayoutRecord | null } {
  const record = findPayout(mandateId, kind, recipient);
  return { phase: phaseFromRecord(creditWei, record), record };
}

export function txHashFromStatus(status: {
  genlayerTxId?: string;
  evmTxHash?: string;
}): string | null {
  return status.genlayerTxId || status.evmTxHash || null;
}

export function executionOkFromStatus(status: {
  phase?: string;
  successful?: boolean;
  executionResultName?: string;
}): boolean {
  if (status.successful === true) return true;
  return status.executionResultName === "FINISHED_WITH_RETURN";
}
