import { STUDIO_NEXT } from "../constants";
import { formatGen } from "../format";
import type { AdapterResult, Decision, Invoice, Mandate, MandateStatus, MerchantCredit } from "./types";
import type { PayoutRecord } from "./delivery";
import { isDeliveryLive } from "./delivery";

export const STUDIO_NEXT_CHAIN_ID = STUDIO_NEXT.chainId;

export type ConnectedRole = "owner" | "agent" | "merchant" | "observer";
export type WriteAction = "close" | "invoice" | "request" | "withdraw";

export type WriteGate = {
  action: WriteAction;
  allowed: boolean;
  reason: string;
  buttonLabel: string;
};

export type WalletGateInput = {
  address: string | null;
  chainOk: boolean;
  canWrite: boolean;
  chainId?: string | number | null;
};

export type JourneyStepState = "done" | "current" | "waiting";
export type EvidenceSource = "on-chain" | "local-evidence";

export type JourneyStep = {
  id: string;
  label: string;
  state: JourneyStepState;
  source: EvidenceSource;
  detail: string;
};

export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function roleForMandate(mandate: Pick<Mandate, "owner" | "agent" | "merchants">, address: string | null): ConnectedRole {
  if (!address) return "observer";
  if (sameAddress(mandate.owner, address)) return "owner";
  if (sameAddress(mandate.agent, address)) return "agent";
  if (mandate.merchants.some((merchant) => sameAddress(merchant, address))) return "merchant";
  return "observer";
}

export function remainingCreditWei(credit: Pick<MerchantCredit, "approvedCredit" | "withdrawn"> | null | undefined): bigint {
  if (!credit) return 0n;
  const approved = BigInt(credit.approvedCredit || "0");
  const withdrawn = BigInt(credit.withdrawn || "0");
  return approved > withdrawn ? approved - withdrawn : 0n;
}

export function walletWriteBlocked(wallet: WalletGateInput): string | null {
  if (!wallet.address) return "Connect the wallet for this role on Studio Next before signing.";
  if (!wallet.chainOk) {
    return `Writes require ${STUDIO_NEXT.chainName} (chain ${STUDIO_NEXT_CHAIN_ID}).`;
  }
  if (!wallet.canWrite) {
    return "The selected wallet is not ready to sign on chain 61997. Reconnect it, then retry.";
  }
  return null;
}

export function mandateInactiveReason(status: MandateStatus, action: "invoice" | "request"): string {
  if (status === "closed") {
    return action === "invoice"
      ? "This mandate is closed on chain. New invoices cannot be posted."
      : "This mandate is closed on chain. New payment requests cannot be submitted.";
  }
  if (status === "expired") {
    return action === "invoice"
      ? "This mandate is expired on chain. New invoices cannot be posted."
      : "This mandate is expired on chain. New payment requests cannot be submitted.";
  }
  if (status !== "active") {
    return "This mandate is not active on chain.";
  }
  return "";
}

