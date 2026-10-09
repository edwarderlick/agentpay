"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  OPEN_CREATED_RECORD_LABEL,
  RETRY_VERIFICATION_LABEL,
  VERIFICATION_PENDING_TITLE,
} from "@/lib/contract/createdWrite";
import { explorerTxUrl } from "@/lib/explorer";
import { shortenHex } from "@/lib/format";
import type { useCreatedWriteRecovery } from "@/lib/hooks/useCreatedWriteRecovery";

export function CreatedWriteRecoveryStatus({
  recovery,
}: {
  recovery: ReturnType<typeof useCreatedWriteRecovery>;
}) {
  const [abandonOpen, setAbandonOpen] = useState(false);
  if (recovery.pending && recovery.pendingCopy) {
    const copy = recovery.pendingCopy;
    const abandon = recovery.abandonCopy;
    return (
      <div
        className="border border-[#02150a] bg-[#f7f3ea] p-5 text-[#02150a]"
        role="status"
        data-testid="created-write-verification-pending"
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#a63500]">
          {copy.kicker}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#424843]">{copy.body}</p>
        {recovery.txHash ? (
          <a
            className="mt-3 inline-block font-mono text-xs underline"
            href={explorerTxUrl(recovery.txHash)}
            rel="noreferrer"
            target="_blank"
          >
            Explorer {shortenHex(recovery.txHash)}
          </a>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="bg-[#152a1e] px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-55"
            disabled={recovery.recovering}
            onClick={() => void recovery.onRetryVerification()}
          >
            {recovery.retryVerificationLabel || RETRY_VERIFICATION_LABEL}
          </button>
          <button
            type="button"
            className="border border-[#02150a] bg-white px-4 py-2 font-display text-sm font-bold"
            onClick={() => setAbandonOpen(true)}
          >
            {abandon.triggerLabel}
          </button>
        </div>
        <ConfirmDialog
          open={abandonOpen}
          onOpenChange={setAbandonOpen}
          title={abandon.title}
          description={abandon.description}
          confirmLabel={abandon.confirmLabel}
          onConfirm={() => {
            recovery.onAbandonRecovery();
            setAbandonOpen(false);
          }}
        />
      </div>
    );
  }

  if (!recovery.locked && !recovery.recordHref) return null;

  return (
    <div className="space-y-2">
      {recovery.locked ? <p className="text-sm text-[#424843]">{recovery.lockReason}</p> : null}
      {recovery.recordHref ? (
        <a
          className="inline-block font-display text-sm font-bold underline"
          href={recovery.recordHref}
          onClick={() => recovery.onReachCreatedRecord()}
        >
          {recovery.recordLabel || OPEN_CREATED_RECORD_LABEL}
        </a>
      ) : recovery.recovering ? (
        <p className="font-mono text-[11px] text-[#424843]">{VERIFICATION_PENDING_TITLE}</p>
      ) : null}
    </div>
  );
}
