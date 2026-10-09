import Link from "next/link";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="border border-[#e6e2d9] bg-[#f7f3ea] p-8 md:p-10">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
        No chain data
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary">
        {title}
      </h2>
      <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#424843]">{body}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-[#152a1e]"
        >
          {actionLabel} →
        </Link>
      ) : null}
    </div>
  );
}
