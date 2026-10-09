"use client";

import { OPEN_CREATED_RECORD_LABEL } from "@/lib/contract/createdWrite";
import { postFinalizeRefreshCopy } from "@/lib/contract/postFinalizeRefresh";
import { explorerTxUrl } from "@/lib/explorer";
import { shortenHex } from "@/lib/format";

export function PostFinalizeRefreshError({
  txHash,
  onRetry,
  retrying = false,
  recordHref = null,
  recordLabel = OPEN_CREATED_RECORD_LABEL,
  onRecordOpen,
}: {
  txHash: string | null;
  onRetry: () => void;
  retrying?: boolean;
  recordHref?: string | null;
  recordLabel?: string;
  onRecordOpen?: () => void;
}) {
  const copy = postFinalizeRefreshCopy();
  return (
    <div
      className="border border-[#02150a] bg-[#f7f3ea] p-5 text-[#02150a] shadow-[0_-8px_24px_rgba(2,21,10,0.12)]"
      role="alert"
      data-testid="post-finalize-refresh-error"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#a63500]">
        {copy.kicker}
      </p>
      <h2 className="mt-1 font-display text-xl font-semibold">{copy.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#424843]">{copy.body}</p>
      {txHash ? (
        <a
          className="mt-3 inline-block font-mono text-xs underline"
          href={explorerTxUrl(txHash)}
          rel="noreferrer"
          target="_blank"
        >
          Explorer {shortenHex(txHash)}
        </a>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="bg-[#152a1e] px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-55"
          disabled={retrying}
          onClick={onRetry}
        >
          Retry on-chain read
        </button>
        {recordHref ? (
          <a
            className="bg-[#d04400] px-4 py-2 font-display text-sm font-bold text-white"
            href={recordHref}
            onClick={() => onRecordOpen?.()}
          >
            {recordLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
