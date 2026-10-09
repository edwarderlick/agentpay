import Link from "next/link";
import { PRODUCT_BOUNDARY, STUDIO_NEXT, TEST_TOKEN_NOTICE } from "@/lib/constants";
import { explorerHomeUrl } from "@/lib/explorer";

const STEPS = [
  {
    n: "01",
    tag: "Treasury owner",
    title: "Owner freezes a mandate and funds test GEN",
    body: "The owner locks purpose text, an authorized agent wallet, approved merchant wallets, a per-payment cap, a total budget, and an expiry. After freeze, those fields are the rules.",
  },
  {
    n: "02",
    tag: "Approved merchant",
    title: "Merchant issues an invoice",
    body: "An approved merchant wallet posts an invoice: amount and a stated purpose. This records a claim. It does not move escrow.",
  },
  {
    n: "03",
    tag: "Authorized agent",
    title: "Agent requests payment for that invoice",
    body: "Only the authorized agent can request payment against a given invoice. The contract rejects the wrong caller, reuse, over-cap amounts, and expired mandates.",
  },
  {
    n: "04",
    tag: "GenLayer",
    title: "Validators judge purpose fit",
    body: "GenLayer compares the invoice’s stated purpose to the frozen mandate text. AgentPay does not certify that goods or services were delivered.",
  },
  {
    n: "05",
    tag: "Merchant credit",
    title: "Approved credit, then a separate withdrawal",
    body: "If the purpose fits and deterministic checks pass, the merchant receives recorded credit. Native test GEN arrives only after a later withdrawal transaction is accepted/finalized and finishes with a return.",
  },
];

export default function HowItWorksPage() {
  return (
    <div>
      <section className="bg-[#152a1e] px-4 py-14 text-[#fdf9f0] md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs uppercase tracking-widest text-[#b4d25b]">
            Execution workflow
          </p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold tracking-tight md:text-5xl">
            Mandate, invoice, judgment, payout
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-7 text-[#e6e2d9]">
            From frozen authorization to native withdrawal. {PRODUCT_BOUNDARY}
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl space-y-6 px-4 py-12 md:px-8">
        <ol className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {["Owner funds", "Merchant invoices", "Agent requests", "Chain judges", "Merchant withdraws"].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={i === 4 ? "bg-[#d04400] px-2.5 py-1 text-white" : "bg-primary px-2.5 py-1 text-white"}>
                {s}
              </span>
              {i < 4 ? <span className="text-[#c2c8c2]" aria-hidden>→</span> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 max-w-2xl text-sm text-[#424843]">
          Step five is native payout. An APPROVED decision is merchant credit, not a wallet transfer.
        </p>
        {STEPS.map((step) => (
          <article key={step.n} className="grid grid-cols-1 gap-6 border border-[#e6e2d9] bg-white p-6 md:p-8 lg:grid-cols-12">
            <div className="lg:col-span-1">
              <span className="flex h-12 w-12 items-center justify-center bg-primary font-display text-xl font-bold text-white">
                {step.n}
              </span>
            </div>
            <div className="lg:col-span-7">
              <p className="inline-block bg-[#f1eee5] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest">
                {step.tag}
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-primary">
                {step.title}
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-6 text-[#424843]">{step.body}</p>
            </div>
            <div className="bg-[#152a1e] p-5 text-[#fdf9f0] lg:col-span-4">
              <p className="font-mono text-[11px] text-[#b4d25b]">Architectural bound</p>
              <p className="mt-2 text-sm leading-6 text-[#e6e2d9]">
                UI validates form shape. The contract enforces wallets, amounts, remaining budget, expiry, and reuse.
              </p>
            </div>
          </article>
        ))}
      </section>
      <section className="bg-[#f7f3ea] px-4 py-12 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          <div className="border border-[#e6e2d9] bg-white p-6">
            <h3 className="font-display text-lg font-semibold">RPC</h3>
            <p className="mt-2 break-all font-mono text-xs">{STUDIO_NEXT.rpcUrl}</p>
          </div>
          <div className="border border-[#e6e2d9] bg-white p-6">
            <h3 className="font-display text-lg font-semibold">Explorer</h3>
            <a className="mt-2 block font-mono text-xs underline" href={explorerHomeUrl()} rel="noreferrer" target="_blank">
              {STUDIO_NEXT.explorerUrl}
            </a>
          </div>
          <div className="border border-[#e6e2d9] bg-white p-6">
            <h3 className="font-display text-lg font-semibold">Faucet</h3>
            <p className="mt-2 text-sm text-[#424843]">
              Request test GEN from Studio Next. {TEST_TOKEN_NOTICE}
            </p>
            <a className="mt-3 inline-block font-mono text-xs underline" href={STUDIO_NEXT.studioUrl} rel="noreferrer" target="_blank">
              Open Studio Next
            </a>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl">
          <Link href="/mandates/new" className="inline-flex bg-primary px-6 py-3 font-display font-bold text-white">
            Create a mandate →
          </Link>
        </div>
      </section>
    </div>
  );
}
