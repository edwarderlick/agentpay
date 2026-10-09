"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  deliveryLabel,
  type DeliveryPhase,
  type PayoutRecord,
} from "@/lib/contract/delivery";
import { explorerTxUrl } from "@/lib/explorer";
import { formatGen, shortenHex } from "@/lib/format";

export function DeliveryStatus({
  phase,
  record,
  creditWei,
}: {
  phase: DeliveryPhase;
  record?: PayoutRecord | null;
  creditWei?: bigint;
}) {
  const paid = phase === "native_delivered";
  const executionFailed = Boolean(record?.finalized && !record.executionOk);
  return (
    <div className="space-y-3 border border-[#e6e2d9] bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {creditWei && creditWei > 0n ? (
          <StatusBadge status="approved" label="Approved credit" />
        ) : null}
        {executionFailed ? <StatusBadge status="denied" label="Execution failed" /> : null}
        {!executionFailed && (phase === "tx_finalized" || (record?.finalized && !paid)) ? (
          <StatusBadge status="pending" label="Transaction finalized" />
        ) : null}
        {paid ? <StatusBadge status="paid" label="Native delivery confirmed" /> : null}
        {phase === "unresolved" && !executionFailed ? (
          <StatusBadge status="unresolved" label="Delivery unresolved" />
        ) : null}
        {phase === "tx_submitted" ? (
          <StatusBadge status="pending" label="Submitted" />
        ) : null}
      </div>
      <p className="text-sm text-[#424843]">
        {executionFailed
          ? "This transaction failed during execution. Check the explorer and current credit or budget before retrying."
          : deliveryLabel(phase)}
      </p>
      {creditWei !== undefined ? (
        <p className="font-mono text-xs text-[#424843]">Remaining credit {formatGen(creditWei.toString())}</p>
      ) : null}
      {record?.txHash ? (
        <a
          className="inline-block font-mono text-xs underline"
          href={explorerTxUrl(record.txHash)}
          rel="noreferrer"
          target="_blank"
        >
          Explorer {shortenHex(record.txHash)}
        </a>
      ) : (
        <p className="font-mono text-[11px] text-[#424843]">
          Explorer link appears after a withdrawal transaction id exists.
        </p>
      )}
      <p className="text-xs text-[#424843]">
        A finalized parent or a zero credit balance is not paid. Paid requires a successful
        outbound transfer on this transaction plus a matching contract drop and recipient gain.
      </p>
    </div>
  );
}
