import { parseGenToWei } from "./wei";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isEvmAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

export function parsePositiveAmount(value: string): number | null {
  const wei = parseGenToWei(value);
  if (wei === null) return null;
  const n = Number(value.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export type MandateFormInput = {
  title: string;
  purpose: string;
  agentAddress: string;
  merchantAddresses: string[];
  perPaymentCap: string;
  totalBudget: string;
  expiry: string;
};

export type FieldErrors = Record<string, string>;

export function validateMandateForm(input: MandateFormInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.title.trim()) {
    errors.title = "Give this mandate a short designation.";
  }

  if (!input.purpose.trim()) {
    errors.purpose = "Purpose text is required. Validators compare invoices against this frozen wording.";
  }

  if (!isEvmAddress(input.agentAddress)) {
    errors.agentAddress = "Enter a 42-character 0x agent wallet address.";
  }

  const merchants = input.merchantAddresses.map((m) => m.trim()).filter(Boolean);
  if (merchants.length === 0) {
    errors.merchantAddresses = "Add at least one approved merchant wallet.";
  } else {
    const invalid = merchants.find((m) => !isEvmAddress(m));
    if (invalid) {
      errors.merchantAddresses = `Merchant address is not a valid 0x wallet: ${invalid}`;
    }
  }

  const cap = parseGenToWei(input.perPaymentCap);
  if (cap === null) {
    errors.perPaymentCap = "Per-payment cap must be a positive amount.";
  }

  const budget = parseGenToWei(input.totalBudget);
  if (budget === null) {
    errors.totalBudget = "Total budget must be a positive amount.";
  }

  if (cap !== null && budget !== null && cap > budget) {
    errors.perPaymentCap = "Per-payment cap cannot exceed the total budget.";
  }

  if (!input.expiry) {
    errors.expiry = "Set an expiry date in the future.";
  } else {
    const when = new Date(input.expiry);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      errors.expiry = "Expiry must be in the future.";
    }
  }

  return errors;
}

export type InvoiceFormInput = {
  mandateId: string;
  purpose: string;
  amount: string;
};

export function validateInvoiceForm(input: InvoiceFormInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.mandateId.trim()) {
    errors.mandateId = "Select or enter the mandate this invoice claims against.";
  }
  if (!input.purpose.trim()) {
    errors.purpose = "Stated purpose is required. GenLayer judges this text against the frozen mandate.";
  }
  if (parsePositiveAmount(input.amount) === null) {
    errors.amount = "Invoice amount must be a positive number of test GEN.";
  }
  return errors;
}

export type PaymentRequestInput = {
  mandateId: string;
  invoiceId: string;
};

export function validatePaymentRequest(input: PaymentRequestInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.mandateId.trim()) errors.mandateId = "Mandate id is required.";
  if (!input.invoiceId.trim()) errors.invoiceId = "Invoice id is required.";
  return errors;
}

export type WithdrawalInput = {
  amount: string;
};

export function validateWithdrawal(input: WithdrawalInput, availableCreditWei: bigint | null): FieldErrors {
  const errors: FieldErrors = {};
  const amount = parseGenToWei(input.amount);
  if (amount === null) {
    errors.amount = "Withdrawal amount must be a positive number of test GEN.";
    return errors;
  }
  if (availableCreditWei !== null && amount > availableCreditWei) {
    errors.amount = "Withdrawal cannot exceed recorded merchant credit.";
  }
  return errors;
}
