"use client";

import { useMemo, useState } from "react";
import { CreatedWriteRecoveryStatus } from "@/components/shared/CreatedWriteRecoveryStatus";
import { PendingWriteButton } from "@/components/shared/PendingWrite";
import { WriteDialog } from "@/components/shared/WriteDialog";
import { contractPendingMessage, isContractReady } from "@/lib/contract/adapter";
import type { PreparedWrite } from "@/lib/contract/types";
import { isWriteBusy, type WriteFlight } from "@/lib/contract/writeRecovery";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useAdapter } from "@/lib/hooks/useAdapter";
import { useCreatedWriteRecovery } from "@/lib/hooks/useCreatedWriteRecovery";
import { validateMandateForm, type MandateFormInput } from "@/lib/validation";

const STEPS = [
  { id: 1, label: "Purpose & scope", hint: "Title, frozen text" },
  { id: 2, label: "Wallets & auth", hint: "Agent and merchants" },
  { id: 3, label: "Limits & budget", hint: "Caps and expiry" },
  { id: 4, label: "Review & freeze", hint: "Immutable seal" },
];

const empty: MandateFormInput = {
  title: "",
  purpose: "",
  agentAddress: "",
  merchantAddresses: [""],
  perPaymentCap: "",
  totalBudget: "",
  expiry: "",
};

