export function ErrorState({
  title = "Something failed",
  body,
  onRetry,
  retryLabel = "Retry on-chain read",
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      className="border border-[#ba1a1a] bg-[#ffdad6] p-6 text-[#93000a]"
      role="alert"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">Error</p>
      <h2 className="mt-1 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6">{body}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-4 bg-[#93000a] px-4 py-2 font-display text-sm font-bold text-white"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