export function evaluateWriteGate(input: {
  action: WriteAction;
  mandate: Pick<Mandate, "status" | "remainingBudget" | "owner" | "agent" | "merchants">;
  wallet: WalletGateInput;
  role?: ConnectedRole;
  remainingCreditWei?: bigint;
  writeBusy?: boolean;
}): WriteGate {
  const role = input.role ?? roleForMandate(input.mandate, input.wallet.address);
  if (input.writeBusy) {
    return {
      action: input.action,
      allowed: false,
      reason: "A transaction is awaiting signature, submitted, decided, or still finalizing. Wait for it to finish.",
      buttonLabel: busyLabel(input.action),
    };
  }

  const walletBlock = walletWriteBlocked(input.wallet);
  if (walletBlock) {
    return { action: input.action, allowed: false, reason: walletBlock, buttonLabel: idleLabel(input.action) };
  }

  if (input.action === "close") {
    if (role !== "owner") {
      return {
        action: "close",
        allowed: false,
        reason: "Only the mandate owner wallet can close this mandate.",
        buttonLabel: "Close mandate",
      };
    }
    if (input.mandate.status === "closed") {
      return {
        action: "close",
        allowed: false,
        reason: "This mandate is already closed on chain. A second close is not allowed.",
        buttonLabel: "Mandate closed",
      };
    }
    return {
      action: "close",
      allowed: true,
      reason: closeRefundPreview(input.mandate.remainingBudget),
      buttonLabel: "Close mandate",
    };
  }

  if (input.action === "invoice") {
    if (role !== "merchant") {
      return {
        action: "invoice",
        allowed: false,
        reason: "Only an allowlisted merchant wallet can issue an invoice against this mandate.",
        buttonLabel: "Issue invoice",
      };
    }
    const inactive = mandateInactiveReason(input.mandate.status, "invoice");
    if (inactive) {
      return { action: "invoice", allowed: false, reason: inactive, buttonLabel: "Issue invoice" };
    }
    return {
      action: "invoice",
      allowed: true,
      reason: "Post an invoice from this allowlisted merchant wallet.",
      buttonLabel: "Issue invoice against this mandate",
    };
  }

  if (input.action === "request") {
    if (role !== "agent") {
      return {
        action: "request",
        allowed: false,
        reason: "Only the frozen agent wallet can request payment against this mandate.",
        buttonLabel: "Request payment",
      };
    }
    const inactive = mandateInactiveReason(input.mandate.status, "request");
    if (inactive) {
      return { action: "request", allowed: false, reason: inactive, buttonLabel: "Request payment" };
    }
    return {
      action: "request",
      allowed: true,
      reason: "Submit a purpose-fit request from the frozen agent wallet.",
      buttonLabel: "Request payment",
    };
  }

  const remaining = input.remainingCreditWei ?? 0n;
  if (role !== "merchant") {
    return {
      action: "withdraw",
      allowed: false,
      reason: "Only the merchant wallet that holds this credit can withdraw.",
      buttonLabel: "Execute native withdrawal",
    };
  }
  if (remaining <= 0n) {
    return {
      action: "withdraw",
      allowed: false,
      reason: "Fully withdrawn. Remaining merchant credit on chain is zero.",
      buttonLabel: "Fully withdrawn",
    };
  }
  return {
    action: "withdraw",
    allowed: true,
    reason: `${formatGen(remaining.toString())} remaining credit is withdrawable. Closing a mandate does not erase merchant credit.`,
    buttonLabel: "Execute native withdrawal",
  };
}

export function recheckWithdrawReads(input: {
  mandate: AdapterResult<Mandate | null>;
  credit: AdapterResult<MerchantCredit | null>;
}): { ok: true; mandate: Mandate; remainingCreditWei: bigint } | { ok: false; reason: string } {
  if (!input.mandate.ok) {
    return {
      ok: false,
      reason: `Mandate recheck failed: ${input.mandate.message} Retry the on-chain read before withdrawing.`,
    };
  }
  if (!input.mandate.data) {
    return {
      ok: false,
      reason: "Mandate was not found on chain. Retry the on-chain read before withdrawing.",
    };
  }
  if (!input.credit.ok) {
    return {
      ok: false,
      reason: `Merchant credit recheck failed: ${input.credit.message} Retry the on-chain read before withdrawing.`,
    };
  }
  return {
    ok: true,
    mandate: input.mandate.data,
    remainingCreditWei: remainingCreditWei(input.credit.data),
  };
}

export function gateFromFreshRead(input: {
  action: WriteAction;
  cached: Pick<Mandate, "status" | "remainingBudget" | "owner" | "agent" | "merchants">;
  fresh: Pick<Mandate, "status" | "remainingBudget" | "owner" | "agent" | "merchants"> | null;
  wallet: WalletGateInput;
  remainingCreditWei?: bigint;
  freshRemainingCreditWei?: bigint;
  writeBusy?: boolean;
}): WriteGate {
  if (!input.fresh) {
    return {
      action: input.action,
      allowed: false,
      reason: "On-chain recheck failed. The contract is the final authority; retry the read before opening a write dialog.",
      buttonLabel: idleLabel(input.action),
    };
  }
  return evaluateWriteGate({
    action: input.action,
    mandate: input.fresh,
    wallet: input.wallet,
    remainingCreditWei: input.freshRemainingCreditWei ?? input.remainingCreditWei,
    writeBusy: input.writeBusy,
  });
}

