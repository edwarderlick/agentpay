import type { FeeBreakdown as Fees } from "@/lib/contract/types";

export function FeeBreakdown({ fees }: { fees: Fees }) {
  const rows = [
    ["Deposit", fees.deposit],
    ["Consumed", fees.consumed],
    ["Refund", fees.refund],
  ] as const;

  return (
    <dl className="grid grid-cols-1 gap-px bg-[#e6e2d9] sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-[#fdf9f0] p-4">
          <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#424843]">
            {label}
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
