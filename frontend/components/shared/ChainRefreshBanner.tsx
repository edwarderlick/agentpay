export function ChainRefreshBanner({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="border border-[#e6e2d9] bg-[#f7f3ea] p-3" role="status" aria-live="polite">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#424843]">Rechecking on-chain state</p>
      <p className="mt-1 text-sm text-[#424843]">
        Fresh Studio Next reads are loading. Mandate status, remaining budget, credit, and withdrawn amounts come from the contract.
      </p>
    </div>
  );
}
