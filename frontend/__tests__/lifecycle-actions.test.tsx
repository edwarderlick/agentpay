import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/contract/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contract/config")>();
  return {
    ...actual,
    getConfiguredContractAddress: () => "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F",
  };
});
import { MandateJourney } from "../components/shared/MandateJourney";
import { PayoutHistory } from "../components/shared/PayoutHistory";
import {
  buildMandateJourney,
  closedRefundCopy,
  evaluateWriteGate,
  gateFromFreshRead,
  nextActionForRole,
  onChainWithdrawnCopy,
  remainingCreditWei,
  recheckWithdrawReads,
  roleForMandate,
} from "../lib/contract/actions";
import {
  clearDeliveryLive,
  listPayouts,
  loadPayouts,
  markDeliveryLive,
  savePayouts,
  upsertPayout,
  type PayoutRecord,
} from "../lib/contract/delivery";
import { isWriteBusy, writeRecoveryText } from "../lib/contract/writeRecovery";
import type { Mandate } from "../lib/contract/types";

const PRODUCT = "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F";
const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AGENT = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const MERCHANT = "0xcccccccccccccccccccccccccccccccccccccccc";
const LIVE_ID = "m-a56f4429378650ae158a";
const WITHDRAW_1 = "0x063ea623194c0849c1ab8a89217458c84da37f5a05a2ef5636a032b1fb931736";
const CLOSE_TX = "0x57695d077086023b0493d98d13ef99b48f9a3ec01de5c9fb779b4d22ad99c550";
const WITHDRAW_2 = "0xacc2665cd10a94533dc8e2cd14b37674218b5dc4dc783efb705c082ccab93fbb";
const FIVE_FINNEY = "5000000000000000";
const TEN_FINNEY = "10000000000000000";
const TWENTY_FINNEY = "20000000000000000";

const liveClosed: Mandate = {
  id: LIVE_ID,
  title: "Live closed mandate",
  purpose: "Studio Next verified case",
  owner: OWNER,
  agent: AGENT,
  merchants: [MERCHANT],
  perPaymentCap: FIVE_FINNEY,
  totalBudget: TWENTY_FINNEY,
  remainingBudget: "0",
  expiry: "4102444800",
  status: "closed",
};

const liveCredit = {
  merchant: MERCHANT as `0x${string}`,
  mandateId: LIVE_ID,
  approvedCredit: TEN_FINNEY,
  withdrawn: TEN_FINNEY,
};

const readyWallet = {
  address: OWNER,
  chainOk: true,
  canWrite: true,
  chainId: 61997,
};

