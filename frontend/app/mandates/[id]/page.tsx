"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChainRefreshBanner } from "@/components/shared/ChainRefreshBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { MandateJourney } from "@/components/shared/MandateJourney";
import { PageControls } from "@/components/shared/PageControls";
import { PendingWriteButton } from "@/components/shared/PendingWrite";
import { PayoutHistory } from "@/components/shared/PayoutHistory";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WriteDialog } from "@/components/shared/WriteDialog";
import { PAGE, isContractReady } from "@/lib/contract/adapter";
import {
  buildMandateJourney,
  closedRefundCopy,
  closeRefundPreview,
  evaluateWriteGate,
  gateFromFreshRead,
  nextActionForRole,
  remainingCreditWei,
  roleForMandate,
} from "@/lib/contract/actions";
import { findPayout, listPayouts } from "@/lib/contract/delivery";
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
import { useDemoMode } from "@/lib/demo/DemoMode";
import { demoCredits, demoInvoices, demoMandates } from "@/lib/demo/data";
import { formatDate, formatGen, shortenHex } from "@/lib/format";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useAdapter } from "@/lib/hooks/useAdapter";
import {
  useInvalidateChain,
  useMandate,
  useMandateInvoices,
  useMandateMerchantCredits,
  useMandateRequests,
} from "@/lib/hooks/useChainQueries";
import type { PreparedWrite } from "@/lib/contract/types";

