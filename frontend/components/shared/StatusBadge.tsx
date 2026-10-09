import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  active: "bg-[#D4F478] text-[#0c1300]",
  expired: "bg-surface-highest text-on-surface-variant",
  closed: "bg-primary text-on-primary",
  approved: "bg-[#D4F478] text-[#0c1300]",
  paid: "bg-[#7DE2D1] text-[#02150a]",
  denied: "bg-error-container text-error",
  unresolved: "bg-[#FED766] text-[#161f00]",
  pending: "bg-[#FED766] text-[#161f00]",
  unknown: "bg-surface-container text-on-surface-variant",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const key = status.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]",
        styles[key] ?? styles.unknown,
      )}
    >
      {label ?? status}
    </span>
  );
}
