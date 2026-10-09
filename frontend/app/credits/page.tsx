"use client";

import { useEffect, useMemo, useState } from "react";
import { ChainRefreshBanner } from "@/components/shared/ChainRefreshBanner";
import { DeliveryStatus } from "@/components/shared/DeliveryStatus";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { MetricTile } from "@/components/shared/MetricTile";
import { PageControls } from "@/components/shared/PageControls";
import { PendingWriteButton } from "@/components/shared/PendingWrite";
import { PayoutHistory } from "@/components/shared/PayoutHistory";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WriteDialog } from "@/components/shared/WriteDialog";
import { PAGE, isContractReady } from "@/lib/contract/adapter";
import { evaluateWriteGate, gateFromFreshRead, onChainWithdrawnCopy, remainingCreditWei, recheckWithdrawReads } from "@/lib/contract/actions";
import { listPayouts, phaseFromRecord } from "@/lib/contract/delivery";
import {
  confirmPayoutDelivery,
  executionOkFromStatus,
  markPayoutSubmitted,
  resumePayouts,
  snapshotBalances,
  startPayout,
  txHashFromStatus,
} from "@/lib/contract/payout";
import { isWriteBusy, writeRecoveryText, type WriteFlight } from "@/lib/contract/writeRecovery";
import type { PreparedWrite } from "@/lib/contract/types";
import { parseGenToWei } from "@/lib/wei";
import { useDemoMode } from "@/lib/demo/DemoMode";
import { DEMO_IDS, demoCredits, demoMandates } from "@/lib/demo/data";
import { formatGen } from "@/lib/format";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useAdapter } from "@/lib/hooks/useAdapter";
import { useInvalidateChain, useMerchantCredits } from "@/lib/hooks/useChainQueries";
import { validateWithdrawal } from "@/lib/validation";

