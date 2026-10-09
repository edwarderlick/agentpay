import { afterEach, describe, expect, it, vi } from "vitest";
import AgentPayAdapter from "../lib/contract/adapter";
import { mapOutcome } from "../lib/contract/map";

const OWNER = "0x1111111111111111111111111111111111111111";
const AGENT = "0x2222222222222222222222222222222222222222";
const MERCHANT = "0x3333333333333333333333333333333333333333";
const PRODUCT = "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F";

const views = vi.hoisted(() => ({
  readView: vi.fn(),
}));

vi.mock("../lib/contract/readClient", () => ({
  readView: views.readView,
  readNativeBalance: vi.fn(async () => 0n),
}));

function page(ids: string[]) {
  return { ids, total: ids.length, offset: 0, limit: 20, has_more: false };
}

describe("owner agent merchant discovery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    views.readView.mockReset();
  });

  it("loads role-scoped mandates invoices requests and credits past the first 32 ids", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", PRODUCT);
    views.readView.mockImplementation(async (method: string, args: unknown[]) => {
      if (method === "list_mandates_for_owner") return page(["m-owner"]);
      if (method === "list_mandates_for_agent") return page(["m-agent"]);
      if (method === "list_mandates_for_merchant") return page(["m-merchant"]);
      if (method === "list_invoices_for_merchant") return page(["inv-1"]);
      if (method === "list_requests_for_agent") return page(["req-1"]);
      if (method === "list_credit_mandates_for_merchant") return page(["m-merchant"]);
      if (method === "list_mandates") {
        const offset = Number(args[0]);
        const ids = Array.from({ length: 40 }, (_, i) => `m-${i}`);
        return {
          ids: ids.slice(offset, offset + Number(args[1])),
          total: 40,
          offset,
          limit: args[1],
          has_more: offset + Number(args[1]) < 40,
        };
      }
      if (method === "get_mandate") {
        const id = String(args[0]);
        return {
          id,
          title: id,
          purpose: "GPU",
          owner: OWNER,
          agent: AGENT,
          merchants: [MERCHANT],
          per_payment_cap: 1,
          total_budget: 2,
          remaining_budget: 2,
          expiry: 4102444800,
          closed: false,
          status: "active",
        };
      }
      if (method === "get_invoice") {
        return {
          id: "inv-1",
          mandate_id: "m-merchant",
          merchant: MERCHANT,
          purpose: "GPU hours",
          amount: 1,
          used: false,
        };
      }
      if (method === "get_request") {
        return {
          id: "req-1",
          mandate_id: "m-agent",
          invoice_id: "inv-1",
          agent: AGENT,
          amount: 1,
          outcome: "APPROVED",
          reason: "fits",
        };
      }
      if (method === "get_merchant_credit_row") {
        return { mandate_id: "m-merchant", merchant: MERCHANT, credit: 5, withdrawn: 2 };
      }
      return {};
    });

    const owner = new AgentPayAdapter(OWNER);
    const agent = new AgentPayAdapter(AGENT);
    const merchant = new AgentPayAdapter(MERCHANT);

    const owned = await owner.listMandatesForOwner();
    const agentMandates = await agent.listMandatesForAgent();
    const merchantMandates = await merchant.listMandatesForMerchant();
    const invoices = await merchant.listInvoicesForMerchant();
    const requests = await agent.listRequestsForAgent();
    const credits = await merchant.getMerchantCredit();
    const page0 = await owner.listPublicMandates(0);
    const page20 = await owner.listPublicMandates(20);

    expect(owned.ok && owned.data.items[0]?.id).toBe("m-owner");
    expect(agentMandates.ok && agentMandates.data.items[0]?.id).toBe("m-agent");
    expect(merchantMandates.ok && merchantMandates.data.items[0]?.id).toBe("m-merchant");
    expect(invoices.ok && invoices.data.items[0]?.id).toBe("inv-1");
    expect(requests.ok && requests.data.items[0]?.outcome).toBe(mapOutcome("APPROVED"));
    expect(credits.ok && credits.data.items[0]?.approvedCredit).toBe("7");
    expect(credits.ok && credits.data.items[0]?.withdrawn).toBe("2");
    const row = await merchant.getMerchantCreditRow("m-merchant", MERCHANT);
    expect(row.ok && row.data?.approvedCredit).toBe("7");
    expect(row.ok && row.data?.withdrawn).toBe("2");
    expect(page0.ok && page0.data.items).toHaveLength(20);
    expect(page0.ok && page0.data.hasMore).toBe(true);
    expect(page0.ok && page0.data.total).toBe(40);
    expect(page20.ok && page20.data.items[0]?.id).toBe("m-20");
    expect(page20.ok && page20.data.hasMore).toBe(false);
  });

  it("propagates a partial merchant credit row failure instead of omitting the row", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", PRODUCT);
    const other = "0x4444444444444444444444444444444444444444";
    views.readView.mockImplementation(async (method: string, args: unknown[]) => {
      if (method === "get_merchant_credit_row") {
        if (String(args[1]).toLowerCase() === other.toLowerCase()) {
          throw new Error("Studio Next busy");
        }
        return { mandate_id: String(args[0]), merchant: String(args[1]), credit: 5, withdrawn: 2 };
      }
      return {};
    });
    const adapter = new AgentPayAdapter(MERCHANT);
    const result = await adapter.getMandateMerchantCredits("m-merchant", [MERCHANT, other]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected credit unavailable");
    expect(result.message).toMatch(/Studio Next busy/i);
  });
});
