import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDeliveryLive,
  listPayouts,
  loadPayouts,
  loadScopedPayouts,
  phaseFromRecord,
  savePayouts,
  upsertPayout,
  type PayoutRecord,
} from "../lib/contract/delivery";
import { PAYOUT_POLL, matchesOutboundTransfer, resumePayouts } from "../lib/contract/payout";

const PRODUCT = "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F";
const RECIPIENT = "0x1234567890123456789012345678901234567890";
const OTHER_RECIPIENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

const mocks = vi.hoisted(() => ({
  readNativeBalance: vi.fn(),
  readTransactionLifecycle: vi.fn(),
}));

vi.mock("../lib/contract/readClient", () => ({
  readNativeBalance: mocks.readNativeBalance,
  readTransactionLifecycle: mocks.readTransactionLifecycle,
}));

vi.mock("../lib/contract/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contract/config")>();
  return {
    ...actual,
    getConfiguredContractAddress: () => PRODUCT,
  };
});

function scoped(partial: Partial<PayoutRecord> = {}): PayoutRecord {
  return {
    id: "scoped",
    chainId: 61997,
    contractAddress: PRODUCT,
    txHash: "0xabc",
    recipient: RECIPIENT,
    kind: "withdraw",
    mandateId: "m-1",
    amountWei: "1000",
    contractBefore: "5000",
    recipientBefore: "10",
    finalized: true,
    executionOk: true,
    settled: false,
    deliveryChecked: false,
    deliveryVerified: false,
    contractDrop: null,
    recipientGain: null,
    updatedAt: 1,
    ...partial,
  };
}

describe("payout refresh recovery", () => {
  afterEach(() => {
    savePayouts([]);
    clearDeliveryLive();
    mocks.readNativeBalance.mockReset();
    mocks.readTransactionLifecycle.mockReset();
    PAYOUT_POLL.attempts = 20;
    PAYOUT_POLL.delayMs = 2000;
  });

  beforeEach(() => {
    PAYOUT_POLL.attempts = 3;
    PAYOUT_POLL.delayMs = 0;
  });

  function matchingLife() {
    return {
      finalized: true,
      executionOk: true,
      statusName: "FINALIZED",
      executionName: "FINISHED_WITH_RETURN",
      contractAddress: PRODUCT.toLowerCase(),
      transfers: [
        {
          from: PRODUCT.toLowerCase(),
          to: RECIPIENT.toLowerCase(),
          value: 1000n,
          isEthSend: true,
        },
      ],
    };
  }

  it("restores local records and confirms delivery from transfer evidence plus native balances", async () => {
    mocks.readTransactionLifecycle.mockResolvedValue(matchingLife());
    mocks.readNativeBalance.mockImplementation(async (address: string) => {
      if (address.toLowerCase() === RECIPIENT.toLowerCase()) return 910n;
      return 4000n;
    });
    const record = scoped();
    upsertPayout(record);
    expect(loadPayouts()[0]?.settled).toBe(false);
    expect(phaseFromRecord(0n, loadPayouts()[0]!)).toBe("tx_finalized");
    const updated = await resumePayouts(record.recipient);
    expect(updated[0]?.settled).toBe(true);
    expect(updated[0]?.deliveryVerified).toBe(true);
    expect(updated[0]?.contractDrop).toBe("1000");
    expect(updated[0]?.recipientGain).toBe("900");
    expect(phaseFromRecord(0n, updated[0]!)).toBe("native_delivered");
    expect(loadPayouts()[0]?.settled).toBe(true);
  });

  it("does not confirm a specific payout from aggregate balances without a matching outbound transfer", async () => {
    mocks.readTransactionLifecycle.mockResolvedValue({
      finalized: true,
      executionOk: true,
      statusName: "FINALIZED",
      executionName: "FINISHED_WITH_RETURN",
      contractAddress: PRODUCT.toLowerCase(),
      transfers: [],
    });
    mocks.readNativeBalance.mockImplementation(async (address: string) => {
      if (address.toLowerCase() === RECIPIENT.toLowerCase()) return 910n;
      return 4000n;
    });
    upsertPayout(scoped());
    const updated = await resumePayouts(RECIPIENT);
    expect(updated[0]?.contractDrop).toBe("1000");
    expect(updated[0]?.recipientGain).toBe("900");
    expect(updated[0]?.settled).toBe(false);
    expect(updated[0]?.deliveryVerified).toBe(false);
    expect(updated[0]?.deliveryChecked).toBe(true);
    expect(phaseFromRecord(0n, updated[0]!)).toBe("unresolved");
  });

  it("matches an outbound eth send to the expected contract, recipient, and amount", () => {
    expect(
      matchesOutboundTransfer(matchingLife(), {
        contract: PRODUCT,
        recipient: RECIPIENT,
        amountWei: 1000n,
      }),
    ).toBe(true);
    expect(
      matchesOutboundTransfer(matchingLife(), {
        contract: PRODUCT,
        recipient: OTHER_RECIPIENT,
        amountWei: 1000n,
      }),
    ).toBe(false);
  });

  it("ignores stale and cross-contract payout records", () => {
    upsertPayout(
      scoped({
        id: "current",
        txHash: "0xcurrent",
      }),
    );
    upsertPayout(
      scoped({
        id: "other-chain",
        chainId: 61999,
        txHash: "0xstale-chain",
        settled: true,
        deliveryVerified: true,
      }),
    );
    upsertPayout(
      scoped({
        id: "other-contract",
        contractAddress: "0x1111111111111111111111111111111111111111",
        txHash: "0xstale-contract",
        settled: true,
        deliveryVerified: true,
      }),
    );
    upsertPayout(
      scoped({
        id: "other-recipient",
        recipient: OTHER_RECIPIENT,
        txHash: "0xstale-recipient",
      }),
    );
    const scopedForRecipient = loadScopedPayouts(RECIPIENT);
    expect(scopedForRecipient).toHaveLength(1);
    expect(scopedForRecipient[0]?.id).toBe("current");
    expect(loadScopedPayouts().map((item) => item.id).sort()).toEqual(["current", "other-recipient"]);
  });

  it("lists every scoped withdrawal for one mandate instead of keeping only the latest", () => {
    upsertPayout(scoped({ id: "first", txHash: "0xaaa", updatedAt: 1, amountWei: "500" }));
    upsertPayout(scoped({ id: "second", txHash: "0xbbb", updatedAt: 2, amountWei: "500" }));
    expect(listPayouts("m-1", "withdraw", RECIPIENT).map((item) => item.id).sort()).toEqual(["first", "second"]);
  });

  it("resumes a submitted hash before finalization without confirming delivery", async () => {
    mocks.readTransactionLifecycle.mockResolvedValue({
      finalized: false,
      executionOk: false,
      statusName: "PENDING",
      executionName: "PENDING",
    });
    mocks.readNativeBalance.mockImplementation(async () => {
      throw new Error("balances must not be read before finalization");
    });
    const record = scoped({
      id: "pending",
      finalized: false,
      executionOk: false,
      settled: true,
      deliveryChecked: true,
      deliveryVerified: true,
    });
    upsertPayout(record);
    const updated = await resumePayouts(RECIPIENT);
    expect(mocks.readNativeBalance).not.toHaveBeenCalled();
    expect(updated[0]?.finalized).toBe(false);
    expect(updated[0]?.settled).toBe(false);
    expect(updated[0]?.deliveryVerified).toBe(false);
    expect(updated[0]?.deliveryChecked).toBe(false);
    expect(phaseFromRecord(0n, updated[0]!)).toBe("tx_submitted");
  });
});
