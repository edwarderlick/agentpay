import { describe, expect, it } from "vitest";
import { isSuccessfulTransaction } from "../lib/contract/status";
import {
  isEvmAddress,
  validateInvoiceForm,
  validateMandateForm,
  validateWithdrawal,
} from "../lib/validation";

const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);

describe("validation", () => {
  it("accepts a well-formed mandate", () => {
    const errors = validateMandateForm({
      title: "GPU pool",
      purpose: "Inference APIs only",
      agentAddress: "0x1234567890123456789012345678901234567890",
      merchantAddresses: ["0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"],
      perPaymentCap: "10",
      totalBudget: "100",
      expiry: future,
    });
    expect(errors).toEqual({});
  });

  it("rejects cap above budget, past expiry, and missing purpose", () => {
    const errors = validateMandateForm({
      title: "x",
      purpose: "   ",
      agentAddress: "not-an-address",
      merchantAddresses: [],
      perPaymentCap: "50",
      totalBudget: "10",
      expiry: "2020-01-01T00:00",
    });
    expect(errors.purpose).toBeTruthy();
    expect(errors.agentAddress).toBeTruthy();
    expect(errors.merchantAddresses).toBeTruthy();
    expect(errors.perPaymentCap).toMatch(/cannot exceed/);
    expect(errors.expiry).toBeTruthy();
  });

  it("requires positive invoice amounts and purpose", () => {
    expect(validateInvoiceForm({ mandateId: "", purpose: "", amount: "-1" }).amount).toBeTruthy();
    expect(
      validateInvoiceForm({ mandateId: "m1", purpose: "GPU hours", amount: "12.5" }),
    ).toEqual({});
  });

  it("caps withdrawals at recorded credit", () => {
    expect(validateWithdrawal({ amount: "50" }, 45n * 10n ** 18n).amount).toMatch(/cannot exceed/);
    expect(validateWithdrawal({ amount: "10" }, 45n * 10n ** 18n)).toEqual({});
  });

  it("treats only checksum-shaped 0x addresses as wallets", () => {
    expect(isEvmAddress("0x1234567890123456789012345678901234567890")).toBe(true);
    expect(isEvmAddress("0x123")).toBe(false);
  });
});

describe("transaction success", () => {
  it("requires ACCEPTED or FINALIZED plus FINISHED_WITH_RETURN", () => {
    expect(isSuccessfulTransaction("FINALIZED", "FINISHED_WITH_RETURN")).toBe(true);
    expect(isSuccessfulTransaction("ACCEPTED", "FINISHED_WITH_RETURN")).toBe(true);
    expect(isSuccessfulTransaction("FINALIZED", "PENDING")).toBe(false);
    expect(isSuccessfulTransaction("PENDING", "FINISHED_WITH_RETURN")).toBe(false);
  });
});
