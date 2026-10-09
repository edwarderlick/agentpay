"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TransactionTimeline } from "@/components/shared/TransactionTimeline";
import { useDemoMode } from "@/lib/demo/DemoMode";
import { demoDecisions, demoInvoices, demoMandates } from "@/lib/demo/data";
import { useDecision, useInvoice, useMandate } from "@/lib/hooks/useChainQueries";

export default function DecisionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { demoMode } = useDemoMode();
  const decisionQuery = useDecision(demoMode ? undefined : id);
  const decision = demoMode ? demoDecisions.find((d) => d.id === id) : decisionQuery.data;
  const mandateQuery = useMandate(demoMode || !decision ? undefined : decision.mandateId);
  const invoiceQuery = useInvoice(demoMode || !decision ? undefined : decision.invoiceId);
  const mandate = demoMode
    ? demoMandates.find((m) => m.id === decision?.mandateId)
    : mandateQuery.data;
  const invoice = demoMode
    ? demoInvoices.find((i) => i.id === decision?.invoiceId)
    : invoiceQuery.data;

  if (!demoMode && decisionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <LoadingState label="Loading decision" />
      </div>
    );
  }

  if (!demoMode && decisionQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <ErrorState body={(decisionQuery.error as Error).message} />
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <EmptyState
          title="No decision on chain"
          body={`No validator decision record for “${id}”.`}
          actionHref="/explore"
          actionLabel="Open public explore"
        />
      </div>
    );
  }

  return (
    <div>
      <section className="bg-[#152a1e] px-4 py-12 text-[#fdf9f0] md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs uppercase tracking-widest text-[#b4d25b]">
            Merchant invoices & decision audit
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">
            Purpose-fit decision
          </h1>
          <div className="mt-4">
            <StatusBadge status={decision.outcome} />
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-2 md:px-8">
        <article className="border border-[#e6e2d9] bg-white p-6">
          <p className="font-mono text-[10px] uppercase text-[#424843]">Frozen mandate</p>
          <h2 className="mt-2 font-display text-xl font-bold">{mandate?.title ?? decision.mandateId}</h2>
          <blockquote className="mt-3 bg-[#f7f3ea] p-4 text-sm italic text-[#424843]">
            {mandate?.purpose ?? "Mandate text loads from chain when the record exists."}
          </blockquote>
          <Link href={`/mandates/${decision.mandateId}`} className="mt-3 inline-block font-mono text-xs underline">
            Mandate detail
          </Link>
        </article>
        <article className="border border-[#e6e2d9] bg-white p-6">
          <p className="font-mono text-[10px] uppercase text-[#424843]">Stated invoice purpose</p>
          <h2 className="mt-2 font-display text-xl font-bold">{invoice?.id ?? decision.invoiceId}</h2>
          <p className="mt-3 text-sm leading-6">{invoice?.purpose ?? "Invoice text unavailable."}</p>
        </article>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8 space-y-6">
        <div className="border border-[#e6e2d9] bg-white p-6">
          <h2 className="font-display text-xl font-bold">Rationale</h2>
          <p className="mt-3 text-[15px] leading-6 text-[#424843]">{decision.rationale}</p>
          {decision.outcome === "approved" ? (
            <p className="mt-4 text-sm">
              <StatusBadge status="approved" label="Approved — credit recorded" />
              <span className="ml-2 text-[#424843]">Paid requires a separate native withdrawal.</span>
            </p>
          ) : null}
          {decision.outcome === "denied" ? (
            <p className="mt-4 text-sm">
              <StatusBadge status="denied" label="Denied — no credit" />
            </p>
          ) : null}
          {decision.outcome === "unresolved" ? (
            <p className="mt-4 text-sm">
              <StatusBadge status="unresolved" label="UNCLEAR — unresolved, no credit" />
            </p>
          ) : null}
        </div>
        <TransactionTimeline tx={null} emptyLabel="Explorer link appears after a live request transaction id exists." />
        {decision.outcome === "approved" ? (
          <Link href="/credits" className="inline-flex bg-[#d04400] px-5 py-3 font-bold text-white">
            Merchant credits desk →
          </Link>
        ) : null}
      </section>
    </div>
  );
}
