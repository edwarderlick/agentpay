export type HexAddress = `0x${string}`;

export type MandateStatus = "active" | "expired" | "closed" | "unknown";

/** Approved = merchant credit recorded. Paid = a separately confirmed native withdrawal. */
export type SettlementPhase = "none" | "approved" | "paid";

export type DecisionOutcome = "approved" | "denied" | "unresolved";

export type ChainTxStatus = "UNKNOWN" | "PENDING" | "ACCEPTED" | "FINALIZED" | "UNDETERMINED";
export type ChainExecutionStatus =
  | "UNKNOWN"
  | "PENDING"
  | "FINISHED_WITH_RETURN"
  | "FINISHED_WITH_ERROR"
  | "REVERTED"
  | "CANCELED";

export type FeeBreakdown = {
  deposit: string | null;
  consumed: string | null;
  refund: string | null;
};

export type Mandate = {
  id: string;
  title: string;
  purpose: string;
  owner: HexAddress;
  agent: HexAddress;
  merchants: HexAddress[];
  perPaymentCap: string;
  totalBudget: string;
  remainingBudget: string;
  expiry: string;
  status: MandateStatus;
};

export type Invoice = {
  id: string;
  mandateId: string;
  merchant: HexAddress;
  purpose: string;
  amount: string;
  issuedAt: string | null;
  used: boolean;
};

export type PaymentRequest = {
  id: string;
  mandateId: string;
  invoiceId: string;
  agent: HexAddress;
  amount: string;
  createdAt: string | null;
};

export type Decision = {
  id: string;
  requestId: string;
  mandateId: string;
  invoiceId: string;
  outcome: DecisionOutcome;
  rationale: string | null;
};

export type MerchantCredit = {
  merchant: HexAddress;
  mandateId: string;
  approvedCredit: string;
  withdrawn: string;
};

export type TrackedTransaction = {
  id: string;
  label: string;
  txHash: string | null;
  status: ChainTxStatus;
  execution: ChainExecutionStatus;
  fees: FeeBreakdown;
};

export type FreezeMandateInput = {
  title: string;
  purpose: string;
  agent: HexAddress;
  merchants: HexAddress[];
  perPaymentCap: string;
  totalBudget: string;
  expiry: string;
};

export type IssueInvoiceInput = {
  mandateId: string;
  purpose: string;
  amount: string;
};

export type RequestPaymentInput = {
  mandateId: string;
  invoiceId: string;
};

export type WithdrawCreditInput = {
  mandateId: string;
  amount: string;
};

export type IdPage = {
  ids: string[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

export type Listed<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
  offset: number;
};

export type PreparedWrite = {
  method: string;
  args: unknown[];
  userValue?: bigint;
};

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "contract_pending" | "unavailable" | "invalid"; message: string };
