import { afterEach, describe, expect, it } from "vitest";
import { mapMandateStatus, mapOutcome } from "../lib/contract/map";
import {
  clearDeliveryLive,
  isNativeDelivered,
  markDeliveryLive,
  phaseFromRecord,
  type PayoutRecord,
} from "../lib/contract/delivery";

function record(partial: Partial<PayoutRecord>): PayoutRecord {
  return {
    id: "p1",
    chainId: 61997,
    contractAddress: "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F",
    kind: "withdraw",
    mandateId: "m-1",
    recipient: "0xabc",
    amountWei: "1000",
    txHash: null,
    contractBefore: "1000",
    recipientBefore: "0",
    finalized: false,
    executionOk: false,
    settled: false,
    deliveryChecked: false,
    deliveryVerified: false,
    contractDrop: null,
    recipientGain: null,
    updatedAt: 1,
    ...partial,
  };
}

describe("contract outcome mapping", () => {
  it("maps APPROVED DENIED UNCLEAR to UI states", () => {
    expect(mapOutcome("APPROVED")).toBe("approved");
    expect(mapOutcome("DENIED")).toBe("denied");
    expect(mapOutcome("UNCLEAR")).toBe("unresolved");
    expect(mapOutcome("unknown")).toBe("unresolved");
    expect(mapOutcome(null)).toBe("unresolved");
  });

  it("maps mandate status and closed flag", () => {
    expect(mapMandateStatus("active", false)).toBe("active");
    expect(mapMandateStatus("expired", false)).toBe("expired");
    expect(mapMandateStatus("active", true)).toBe("closed");
  });
});

describe("native delivery gate", () => {
  afterEach(() => {
    clearDeliveryLive();
  });

  it("requires contract drop and recipient gain", () => {
    expect(isNativeDelivered(1000n, 1000n, 900n)).toBe(true);
    expect(isNativeDelivered(1000n, 1000n, 0n)).toBe(false);
    expect(isNativeDelivered(1000n, 0n, 900n)).toBe(false);
    expect(isNativeDelivered(1000n, 1000n, 1001n)).toBe(false);
  });

  it("does not treat finalized parent or zero credit as paid", () => {
    expect(phaseFromRecord(0n, record({ finalized: true, executionOk: true, settled: false }))).toBe(
      "tx_finalized",
    );
    expect(
      phaseFromRecord(
        45n,
        record({ finalized: true, executionOk: true, deliveryChecked: true, deliveryVerified: false }),
      ),
    ).toBe("unresolved");
    expect(phaseFromRecord(45n, null)).toBe("credit_approved");
    expect(phaseFromRecord(10n, record({ txHash: "0x1", finalized: false }))).toBe("tx_submitted");
  });

  it("does not display confirmed from a cached settled record until a live recheck", () => {
    const cached = record({
      settled: true,
      deliveryVerified: true,
      deliveryChecked: true,
      finalized: true,
      executionOk: true,
    });
    expect(phaseFromRecord(0n, cached)).toBe("tx_finalized");
    markDeliveryLive(cached.id);
    expect(phaseFromRecord(0n, cached)).toBe("native_delivered");
    clearDeliveryLive(cached.id);
    expect(phaseFromRecord(0n, cached)).toBe("tx_finalized");
  });
});
