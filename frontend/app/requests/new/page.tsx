"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/shared/LoadingState";
import { CreatedWriteRecoveryStatus } from "@/components/shared/CreatedWriteRecoveryStatus";
import { PendingWriteButton } from "@/components/shared/PendingWrite";
import { WriteDialog } from "@/components/shared/WriteDialog";
import { contractPendingMessage, isContractReady } from "@/lib/contract/adapter";
import { evaluateWriteGate, gateFromFreshRead } from "@/lib/contract/actions";
import { isWriteBusy, writeRecoveryText, type WriteFlight } from "@/lib/contract/writeRecovery";
import type { PreparedWrite } from "@/lib/contract/types";
import { useDemoMode } from "@/lib/demo/DemoMode";
import { DEMO_IDS, demoMandates } from "@/lib/demo/data";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useAdapter } from "@/lib/hooks/useAdapter";
import { useMandate } from "@/lib/hooks/useChainQueries";
import { useCreatedWriteRecovery } from "@/lib/hooks/useCreatedWriteRecovery";
import { validatePaymentRequest } from "@/lib/validation";

function RequestForm() {
  const params = useSearchParams();
  const { demoMode } = useDemoMode();
  const adapter = useAdapter();
  const wallet = useWallet();
  const createdWrite = useCreatedWriteRecovery("decision");
  const [mandateId, setMandateId] = useState(params.get("mandate") || (demoMode ? DEMO_IDS.mandate : ""));
  const [invoiceId, setInvoiceId] = useState(params.get("invoice") || (demoMode ? DEMO_IDS.invoice : ""));
  const [attempted, setAttempted] = useState(false);
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedWrite | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [writeFlight, setWriteFlight] = useState<WriteFlight>("idle");
  const [opening, setOpening] = useState(false);
  const mandateQuery = useMandate(demoMode ? undefined : mandateId || undefined);
  const errors = useMemo(
    () => validatePaymentRequest({ mandateId, invoiceId }),
    [mandateId, invoiceId],
  );
  const selectedMandate = demoMode
    ? demoMandates.find((item) => item.id === mandateId) ?? demoMandates[0]
    : mandateQuery.data;
  const busy = opening || createdWrite.locked || isWriteBusy(writeFlight);
  const walletGate = {
    address: wallet.address,
    chainOk: wallet.isOnCorrectNetwork,
    canWrite: wallet.canWrite,
    chainId: wallet.chainId,
  };
  const requestGate = selectedMandate
    ? evaluateWriteGate({ action: "request", mandate: selectedMandate, wallet: walletGate, writeBusy: busy })
    : null;

  useEffect(() => {
    if (createdWrite.locked) return;
    setOpen(false);
    setPrepared(null);
    setPrepareError(null);
    setWriteFlight("idle");
    setOpening(false);
  }, [wallet.address, createdWrite.locked]);

  async function submit() {
    setAttempted(true);
    if (createdWrite.locked || busy || Object.keys(errors).length !== 0) return;
    setOpening(true);
    setWriteFlight("preparing");
    try {
      const fresh = demoMode
        ? { ok: true as const, data: selectedMandate ?? null }
        : await adapter.getMandate(mandateId);
      const gated = gateFromFreshRead({
        action: "request",
        cached: selectedMandate ?? {
          status: "unknown",
          remainingBudget: "0",
          owner: "0x0000000000000000000000000000000000000000",
          agent: "0x0000000000000000000000000000000000000000",
          merchants: [],
        },
        fresh: fresh.ok ? fresh.data : null,
        wallet: walletGate,
      });
      if (!gated.allowed) {
        setPrepareError(gated.reason);
        setWriteFlight("idle");
        return;
      }
      const result = adapter.prepareRequestPayment({ mandateId, invoiceId });
      if (!result.ok) {
        setPrepareError(result.message);
        setWriteFlight("idle");
        return;
      }
      setPrepareError(null);
      setPrepared(result.data);
      setWriteFlight("awaiting_signature");
      setOpen(true);
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : "On-chain recheck failed.");
      setWriteFlight("idle");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">
        Authorized agent · execution chamber
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-primary">
        Request payment
      </h1>
      <p className="mt-3 max-w-3xl text-lg text-[#424843]">
        The authorized agent asks GenLayer to judge whether this invoice’s stated purpose
        fits the frozen mandate. Deterministic wallet, amount, budget, expiry, and reuse
        checks belong to contract code.
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 border border-[#e6e2d9] bg-white p-6 lg:col-span-7">
          <label className="block">
            <span className="font-display text-sm font-bold">Mandate id</span>
            <input
              className="mt-2 w-full bg-[#f1eee5] p-4 font-mono"
              value={mandateId}
              onChange={(e) => setMandateId(e.target.value)}
            />
            {attempted && errors.mandateId ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.mandateId}</p> : null}
          </label>
          <label className="block">
            <span className="font-display text-sm font-bold">Invoice id</span>
            <input
              className="mt-2 w-full bg-[#f1eee5] p-4 font-mono"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            />
            {attempted && errors.invoiceId ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.invoiceId}</p> : null}
          </label>
          {prepareError ? <p className="text-sm text-[#ba1a1a]">{prepareError}</p> : null}
          {writeRecoveryText({ flight: writeFlight, errorMessage: prepareError }) ? (
            <p className="text-sm text-[#424843]">{writeRecoveryText({ flight: writeFlight, errorMessage: prepareError })}</p>
          ) : null}
          <CreatedWriteRecoveryStatus recovery={createdWrite} />
          <PendingWriteButton
            disabled={Boolean(createdWrite.locked || (requestGate && !requestGate.allowed))}
            disabledReason={
              createdWrite.locked
                ? createdWrite.lockReason
                : requestGate && !requestGate.allowed
                  ? requestGate.reason
                  : undefined
            }
            onClick={() => void submit()}
          >
            Request payment
          </PendingWriteButton>
        </div>
        <aside className="lg:col-span-5 border border-[#e6e2d9] bg-[#f7f3ea] p-6">
          <h2 className="font-display text-xl font-bold">Deterministic checks (contract)</h2>
          <ul className="mt-4 space-y-2 text-sm text-[#424843]">
            <li>Caller is the frozen agent wallet</li>
            <li>Invoice merchant is on the allowlist</li>
            <li>Amount ≤ per-payment cap</li>
            <li>Amount ≤ remaining budget</li>
            <li>Mandate has not expired</li>
            <li>Invoice has not already been paid through</li>
          </ul>
        </aside>
      </div>
      <WriteDialog
        open={open}
        onOpenChange={setOpen}
        title={isContractReady() ? "Request payment" : "Payment request cannot be submitted"}
        description={
          isContractReady()
            ? "The app generated a unique request id. Sign request_payment from the frozen agent wallet on chain 61997. Outcomes map APPROVED → approved, DENIED → denied, UNCLEAR → unresolved."
            : contractPendingMessage()
        }
        prepared={prepared}
        onFlightChange={setWriteFlight}
        onRetryRefresh={createdWrite.onRetryRefresh}
        recordHref={createdWrite.recordHref}
        recordLabel={createdWrite.recordLabel}
        onRecordOpen={createdWrite.onReachCreatedRecord}
        onDone={(status) => createdWrite.onWriteDone(prepared, status)}
      />
    </div>
  );
}

export default function RequestPaymentPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12"><LoadingState label="Loading request form" /></div>}>
      <RequestForm />
    </Suspense>
  );
}
