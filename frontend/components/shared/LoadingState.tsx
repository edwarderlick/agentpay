export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="border border-[#e6e2d9] bg-white p-8" role="status" aria-live="polite">
      <div className="h-2 w-24 bg-[#d4f478]" />
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.08em] text-[#424843]">
        {label}
      </p>
    </div>
  );
}
