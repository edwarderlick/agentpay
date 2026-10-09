import { isNativeDeliveryConfirmed, onChainWithdrawnCopy } from "@/lib/contract/actions";
import { deliveryLabel, phaseFromRecord, type PayoutKind, type PayoutRecord } from "@/lib/contract/delivery";
import { explorerTxUrl } from "@/lib/explorer";
import { formatGen, shortenHex } from "@/lib/format";

export function PayoutHistory({
  kind,
  records,
  onChainWithdrawnWei,
}: {
  kind: PayoutKind;
  records: PayoutRecord[];
  onChainWithdrawnWei?: string;
}) {
  const title = kind === "refund" ? "Owner refund evidence" : "Withdrawal evidence";
  return (
    <div className="space-y-3 border border-[#e6e2d9] bg-white p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#424843]">{title}</p>
      {onChainWithdrawnWei !== undefined ? (
        <p className="text-sm text-[#424843]">{onChainWithdrawnCopy(onChainWithdrawnWei)} (contract read).</p>
      ) : null}
      {records.length === 0 ? (
        <p className="text-sm text-[#424843]">
          This browser has no locally observed {kind} hash. On-chain totals are shown without inventing a transaction id or claiming native delivery.
        </p>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => {
            const phase = phaseFromRecord(0n, record);
            const failed = record.finalized && !record.executionOk;
            return (
              <li key={record.id} className="border border-[#e6e2d9] bg-[#fdf9f0] p-3">
                <p className="font-display text-sm font-semibold">{formatGen(record.amountWei)}</p>
                <p className="font-mono text-[11px] text-[#424843]">
                  {failed ? "Execution failed" : deliveryLabel(phase)}
                  {isNativeDeliveryConfirmed(record) ? " · Native delivery confirmed" : ""}
                </p>
                {record.txHash ? (
                  <a className="mt-1 inline-block font-mono text-xs underline" href={explorerTxUrl(record.txHash)} rel="noreferrer" target="_blank">
                    Explorer {shortenHex(record.txHash)}
                  </a>
                ) : (
                  <p className="font-mono text-[11px] text-[#424843]">Hash appears after this browser submits the write.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