export function closeRefundPreview(remainingBudget: string): string {
  const remaining = BigInt(remainingBudget || "0");
  if (remaining <= 0n) {
    return "Closing refunds only uncommitted remaining budget. Remaining budget is already 0, so no owner refund will be sent. Merchant credit is unchanged.";
  }
  return `Closing will refund ${formatGen(remaining.toString())} uncommitted remaining budget to the owner. Merchant credit is unchanged.`;
}

export function closedRefundCopy(input: {
  remainingBudget: string;
  refund: PayoutRecord | null;
}): { headline: string; body: string; verified: boolean } {
  const remaining = formatGen(input.remainingBudget);
  if (input.refund && isNativeDeliveryConfirmed(input.refund)) {
    return {
      headline: `Closed — ${formatGen(input.refund.amountWei)} refunded to owner`,
      body: "Native delivery is verified for this refund transaction. Closing refunds only uncommitted budget and does not erase merchant credit.",
      verified: true,
    };
  }
  if (input.refund?.finalized && !input.refund.executionOk) {
    return {
      headline: "Close transaction failed during execution",
      body: "The close write finalized with an execution error. Recheck mandate status on chain before retrying. Closing refunds only uncommitted budget and does not erase merchant credit.",
      verified: false,
    };
  }
  if (input.refund?.deliveryChecked && input.refund.finalized && !input.refund.deliveryVerified) {
    return {
      headline: "Closed on chain — refund delivery unresolved",
      body: `Remaining budget on chain is ${remaining}. This browser has a refund hash, but native delivery is not confirmed. Open the explorer and recheck transfer evidence.`,
      verified: false,
    };
  }
  if (input.refund?.txHash && !input.refund.finalized) {
    return {
      headline: "Close submitted — refund pending",
      body: "The close transaction is still in flight. Remaining budget and refund delivery will update after finalization.",
      verified: false,
    };
  }
  return {
    headline: "Mandate closed",
    body: `This mandate is closed on chain. Remaining budget is ${remaining}. Closing refunds only uncommitted budget and does not erase merchant credit. This browser has no locally observed refund hash, so native delivery is not claimed.`,
    verified: false,
  };
}

export function onChainWithdrawnCopy(withdrawnWei: string): string {
  return `${formatGen(withdrawnWei)} withdrawn on chain`;
}

export function isNativeDeliveryConfirmed(record: PayoutRecord | null | undefined): boolean {
  return Boolean(record?.deliveryVerified && record.settled && isDeliveryLive(record.id));
}

export function nextActionForRole(input: {
  mandate: Pick<Mandate, "status" | "remainingBudget" | "owner" | "agent" | "merchants">;
  role: ConnectedRole;
  remainingCreditWei: bigint;
  wallet: WalletGateInput;
}): { label: string; detail: string; action: WriteAction | null } {
  const walletBlock = walletWriteBlocked(input.wallet);
  if (walletBlock && input.role !== "observer") {
    return { label: "Wallet not ready", detail: walletBlock, action: null };
  }
  if (input.role === "owner") {
    if (input.mandate.status === "closed") {
      return {
        label: "Mandate closed",
        detail: "No further owner close. Merchant credit, if any, remains withdrawable by the merchant.",
        action: null,
      };
    }
    return {
      label: "Close mandate",
      detail: closeRefundPreview(input.mandate.remainingBudget),
      action: "close",
    };
  }
  if (input.role === "merchant") {
    if (input.remainingCreditWei > 0n) {
      return {
        label: "Withdraw remaining credit",
        detail: `${formatGen(input.remainingCreditWei.toString())} remains withdrawable even if the mandate is closed.`,
        action: "withdraw",
      };
    }
    if (input.mandate.status === "active") {
      return {
        label: "Issue invoice",
        detail: "Post an invoice from this allowlisted merchant wallet.",
        action: "invoice",
      };
    }
    return {
      label: "Fully withdrawn",
      detail: "Remaining merchant credit on chain is zero. A zero credit balance is not paid by itself.",
      action: null,
    };
  }
  if (input.role === "agent") {
    if (input.mandate.status !== "active") {
      return {
        label: "No request",
        detail: mandateInactiveReason(input.mandate.status, "request"),
        action: null,
      };
    }
    return {
      label: "Request payment",
      detail: "Submit a purpose-fit request from the frozen agent wallet.",
      action: "request",
    };
  }
  return {
    label: "View only",
    detail: "Connect the owner, agent, or merchant wallet for this mandate to see the next valid write.",
    action: null,
  };
}

