export type PostFinalizeRefreshError = {
  txHash: string | null;
};

export function postFinalizeRefreshCopy(): { kicker: string; title: string; body: string } {
  return {
    kicker: "Refresh needed",
    title: "Transaction finalized — UI refresh failed",
    body: "This transaction finalized. The UI refresh failed, so on-chain facts on this page may be stale. Open the explorer, then retry the on-chain read.",
  };
}
