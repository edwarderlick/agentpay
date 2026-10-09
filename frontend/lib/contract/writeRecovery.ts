import type { TrackedStatus } from "@genlayer/transaction-kit-react";
import { executionOkFromStatus } from "./payout";

export type WriteFlight =
  | "idle"
  | "preparing"
  | "awaiting_signature"
  | "submitted"
  | "decided"
  | "finalizing"
  | "success"
  | "rejected"
  | "estimate_failed"
  | "execution_failed";

export function isWriteBusy(flight: WriteFlight): boolean {
  return (
    flight === "preparing" ||
    flight === "awaiting_signature" ||
    flight === "submitted" ||
    flight === "decided" ||
    flight === "finalizing"
  );
}

export function flightFromStatus(status: TrackedStatus | null, current: WriteFlight = "idle"): WriteFlight {
  if (!status) return current;
  if (status.phase === "finalized") {
    return executionOkFromStatus(status) ? "success" : "execution_failed";
  }
  if (status.phase === "decided") return "decided";
  if (status.phase === "submitted" || status.phase === "pending" || status.phase === "processing") {
    return status.phase === "submitted" ? "submitted" : "finalizing";
  }
  return current;
}

export function writeRecoveryText(input: {
  flight: WriteFlight;
  errorMessage?: string | null;
}): string | null {
  const message = input.errorMessage ?? "";
  if (input.flight === "rejected" || isWalletRejection(message)) {
    return "The wallet rejected this signature. No on-chain write was submitted. Recheck the current on-chain state, then try again if the action is still valid.";
  }
  if (input.flight === "estimate_failed" || isFeeEstimateFailure(message)) {
    return "Fee estimation failed. Studio Next often reports sim_estimateTransactionFees execution failed when the contract would revert (already closed, insufficient credit, unauthorized, or expired). Recheck on-chain state. Do not retry the same invalid write.";
  }
  if (input.flight === "execution_failed") {
    return "This write finalized with an execution error. Mandate status, remaining budget, credit, and withdrawn amounts stay as they were except for fees paid by the sender. Recheck on-chain state before any retry.";
  }
  if (input.flight === "submitted" || input.flight === "decided" || input.flight === "finalizing") {
    return "This transaction is still in flight (submitted, decided, or finalizing). Wait for a finalized result before sending another write.";
  }
  if (input.flight === "awaiting_signature" || input.flight === "preparing") {
    return "A write dialog is already open. Finish, reject, or close it before starting another.";
  }
  return message || null;
}

export function unresolvedDeliveryText(kind: "withdraw" | "refund"): string {
  return kind === "refund"
    ? "Refund delivery is unresolved. The close may be finalized, but native delivery is confirmed only after a matching outbound transfer plus contract drop and owner gain. Open the explorer and recheck."
    : "Withdrawal delivery is unresolved. A finalized parent or a zero credit balance is not paid. Confirm the outbound transfer and matching balances, or retry the read.";
}

export function isWalletRejection(message: string): boolean {
  return /rejected|denied|cancelled|canceled|4001/i.test(message);
}

export function isFeeEstimateFailure(message: string): boolean {
  return /sim_estimateTransactionFees|fee estimate|estimation failed|execution failed/i.test(message);
}
