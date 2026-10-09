import { newContractId } from "../ids";
import { parseGenToWei } from "../wei";
import {
  contractPendingMessage,
  getChainBinding,
  getConfiguredContractAddress,
  isContractReady,
} from "./config";
import { asAddress, asBool, asString, asWeiString, mapMandateStatus, mapOutcome } from "./map";
import { readNativeBalance, readView } from "./readClient";
import type {
  AdapterResult,
  Decision,
  FreezeMandateInput,
  IdPage,
  Invoice,
  IssueInvoiceInput,
  Listed,
  Mandate,
  MerchantCredit,
  PaymentRequest,
  PreparedWrite,
  RequestPaymentInput,
  WithdrawCreditInput,
} from "./types";

export {
  contractPendingMessage,
  getChainBinding,
  getConfiguredContractAddress,
  isContractReady,
};

export const PAGE = 20;

function emptyListed<T>(offset = 0): Listed<T> {
  return { items: [], total: 0, hasMore: false, offset };
}

function pending<T>(): AdapterResult<T> {
  return { ok: false, reason: "contract_pending", message: contractPendingMessage() };
}

function fail<T>(message: string): AdapterResult<T> {
  return { ok: false, reason: "unavailable", message };
}

function invalid<T>(message: string): AdapterResult<T> {
  return { ok: false, reason: "invalid", message };
}

function mapPage(raw: Record<string, unknown> | null | undefined): IdPage {
  const ids = Array.isArray(raw?.ids) ? raw.ids.map((id) => String(id)) : [];
  return {
    ids,
    total: Number(raw?.total ?? 0),
    offset: Number(raw?.offset ?? 0),
    limit: Number(raw?.limit ?? ids.length),
    hasMore: Boolean(raw?.has_more),
  };
}

function mapMandate(raw: Record<string, unknown> | null | undefined): Mandate | null {
  if (!raw || !raw.id) return null;
  return {
    id: asString(raw.id),
    title: asString(raw.title),
    purpose: asString(raw.purpose),
    owner: asAddress(asString(raw.owner)),
    agent: asAddress(asString(raw.agent)),
    merchants: Array.isArray(raw.merchants)
      ? raw.merchants.map((item) => asAddress(String(item)))
      : [],
    perPaymentCap: asWeiString(raw.per_payment_cap),
    totalBudget: asWeiString(raw.total_budget),
    remainingBudget: asWeiString(raw.remaining_budget),
    expiry: asString(raw.expiry),
    status: mapMandateStatus(asString(raw.status), asBool(raw.closed)),
  };
}

function mapInvoice(raw: Record<string, unknown> | null | undefined): Invoice | null {
  if (!raw || !raw.id) return null;
  return {
    id: asString(raw.id),
    mandateId: asString(raw.mandate_id),
    merchant: asAddress(asString(raw.merchant)),
    purpose: asString(raw.purpose),
    amount: asWeiString(raw.amount),
    issuedAt: null,
    used: asBool(raw.used),
  };
}

function mapRequest(raw: Record<string, unknown> | null | undefined): PaymentRequest | null {
  if (!raw || !raw.id) return null;
  return {
    id: asString(raw.id),
    mandateId: asString(raw.mandate_id),
    invoiceId: asString(raw.invoice_id),
    agent: asAddress(asString(raw.agent)),
    amount: asWeiString(raw.amount),
    createdAt: null,
  };
}

function mapDecision(raw: Record<string, unknown> | null | undefined): Decision | null {
  if (!raw || !raw.id) return null;
  return {
    id: asString(raw.id),
    requestId: asString(raw.id),
    mandateId: asString(raw.mandate_id),
    invoiceId: asString(raw.invoice_id),
    outcome: mapOutcome(asString(raw.outcome)),
    rationale: asString(raw.reason) || null,
  };
}

async function loadByIds<T>(
  ids: string[],
  loader: (id: string) => Promise<T | null>,
): Promise<T[]> {
  const rows: Array<T | null> = await Promise.all(ids.map((id) => loader(id)));
  const items: T[] = [];
  for (const row of rows) {
    if (row !== null) items.push(row);
  }
  return items;
}

export class AgentPayAdapter {
  constructor(private account?: string | null) {}

  updateAccount(address: string): void {
    this.account = address;
  }

