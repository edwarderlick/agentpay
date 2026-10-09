import Link from "next/link";
import { PRODUCT_BOUNDARY, STUDIO_NEXT, TEST_TOKEN_NOTICE } from "@/lib/constants";

const FLOW = [
  {
    n: "01",
    role: "Owner",
    title: "Fund a mandate",
    body: "Freeze purpose, agent, merchants, cap, budget, and expiry. Test GEN is locked in the contract.",
  },
  {
    n: "02",
    role: "Merchant",
    title: "Issue an invoice",
    body: "An allowlisted merchant posts amount and purpose. No funds move.",
  },
  {
    n: "03",
    role: "Agent",
    title: "Request payment",
    body: "Only the frozen agent can request payment against that invoice.",
  },
  {
    n: "04",
    role: "GenLayer",
    title: "Judge purpose",
    body: "Validators compare invoice text to the frozen mandate. APPROVED, DENIED, or UNCLEAR.",
  },
  {
    n: "05",
    role: "Merchant",
    title: "Withdraw credit",
    body: "Approval records credit. Native test GEN arrives only after a separate withdrawal.",
  },
];

export default function LandingPage() {
  return (
    <div>
      <section className="border-b border-[#e6e2d9] bg-[#fdf9f0]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-8 md:py-16 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a63500]">
              Agent spending on GenLayer
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-[36px] leading-[1.05] font-bold tracking-tight text-primary sm:text-5xl lg:text-[56px]">
              Fund an agent. Freeze the rules.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-7 text-[#424843]">
              The owner locks a funded mandate. A merchant invoices. The agent requests payment.
              GenLayer judges whether the purpose fits. The merchant then withdraws approved credit.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/mandates/new"
                className="inline-flex bg-[#d04400] px-6 py-3 font-display text-base font-bold text-white hover:bg-[#a63500]"
              >
                Create a mandate
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex border border-[#152a1e] bg-white px-6 py-3 font-display text-base font-semibold text-primary"
              >
                How it works
              </Link>
            </div>
          </div>
          <aside className="border border-[#152a1e] bg-[#152a1e] p-6 text-[#fdf9f0] lg:col-span-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#b4d25b]">
              Approval is not payout
            </p>
            <p className="mt-3 font-display text-2xl font-bold leading-snug">
              Credit is recorded first. Native test GEN moves only on withdraw.
            </p>
            <p className="mt-4 text-sm leading-6 text-[#e6e2d9]">{PRODUCT_BOUNDARY}</p>
            <p className="mt-6 font-mono text-[11px] text-[#7b9282]">{TEST_TOKEN_NOTICE}</p>
          </aside>
        </div>
      </section>

      <section className="bg-[#f7f3ea]">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
          <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a63500]">
                Sequence
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-primary">
                Owner to native withdrawal
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#424843]">
              Live balances and activity appear after a wallet is connected and the contract has records.
              This page does not invent telemetry.
            </p>
          </div>
          <ol className="grid grid-cols-1 gap-px bg-[#e6e2d9] sm:grid-cols-2 xl:grid-cols-5 [&>:last-child]:sm:col-span-2 [&>:last-child]:xl:col-span-1">
            {FLOW.map((step) => (
              <li key={step.n} className="bg-[#fdf9f0] p-5">
                <p className="font-mono text-[11px] text-[#a63500]">
                  {step.n} · {step.role}
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold text-primary">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#424843]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="border border-[#e6e2d9] bg-white p-7">
            <h2 className="font-display text-2xl font-bold text-primary">What the contract enforces</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#424843]">
              Wallets, remaining budget, per-payment cap, expiry, and invoice reuse are deterministic.
              Purpose fit is a GenLayer judgment. Denied and unclear requests create no merchant credit.
            </p>
            <Link href="/explore" className="mt-6 inline-block font-mono text-xs font-semibold underline">
              View public activity
            </Link>
          </article>
          <article className="bg-[#152a1e] p-7 text-[#fdf9f0]">
            <h2 className="font-display text-2xl font-bold">Studio Next only</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#e6e2d9]">
              Writes use Transaction Kit against chain {STUDIO_NEXT.chainId}. Connect any EIP-6963 injected
              wallet, or WalletConnect when a project ID is configured.
            </p>
            <Link href="/dashboard" className="mt-6 inline-block font-mono text-xs font-semibold text-[#b4d25b] underline">
              Open dashboard
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
