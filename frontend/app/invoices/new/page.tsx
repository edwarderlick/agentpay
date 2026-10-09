"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreatedWriteRecoveryStatus } from "@/components/shared/CreatedWriteRecoveryStatus";
import { PendingWriteButton } from "@/components/shared/PendingWrite";
import { LoadingState } from "@/components/shared/LoadingState";
import { WriteDialog } from "@/components/shared/WriteDialog";
import { contractPendingMessage, isContractReady } from "@/lib/contract/adapter";
import { evaluateWriteGate, gateFromFreshRead } from "@/lib/contract/actions";
import { isWriteBusy, writeRecoveryText, type WriteFlight } from "@/lib/contract/writeRecovery";
import type { PreparedWrite } from "@/lib/contract/types";
import { useDemoMode } from "@/lib/demo/DemoMode";
import { DEMO_IDS, demoMandates } from "@/lib/demo/data";
import { PAGE } from "@/lib/contract/adapter";
import { PageControls } from "@/components/shared/PageControls";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useAdapter } from "@/lib/hooks/useAdapter";
import { useMandate, useMerchantMandates } from "@/lib/hooks/useChainQueries";
import { useCreatedWriteRecovery } from "@/lib/hooks/useCreatedWriteRecovery";
import { validateInvoiceForm } from "@/lib/validation";

function NewInvoiceForm() {
  const params = useSearchParams();
  const { demoMode } = useDemoMode();
  const adapter = useAdapter();
  const wallet = useWallet();
  const createdWrite = useCreatedWriteRecovery("invoice");
  const [mandateOffset, setMandateOffset] = useState(0);
  const merchantMandates = useMerchantMandates(mandateOffset);
  const [mandateId, setMandateId] = useState(
    params.get("mandate") || (demoMode ? DEMO_IDS.mandate : ""),
  );
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedWrite | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [writeFlight, setWriteFlight] = useState<WriteFlight>("idle");
  const [opening, setOpening] = useState(false);
  const mandateQuery = useMandate(demoMode ? undefined : mandateId || undefined);
  const errors = useMemo(
    () => validateInvoiceForm({ mandateId, purpose, amount }),
    [mandateId, purpose, amount],
  );
  const liveMandates = merchantMandates.data?.items ?? [];
  const selectedMandate = demoMode
    ? demoMandates.find((item) => item.id === mandateId) ?? demoMandates[0]
    : mandateQuery.data ?? liveMandates.find((item) => item.id === mandateId);
  const busy = opening || createdWrite.locked || isWriteBusy(writeFlight);
  const walletGate = {
    address: wallet.address,
    chainOk: wallet.isOnCorrectNetwork,
    canWrite: wallet.canWrite,
    chainId: wallet.chainId,
  };
  const invoiceGate = selectedMandate
    ? evaluateWriteGate({ action: "invoice", mandate: selectedMandate, wallet: walletGate, writeBusy: busy })
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
        action: "invoice",
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
      const result = adapter.prepareIssueInvoice({ mandateId, purpose, amount });
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
        Merchant terminal
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-primary">
        Issue authenticated merchant invoice
      </h1>
      <p className="mt-3 max-w-3xl text-lg text-[#424843]">
        Post an itemized claim from an approved merchant wallet. An invoice does not draw
        escrow. The authorized agent must request payment, and GenLayer judges purpose fit.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <form
          className="space-y-6 border border-[#e6e2d9] bg-white p-6 lg:col-span-8"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="block">
            <span className="font-display text-sm font-bold">Target mandate</span>
            {demoMode ? (
              <select
                className="mt-2 w-full bg-[#f1eee5] p-4"
                value={mandateId}
                onChange={(e) => setMandateId(e.target.value)}
              >
                {demoMandates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            ) : liveMandates.length > 0 ? (
              <select
                className="mt-2 w-full bg-[#f1eee5] p-4"
                value={mandateId}
                onChange={(e) => setMandateId(e.target.value)}
              >
                <option value="">Select a mandate</option>
                {liveMandates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="mt-2 w-full bg-[#f1eee5] p-4 font-mono"
                value={mandateId}
                onChange={(e) => setMandateId(e.target.value)}
                placeholder="Mandate id"
              />
            )}
            {attempted && errors.mandateId ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.mandateId}</p> : null}
            {!demoMode && merchantMandates.data ? (
              <div className="mt-2">
                <PageControls
                  offset={mandateOffset}
                  limit={PAGE}
                  total={merchantMandates.data.total}
                  hasMore={merchantMandates.data.hasMore}
                  onPrev={() => setMandateOffset(Math.max(0, mandateOffset - PAGE))}
                  onNext={() => setMandateOffset(mandateOffset + PAGE)}
                  label="Merchant mandates"
                />
              </div>
            ) : null}
          </label>
          <label className="block">
            <span className="font-display text-sm font-bold">Stated purpose</span>
            <textarea
              className="mt-2 w-full bg-[#f1eee5] p-4"
              rows={5}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What this invoice is for. Validators compare this to the frozen mandate."
            />
            {attempted && errors.purpose ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.purpose}</p> : null}
          </label>
          <label className="block">
            <span className="font-display text-sm font-bold">Amount (test GEN)</span>
            <input
              className="mt-2 w-full bg-[#f1eee5] p-4 font-mono"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
            />
            {attempted && errors.amount ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.amount}</p> : null}
          </label>
          {prepareError ? <p className="text-sm text-[#ba1a1a]">{prepareError}</p> : null}
          {writeRecoveryText({ flight: writeFlight, errorMessage: prepareError }) ? (
            <p className="text-sm text-[#424843]">{writeRecoveryText({ flight: writeFlight, errorMessage: prepareError })}</p>
          ) : null}
          <CreatedWriteRecoveryStatus recovery={createdWrite} />
          <PendingWriteButton
            disabled={Boolean(createdWrite.locked || (invoiceGate && !invoiceGate.allowed))}
            disabledReason={
              createdWrite.locked
                ? createdWrite.lockReason
                : invoiceGate && !invoiceGate.allowed
                  ? invoiceGate.reason
                  : undefined
            }
            onClick={() => void submit()}
          >
            Sign and post invoice
          </PendingWriteButton>
        </form>
        <aside className="lg:col-span-4 bg-[#152a1e] p-6 text-[#fdf9f0]">
          <p className="font-mono text-xs text-[#b4d25b]">Lifecycle</p>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-[#e6e2d9]">
            <li>1. Invoice recorded</li>
            <li>2. Agent requests payment</li>
            <li>3. Purpose judged</li>
            <li>4. Credit recorded if approved</li>
            <li>5. Merchant withdraws in a later tx</li>
          </ol>
        </aside>
      </div>
      <WriteDialog
        open={open}
        onOpenChange={setOpen}
        title={isContractReady() ? "Issue invoice" : "Invoice cannot be posted yet"}
        description={
          isContractReady()
            ? "The app generated a unique invoice id. Transaction Kit quotes fees, then the connected merchant wallet signs issue_invoice on chain 61997."
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

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-12"><LoadingState label="Loading invoice form" /></div>}>
      <NewInvoiceForm />
    </Suspense>
  );
}