function payout(partial: Partial<PayoutRecord>): PayoutRecord {
  return {
    id: "p",
    chainId: 61997,
    contractAddress: PRODUCT,
    txHash: null,
    recipient: MERCHANT,
    kind: "withdraw",
    mandateId: LIVE_ID,
    amountWei: FIVE_FINNEY,
    contractBefore: "0",
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

afterEach(() => {
  cleanup();
  savePayouts([]);
  clearDeliveryLive();
});

beforeEach(() => {
  savePayouts([]);
  clearDeliveryLive();
});

describe("live closed mandate and zero credit", () => {
  it("treats the live Studio Next case as closed with zero remaining credit", () => {
    expect(liveClosed.status).toBe("closed");
    expect(liveClosed.remainingBudget).toBe("0");
    expect(remainingCreditWei(liveCredit)).toBe(0n);
    expect(onChainWithdrawnCopy(liveCredit.withdrawn)).toMatch(/0\.01 test GEN withdrawn on chain/);

    const close = evaluateWriteGate({
      action: "close",
      mandate: liveClosed,
      wallet: readyWallet,
    });
    expect(close.allowed).toBe(false);
    expect(close.buttonLabel).toBe("Mandate closed");
    expect(close.reason).toMatch(/already closed on chain/i);

    const invoice = evaluateWriteGate({
      action: "invoice",
      mandate: liveClosed,
      wallet: { ...readyWallet, address: MERCHANT },
    });
    expect(invoice.allowed).toBe(false);
    expect(invoice.reason).toMatch(/closed on chain/i);

    const request = evaluateWriteGate({
      action: "request",
      mandate: liveClosed,
      wallet: { ...readyWallet, address: AGENT },
    });
    expect(request.allowed).toBe(false);
    expect(request.reason).toMatch(/closed on chain/i);

    const withdraw = evaluateWriteGate({
      action: "withdraw",
      mandate: liveClosed,
      wallet: { ...readyWallet, address: MERCHANT },
      remainingCreditWei: remainingCreditWei(liveCredit),
    });
    expect(withdraw.allowed).toBe(false);
    expect(withdraw.buttonLabel).toBe("Fully withdrawn");
    expect(withdraw.reason).toMatch(/zero/i);
  });

  it("does not invent a payout hash or native delivery from empty localStorage", () => {
    expect(loadPayouts()).toEqual([]);
    expect(listPayouts(LIVE_ID, "withdraw")).toEqual([]);
    const copy = closedRefundCopy({ remainingBudget: "0", refund: null });
    expect(copy.verified).toBe(false);
    expect(copy.headline).toBe("Mandate closed");
    expect(copy.body).toMatch(/no locally observed refund hash/i);
    expect(copy.body).not.toMatch(CLOSE_TX);
    expect(onChainWithdrawnCopy(TEN_FINNEY)).toMatch(/0\.01/);
    expect(onChainWithdrawnCopy(TEN_FINNEY)).not.toMatch(/0x/);
  });

  it("shows Closed refund copy only after locally verified native delivery", () => {
    const refund = payout({
      id: "refund-live",
      kind: "refund",
      recipient: OWNER,
      txHash: CLOSE_TX,
      amountWei: TEN_FINNEY,
      finalized: true,
      executionOk: true,
      settled: true,
      deliveryChecked: true,
      deliveryVerified: true,
    });
    markDeliveryLive(refund.id);
    const verified = closedRefundCopy({ remainingBudget: "0", refund });
    expect(verified.verified).toBe(true);
    expect(verified.headline).toMatch(/Closed — 0\.01 test GEN refunded to owner/);

    clearDeliveryLive();
    const unverified = closedRefundCopy({
      remainingBudget: "0",
      refund: { ...refund, deliveryVerified: false, settled: false },
    });
    expect(unverified.verified).toBe(false);
    expect(unverified.headline).toMatch(/unresolved/i);
  });
});

describe("withdraw recheck does not fabricate mandate state", () => {
  const creditOk = {
    ok: true as const,
    data: liveCredit,
  };

  it("blocks the write dialog when the fresh mandate read fails", () => {
    const result = recheckWithdrawReads({
      mandate: { ok: false, reason: "unavailable", message: "Studio Next busy" },
      credit: creditOk,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toMatch(/Mandate recheck failed/i);
    expect(result.reason).toMatch(/Retry the on-chain read/i);
    expect(result.reason).not.toMatch(/active/i);
  });

  it("blocks the write dialog when the fresh credit read fails", () => {
    const result = recheckWithdrawReads({
      mandate: { ok: true, data: liveClosed },
      credit: { ok: false, reason: "unavailable", message: "credit view failed" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toMatch(/Merchant credit recheck failed/i);
    expect(result.reason).toMatch(/Retry the on-chain read/i);
  });

  it("does not fabricate an active mandate when the mandate is missing", () => {
    const result = recheckWithdrawReads({
      mandate: { ok: true, data: null },
      credit: creditOk,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toMatch(/not found on chain/i);
    expect(result.reason).not.toMatch(/\bactive\b/i);
  });
});

describe("stale cache cannot open an invalid write", () => {
  it("blocks a second close when the cached mandate is still active but the fresh read is closed", () => {
    const cached = { ...liveClosed, status: "active" as const, remainingBudget: TEN_FINNEY };
    const gated = gateFromFreshRead({
      action: "close",
      cached,
      fresh: liveClosed,
      wallet: readyWallet,
    });
    expect(gated.allowed).toBe(false);
    expect(gated.reason).toMatch(/already closed/i);
  });

  it("blocks invoice and request when the fresh read is expired", () => {
    const cached = { ...liveClosed, status: "active" as const };
    const fresh = { ...liveClosed, status: "expired" as const };
    expect(
      gateFromFreshRead({
        action: "invoice",
        cached,
        fresh,
        wallet: { ...readyWallet, address: MERCHANT },
      }).allowed,
    ).toBe(false);
    expect(
      gateFromFreshRead({
        action: "request",
        cached,
        fresh,
        wallet: { ...readyWallet, address: AGENT },
      }).reason,
    ).toMatch(/expired on chain/i);
  });

  it("blocks withdraw when the fresh remaining credit is zero even if the cache still shows credit", () => {
    const cached = { ...liveClosed, status: "active" as const };
    const gated = gateFromFreshRead({
      action: "withdraw",
      cached,
      fresh: liveClosed,
      wallet: { ...readyWallet, address: MERCHANT },
      remainingCreditWei: 5_000_000_000_000_000n,
      freshRemainingCreditWei: 0n,
    });
    expect(gated.allowed).toBe(false);
    expect(gated.buttonLabel).toBe("Fully withdrawn");
  });
});

describe("duplicate close and in-flight writes", () => {
  it("does not allow a second close while a close is awaiting signature or finalizing", () => {
    const active = { ...liveClosed, status: "active" as const, remainingBudget: TEN_FINNEY };
    const gated = evaluateWriteGate({
      action: "close",
      mandate: active,
      wallet: readyWallet,
      writeBusy: true,
    });
    expect(gated.allowed).toBe(false);
    expect(gated.reason).toMatch(/awaiting signature|finalizing|submitted/i);
    expect(isWriteBusy("awaiting_signature")).toBe(true);
    expect(isWriteBusy("submitted")).toBe(true);
    expect(isWriteBusy("decided")).toBe(true);
    expect(isWriteBusy("finalizing")).toBe(true);
    expect(isWriteBusy("success")).toBe(false);
  });
});

describe("role and chain gating", () => {
  it("requires the owner wallet on chain 61997 to close", () => {
    const active = { ...liveClosed, status: "active" as const, remainingBudget: TEN_FINNEY };
    expect(
      evaluateWriteGate({
        action: "close",
        mandate: active,
        wallet: { ...readyWallet, address: MERCHANT },
      }).reason,
    ).toMatch(/owner/i);
    expect(
      evaluateWriteGate({
        action: "close",
        mandate: active,
        wallet: { ...readyWallet, chainOk: false },
      }).reason,
    ).toMatch(/61997/);
    expect(
      evaluateWriteGate({
        action: "invoice",
        mandate: { ...liveClosed, status: "active" },
        wallet: { ...readyWallet, address: AGENT },
      }).reason,
    ).toMatch(/merchant/i);
    expect(roleForMandate(liveClosed, OWNER)).toBe("owner");
    expect(roleForMandate(liveClosed, AGENT)).toBe("agent");
    expect(roleForMandate(liveClosed, MERCHANT)).toBe("merchant");
  });
});

describe("multiple partial withdrawals stay distinct", () => {
  it("keeps both live withdrawal hashes after a later record is stored", () => {
    upsertPayout(
      payout({
        id: "w1",
        txHash: WITHDRAW_1,
        amountWei: FIVE_FINNEY,
        updatedAt: 1,
        finalized: true,
        executionOk: true,
      }),
    );
    upsertPayout(
      payout({
        id: "w2",
        txHash: WITHDRAW_2,
        amountWei: FIVE_FINNEY,
        updatedAt: 2,
        finalized: true,
        executionOk: true,
      }),
    );
    const listed = listPayouts(LIVE_ID, "withdraw");
    expect(listed).toHaveLength(2);
    expect(listed.map((item) => item.txHash).sort()).toEqual([WITHDRAW_1, WITHDRAW_2].sort());
    render(<PayoutHistory kind="withdraw" records={listed} onChainWithdrawnWei={TEN_FINNEY} />);
    expect(screen.getByText(/0\.01 test GEN withdrawn on chain/)).toBeInTheDocument();
    expect(screen.getByText(/0x063e/i)).toBeInTheDocument();
    expect(screen.getByText(/0xacc2/i)).toBeInTheDocument();
  });
});

describe("write recovery copy", () => {
  it("explains wallet rejection, fee estimation failure, and failed execution", () => {
    expect(writeRecoveryText({ flight: "rejected" })).toMatch(/rejected this signature/i);
    expect(writeRecoveryText({ flight: "estimate_failed" })).toMatch(/Fee estimation failed/i);
    expect(
      writeRecoveryText({
        flight: "idle",
        errorMessage: "sim_estimateTransactionFees failed (code=-32000): execution failed",
      }),
    ).toMatch(/would revert/i);
    expect(writeRecoveryText({ flight: "execution_failed" })).toMatch(/execution error/i);
    expect(writeRecoveryText({ flight: "submitted" })).toMatch(/still in flight/i);
  });
});

describe("finalized but unverified delivery is not paid", () => {
  it("keeps the live close hash unresolved without native delivery confirmation", () => {
    const refund = payout({
      id: "refund-unverified",
      kind: "refund",
      recipient: OWNER,
      txHash: CLOSE_TX,
      amountWei: TEN_FINNEY,
      finalized: true,
      executionOk: true,
      deliveryChecked: true,
      deliveryVerified: false,
      settled: false,
    });
    const copy = closedRefundCopy({ remainingBudget: "0", refund });
    expect(copy.verified).toBe(false);
    expect(copy.headline).not.toMatch(/refunded to owner/i);
    const steps = buildMandateJourney({
      mandate: liveClosed,
      invoices: [{ id: "inv-1" }],
      decisions: [{ id: "req-1", outcome: "approved" }],
      credit: liveCredit,
      withdrawals: [],
      refund,
    });
    const delivery = steps.find((step) => step.id === "native-delivery");
    expect(delivery?.state).toBe("waiting");
    expect(delivery?.source).toBe("local-evidence");
    const withdrawn = steps.find((step) => step.id === "withdrawn-on-chain");
    expect(withdrawn?.state).toBe("done");
    expect(withdrawn?.source).toBe("on-chain");
    expect(withdrawn?.detail).toMatch(/0\.01 test GEN withdrawn on chain/);
  });
});

describe("next action and journey for the connected role", () => {
  it("tells the owner the live mandate is closed and the merchant that credit is fully withdrawn", () => {
    expect(
      nextActionForRole({
        mandate: liveClosed,
        role: "owner",
        remainingCreditWei: 0n,
        wallet: readyWallet,
      }).label,
    ).toBe("Mandate closed");
    expect(
      nextActionForRole({
        mandate: liveClosed,
        role: "merchant",
        remainingCreditWei: 0n,
        wallet: { ...readyWallet, address: MERCHANT },
      }).label,
    ).toBe("Fully withdrawn");
    expect(
      nextActionForRole({
        mandate: liveClosed,
        role: "merchant",
        remainingCreditWei: 5_000_000_000_000_000n,
        wallet: { ...readyWallet, address: MERCHANT },
      }).action,
    ).toBe("withdraw");
  });

  it("does not treat a missing credit read as zero withdrawn", () => {
    const steps = buildMandateJourney({
      mandate: liveClosed,
      invoices: [],
      decisions: [],
      credit: null,
      withdrawals: [],
      refund: null,
    });
    const withdrawn = steps.find((step) => step.id === "withdrawn-on-chain");
    expect(withdrawn?.state).toBe("waiting");
    expect(withdrawn?.detail).toMatch(/still loading/i);
  });

  it("renders the live closed journey with on-chain facts and no invented hashes", () => {
    const steps = buildMandateJourney({
      mandate: liveClosed,
      invoices: [{ id: "inv-1" }],
      decisions: [{ id: "req-1", outcome: "approved" }],
      credit: liveCredit,
      withdrawals: [],
      refund: null,
    });
    render(<MandateJourney steps={steps} />);
    expect(screen.getByText("Mandate closed")).toBeInTheDocument();
    expect(screen.getByText(/0\.01 test GEN withdrawn on chain/)).toBeInTheDocument();
    expect(screen.queryByText(WITHDRAW_1)).not.toBeInTheDocument();
    expect(screen.queryByText(CLOSE_TX)).not.toBeInTheDocument();
    expect(screen.getByText(/Final merchant credit zero/)).toBeInTheDocument();
  });
});
