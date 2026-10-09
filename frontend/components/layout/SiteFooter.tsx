"use client";

import Link from "next/link";
import { STUDIO_NEXT, TEST_TOKEN_NOTICE } from "@/lib/constants";
import { explorerHomeUrl } from "@/lib/explorer";
import { useDemoMode } from "@/lib/demo/DemoMode";

export function SiteFooter() {
  const { demoMode, setDemoMode } = useDemoMode();

  return (
    <footer className="border-t border-[#152a1e] bg-[#02150a] pt-16 pb-12 text-[#fdf9f0]">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-[#152a1e] pb-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <h2 className="font-display text-4xl font-bold tracking-tight">
              Intelligent agent settlement
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-6 text-[#e6e2d9]">
              Freeze a mandate, let an approved merchant invoice, and let the authorized
              agent request payment. GenLayer judges purpose fit. The contract enforces
              wallets, amounts, budget, expiry, and reuse.
            </p>
            <p className="mt-6 inline-block border border-[#b4d25b]/30 px-3 py-1 font-mono text-[12px] text-[#b4d25b]">
              Studio Next · Chain ID {STUDIO_NEXT.chainId}
            </p>
          </div>
          <div className="space-y-3 md:col-span-2">
            <h3 className="font-mono text-[12px] font-semibold uppercase tracking-wider text-[#7b9282]">
              App
            </h3>
            <Link className="block text-sm hover:underline" href="/dashboard">Dashboard</Link>
            <Link className="block text-sm hover:underline" href="/mandates/new">Create mandate</Link>
            <Link className="block text-sm hover:underline" href="/explore">Explore</Link>
          </div>
          <div className="space-y-3 md:col-span-2">
            <h3 className="font-mono text-[12px] font-semibold uppercase tracking-wider text-[#7b9282]">
              Network
            </h3>
            <a className="block text-sm hover:underline" href={STUDIO_NEXT.studioUrl} rel="noreferrer" target="_blank">
              Studio Next
            </a>
            <a className="block text-sm hover:underline" href={explorerHomeUrl()} rel="noreferrer" target="_blank">
              Explorer
            </a>
            <a className="block text-sm hover:underline" href={STUDIO_NEXT.rpcUrl} rel="noreferrer" target="_blank">
              RPC endpoint
            </a>
          </div>
          <div className="space-y-3 md:col-span-3">
            <h3 className="font-mono text-[12px] font-semibold uppercase tracking-wider text-[#7b9282]">
              Design review
            </h3>
            <p className="text-sm text-[#e6e2d9]">
              Sample layouts from Stitch live behind demo mode. They are not chain data.
            </p>
            <button
              type="button"
              className="border border-[#7b9282] px-3 py-2 font-mono text-[11px]"
              onClick={() => setDemoMode(!demoMode)}
            >
              {demoMode ? "Exit design demo" : "Enter design demo"}
            </button>
          </div>
        </div>
        <p className="pt-8 font-mono text-[11px] text-[#7b9282]">{TEST_TOKEN_NOTICE}</p>
      </div>
    </footer>
  );
}
