import Link from "next/link";

export function PastelCard({
  index,
  color,
  title,
  body,
  href,
  footer,
}: {
  index: string;
  color: string;
  title: string;
  body: string;
  href?: string;
  footer?: string;
}) {
  const inner = (
    <div
      className="flex min-h-[280px] flex-col justify-between p-7 text-primary"
      style={{ background: color }}
    >
      <div>
        <div className="mb-8 flex items-center justify-between">
          <span className="flex h-12 w-12 items-center justify-center bg-primary font-mono text-sm font-bold text-white">
            {index}
          </span>
        </div>
        <h3 className="font-display text-[22px] font-semibold leading-7">{title}</h3>
        <p className="mt-3 text-[15px] leading-6 text-primary/80">{body}</p>
      </div>
      {footer ? (
        <p className="pt-6 font-mono text-xs font-semibold">{footer} →</p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-ring">
        {inner}
      </Link>
    );
  }
  return inner;
}
