import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  hint,
  tone = "cream",
  index,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "cream" | "forest" | "canary" | "cyan" | "rose" | "lime";
  index?: string;
}) {
  const tones: Record<string, string> = {
    cream: "bg-[#f7f3ea] text-primary",
    forest: "bg-[#152a1e] text-[#fdf9f0]",
    canary: "bg-[#FED766] text-[#161f00]",
    cyan: "bg-[#7DE2D1] text-[#02150a]",
    rose: "bg-[#FFA6C9] text-[#02150a]",
    lime: "bg-[#D4F478] text-[#0c1300]",
  };

  return (
    <div className={cn("flex flex-col justify-between p-6", tones[tone])}>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] opacity-80">
          {label}
        </span>
        {index ? (
          <span className="font-mono text-[10px] font-bold opacity-70">{index}</span>
        ) : null}
      </div>
      <div className="font-display text-[40px] font-bold leading-[44px] tracking-tight md:text-[48px] md:leading-[52px]">
        {value}
      </div>
      {hint ? <p className="mt-2 text-[13px] leading-[18px] opacity-80">{hint}</p> : null}
    </div>
  );
}
