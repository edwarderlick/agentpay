import type {
  Decision,
  Invoice,
  Mandate,
  MerchantCredit,
  PaymentRequest,
  TrackedTransaction,
} from "../contract/types";

const OWNER = "0x71C8a992d4A3b2A69De6Dbf7f01ED13B21084e89" as const;
const AGENT = "0x39a441e8A3b2A69De6Dbf7f01ED13B2108bc10aa" as const;
const MERCHANT_A = "0x88b89da3b6201e74d431c4f5298a0c2e912deaaa" as const;
const MERCHANT_B = "0x41b2c18d348a04df97b7b2512f438a0f98e81cbb" as const;

export const DEMO_IDS = {
  mandate: "demo-mandate-q3",
  invoice: "demo-invoice-092",
  request: "demo-request-62d",
  decisionApproved: "demo-decision-approved",
  decisionDenied: "demo-decision-denied",
} as const;

export const demoMandates: Mandate[] = [
  {
    id: DEMO_IDS.mandate,
    title: "Autonomous GPU & Inference Budget Q3",
    purpose:
      "Permitted expenses: API inference tokens on listed endpoints, GPU cloud hours, vector database compute. Prohibited: personal subscriptions, domain renewals, unlisted endpoints.",
    owner: OWNER,
    agent: AGENT,
    merchants: [MERCHANT_A, MERCHANT_B],
    perPaymentCap: "75000000000000000000",
    totalBudget: "500000000000000000000",
    remainingBudget: "320000000000000000000",
    expiry: "2026-12-31T23:59:00.000Z",
    status: "active",
  },
];

export const demoInvoices: Invoice[] = [
  {
    id: DEMO_IDS.invoice,
    mandateId: DEMO_IDS.mandate,
    merchant: MERCHANT_A,
    purpose: "A100 cluster hours for transformer inference batch 14–22 October.",
    amount: "45000000000000000000",
    issuedAt: "2026-10-01T14:12:00.000Z",
    used: true,
  },
];

export const demoRequests: PaymentRequest[] = [
  {
    id: DEMO_IDS.request,
    mandateId: DEMO_IDS.mandate,
    invoiceId: DEMO_IDS.invoice,
    agent: AGENT,
    amount: "45000000000000000000",
    createdAt: "2026-10-01T14:40:00.000Z",
  },
];

export const demoDecisions: Decision[] = [
  {
    id: DEMO_IDS.decisionApproved,
    requestId: DEMO_IDS.request,
    mandateId: DEMO_IDS.mandate,
    invoiceId: DEMO_IDS.invoice,
    outcome: "approved",
    rationale:
      "Stated purpose matches frozen GPU and inference scope. Deterministic wallet, cap, budget, and expiry checks are contract-enforced when deployed.",
  },
  {
    id: DEMO_IDS.decisionDenied,
    requestId: "demo-request-denied",
    mandateId: DEMO_IDS.mandate,
    invoiceId: "demo-invoice-denied",
    outcome: "denied",
    rationale: "Invoice purpose described domain renewal, which the frozen mandate prohibits.",
  },
];

export const demoCredits: MerchantCredit[] = [
  {
    merchant: MERCHANT_A,
    mandateId: DEMO_IDS.mandate,
    approvedCredit: "45000000000000000000",
    withdrawn: "0",
  },
];

export const demoActivity: TrackedTransaction[] = [
  {
    id: "demo-tx-request",
    label: "Payment request (design sample)",
    txHash: null,
    status: "UNKNOWN",
    execution: "UNKNOWN",
    fees: { deposit: null, consumed: null, refund: null },
  },
];
