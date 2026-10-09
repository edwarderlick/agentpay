import { isSuccessfulTransaction } from "@/lib/contract/status";
import type { TrackedTransaction } from "@/lib/contract/types";
import { explorerTxUrl } from "@/lib/explorer";
import { shortenHex } from "@/lib/format";

const STEPS: { key: string; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "FINALIZED", label: "Finalized" },
  { key: "FINISHED_WITH_RETURN", label: "Execution finished with return" },
];

function stepDone(tx: TrackedTransaction, key: string): boolean {
  if (key === "submitted") return Boolean(tx.txHash);
  if (key === "ACCEPTED") return tx.status === "ACCEPTED" || tx.status === "FINALIZED";
  if (key === "FINALIZED") return tx.status === "FINALIZED";
  if (key === "FINISHED_WITH_RETURN") {
    return isSuccessfulTransaction(tx.status, tx.execution);
  }
  return false;
}

export function TransactionTimeline({
  tx,
  emptyLabel = "No transaction has been submitted.",
}: {
  tx: TrackedTransaction | null;
  emptyLabel?: string;
}) {
  if (!tx) {
    return (
      <div className="border border-[#e6e2d9] bg-[#f7f3ea] p-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
          Timeline
        </p>
        <p className="mt-2 text-sm text-[#424843]">{emptyLabel}</p>
      </div>
    );
  }

  const success = isSuccessfulTransaction(tx.status, tx.execution);

  return (
    <div className="border border-[#e6e2d9] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
          Transaction timeline
        </p>
        <span className="font-mono text-[11px] text-[#424843]">
          {success ? "Successful" : "Not successful yet"}
        </span>
      </div>
      <ol className="mt-4 space-y-3">
        {STEPS.map((step) => {
          const done = stepDone(tx, step.key);
          return (
            <li key={step.key} className="flex items-start gap-3">
              <span
                className={`mt-0.5 h-3 w-3 shrink-0 ${done ? "bg-[#d4f478]" : "border border-[#737973] bg-transparent"}`}
              />
              <div>
                <p className="font-display text-sm font-semibold">{step.label}</p>
                <p className="font-mono text-[11px] text-[#424843]">
                  {done ? "Reached" : "Waiting for chain data"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-[#e6e2d9] pt-4 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#424843]">
            Fee deposit
          </dt>
          <dd className="font-display text-base font-semibold">{tx.fees.deposit ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#424843]">
            Consumed
          </dt>
          <dd className="font-display text-base font-semibold">{tx.fees.consumed ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#424843]">
            Refund
          </dt>
          <dd className="font-display text-base font-semibold">{tx.fees.refund ?? "—"}</dd>
        </div>
      </dl>
      {tx.txHash ? (
        <a
          className="mt-4 inline-flex font-mono text-xs underline"
          href={explorerTxUrl(tx.txHash)}
          rel="noreferrer"
          target="_blank"
        >
          Open {shortenHex(tx.txHash)} on explorer
        </a>
      ) : (
        <p className="mt-4 font-mono text-[11px] text-[#424843]">
          Explorer link appears when a transaction id exists.
        </p>
      )}
    </div>
  );
}