export default function MandateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { demoMode } = useDemoMode();
  const wallet = useWallet();
  const adapter = useAdapter();
  const invalidate = useInvalidateChain();
  const [closeOpen, setCloseOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedWrite | null>(null);
  const [payoutTick, setPayoutTick] = useState(0);
  const [invoiceOffset, setInvoiceOffset] = useState(0);
  const [requestOffset, setRequestOffset] = useState(0);
  const [writeFlight, setWriteFlight] = useState<WriteFlight>("idle");
  const [recheckError, setRecheckError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const mandateQuery = useMandate(demoMode ? undefined : id);
  const invoicesQuery = useMandateInvoices(demoMode ? undefined : id, invoiceOffset);
  const requestsQuery = useMandateRequests(demoMode ? undefined : id, requestOffset);

  const mandate = demoMode ? demoMandates.find((m) => m.id === id) : mandateQuery.data;
  const invoices = demoMode ? demoInvoices.filter((i) => i.mandateId === id) : (invoicesQuery.data?.items ?? []);
  const requests = demoMode ? [] : (requestsQuery.data?.items ?? []);
  const creditsQuery = useMandateMerchantCredits(demoMode ? undefined : mandate?.id, mandate?.merchants);
  const creditsReady = demoMode || creditsQuery.isSuccess;
  const connectedCredit = useMemo(() => {
    if (demoMode) return demoCredits.find((c) => c.mandateId === id) ?? null;
    if (!creditsQuery.isSuccess) return null;
    const rows = creditsQuery.data ?? [];
    if (wallet.address) {
      const mine = rows.find((row) => row.merchant.toLowerCase() === wallet.address!.toLowerCase());
      if (mine) return mine;
    }
    return rows[0] ?? null;
  }, [creditsQuery.data, creditsQuery.isSuccess, demoMode, id, wallet.address]);

  const refunds = useMemo(() => listPayouts(id, "refund"), [id, payoutTick]);
  const withdrawals = useMemo(() => listPayouts(id, "withdraw"), [id, payoutTick]);
  const refund = useMemo(() => findPayout(id, "refund"), [id, payoutTick]);
  const busy = opening || isWriteBusy(writeFlight);

  useEffect(() => {
    setCloseOpen(false);
    setPrepared(null);
    setRecheckError(null);
    setWriteFlight("idle");
    setOpening(false);
  }, [wallet.address]);

  useEffect(() => {
    if (demoMode || !wallet.address || !isContractReady()) return;
    void resumePayouts(wallet.address).then(() => setPayoutTick((n) => n + 1));
  }, [demoMode, wallet.address]);

  if (!demoMode && mandateQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <LoadingState label="Loading mandate" />
      </div>
    );
  }

  if (!demoMode && mandateQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <ErrorState body={(mandateQuery.error as Error).message} />
      </div>
    );
  }

  if (!mandate) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <EmptyState
          title="No mandate on chain"
          body={`There is no deployed contract record for “${id}”. Enable design demo to inspect the layout with sample fields.`}
          actionHref="/mandates/new"
          actionLabel="Draft a mandate"
        />
      </div>
    );
  }

  const current = mandate;
  const role = roleForMandate(current, wallet.address);
  const remaining = BigInt(current.remainingBudget || "0");
  const creditLeft = remainingCreditWei(connectedCredit);
  const walletGate = {
    address: wallet.address,
    chainOk: wallet.isOnCorrectNetwork,
    canWrite: wallet.canWrite,
    chainId: wallet.chainId,
  };
  const closeGate = evaluateWriteGate({
    action: "close",
    mandate: current,
    wallet: walletGate,
    remainingCreditWei: creditLeft,
    writeBusy: busy,
  });
  const invoiceGate = evaluateWriteGate({
    action: "invoice",
    mandate: current,
    wallet: walletGate,
    writeBusy: busy,
  });
  const requestGate = evaluateWriteGate({
    action: "request",
    mandate: current,
    wallet: walletGate,
    writeBusy: busy,
  });
  const withdrawGate = evaluateWriteGate({
    action: "withdraw",
    mandate: current,
    wallet: walletGate,
    remainingCreditWei: creditLeft,
    writeBusy: busy,
  });
  const next = nextActionForRole({
    mandate: current,
    role,
    remainingCreditWei: creditLeft,
    wallet: walletGate,
  });
  const journey = buildMandateJourney({
    mandate: current,
    invoices,
    decisions: requests,
    credit: connectedCredit,
    withdrawals,
    refund,
  });
  const closedCopy = closedRefundCopy({ remainingBudget: current.remainingBudget, refund });
  const refreshing =
    !demoMode &&
    ((mandateQuery.isFetching && !mandateQuery.isLoading) ||
      (invoicesQuery.isFetching && !invoicesQuery.isLoading) ||
      (requestsQuery.isFetching && !requestsQuery.isLoading) ||
      (creditsQuery.isFetching && !creditsQuery.isLoading));
  const recovery = writeRecoveryText({ flight: writeFlight, errorMessage: recheckError });

  async function openClose() {
    if (busy || current.status === "closed") return;
    setOpening(true);
    setWriteFlight("preparing");
    setRecheckError(null);
    try {
      const fresh = demoMode
        ? { ok: true as const, data: current }
        : await adapter.getMandate(current.id);
      const gated = gateFromFreshRead({
        action: "close",
        cached: current,
        fresh: fresh.ok ? fresh.data : null,
        wallet: walletGate,
        remainingCreditWei: creditLeft,
        writeBusy: false,
      });
      if (!gated.allowed || !fresh.ok || !fresh.data) {
        setRecheckError(gated.reason);
        setWriteFlight("idle");
        return;
      }
      const live = fresh.data;
      const result = adapter.prepareCloseMandate(live.id);
      if (!result.ok) {
        setRecheckError(result.message);
        setWriteFlight("idle");
        return;
      }
      const refundWei = BigInt(live.remainingBudget || "0");
      if (wallet.address && refundWei > 0n) {
        const snap = await snapshotBalances(wallet.address);
        startPayout({
          kind: "refund",
          mandateId: live.id,
          recipient: wallet.address,
          amountWei: refundWei,
          contractBefore: snap.contractBefore,
          recipientBefore: snap.recipientBefore,
        });
        setPayoutTick((n) => n + 1);
      }
      setPrepared(result.data);
      setWriteFlight("awaiting_signature");
      setCloseOpen(true);
    } catch (error) {
      setRecheckError(error instanceof Error ? error.message : "On-chain recheck failed.");
      setWriteFlight("idle");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div>
      <section className="bg-[#152a1e] px-4 py-12 text-[#fdf9f0] md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={mandate.status} label={mandate.status === "closed" ? "CLOSED" : mandate.status} />
            <span className="font-mono text-xs">{mandate.id}</span>
            {role !== "observer" ? (
              <span className="font-mono text-[10px] uppercase text-[#b4d25b]">{role}</span>
            ) : null}
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            {mandate.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-7 text-[#e6e2d9]">{mandate.purpose}</p>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="bg-white/5 p-4">
              <p className="font-mono text-[10px] uppercase text-[#7b9282]">Remaining</p>
              <p className="font-display text-2xl font-bold">{formatGen(mandate.remainingBudget)}</p>
            </div>
            <div className="bg-white/5 p-4">
              <p className="font-mono text-[10px] uppercase text-[#7b9282]">Budget</p>
              <p className="font-display text-2xl font-bold">{formatGen(mandate.totalBudget)}</p>
            </div>
            <div className="bg-white/5 p-4">
              <p className="font-mono text-[10px] uppercase text-[#7b9282]">Per-payment cap</p>
              <p className="font-display text-2xl font-bold">{formatGen(mandate.perPaymentCap)}</p>
            </div>
            <div className="bg-white/5 p-4">
              <p className="font-mono text-[10px] uppercase text-[#7b9282]">Expiry</p>
              <p className="font-display text-lg font-bold">{formatDate(mandate.expiry)}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-12 md:px-8">
        <div className="lg:col-span-8 space-y-6">
          <ChainRefreshBanner active={refreshing} />
          {recovery ? <p className="border border-[#e6e2d9] bg-[#f7f3ea] p-3 text-sm text-[#424843]">{recovery}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-[#e6e2d9] bg-white p-5">
              <p className="font-mono text-[10px] uppercase text-[#424843]">Owner</p>
              <p className="mt-1 font-mono text-sm">{shortenHex(mandate.owner)}</p>
            </div>
            <div className="border border-[#e6e2d9] bg-white p-5">
              <p className="font-mono text-[10px] uppercase text-[#424843]">Authorized agent</p>
              <p className="mt-1 font-mono text-sm">{shortenHex(mandate.agent)}</p>
            </div>
          </div>
          <div className="border border-[#e6e2d9] bg-white p-5">
            <p className="font-mono text-[10px] uppercase text-[#424843]">Approved merchants</p>
            <ul className="mt-2 space-y-1 font-mono text-sm">
              {mandate.merchants.map((m) => (
                <li key={m}>{shortenHex(m)}</li>
              ))}
            </ul>
          </div>
          {!demoMode && creditsQuery.isLoading ? <LoadingState label="Loading merchant credit" /> : null}
          {!demoMode && creditsQuery.isError ? (
            <ErrorState
              title="Merchant credit unavailable"
              body={`${(creditsQuery.error as Error).message} This is not zero credit. Retry the on-chain read.`}
              onRetry={() => void creditsQuery.refetch()}
            />
          ) : null}
          {connectedCredit ? (
            <div className="border border-[#e6e2d9] bg-white p-5">
              <p className="font-mono text-[10px] uppercase text-[#424843]">Merchant credit (on-chain)</p>
              <p className="mt-2 text-sm text-[#424843]">
                Approved {formatGen(connectedCredit.approvedCredit)} · Withdrawn {formatGen(connectedCredit.withdrawn)} · Remaining {formatGen(creditLeft.toString())}
              </p>
            </div>
          ) : creditsReady && !creditsQuery.isLoading && !creditsQuery.isError ? (
            <div className="border border-[#e6e2d9] bg-white p-5">
              <p className="font-mono text-[10px] uppercase text-[#424843]">Merchant credit (on-chain)</p>
              <p className="mt-2 text-sm text-[#424843]">No merchant credit row is recorded for this mandate.</p>
            </div>
          ) : null}
          <MandateJourney steps={journey} />
          <div>
            <h2 className="font-display text-2xl font-bold">Invoices against this mandate</h2>
            {!demoMode && invoicesQuery.isLoading ? <LoadingState label="Loading invoices" /> : null}
            {invoices.length === 0 && (demoMode || invoicesQuery.isSuccess) ? (
              <p className="mt-3 text-sm text-[#424843]">None recorded.</p>
            ) : invoices.length === 0 ? null : (
              <ul className="mt-4 space-y-3">
                {invoices.map((inv) => (
                  <li key={inv.id} className="border border-[#e6e2d9] bg-white p-4">
                    <Link href={`/invoices/${inv.id}`} className="font-display font-semibold underline">
                      {inv.id}
                    </Link>
                    <p className="text-sm text-[#424843]">{formatGen(inv.amount)} · {inv.purpose}</p>
                  </li>
                ))}
              </ul>
            )}
            {!demoMode && invoicesQuery.data ? (
              <PageControls
                offset={invoiceOffset}
                limit={PAGE}
                total={invoicesQuery.data.total}
                hasMore={invoicesQuery.data.hasMore}
                onPrev={() => setInvoiceOffset(Math.max(0, invoiceOffset - PAGE))}
                onNext={() => setInvoiceOffset(invoiceOffset + PAGE)}
                label="Invoices"
              />
            ) : null}
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">Payment requests</h2>
            {!demoMode && requestsQuery.isLoading ? <LoadingState label="Loading payment requests" /> : null}
            {requests.length === 0 && (demoMode || requestsQuery.isSuccess) ? (
              <p className="mt-3 text-sm text-[#424843]">None recorded.</p>
            ) : requests.length === 0 ? null : (
              <ul className="mt-4 space-y-3">
                {requests.map((req) => (
                  <li key={req.id} className="border border-[#e6e2d9] bg-white p-4">
                    <StatusBadge status={req.outcome} />
                    <Link href={`/decisions/${req.id}`} className="ml-2 font-mono text-xs underline">
                      {req.id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {!demoMode && requestsQuery.data ? (
              <PageControls
                offset={requestOffset}
                limit={PAGE}
                total={requestsQuery.data.total}
                hasMore={requestsQuery.data.hasMore}
                onPrev={() => setRequestOffset(Math.max(0, requestOffset - PAGE))}
                onNext={() => setRequestOffset(requestOffset + PAGE)}
                label="Requests"
              />
            ) : null}
          </div>
          <PayoutHistory kind="withdraw" records={withdrawals} onChainWithdrawnWei={connectedCredit?.withdrawn} />
          <PayoutHistory kind="refund" records={refunds} />
        </div>
        <aside className="lg:col-span-4 space-y-4">
          <div className="border border-[#e6e2d9] bg-[#f7f3ea] p-5">
            <p className="font-mono text-[10px] uppercase text-[#424843]">Next valid action</p>
            <p className="mt-2 font-display text-lg font-bold">{next.label}</p>
            <p className="mt-1 text-sm text-[#424843]">{next.detail}</p>
          </div>
          {current.status === "closed" ? (
            <div className="bg-[#152a1e] p-6 text-[#fdf9f0]">
              <h3 className="font-display text-xl font-bold">Mandate closed</h3>
              <p className="mt-2 text-sm text-[#e6e2d9]">{closedCopy.headline}</p>
              <p className="mt-2 text-sm text-[#e6e2d9]">{closedCopy.body}</p>
              <p className="mt-3 font-mono text-[11px] text-[#7b9282]">
                Remaining budget {formatGen(current.remainingBudget)}. Close refunds only uncommitted budget.
              </p>
            </div>
          ) : (
            <div className="bg-[#a63500] p-6 text-white">
              <h3 className="font-display text-xl font-bold">Close mandate</h3>
              <p className="mt-2 text-sm text-[#ffdbcf]">{closeRefundPreview(current.remainingBudget)}</p>
              <p className="mt-2 text-sm text-[#ffdbcf]">
                Paid requires native delivery, not a parent receipt. Remaining to refund before signing: {formatGen(remaining.toString())}.
              </p>
              <div className="mt-4">
                <PendingWriteButton
                  disabled={!closeGate.allowed}
                  disabledReason={closeGate.allowed ? undefined : closeGate.reason}
                  onClick={() => void openClose()}
                >
                  {closeGate.buttonLabel}
                </PendingWriteButton>
              </div>
            </div>
          )}
          {invoiceGate.allowed ? (
            <Link href={`/invoices/new?mandate=${mandate.id}`} className="block bg-[#f7f3ea] p-4 font-semibold underline">
              Issue invoice against this mandate
            </Link>
          ) : (
            <div className="border border-[#e6e2d9] bg-white p-4">
              <p className="font-display font-semibold">Issue invoice</p>
              <p className="mt-1 text-sm text-[#424843]">{invoiceGate.reason}</p>
            </div>
          )}
          {requestGate.allowed ? (
            <Link href={`/requests/new?mandate=${mandate.id}`} className="block bg-[#f7f3ea] p-4 font-semibold underline">
              Request payment against this mandate
            </Link>
          ) : (
            <div className="border border-[#e6e2d9] bg-white p-4">
              <p className="font-display font-semibold">Request payment</p>
              <p className="mt-1 text-sm text-[#424843]">{requestGate.reason}</p>
            </div>
          )}
          {role === "merchant" ? (
            withdrawGate.allowed ? (
              <Link href="/credits" className="block bg-[#f7f3ea] p-4 font-semibold underline">
                Withdraw remaining credit
              </Link>
            ) : (
              <div className="border border-[#e6e2d9] bg-white p-4">
                <p className="font-display font-semibold">{withdrawGate.buttonLabel}</p>
                <p className="mt-1 text-sm text-[#424843]">{withdrawGate.reason}</p>
              </div>
            )
          ) : null}
        </aside>
      </section>
      <WriteDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close mandate"
        description={`${closeRefundPreview(current.remainingBudget)} Transaction Kit will quote fees, ask the owner wallet to sign, then track close_mandate.`}
        prepared={prepared}
        onFlightChange={setWriteFlight}
        onRetryRefresh={invalidate}
        onDone={async (status) => {
          const existing = findPayout(mandate.id, "refund", wallet.address ?? undefined);
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
