import { afterEach, describe, expect, it, vi } from "vitest";
import AgentPayAdapter from "../lib/contract/adapter";
import {
  REQUIRED_VIEWS,
  REQUIRED_WRITES,
  clearSchemaVerification,
  isBlockedFixtureAddress,
  isContractReady,
} from "../lib/contract/config";
import { verifyReplacementSchema } from "../lib/contract/schema";
import { parseGenToWei } from "../lib/wei";

const views = vi.hoisted(() => ({
  readView: vi.fn(),
}));

vi.mock("../lib/contract/readClient", () => ({
  readView: views.readView,
  readNativeBalance: vi.fn(async () => 0n),
}));

const PRODUCT = "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F";
const AGENT = "0x1234567890123456789012345678901234567890";
const MERCHANT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("product address gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    clearSchemaVerification();
    views.readView.mockReset();
  });

  it("blocks probe and fixture addresses", () => {
    expect(isBlockedFixtureAddress("0x0a18edf32FfB3B58ED274207210E7516FF77b058")).toBe(true);
    expect(isBlockedFixtureAddress("0x00c12559fa8C78e76F369a0d513ce45447E61892")).toBe(true);
    expect(isBlockedFixtureAddress("0xdeE932fA7997325381d47808A3283eD4A420Ba22")).toBe(true);
    expect(isBlockedFixtureAddress("0x7561080FEB7557beF4E19BEAB3E95CcBdbfB1Fbd")).toBe(true);
    expect(isBlockedFixtureAddress(PRODUCT)).toBe(false);
  });

  it("stays unready without env and ready for the dedicated product address", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", "");
    expect(isContractReady()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", "0x00c12559fa8C78e76F369a0d513ce45447E61892");
    expect(isContractReady()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", PRODUCT);
    expect(isContractReady()).toBe(true);
  });

  it("keeps an unrelated valid address unready until get_schema matches AgentPay", async () => {
    const other = "0x1111111111111111111111111111111111111111";
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", other);
    expect(isContractReady()).toBe(false);
    views.readView.mockResolvedValueOnce({
      name: "SomethingElse",
      writes: [...REQUIRED_WRITES],
      views: [...REQUIRED_VIEWS],
    });
    await expect(verifyReplacementSchema(other)).resolves.toBe(false);
    expect(isContractReady()).toBe(false);
    views.readView.mockResolvedValueOnce({
      name: "AgentPay",
      writes: [...REQUIRED_WRITES],
      views: [...REQUIRED_VIEWS],
    });
    await expect(verifyReplacementSchema(other)).resolves.toBe(true);
    expect(isContractReady()).toBe(true);
    expect(views.readView).toHaveBeenCalledWith("get_schema", [], other);
  });

  it("reads get_schema from the passed address, not the configured product address", async () => {
    const other = "0x2222222222222222222222222222222222222222";
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", PRODUCT);
    views.readView.mockImplementation(async (_method: string, _args: unknown[], address?: string) => {
      if (address === PRODUCT) {
        return { name: "WrongContract", writes: [], views: [] };
      }
      return {
        name: "AgentPay",
        writes: [...REQUIRED_WRITES],
        views: [...REQUIRED_VIEWS],
      };
    });
    await expect(verifyReplacementSchema(other)).resolves.toBe(true);
    expect(views.readView).toHaveBeenCalledWith("get_schema", [], other);
    expect(views.readView).not.toHaveBeenCalledWith("get_schema", [], PRODUCT);
  });
});

describe("prepared writes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function adapter() {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", PRODUCT);
    return new AgentPayAdapter(AGENT);
  }

  it("creates unique ids and submits budget as integer wei userValue", () => {
    const a = adapter();
    const first = a.prepareFreezeMandate({
      title: "GPU",
      purpose: "inference only",
      agent: AGENT,
      merchants: [MERCHANT],
      perPaymentCap: "1",
      totalBudget: "2.5",
      expiry: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const second = a.prepareFreezeMandate({
      title: "GPU",
      purpose: "inference only",
      agent: AGENT,
      merchants: [MERCHANT],
      perPaymentCap: "1",
      totalBudget: "2.5",
      expiry: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.method).toBe("create_mandate");
    expect(first.data.args[0]).toMatch(/^m-/);
    expect(first.data.args[0]).not.toBe(second.data.args[0]);
    expect(first.data.userValue).toBe(parseGenToWei("2.5"));
    expect(first.data.args[5]).toBe(parseGenToWei("1")!.toString());
  });

  it("prepares the other four writes with unique ids where required", () => {
    const a = adapter();
    const invoice = a.prepareIssueInvoice({ mandateId: "m-1", purpose: "GPU hours", amount: "0.01" });
    const request = a.prepareRequestPayment({ mandateId: "m-1", invoiceId: "inv-1" });
    const withdraw = a.prepareWithdrawCredit({ mandateId: "m-1", amount: "0.01" });
    const close = a.prepareCloseMandate("m-1");
    expect(invoice.ok && request.ok && withdraw.ok && close.ok).toBe(true);
    if (!invoice.ok || !request.ok || !withdraw.ok || !close.ok) return;
    expect(invoice.data.method).toBe("issue_invoice");
    expect(invoice.data.args[0]).toMatch(/^inv-/);
    expect(request.data.method).toBe("request_payment");
    expect(request.data.args[0]).toMatch(/^req-/);
    expect(withdraw.data.method).toBe("withdraw_credit");
    expect(withdraw.data.userValue).toBeUndefined();
    expect(close.data.method).toBe("close_mandate");
    expect(close.data.args).toEqual(["m-1"]);
  });
});