export default function CreateMandatePage() {
  const wallet = useWallet();
  const adapter = useAdapter();
  const createdWrite = useCreatedWriteRecovery("mandate");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<MandateFormInput>(empty);
  const [attempted, setAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedWrite | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [writeFlight, setWriteFlight] = useState<WriteFlight>("idle");
  const errors = useMemo(() => validateMandateForm(form), [form]);
  const valid = Object.keys(errors).length === 0;
  const busy = createdWrite.locked || isWriteBusy(writeFlight);

  function setField<K extends keyof MandateFormInput>(key: K, value: MandateFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function merchants() {
    return form.merchantAddresses;
  }

  function goNext() {
    setAttempted(true);
    if (step === 1 && (errors.title || errors.purpose)) return;
    if (step === 2 && (errors.agentAddress || errors.merchantAddresses)) return;
    if (step === 3 && (errors.perPaymentCap || errors.totalBudget || errors.expiry)) return;
    setAttempted(false);
    setStep((s) => Math.min(4, s + 1));
  }

  return (
    <div>
      <section className="bg-[#f7f3ea] px-4 py-10 md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">
            Spending mandate setup
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-primary md:text-6xl">
            Create a spending mandate
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-[#424843]">
            Set the agent, approved merchants, budget, and purpose. Once created, validators
            evaluate invoices against this exact wording.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`p-4 text-left ${step === s.id ? "bg-[#152a1e] text-white" : "bg-[#ece8df] text-primary"}`}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest">Stage 0{s.id}</p>
                <p className="mt-1 font-display text-lg font-bold">{s.label}</p>
                <p className="font-mono text-[11px] opacity-70">{s.hint}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#d04400] px-4 py-3.5 text-white">
        <div className="mx-auto max-w-7xl font-mono text-sm">
          <strong className="uppercase">Protocol notice:</strong> Terms cannot be edited after the mandate is created.
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 lg:grid-cols-12 md:px-8">
        <div className="lg:col-span-7 space-y-6">
          {step === 1 ? (
            <div className="bg-white p-6 md:p-8 border border-[#e6e2d9] space-y-4">
              <h2 className="font-display text-2xl font-bold">Purpose & semantic scope</h2>
              <label className="block">
                <span className="font-display text-sm font-bold">Mandate designation</span>
                <input
                  className="mt-2 w-full bg-[#f1eee5] p-4 outline-none focus:ring-2 focus:ring-primary"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="e.g. GPU infrastructure pool Q4"
                />
                {attempted && errors.title ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.title}</p> : null}
              </label>
              <label className="block">
                <span className="font-display text-sm font-bold">Permitted purpose</span>
                <textarea
                  className="mt-2 w-full bg-[#f1eee5] p-4 outline-none focus:ring-2 focus:ring-primary"
                  rows={6}
                  value={form.purpose}
                  onChange={(e) => setField("purpose", e.target.value)}
                  placeholder="What the agent may pay for, and what is prohibited."
                />
                {attempted && errors.purpose ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.purpose}</p> : null}
              </label>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="bg-white p-6 md:p-8 border border-[#e6e2d9] space-y-4">
              <h2 className="font-display text-2xl font-bold">Wallets & agent authorization</h2>
              <label className="block">
                <span className="font-display text-sm font-bold">Authorized agent address</span>
                <input
                  className="mt-2 w-full bg-[#f1eee5] p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
                  value={form.agentAddress}
                  onChange={(e) => setField("agentAddress", e.target.value)}
                  placeholder="0x…"
                />
                {attempted && errors.agentAddress ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.agentAddress}</p> : null}
              </label>
              <div className="space-y-2">
                <p className="font-display text-sm font-bold">Approved merchant wallets</p>
                {merchants().map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="w-full bg-[#f1eee5] p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
                      value={m}
                      onChange={(e) => {
                        const next = [...form.merchantAddresses];
                        next[i] = e.target.value;
                        setField("merchantAddresses", next);
                      }}
                      placeholder="0x…"
                    />
                    <button
                      type="button"
                      className="border border-[#e6e2d9] px-3"
                      onClick={() => setField("merchantAddresses", form.merchantAddresses.filter((_, idx) => idx !== i))}
                      disabled={form.merchantAddresses.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="font-mono text-xs underline"
                  onClick={() => setField("merchantAddresses", [...form.merchantAddresses, ""])}
                >
                  Add merchant
                </button>
                {attempted && errors.merchantAddresses ? (
                  <p className="text-sm text-[#ba1a1a]">{errors.merchantAddresses}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          {step === 3 ? (
            <div className="bg-white p-6 md:p-8 border border-[#e6e2d9] space-y-4">
              <h2 className="font-display text-2xl font-bold">Limits & budget</h2>
              <label className="block">
                <span className="font-display text-sm font-bold">Total test-GEN budget</span>
                <input
                  className="mt-2 w-full bg-[#f1eee5] p-4 font-mono outline-none focus:ring-2 focus:ring-primary"
                  value={form.totalBudget}
                  onChange={(e) => setField("totalBudget", e.target.value)}
                  inputMode="decimal"
                />
                {attempted && errors.totalBudget ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.totalBudget}</p> : null}
              </label>
              <label className="block">
                <span className="font-display text-sm font-bold">Per-payment cap</span>
                <input
                  className="mt-2 w-full bg-[#f1eee5] p-4 font-mono outline-none focus:ring-2 focus:ring-primary"
                  value={form.perPaymentCap}
                  onChange={(e) => setField("perPaymentCap", e.target.value)}
                  inputMode="decimal"
                />
                {attempted && errors.perPaymentCap ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.perPaymentCap}</p> : null}
              </label>
              <label className="block">
                <span className="font-display text-sm font-bold">Expiry</span>
                <input
                  type="datetime-local"
                  className="mt-2 w-full bg-[#f1eee5] p-4 font-mono outline-none focus:ring-2 focus:ring-primary"
                  value={form.expiry}
                  onChange={(e) => setField("expiry", e.target.value)}
                />
                {attempted && errors.expiry ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.expiry}</p> : null}
              </label>
            </div>
          ) : null}
          {step === 4 ? (
            <div className="bg-white p-6 md:p-8 border border-[#e6e2d9] space-y-4">
              <h2 className="font-display text-2xl font-bold">Review</h2>
              <dl className="space-y-3 text-sm">
                <div><dt className="font-mono text-[10px] uppercase text-[#424843]">Title</dt><dd>{form.title || "—"}</dd></div>
                <div><dt className="font-mono text-[10px] uppercase text-[#424843]">Purpose</dt><dd className="whitespace-pre-wrap">{form.purpose || "—"}</dd></div>
                <div><dt className="font-mono text-[10px] uppercase text-[#424843]">Agent</dt><dd className="font-mono">{form.agentAddress || "—"}</dd></div>
                <div><dt className="font-mono text-[10px] uppercase text-[#424843]">Merchants</dt><dd className="font-mono">{form.merchantAddresses.filter(Boolean).join(", ") || "—"}</dd></div>
                <div><dt className="font-mono text-[10px] uppercase text-[#424843]">Cap / budget</dt><dd>{form.perPaymentCap || "—"} / {form.totalBudget || "—"} test GEN</dd></div>
                <div><dt className="font-mono text-[10px] uppercase text-[#424843]">Expiry</dt><dd>{form.expiry || "—"}</dd></div>
              </dl>
              {!valid ? <p className="text-sm text-[#ba1a1a]">Complete every field before freeze. {Object.values(errors)[0]}</p> : null}
              {prepareError ? <p className="text-sm text-[#ba1a1a]">{prepareError}</p> : null}
              <CreatedWriteRecoveryStatus recovery={createdWrite} />
              <PendingWriteButton
                disabled={!valid || busy}
                disabledReason={createdWrite.locked ? createdWrite.lockReason : undefined}
                onClick={() => {
                  if (!valid) {
                    setAttempted(true);
                    return;
                  }
                  if (busy) return;
                  const result = adapter.prepareFreezeMandate({
                    title: form.title,
                    purpose: form.purpose,
                    agent: form.agentAddress as `0x${string}`,
                    merchants: form.merchantAddresses.filter(Boolean).map((item) => item as `0x${string}`),
                    perPaymentCap: form.perPaymentCap,
                    totalBudget: form.totalBudget,
                    expiry: form.expiry,
                  });
                  if (!result.ok) {
                    setPrepareError(result.message);
                    return;
                  }
                  setPrepareError(null);
                  setPrepared(result.data);
                  setWriteFlight("awaiting_signature");
                  setConfirmOpen(true);
                }}
              >
                Freeze terms & deposit test GEN
              </PendingWriteButton>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="bg-[#ece8df] px-5 py-3 font-semibold disabled:opacity-40"
              disabled={step === 1}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
            {step < 4 ? (
              <button type="button" className="bg-primary px-8 py-3 font-bold text-white" onClick={goNext}>
                Next
              </button>
            ) : null}
          </div>
        </div>
        <aside className="lg:col-span-5 bg-[#152a1e] p-6 text-[#fdf9f0]">
          <p className="font-mono text-xs text-[#b4d25b]">Freeze preview</p>
          <p className="mt-3 font-display text-2xl font-bold">{form.title || "Untitled mandate"}</p>
          <p className="mt-4 text-sm leading-6 text-[#e6e2d9]">
            Budget {form.totalBudget || "—"} · Cap {form.perPaymentCap || "—"} · {form.merchantAddresses.filter(Boolean).length} merchants
          </p>
          <p className="mt-8 font-mono text-[11px] text-[#7b9282]">{contractPendingMessage()}</p>
        </aside>
      </section>
      <WriteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isContractReady() ? "Freeze mandate" : "Contract not ready"}
        description={
          isContractReady()
            ? `Budget ${form.totalBudget} test GEN is submitted as payable value in integer wei from ${wallet.address ?? "the connected wallet"} on chain 61997. The app generated a unique mandate id.`
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
