"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageControls } from "@/components/shared/PageControls";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useDemoMode } from "@/lib/demo/DemoMode";
import { demoDecisions, demoInvoices, demoMandates } from "@/lib/demo/data";
import { formatGen } from "@/lib/format";
import { STUDIO_NEXT } from "@/lib/constants";
import { explorerHomeUrl } from "@/lib/explorer";
import { PAGE, isContractReady } from "@/lib/contract/adapter";
import { usePublicActivity } from "@/lib/hooks/useChainQueries";

export default function ExplorePage() {
  const { demoMode } = useDemoMode();
  const [offset, setOffset] = useState(0);
  const activity = usePublicActivity(offset);
  const items = demoMode ? demoDecisions : (activity.data?.items ?? []);

  return (
    <div>
      <section className="border-b border-[#e6e2d9] bg-white px-4 py-10 md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">
            Public ledger · Chain {STUDIO_NEXT.chainId}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-primary md:text-5xl">
            Explore activity
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-[#424843]">
            Public purpose-fit decisions. Explorer links open only when a real transaction id exists.
          </p>
          <a className="mt-4 inline-block font-mono text-xs underline" href={explorerHomeUrl()} rel="noreferrer" target="_blank">
            Open Studio Dev explorer
          </a>
        </div>
      </section>
      <section className="mx-auto max-w-7xl space-y-4 px-4 py-10 md:px-8">
        {!demoMode && activity.isLoading ? <LoadingState label="Loading public activity" /> : null}
        {!demoMode && activity.isError ? <ErrorState body={(activity.error as Error).message} /> : null}
        {items.length === 0 && !activity.isLoading ? (
          <EmptyState
            title="No public activity"
            body={
              isContractReady()
                ? "When payment requests are judged on Studio Next, they list here."
                : "Connect the dedicated product contract to load public requests."
            }
          />
        ) : (
          items.map((d) => {
            const mandate = demoMode ? demoMandates.find((m) => m.id === d.mandateId) : undefined;
            const invoice = demoMode ? demoInvoices.find((i) => i.id === d.invoiceId) : undefined;
            return (
              <article key={d.id} className="border border-[#e6e2d9] bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <StatusBadge status={d.outcome} />
                    <h2 className="mt-2 font-display text-xl font-bold">{mandate?.title ?? d.mandateId}</h2>
                    <p className="mt-2 max-w-xl text-sm text-[#424843]">{invoice?.purpose ?? d.rationale}</p>
                  </div>
                  <p className="font-display text-2xl font-bold">
                    {invoice ? formatGen(invoice.amount) : d.id}
                  </p>
                </div>
                <Link href={`/decisions/${d.id}`} className="mt-4 inline-block font-mono text-xs underline">
                  Decision detail
                </Link>
              </article>
            );
          })
        )}
        {!demoMode && activity.data ? (
          <PageControls
            offset={offset}
            limit={PAGE}
            total={activity.data.total}
            hasMore={activity.data.hasMore}
            onPrev={() => setOffset(Math.max(0, offset - PAGE))}
            onNext={() => setOffset(offset + PAGE)}
            label="Public requests"
          />
        ) : null}
      </section>
    </div>
  );
}
