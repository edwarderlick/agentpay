import { contractPendingMessage, isContractReady } from "@/lib/contract/adapter";
import { cn } from "@/lib/utils";

export function PendingWriteButton({
  children,
  className,
  onClick,
  disabled = false,
  disabledReason,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const ready = isContractReady();
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!ready || disabled}
        onClick={ready && !disabled ? onClick : undefined}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 bg-[#d04400] px-6 py-4 font-display text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-55",
          className,
        )}
      >
        {children}
      </button>
      {!ready ? (
        <p className="font-mono text-[11px] leading-4 text-[#424843]">
          {contractPendingMessage()}
        </p>
      ) : disabled && disabledReason ? (
        <p className="font-mono text-[11px] leading-4 text-[#424843]">{disabledReason}</p>
      ) : null}
    </div>
  );
}