export default function CreditsPage() {
  const { demoMode } = useDemoMode();
  const wallet = useWallet();
  const adapter = useAdapter();
  const invalidate = useInvalidateChain();
  const [offset, setOffset] = useState(0);
  const creditsQuery = useMerchantCredits(offset);
  const credits = demoMode ? demoCredits : (creditsQuery.data?.items ?? []);
  const [selected, setSelected] = useState(demoMode ? DEMO_IDS.mandate : "");
  const selectedCredit = credits.find((c) => c.mandateId === selected) ?? credits[0];
  const availableWei = selectedCredit ? remainingCreditWei(selectedCredit) : null;
  const [amount, setAmount] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedWrite | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [payoutTick, setPayoutTick] = useState(0);
  const [writeFlight, setWriteFlight] = useState<WriteFlight>("idle");
  const [opening, setOpening] = useState(false);
  const errors = useMemo(() => validateWithdrawal({ amount }, availableWei), [amount, availableWei]);
  const records = selectedCredit ? listPayouts(selectedCredit.mandateId, "withdraw", wallet.address ?? undefined) : [];
  const record = records[0] ?? null;
  const phase = phaseFromRecord(availableWei ?? 0n, record);
  const busy = opening || isWriteBusy(writeFlight);
  const demoMandate = demoMode ? demoMandates[0] : null;

  const walletGate = {
    address: wallet.address,
    chainOk: wallet.isOnCorrectNetwork,
    canWrite: wallet.canWrite,
    chainId: wallet.chainId,
  };
  const withdrawGate = evaluateWriteGate({
    action: "withdraw",
    mandate: demoMandate ?? {
      status: "active",
      remainingBudget: "0",
      owner: "0x0000000000000000000000000000000000000000",
      agent: "0x0000000000000000000000000000000000000000",
      merchants: wallet.address ? [wallet.address as `0x${string}`] : [],
    },
    wallet: walletGate,
    remainingCreditWei: availableWei ?? 0n,
    writeBusy: busy,
  });

  useEffect(() => {
    setSelected(demoMode ? DEMO_IDS.mandate : "");
    setAmount("");
    setAttempted(false);
    setOpen(false);
    setPrepared(null);
    setPrepareError(null);
    setWriteFlight("idle");
    setOpening(false);
  }, [wallet.address, demoMode]);

  useEffect(() => {
    if (demoMode || !wallet.address || !isContractReady()) return;
    void resumePayouts(wallet.address).then(() => setPayoutTick((n) => n + 1));
  }, [demoMode, wallet.address]);

  useEffect(() => {
    if (!selected && selectedCredit) setSelected(selectedCredit.mandateId);
  }, [selected, selectedCredit]);

  async function submit() {
    setAttempted(true);
    if (busy || Object.keys(errors).length !== 0 || !selectedCredit || !wallet.address) return;
    setOpening(true);
    setWriteFlight("preparing");
    setPrepareError(null);
    try {
      const freshCredit = demoMode
        ? { ok: true as const, data: selectedCredit }
        : await adapter.getMerchantCreditRow(selectedCredit.mandateId, wallet.address);
      const freshMandate = demoMode
        ? { ok: true as const, data: demoMandate }
        : await adapter.getMandate(selectedCredit.mandateId);
      const rechecked = recheckWithdrawReads({ mandate: freshMandate, credit: freshCredit });
      if (!rechecked.ok) {
        setPrepareError(rechecked.reason);
        setWriteFlight("idle");
        return;
      }
      const remaining = rechecked.remainingCreditWei;
      const gated = gateFromFreshRead({
        action: "withdraw",
        cached: rechecked.mandate,
        fresh: rechecked.mandate,
        wallet: walletGate,
        freshRemainingCreditWei: remaining,
        writeBusy: false,
      });
      if (!gated.allowed) {
        setPrepareError(gated.reason);
        setWriteFlight("idle");
        return;
      }
      const wei = parseGenToWei(amount);
      if (!wei || wei > remaining) {
        setPrepareError("Rechecked credit cannot cover this withdrawal. Remaining credit on chain is " + formatGen(remaining.toString()) + ".");
        setWriteFlight("idle");
        return;
      }
      const result = adapter.prepareWithdrawCredit({
        mandateId: selectedCredit.mandateId,
        amount,
      });
      if (!result.ok) {
        setPrepareError(result.message);
        setWriteFlight("idle");
        return;
      }
      const snap = await snapshotBalances(wallet.address);
      startPayout({
        kind: "withdraw",
        mandateId: selectedCredit.mandateId,
        recipient: wallet.address,
        amountWei: wei,
        contractBefore: snap.contractBefore,
        recipientBefore: snap.recipientBefore,
      });
      setPayoutTick((n) => n + 1);
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

  const refreshing = !demoMode && creditsQuery.isFetching && !creditsQuery.isLoading;
  const recovery = writeRecoveryText({ flight: writeFlight, errorMessage: prepareError });

  return (
    <div>
      <section className="bg-[#152a1e] px-4 py-12 text-[#fdf9f0] md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs uppercase tracking-widest text-[#b4d25b]">Merchant credits</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Approved credit and native withdrawal
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#e6e2d9]">
            Approved means merchant credit recorded. Paid means a separately confirmed native
            withdrawal. A finalized parent or a zero credit balance is not paid.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricTile
              tone="lime"
              label="Approved credit"
              value={selectedCredit ? formatGen(selectedCredit.approvedCredit) : "—"}
            />
            <MetricTile
              tone="canary"
              label="Withdrawn"
              value={selectedCredit ? formatGen(selectedCredit.withdrawn) : "—"}
            />
            <MetricTile
              tone="cyan"
              label="Remaining credit"
              value={availableWei === null ? "—" : formatGen(availableWei.toString())}
            />
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-12 md:px-8">
        <div className="lg:col-span-7 space-y-6">
          <ChainRefreshBanner active={refreshing} />
          {!demoMode && creditsQuery.isLoading ? <LoadingState label="Loading credits" /> : null}
          {!demoMode && creditsQuery.isError ? (
            <ErrorState
              title="Merchant credit unavailable"
              body={`${(creditsQuery.error as Error).message} This is not zero credit. Retry the on-chain read.`}
              onRetry={() => void creditsQuery.refetch()}
            />
          ) : null}
          {credits.length === 0 && !creditsQuery.isLoading && (demoMode || creditsQuery.isSuccess) ? (
            <EmptyState
              title="No merchant credit"
              body="When a purpose-fit decision records credit, it will list here. Withdrawal is a later write."
              actionHref="/explore"
              actionLabel="View public activity"
            />
          ) : credits.length === 0 ? null : (
            credits.map((c) => {
              const remaining = remainingCreditWei(c);
              const rowRecords = listPayouts(c.mandateId, "withdraw", wallet.address ?? undefined);
              const rowRecord = rowRecords[0] ?? null;
              const rowPhase = phaseFromRecord(remaining, rowRecord);
              return (
                <article key={c.mandateId} className="border border-[#e6e2d9] bg-white p-6">
                  <button
                    type="button"
                    className="font-mono text-xs underline"
                    onClick={() => setSelected(c.mandateId)}
                  >
                    Select {c.mandateId}
                  </button>
                  <p className="mt-2 text-sm text-[#424843]">
                    Approved {formatGen(c.approvedCredit)} · {onChainWithdrawnCopy(c.withdrawn)} · Remaining {formatGen(remaining.toString())}
                  </p>
                  {remaining <= 0n ? (
                    <div className="mt-2">
                      <StatusBadge status="closed" label="Fully withdrawn" />
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <DeliveryStatus phase={rowPhase} record={rowRecord} creditWei={remaining} />
                  </div>
                  <div className="mt-3">
                    <PayoutHistory kind="withdraw" records={rowRecords} onChainWithdrawnWei={c.withdrawn} />
                  </div>
                </article>
              );
            })
          )}
          {!demoMode && creditsQuery.data ? (
            <PageControls
              offset={offset}
              limit={PAGE}
              total={creditsQuery.data.total}
              hasMore={creditsQuery.data.hasMore}
              onPrev={() => setOffset(Math.max(0, offset - PAGE))}
              onNext={() => setOffset(offset + PAGE)}
              label="Credits"
            />
          ) : null}
        </div>
        <aside className="lg:col-span-5 border border-[#e6e2d9] bg-white p-6 space-y-4">
          <h2 className="font-display text-xl font-bold">Withdraw native test GEN</h2>
          <p className="text-sm text-[#424843]">
            Closing a mandate refunds uncommitted budget only and does not erase merchant credit.
          </p>
          <label className="block">
            <span className="font-display text-sm font-bold">Amount</span>
            <input
              className="mt-2 w-full bg-[#f1eee5] p-4 font-mono disabled:opacity-55"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              disabled={!withdrawGate.allowed}
            />
            {attempted && errors.amount ? <p className="mt-1 text-sm text-[#ba1a1a]">{errors.amount}</p> : null}
          </label>
          <p className="text-sm text-[#424843]">
            Mandate {selectedCredit?.mandateId ?? "—"} · Remaining {availableWei === null ? "—" : formatGen(availableWei.toString())}.
          </p>
          {recovery ? <p className="text-sm text-[#424843]">{recovery}</p> : null}
          {prepareError ? (
            <ErrorState
              title="On-chain recheck failed"
              body={prepareError}
            />
          ) : null}
          <PendingWriteButton
            disabled={!withdrawGate.allowed}
            disabledReason={withdrawGate.allowed ? undefined : withdrawGate.reason}
            onClick={() => void submit()}
          >
            {withdrawGate.buttonLabel}
          </PendingWriteButton>
          {selectedCredit ? (
            <DeliveryStatus
              key={`${payoutTick}-${record?.id ?? "none"}`}
              phase={phase}
              record={record}
              creditWei={availableWei ?? 0n}
            />
          ) : (
            <StatusBadge status="unresolved" label="No credit selected" />
          )}
        </aside>
      </section>
      <WriteDialog
        open={open}
        onOpenChange={setOpen}
        title="Withdraw credit"
        description="Fee quote, wallet approval, submit, then tracking. Paid is shown only after the contract native balance falls and the merchant native balance rises, with a matching outbound transfer."
        prepared={prepared}
        onFlightChange={setWriteFlight}
        onRetryRefresh={invalidate}
        onDone={async (status) => {
          if (!selectedCredit || !wallet.address) {
            await invalidate();
            return;
          }
          const existing = listPayouts(selectedCredit.mandateId, "withdraw", wallet.address).find((item) => !item.txHash) ??
            listPayouts(selectedCredit.mandateId, "withdraw", wallet.address)[0];
          if (existing) {
            const submitted = markPayoutSubmitted(existing, txHashFromStatus(status));
            setPayoutTick((n) => n + 1);
            if (status.phase === "finalized") {
              void confirmPayoutDelivery(submitted, {
                finalized: true,
                executionOk: executionOkFromStatus(status),
              }).then(
                () => setPayoutTick((n) => n + 1),
                () => setPayoutTick((n) => n + 1),
              );
            }
          }
          await invalidate();
        }}
      />
    </div>
  );
}
