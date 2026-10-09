"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostFinalizeRefreshError } from "@/components/shared/PostFinalizeRefreshError";
import { WriteTxPanel } from "@/components/shared/WriteTxPanel";
import type { PreparedWrite } from "@/lib/contract/types";
import type { TrackedStatus } from "@genlayer/transaction-kit-react";
import { executionOkFromStatus, txHashFromStatus } from "@/lib/contract/payout";
import type { PostFinalizeRefreshError as RefreshError } from "@/lib/contract/postFinalizeRefresh";
import { flightFromStatus, writeRecoveryText, type WriteFlight } from "@/lib/contract/writeRecovery";

export function WriteDialog({
  open,
  onOpenChange,
  title,
  description,
  prepared,
  trackUntil = "finalized",
  onDone,
  onRetryRefresh,
  onFlightChange,
  recordHref = null,
  recordLabel,
  onRecordOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  prepared: PreparedWrite | null;
  trackUntil?: "decided" | "finalized";
  onDone?: (status: TrackedStatus) => void | Promise<void>;
  onRetryRefresh?: () => void | Promise<void>;
  onFlightChange?: (flight: WriteFlight) => void;
  recordHref?: string | null;
  recordLabel?: string;
  onRecordOpen?: () => void;
}) {
  const [flight, setFlight] = useState<WriteFlight>("idle");
  const [refreshError, setRefreshError] = useState<RefreshError | null>(null);
  const [retrying, setRetrying] = useState(false);
  const lastStatusRef = useRef<TrackedStatus | null>(null);
  const recovery = writeRecoveryText({ flight });

  function setAndPublish(next: WriteFlight) {
    setFlight(next);
    onFlightChange?.(next);
  }

  function runParentDone(status: TrackedStatus, succeeded: boolean) {
    void Promise.resolve()
      .then(() => onDone?.(status))
      .then(() => {
        if (succeeded) setRefreshError(null);
      })
      .catch(() => {
        if (!succeeded) return;
        lastStatusRef.current = status;
        setRefreshError({ txHash: txHashFromStatus(status) });
      });
  }

  function retryRefresh() {
    const status = lastStatusRef.current;
    setRetrying(true);
    void Promise.resolve()
      .then(() => (onRetryRefresh ? onRetryRefresh() : status ? onDone?.(status) : undefined))
      .then(() => {
        setRefreshError(null);
      })
      .catch(() => undefined)
      .finally(() => {
        setRetrying(false);
      });
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && (flight === "submitted" || flight === "decided" || flight === "finalizing")) {
            return;
          }
          if (!next && flight === "success") {
            onOpenChange(next);
            return;
          }
          if (!next) setAndPublish("idle");
          else setAndPublish("awaiting_signature");
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none border border-[#02150a] bg-[#fdf9f0] p-6 shadow-none sm:max-w-lg sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold normal-case tracking-tight text-primary">
              {title}
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-6 text-[#424843]">
              {description}
            </DialogDescription>
          </DialogHeader>
          {recovery ? <p className="text-sm text-[#424843]">{recovery}</p> : null}
          {prepared ? (
            <WriteTxPanel
              prepared={prepared}
              trackUntil={trackUntil}
              onDone={(status) => {
                // RC2 can call onDone while its panel is rendering. Defer every
                // state update, parent callback, and dialog close until after render.
                queueMicrotask(() => {
                  const nextFlight = flightFromStatus(status, flight);
                  setAndPublish(nextFlight);
                  const succeeded = status.phase === "finalized" && executionOkFromStatus(status);
                  if (succeeded) {
                    onOpenChange(false);
                    setAndPublish("success");
                  }
                  runParentDone(status, succeeded);
                });
              }}
            />
          ) : (
            <p className="text-sm text-[#424843]">Prepare a valid write before submitting.</p>
          )}
        </DialogContent>
      </Dialog>
      {refreshError && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-x-0 bottom-0 z-[60] p-4">
              <PostFinalizeRefreshError
                txHash={refreshError.txHash}
                retrying={retrying}
                onRetry={retryRefresh}
                recordHref={recordHref}
                recordLabel={recordLabel}
                onRecordOpen={onRecordOpen}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