  private requireReady<T>(): AdapterResult<T> | null {
    if (!isContractReady()) return pending();
    return null;
  }

  async getMandate(id: string): Promise<AdapterResult<Mandate | null>> {
    const blocked = this.requireReady<Mandate | null>();
    if (blocked) return { ok: true, data: null };
    try {
      const raw = await readView<Record<string, unknown>>("get_mandate", [id]);
      return { ok: true, data: mapMandate(raw) };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load mandate");
    }
  }

  async listIdPage(
    method: string,
    args: unknown[],
  ): Promise<AdapterResult<IdPage>> {
    const blocked = this.requireReady<IdPage>();
    if (blocked) {
      const offset = typeof args[args.length - 2] === "number" ? Number(args[args.length - 2]) : 0;
      return { ok: true, data: { ids: [], total: 0, offset, limit: PAGE, hasMore: false } };
    }
    try {
      const raw = await readView<Record<string, unknown>>(method, args);
      return { ok: true, data: mapPage(raw) };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to list ids");
    }
  }

  private async listedFromIds<T>(
    page: AdapterResult<IdPage>,
    loader: (id: string) => Promise<T | null>,
  ): Promise<AdapterResult<Listed<T>>> {
    if (!page.ok) return page;
    try {
      const items = await loadByIds(page.data.ids, loader);
      return {
        ok: true,
        data: {
          items,
          total: page.data.total,
          hasMore: page.data.hasMore,
          offset: page.data.offset,
        },
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load records");
    }
  }

  async listMandatesForOwner(owner?: string, offset = 0): Promise<AdapterResult<Listed<Mandate>>> {
    const address = owner || this.account;
    if (!address) return { ok: true, data: emptyListed(offset) };
    return this.listedFromIds(
      await this.listIdPage("list_mandates_for_owner", [address, offset, PAGE]),
      async (id) => {
        const result = await this.getMandate(id);
        return result.ok ? result.data : null;
      },
    );
  }

  async listMandatesForAgent(agent?: string, offset = 0): Promise<AdapterResult<Listed<Mandate>>> {
    const address = agent || this.account;
    if (!address) return { ok: true, data: emptyListed(offset) };
    return this.listedFromIds(
      await this.listIdPage("list_mandates_for_agent", [address, offset, PAGE]),
      async (id) => {
        const result = await this.getMandate(id);
        return result.ok ? result.data : null;
      },
    );
  }

  async listMandatesForMerchant(merchant?: string, offset = 0): Promise<AdapterResult<Listed<Mandate>>> {
    const address = merchant || this.account;
    if (!address) return { ok: true, data: emptyListed(offset) };
    return this.listedFromIds(
      await this.listIdPage("list_mandates_for_merchant", [address, offset, PAGE]),
      async (id) => {
        const result = await this.getMandate(id);
        return result.ok ? result.data : null;
      },
    );
  }

  async listPublicMandates(offset = 0): Promise<AdapterResult<Listed<Mandate>>> {
    return this.listedFromIds(await this.listIdPage("list_mandates", [offset, PAGE]), async (id) => {
      const result = await this.getMandate(id);
      return result.ok ? result.data : null;
    });
  }

  async getInvoice(id: string): Promise<AdapterResult<Invoice | null>> {
    const blocked = this.requireReady<Invoice | null>();
    if (blocked) return { ok: true, data: null };
    try {
      const raw = await readView<Record<string, unknown>>("get_invoice", [id]);
      return { ok: true, data: mapInvoice(raw) };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load invoice");
    }
  }

  async listInvoices(mandateId?: string, offset = 0): Promise<AdapterResult<Listed<Invoice>>> {
    if (!mandateId) return { ok: true, data: emptyListed(offset) };
    return this.listedFromIds(
      await this.listIdPage("list_invoices_for_mandate", [mandateId, offset, PAGE]),
      async (id) => {
        const result = await this.getInvoice(id);
        return result.ok ? result.data : null;
      },
    );
  }

  async listInvoicesForMerchant(merchant?: string, offset = 0): Promise<AdapterResult<Listed<Invoice>>> {
    const address = merchant || this.account;
    if (!address) return { ok: true, data: emptyListed(offset) };
    return this.listedFromIds(
      await this.listIdPage("list_invoices_for_merchant", [address, offset, PAGE]),
      async (id) => {
        const result = await this.getInvoice(id);
        return result.ok ? result.data : null;
      },
    );
  }

  async getPaymentRequest(id: string): Promise<AdapterResult<PaymentRequest | null>> {
    const blocked = this.requireReady<PaymentRequest | null>();
    if (blocked) return { ok: true, data: null };
    try {
      const raw = await readView<Record<string, unknown>>("get_request", [id]);
      return { ok: true, data: mapRequest(raw) };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load request");
    }
  }

  async getDecision(id: string): Promise<AdapterResult<Decision | null>> {
    const blocked = this.requireReady<Decision | null>();
    if (blocked) return { ok: true, data: null };
    try {
      const raw = await readView<Record<string, unknown>>("get_request", [id]);
      return { ok: true, data: mapDecision(raw) };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load decision");
    }
  }

  async listDecisions(offset = 0): Promise<AdapterResult<Listed<Decision>>> {
    return this.listedFromIds(await this.listIdPage("list_requests", [offset, PAGE]), async (id) => {
      const result = await this.getDecision(id);
      return result.ok ? result.data : null;
    });
  }

  async listRequestsForAgent(agent?: string, offset = 0): Promise<AdapterResult<Listed<Decision>>> {
    const address = agent || this.account;
    if (!address) return { ok: true, data: emptyListed(offset) };
    return this.listedFromIds(
      await this.listIdPage("list_requests_for_agent", [address, offset, PAGE]),
      async (id) => {
        const result = await this.getDecision(id);
        return result.ok ? result.data : null;
      },
    );
  }

  async listRequestsForMandate(mandateId: string, offset = 0): Promise<AdapterResult<Listed<Decision>>> {
    if (!mandateId) return { ok: true, data: emptyListed(offset) };
    return this.listedFromIds(
      await this.listIdPage("list_requests_for_mandate", [mandateId, offset, PAGE]),
      async (id) => {
        const result = await this.getDecision(id);
        return result.ok ? result.data : null;
      },
    );
  }

  async getMerchantCreditRow(mandateId: string, merchant: string): Promise<AdapterResult<MerchantCredit | null>> {
    const blocked = this.requireReady<MerchantCredit | null>();
    if (blocked) return { ok: true, data: null };
    try {
      const raw = await readView<Record<string, unknown>>("get_merchant_credit_row", [mandateId, merchant]);
      const remaining = BigInt(asWeiString(raw?.credit));
      const withdrawn = BigInt(asWeiString(raw?.withdrawn));
      return {
        ok: true,
        data: {
          merchant: asAddress(asString(raw?.merchant) || merchant),
          mandateId: asString(raw?.mandate_id) || mandateId,
          approvedCredit: (remaining + withdrawn).toString(),
          withdrawn: withdrawn.toString(),
        },
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load merchant credit");
    }
  }

  async getMandateMerchantCredits(mandateId: string, merchants: string[]): Promise<AdapterResult<MerchantCredit[]>> {
    const blocked = this.requireReady<MerchantCredit[]>();
    if (blocked) return { ok: true, data: [] };
    try {
      const results = await Promise.all(merchants.map((merchant) => this.getMerchantCreditRow(mandateId, merchant)));
      const failed = results.find((result) => !result.ok);
      if (failed && !failed.ok) return failed;
      return {
        ok: true,
        data: results
          .map((result) => (result.ok ? result.data : null))
          .filter((row): row is MerchantCredit => row !== null),
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load merchant credits");
    }
  }

  async getMerchantCredit(merchant?: string, offset = 0): Promise<AdapterResult<Listed<MerchantCredit>>> {
    const address = merchant || this.account;
    if (!address) return { ok: true, data: emptyListed(offset) };
    const page = await this.listIdPage("list_credit_mandates_for_merchant", [address, offset, PAGE]);
    if (!page.ok) return page;
    try {
      const rows = await Promise.all(
        page.data.ids.map(async (mandateId) => {
          const raw = await readView<Record<string, unknown>>("get_merchant_credit_row", [
            mandateId,
            address,
          ]);
          const remaining = BigInt(asWeiString(raw?.credit));
          const withdrawn = BigInt(asWeiString(raw?.withdrawn));
          return {
            merchant: asAddress(address),
            mandateId,
            approvedCredit: (remaining + withdrawn).toString(),
            withdrawn: withdrawn.toString(),
          } satisfies MerchantCredit;
        }),
      );
      return {
        ok: true,
        data: {
          items: rows,
          total: page.data.total,
          hasMore: page.data.hasMore,
          offset: page.data.offset,
        },
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load credits");
    }
  }

  async getAccounting(): Promise<AdapterResult<Record<string, string>>> {
    const blocked = this.requireReady<Record<string, string>>();
    if (blocked) return { ok: true, data: {} };
    try {
      const raw = await readView<Record<string, unknown>>("get_accounting", []);
      return {
        ok: true,
        data: {
          contractBalance: asWeiString(raw.contract_balance),
          totalRemaining: asWeiString(raw.total_remaining),
          totalCredits: asWeiString(raw.total_credits),
        },
      };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to load accounting");
    }
  }

  async nativeBalance(address: string): Promise<AdapterResult<bigint>> {
    try {
      return { ok: true, data: await readNativeBalance(address) };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to read native balance");
    }
  }

  async listActivity(offset = 0): Promise<AdapterResult<Listed<Decision>>> {
    return this.listDecisions(offset);
  }

  prepareFreezeMandate(input: FreezeMandateInput): AdapterResult<PreparedWrite> {
    if (!isContractReady()) return pending();
    const budget = parseGenToWei(input.totalBudget);
    const cap = parseGenToWei(input.perPaymentCap);
    if (!budget || !cap) return invalid("Budget and cap must be positive test GEN amounts.");
    const expiry = Math.floor(new Date(input.expiry).getTime() / 1000);
    if (!Number.isFinite(expiry) || expiry * 1000 <= Date.now()) {
      return invalid("Expiry must be in the future.");
    }
    return {
      ok: true,
      data: {
        method: "create_mandate",
        args: [
          newContractId("mandate"),
          input.title.trim(),
          input.purpose.trim(),
          input.agent,
          input.merchants.map((item) => item.trim()),
          cap.toString(),
          expiry,
        ],
        userValue: budget,
      },
    };
  }

  prepareIssueInvoice(input: IssueInvoiceInput): AdapterResult<PreparedWrite> {
    if (!isContractReady()) return pending();
    const amount = parseGenToWei(input.amount);
    if (!amount) return invalid("Invoice amount must be a positive test GEN value.");
    return {
      ok: true,
      data: {
        method: "issue_invoice",
        args: [
          newContractId("invoice"),
          input.mandateId.trim(),
          input.purpose.trim(),
          amount.toString(),
        ],
      },
    };
  }

  prepareRequestPayment(input: RequestPaymentInput): AdapterResult<PreparedWrite> {
    if (!isContractReady()) return pending();
    return {
      ok: true,
      data: {
        method: "request_payment",
        args: [newContractId("request"), input.mandateId.trim(), input.invoiceId.trim()],
      },
    };
  }

  prepareWithdrawCredit(input: WithdrawCreditInput): AdapterResult<PreparedWrite> {
    if (!isContractReady()) return pending();
    const amount = parseGenToWei(input.amount);
    if (!amount) return invalid("Withdrawal amount must be a positive test GEN value.");
    return {
      ok: true,
      data: {
        method: "withdraw_credit",
        args: [input.mandateId.trim(), amount.toString()],
      },
    };
  }

  prepareCloseMandate(mandateId: string): AdapterResult<PreparedWrite> {
    if (!isContractReady()) return pending();
    return {
      ok: true,
      data: {
        method: "close_mandate",
        args: [mandateId.trim()],
      },
    };
  }

  async freezeMandate(input: FreezeMandateInput): Promise<AdapterResult<PreparedWrite>> {
    return this.prepareFreezeMandate(input);
  }

  async issueInvoice(input: IssueInvoiceInput): Promise<AdapterResult<PreparedWrite>> {
    return this.prepareIssueInvoice(input);
  }

  async requestPayment(input: RequestPaymentInput): Promise<AdapterResult<PreparedWrite>> {
    return this.prepareRequestPayment(input);
  }

  async withdrawCredit(input: WithdrawCreditInput): Promise<AdapterResult<PreparedWrite>> {
    return this.prepareWithdrawCredit(input);
  }

  async closeMandate(mandateId: string): Promise<AdapterResult<PreparedWrite>> {
    return this.prepareCloseMandate(mandateId);
  }
}

export default AgentPayAdapter;
