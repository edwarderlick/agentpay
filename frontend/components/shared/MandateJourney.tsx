import type { JourneyStep } from "@/lib/contract/actions";

export function MandateJourney({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="border border-[#e6e2d9] bg-white p-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">Lifecycle</p>
      <p className="mt-1 text-sm text-[#424843]">
        On-chain facts come from contract reads. Transaction hashes and native delivery come from locally observed evidence.
      </p>
      <ol className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={`mt-0.5 h-3 w-3 shrink-0 ${
                step.state === "done"
                  ? "bg-[#d4f478]"
                  : step.state === "current"
                    ? "bg-[#d04400]"
                    : "border border-[#737973] bg-transparent"
              }`}
            />
            <div>
              <p className="font-display text-sm font-semibold">{step.label}</p>
              <p className="font-mono text-[11px] uppercase text-[#424843]">
                {step.state} · {step.source === "on-chain" ? "on-chain fact" : "local evidence"}
              </p>
              <p className="mt-1 text-sm text-[#424843]">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
