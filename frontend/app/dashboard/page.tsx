"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { MetricTile } from "@/components/shared/MetricTile";
import { PageControls } from "@/components/shared/PageControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TransactionTimeline } from "@/components/shared/TransactionTimeline";
import { PAGE, isContractReady } from "@/lib/contract/adapter";
import { deliveryLabel, loadScopedPayouts, phaseFromRecord, type PayoutRecord } from "@/lib/contract/delivery";
import { resumePayouts } from "@/lib/contract/payout";
import { useDemoMode } from "@/lib/demo/DemoMode";
import { demoActivity, demoCredits, demoMandates, demoRequests, DEMO_IDS } from "@/lib/demo/data";
import { remainingCreditWei } from "@/lib/contract/actions";
import { formatGen, shortenHex } from "@/lib/format";
import { explorerHomeUrl } from "@/lib/explorer";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import {
  useAccounting,
  useAgentMandates,
  useAgentRequests,
  useMerchantCredits,
  useOwnerMandates,
} from "@/lib/hooks/useChainQueries";

const TABS = ["owned", "agent", "merchant", "transactions"] as const;

export default function DashboardPage() {
  const { demoMode } = useDemoMode();
  const wallet = useWallet();
  const [tab, setTab] = useState<(typeof TABS)[number]>("owned");
  const [ownedOffset, setOwnedOffset] = useState(0);
  const [agentMandateOffset, setAgentMandateOffset] = useState(0);
  const [agentRequestOffset, setAgentRequestOffset] = useState(0);
  const [creditOffset, setCreditOffset] = useState(0);
  const ready = isContractReady();
  const owned = useOwnerMandates(ownedOffset);
  const agentMandates = useAgentMandates(agentMandateOffset);
  const agentRequests = useAgentRequests(agentRequestOffset);
  const creditsQuery = useMerchantCredits(creditOffset);
  const accounting = useAccounting();

  const mandates = demoMode ? demoMandates : (owned.data?.items ?? []);
  const requestCount = demoMode ? demoRequests.length : (agentRequests.data?.total ?? 0);
  const credits = demoMode ? demoCredits : (creditsQuery.data?.items ?? []);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  useEffect(() => {
    setTab("owned");
    setOwnedOffset(0);
    setAgentMandateOffset(0);
    setAgentRequestOffset(0);
    setCreditOffset(0);
  }, [wallet.address]);

  useEffect(() => {
    const address = wallet.address ?? undefined;
    if (!address || !ready) {
      setPayouts(loadScopedPayouts());
      return;
    }
    void resumePayouts(address).then(() => setPayouts(loadScopedPayouts(address)));
  }, [tab, wallet.address, ready]);

  return (
    <div>
      <section className="border-b border-[#e6e2d9] bg-white px-4 py-10 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl space-y-3">
              <p className="inline-flex bg-[#ece8df] px-3 py-1 font-mono text-[10px] uppercase tracking-widest">
                Owner · Agent · Merchant
              </p>
              <h1 className="font-display text-4xl font-bold tracking-tight text-primary md:text-5xl">
                Dashboard
              </h1>
              <p className="max-w-2xl text-lg leading-7 text-[#424843]">
                Mandates, invoices, payment requests, and merchant credits on GenLayer Studio Next.
                {wallet.address
                  ? ` Connected as ${shortenHex(wallet.address)}.`
                  : " Connect a wallet to load role-scoped records."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/mandates/new" className="bg-[#d04400] px-6 py-3.5 font-display font-bold text-white">
                Create a mandate →
              </Link>
              <a href={explorerHomeUrl()} className="bg-[#f7f3ea] px-5 py-3.5 font-display font-semibold" rel="noreferrer" target="_blank">
                Public explorer
              </a>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              tone="forest"
              index="01"
              label="Escrow allocation"
              value={
                demoMode
                  ? "500.00"
                  : accounting.data?.contractBalance !== undefined
                    ? formatGen(accounting.data.contractBalance)
                    : "—"
              }
              hint={demoMode ? "Design sample, not chain data" : ready ? "Contract native balance" : "Set the product address"}
            />
            <MetricTile
              tone="canary"
              index="02"
              label="Requests in flight"
              value={String(requestCount)}
              hint="Agent payment requests"
            />
            <MetricTile
              tone="cyan"
              index="03"
              label="Merchant credit"
              value={demoMode ? formatGen(credits[0]?.approvedCredit) : credits[0] ? formatGen(credits[0].approvedCredit) : "—"}
              hint="Approved is not paid"
            />
            <MetricTile
              tone="cream"
              index="04"
              label="Guarded mandates"
              value={String(demoMode ? mandates.length : owned.data?.total ?? mandates.length)}
              hint={demoMode ? "Sample mandate" : "Owned by connected wallet"}
            />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className="flex flex-col justify-between gap-4 border-b border-[#e6e2d9] pb-4 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold text-primary">Workspace</h2>
            <p className="text-sm text-[#424843]">Switch roles without mixing settlement states.</p>
          </div>
          <div className="flex flex-wrap bg-[#ece8df] p-1">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-3.5 py-1.5 font-mono text-xs ${tab === id ? "bg-white font-bold text-primary" : "text-[#424843]"}`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            {tab === "owned" && owned.isLoading && !demoMode ? <LoadingState label="Loading owner mandates" /> : null}
            {tab === "owned" && owned.isError ? <ErrorState body={(owned.error as Error).message} /> : null}
            {tab === "owned" && mandates.length === 0 && !owned.isLoading ? (
              <EmptyState
                title="No mandates for this wallet"
                body="Mandates owned by the connected Studio Next address list here."
                actionHref="/mandates/new"
                actionLabel="Create a mandate"
              />
            ) : null}
            {tab === "owned" &&
              mandates.map((m) => (
                <article key={m.id} className="border border-[#e6e2d9] bg-white p-6 md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={m.status} />
                        <span className="font-mono text-[11px] text-[#424843]">{m.id}</span>
                      </div>
                      <h3 className="mt-2 font-display text-xl font-bold">{m.title}</h3>
                      <p className="mt-2 max-w-xl text-sm text-[#424843]">{m.purpose}</p>
                    </div>
                    <div className="bg-[#f7f3ea] p-4 text-right">
                      <p className="font-mono text-[10px] uppercase text-[#424843]">Remaining</p>
                      <p className="font-display text-2xl font-bold">{formatGen(m.remainingBudget)}</p>
                      <p className="font-mono text-[11px] text-[#424843]">of {formatGen(m.totalBudget)}</p>
                      {m.status === "closed" ? (
                        <p className="mt-2 font-mono text-[11px] text-[#424843]">Closed on chain. Uncommitted budget already refunded or zero.</p>
                      ) : null}
                    </div>
                  </div>
                  <Link href={`/mandates/${m.id}`} className="mt-4 inline-flex font-mono text-xs underline">
                    Open mandate
                  </Link>
                </article>
              ))}
            {tab === "owned" && !demoMode && owned.data ? (
              <PageControls
                offset={ownedOffset}
                limit={PAGE}
                total={owned.data.total}
                hasMore={owned.data.hasMore}
                onPrev={() => setOwnedOffset(Math.max(0, ownedOffset - PAGE))}
                onNext={() => setOwnedOffset(ownedOffset + PAGE)}
                label="Owned mandates"
              />
            ) : null}
            {tab === "agent" && agentRequests.isLoading && !demoMode ? <LoadingState label="Loading agent requests" /> : null}
            {tab === "agent" && requestCount === 0 && (demoMode || !(agentMandates.data?.items.length)) && !agentRequests.isLoading ? (
              <EmptyState
                title="No agent requests"
                body="Payment requests from the authorized agent wallet appear here."
                actionHref="/requests/new"
                actionLabel="Open request form"
              />
            ) : null}
            {tab === "agent" &&
              !demoMode &&
              (agentMandates.data?.items ?? []).map((m) => (
                <article key={m.id} className="border border-[#e6e2d9] bg-white p-6">
                  <StatusBadge status={m.status} />
                  <h3 className="mt-2 font-display text-lg font-semibold">{m.title}</h3>
                  <p className="font-mono text-[11px]">{m.id}</p>
                  <Link href={`/mandates/${m.id}`} className="mt-3 inline-block font-mono text-xs underline">
                    Open mandate
                  </Link>
                </article>
              ))}
            {tab === "agent" && !demoMode && agentMandates.data ? (
              <PageControls
                offset={agentMandateOffset}
                limit={PAGE}
                total={agentMandates.data.total}
                hasMore={agentMandates.data.hasMore}
                onPrev={() => setAgentMandateOffset(Math.max(0, agentMandateOffset - PAGE))}
                onNext={() => setAgentMandateOffset(agentMandateOffset + PAGE)}
                label="Agent mandates"
              />
            ) : null}
            {tab === "agent" &&
              demoMode &&
              demoRequests.map((r) => (
                <article key={r.id} className="border border-[#e6e2d9] bg-white p-6">
                  <p className="font-mono text-[11px]">{r.id}</p>
                  <p className="mt-2 font-display text-lg font-semibold">{formatGen(r.amount)}</p>
                  <Link href={`/decisions/${DEMO_IDS.decisionApproved}`} className="mt-3 inline-block font-mono text-xs underline">
                    Decision
                  </Link>
                </article>
              ))}
            {tab === "agent" &&
              !demoMode &&
              (agentRequests.data?.items ?? []).map((r) => (
                <article key={r.id} className="border border-[#e6e2d9] bg-white p-6">
                  <p className="font-mono text-[11px]">{r.id}</p>
                  <div className="mt-2"><StatusBadge status={r.outcome} /></div>
                  <Link href={`/decisions/${r.id}`} className="mt-3 inline-block font-mono text-xs underline">
                    Decision
                  </Link>
                </article>
              ))}
            {tab === "agent" && !demoMode && agentRequests.data ? (
              <PageControls
                offset={agentRequestOffset}
                limit={PAGE}
                total={agentRequests.data.total}
                hasMore={agentRequests.data.hasMore}
                onPrev={() => setAgentRequestOffset(Math.max(0, agentRequestOffset - PAGE))}
                onNext={() => setAgentRequestOffset(agentRequestOffset + PAGE)}
                label="Agent requests"
              />
            ) : null}
            {tab === "merchant" && creditsQuery.isLoading && !demoMode ? <LoadingState label="Loading merchant credit" /> : null}
            {tab === "merchant" && credits.length === 0 && !creditsQuery.isLoading ? (
              <EmptyState
                title="No merchant credit"
                body="Approved means credit recorded. Paid means a separately confirmed native withdrawal."
                actionHref="/credits"
                actionLabel="Open credits"
              />
            ) : null}
            {tab === "merchant" &&
              credits.map((c) => {
                const remaining = remainingCreditWei(c);
                return (
                  <article key={c.mandateId} className="border border-[#e6e2d9] bg-white p-6">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status="approved" label="Approved credit" />
                      {remaining === 0n ? (
                        <StatusBadge status="closed" label="Fully withdrawn" />
                      ) : (
                        <StatusBadge status="unresolved" label="Credit still withdrawable" />
                      )}
                    </div>
                    <p className="mt-3 font-display text-2xl font-bold">{formatGen(c.approvedCredit)}</p>
                    <p className="font-mono text-xs text-[#424843]">
                      Withdrawn on chain {formatGen(c.withdrawn)} · Remaining {formatGen(remaining.toString())}
                    </p>
                    <p className="mt-2 text-sm text-[#424843]">
                      A zero remaining credit balance is not paid. Native delivery is confirmed only from a locally observed hash with transfer evidence.
                    </p>
                    <Link href="/credits" className="mt-3 inline-block font-mono text-xs underline">
                      Credits desk
                    </Link>
                  </article>
                );
              })}
            {tab === "merchant" && !demoMode && creditsQuery.data ? (
              <PageControls
                offset={creditOffset}
                limit={PAGE}
                total={creditsQuery.data.total}
                hasMore={creditsQuery.data.hasMore}
                onPrev={() => setCreditOffset(Math.max(0, creditOffset - PAGE))}
                onNext={() => setCreditOffset(creditOffset + PAGE)}
                label="Merchant credits"
              />
            ) : null}
            {tab === "transactions" ? (
              demoMode ? (
                <TransactionTimeline tx={demoActivity[0]} emptyLabel="No AgentPay transactions." />
              ) : payouts.length === 0 ? (
                <TransactionTimeline tx={null} emptyLabel="No withdrawal or refund tracked yet. Explorer links appear after a transaction id exists." />
              ) : (
                <ul className="space-y-3">
                  {payouts.map((p) => (
                    <li key={p.id} className="border border-[#e6e2d9] bg-white p-4">
                      <p className="font-mono text-[11px]">{p.kind} · {p.mandateId} · {formatGen(p.amountWei)}</p>
                      <p className="text-sm">{deliveryLabel(phaseFromRecord(0n, p))}</p>
                      {p.txHash ? <p className="font-mono text-[11px] text-[#424843]">{p.txHash}</p> : null}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
          <aside className="space-y-4 lg:col-span-4">
            <div className="bg-[#152a1e] p-6 text-[#fdf9f0]">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#b4d25b]">Next actions</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link className="underline" href="/invoices/new">Issue invoice</Link></li>
                <li><Link className="underline" href="/requests/new">Request payment</Link></li>
                <li><Link className="underline" href={demoMode ? `/decisions/${DEMO_IDS.decisionApproved}` : "/explore"}>Decision / explore</Link></li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
