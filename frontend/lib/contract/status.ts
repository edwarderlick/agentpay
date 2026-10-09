import type { ChainExecutionStatus, ChainTxStatus } from "./types";

/**
 * A write is successful only after consensus accepts/finalizes the
 * transaction and execution finishes with a return value.
 */
export function isSuccessfulTransaction(
  status: ChainTxStatus | null | undefined,
  execution: ChainExecutionStatus | null | undefined,
): boolean {
  const accepted = status === "ACCEPTED" || status === "FINALIZED";
  return accepted && execution === "FINISHED_WITH_RETURN";
}