export function buildMandateJourney(input: {
  mandate: Pick<Mandate, "status" | "remainingBudget" | "totalBudget">;
  invoices: Pick<Invoice, "id">[];
  decisions: Pick<Decision, "id" | "outcome">[];
  credit: Pick<MerchantCredit, "approvedCredit" | "withdrawn"> | null;
  withdrawals: PayoutRecord[];
  refund: PayoutRecord | null;
}): JourneyStep[] {
  const creditKnown = input.credit !== null;
  const remaining = remainingCreditWei(input.credit);
  const withdrawn = creditKnown ? BigInt(input.credit?.withdrawn || "0") : 0n;
  const approved = creditKnown ? BigInt(input.credit?.approvedCredit || "0") : 0n;
  const approvedDecision = input.decisions.find((item) => item.outcome === "approved");
  const anyDecision = input.decisions[0];
  const submittedWithdrawals = input.withdrawals.filter((item) => item.txHash);
  const finalizedWithdrawals = submittedWithdrawals.filter((item) => item.finalized && item.executionOk);
  const verifiedWithdrawals = submittedWithdrawals.filter((item) => isNativeDeliveryConfirmed(item));
  const failedWithdrawals = submittedWithdrawals.filter((item) => item.finalized && !item.executionOk);

  const invoiceDone = input.invoices.length > 0;
  const requestDone = input.decisions.length > 0;
  const creditDone = approved > 0n;
  const closed = input.mandate.status === "closed";

  return [
    {
      id: "created",
      label: "Mandate created and funded",
      state: "done",
      source: "on-chain",
      detail: `On-chain budget ${formatGen(input.mandate.totalBudget)}. Remaining ${formatGen(input.mandate.remainingBudget)}.`,
    },
    {
      id: "invoice",
      label: "Merchant invoice posted",
      state: invoiceDone ? "done" : closed ? "waiting" : "current",
      source: "on-chain",
      detail: invoiceDone ? `${input.invoices.length} invoice(s) recorded on chain.` : "No invoice recorded on chain yet.",
    },
    {
      id: "request",
      label: "Agent request submitted",
      state: requestDone ? "done" : invoiceDone && !closed ? "current" : "waiting",
      source: "on-chain",
      detail: requestDone ? `${input.decisions.length} request(s) recorded on chain.` : "No payment request recorded on chain yet.",
    },
    {
      id: "decision",
      label: "Purpose decision",
      state: requestDone ? "done" : "waiting",
      source: "on-chain",
      detail: requestDone
        ? decisionDetail(anyDecision, approvedDecision)
        : "Waiting for a purpose-fit outcome (APPROVED, DENIED, or UNCLEAR).",
    },
    {
      id: "credit",
      label: "Credit recorded",
      state: !creditKnown ? "waiting" : creditDone ? "done" : approvedDecision ? "current" : "waiting",
      source: "on-chain",
      detail: !creditKnown
        ? "Merchant credit is still loading from chain."
        : creditDone
          ? `Approved ${formatGen(approved.toString())} on chain.`
          : "Merchant credit is recorded only after an APPROVED decision.",
    },
    {
      id: "withdrawn-on-chain",
      label: "Withdrawn on chain",
      state: !creditKnown ? "waiting" : withdrawn > 0n ? "done" : creditDone ? "current" : "waiting",
      source: "on-chain",
      detail: !creditKnown
        ? "Withdrawn amount is still loading from chain."
        : withdrawn > 0n
          ? onChainWithdrawnCopy(withdrawn.toString())
          : "No withdrawn amount is recorded on chain yet. A zero credit balance is not paid.",
    },
    {
      id: "withdrawal-submitted",
      label: "Withdrawal submitted",
      state: submittedWithdrawals.length > 0 ? "done" : "waiting",
      source: "local-evidence",
      detail:
        submittedWithdrawals.length > 0
          ? `${submittedWithdrawals.length} locally observed withdrawal hash(es).`
          : "No locally observed withdrawal hash. On-chain withdrawn amount does not invent a payout transaction.",
    },
    {
      id: "withdrawal-finalized",
      label: "Withdrawal finalized",
      state: finalizedWithdrawals.length > 0 ? "done" : submittedWithdrawals.length > 0 ? "current" : "waiting",
      source: "local-evidence",
      detail: failedWithdrawals.length
        ? `${failedWithdrawals.length} locally observed withdrawal(s) finalized with execution error.`
        : finalizedWithdrawals.length
          ? `${finalizedWithdrawals.length} locally observed withdrawal(s) finalized with FINISHED_WITH_RETURN.`
          : "Finalization is shown only for a locally observed transaction hash.",
    },
    {
      id: "native-delivery",
      label: "Native delivery verified",
      state: verifiedWithdrawals.length > 0 ? "done" : submittedWithdrawals.length > 0 ? "current" : "waiting",
      source: "local-evidence",
      detail:
        verifiedWithdrawals.length > 0
          ? `${verifiedWithdrawals.length} withdrawal(s) confirmed with outbound transfer evidence plus matching balances.`
          : "Native delivery confirmed requires a hash, FINISHED_WITH_RETURN, a matching outbound transfer, and matching contract drop and recipient gain.",
    },
    {
      id: "closed",
      label: "Mandate closed",
      state: closed ? "done" : "waiting",
      source: "on-chain",
      detail: closed
        ? `Closed on chain. Remaining budget ${formatGen(input.mandate.remainingBudget)}.`
        : "Owner can close to refund uncommitted remaining budget.",
    },
    {
      id: "refund",
      label: "Owner refund verified",
      state: isNativeDeliveryConfirmed(input.refund) ? "done" : input.refund?.txHash ? "current" : "waiting",
      source: "local-evidence",
      detail: closedRefundCopy({ remainingBudget: input.mandate.remainingBudget, refund: input.refund }).body,
    },
    {
      id: "credit-left",
      label: !creditKnown
        ? "Merchant credit"
        : remaining > 0n
          ? "Remaining merchant credit still withdrawable"
          : "Final merchant credit zero",
      state: !creditKnown ? "waiting" : closed || withdrawn > 0n || remaining > 0n ? "done" : "waiting",
      source: "on-chain",
      detail: !creditKnown
        ? "Remaining merchant credit is still loading from chain."
        : remaining > 0n
          ? `${formatGen(remaining.toString())} remains withdrawable. Close does not erase merchant credit.`
          : "Remaining merchant credit on chain is zero. Fully withdrawn is not the same as locally verified native delivery.",
    },
  ];
}

function decisionDetail(
  anyDecision: Pick<Decision, "outcome"> | undefined,
  approved: Pick<Decision, "outcome"> | undefined,
): string {
  if (approved) return "On-chain purpose decision includes APPROVED. Merchant credit is recorded only for APPROVED.";
  if (!anyDecision) return "No decision recorded.";
  if (anyDecision.outcome === "denied") return "On-chain purpose decision DENIED. Merchant credit is not recorded.";
  return "On-chain purpose decision UNCLEAR. Merchant credit is not recorded.";
}

function idleLabel(action: WriteAction): string {
  if (action === "close") return "Close mandate";
  if (action === "invoice") return "Issue invoice";
  if (action === "request") return "Request payment";
  return "Execute native withdrawal";
}

function busyLabel(action: WriteAction): string {
  if (action === "close") return "Close in progress";
  if (action === "invoice") return "Invoice in progress";
  if (action === "request") return "Request in progress";
  return "Withdrawal in progress";
}
