"use client";

import { useDemoMode } from "@/lib/demo/DemoMode";

export function DemoBanner() {
  const { demoMode, setDemoMode, ready } = useDemoMode();
  if (!ready || !demoMode) return null;

  return (
    <div className="z-30 bg-[#FED766] px-4 py-2 text-[#161f00]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
          DESIGN DEMO — NOT CHAIN DATA
        </p>
        <button
          type="button"
          className="border border-[#161f00] px-3 py-1 font-mono text-[11px] font-bold"
          onClick={() => setDemoMode(false)}
        >
          Exit demo
        </button>
      </div>
    </div>
  );
}
