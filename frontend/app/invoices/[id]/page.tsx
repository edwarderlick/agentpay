"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useDemoMode } from "@/lib/demo/DemoMode";
import { demoInvoices, demoMandates } from "@/lib/demo/data";
import { formatDate, formatGen, shortenHex } from "@/lib/format";
import { useInvoice, useMandate } from "@/lib/hooks/useChainQueries";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { demoMode } = useDemoMode();
  const invoiceQuery = useInvoice(demoMode ? undefined : id);
  const invoice = demoMode ? demoInvoices.find((i) => i.id === id) : invoiceQuery.data;
  const mandateQuery = useMandate(demoMode || !invoice ? undefined : invoice.mandateId);
  const mandate = demoMode
    ? demoMandates.find((m) => m.id === invoice?.mandateId)
    : mandateQuery.data;

  if (!demoMode && invoiceQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <LoadingState label="Loading invoice" />
      </div>
    );
  }

  if (!demoMode && invoiceQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <ErrorState body={(invoiceQuery.error as Error).message} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <EmptyState
          title="No invoice on chain"
          body={`No contract record for “${id}”.`}
          actionHref="/invoices/new"
          actionLabel="Draft an invoice"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
      <StatusBadge status={invoice.used ? "approved" : "pending"} label={invoice.used ? "Used in a request" : "Recorded invoice"} />
      <h1 className="mt-4 font-display text-4xl font-bold">{invoice.id}</h1>
      <p className="mt-3 max-w-2xl text-lg text-[#424843]">{invoice.purpose}</p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-[#e6e2d9] bg-white p-4">
          <dt className="font-mono text-[10px] uppercase text-[#424843]">Amount</dt>
          <dd className="font-display text-2xl font-bold">{formatGen(invoice.amount)}</dd>
        </div>
        <div className="border border-[#e6e2d9] bg-white p-4">
          <dt className="font-mono text-[10px] uppercase text-[#424843]">Merchant</dt>
          <dd className="font-mono">{shortenHex(invoice.merchant)}</dd>
        </div>
        <div className="border border-[#e6e2d9] bg-white p-4">
          <dt className="font-mono text-[10px] uppercase text-[#424843]">Issued</dt>
          <dd>{formatDate(invoice.issuedAt)}</dd>
        </div>
        <div className="border border-[#e6e2d9] bg-white p-4">
          <dt className="font-mono text-[10px] uppercase text-[#424843]">Mandate</dt>
          <dd>
            <Link className="underline" href={`/mandates/${invoice.mandateId}`}>
              {mandate?.title ?? invoice.mandateId}
            </Link>
          </dd>
        </div>
      </dl>
      {mandate && mandate.status !== "active" ? (
        <p className="mt-8 text-sm text-[#424843]">
          {mandate.status === "closed"
            ? "This mandate is closed on chain. New payment requests cannot be submitted."
            : mandate.status === "expired"
              ? "This mandate is expired on chain. New payment requests cannot be submitted."
              : "This mandate is not active on chain."}
        </p>
      ) : (
        <Link href={`/requests/new?mandate=${invoice.mandateId}&invoice=${invoice.id}`} className="mt-8 inline-flex bg-primary px-5 py-3 font-bold text-white">
          Agent: request payment →
        </Link>
      )}
    </div>
  );
}
