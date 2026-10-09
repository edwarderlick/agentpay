"use client";

export function PageControls({
  offset,
  limit,
  total,
  hasMore,
  onPrev,
  onNext,
  label = "Page",
}: {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  label?: string;
}) {
  if (total === 0 && !hasMore && offset === 0) return null;
  const page = Math.floor(offset / Math.max(limit, 1)) + 1;
  const last = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-[#e6e2d9] bg-white px-4 py-3">
      <p className="font-mono text-[11px] text-[#424843]">
        {label} {page} of {last} · {total} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="border border-[#e6e2d9] px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          onClick={onPrev}
          disabled={offset <= 0}
          aria-label="Previous page"
        >
          Previous
        </button>
        <button
          type="button"
          className="border border-[#e6e2d9] px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          onClick={onNext}
          disabled={!hasMore}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
