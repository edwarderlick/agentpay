"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { WalletArea } from "@/components/wallet/WalletArea";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { STUDIO_NEXT } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mandates/new", label: "Create" },
  { href: "/credits", label: "Credits" },
  { href: "/explore", label: "Explore" },
  { href: "/how-it-works", label: "How it works" },
];

const MOBILE_NAV = [
  ...NAV,
  { href: "/invoices/new", label: "Issue invoice" },
  { href: "/requests/new", label: "Request payment" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const wrongNetwork = wallet.isConnected && !wallet.isOnCorrectNetwork;

  return (
    <header className="sticky top-0 z-40 border-b border-[#e6e2d9] bg-[#fdf9f0]">
      <div className="flex items-center justify-between gap-3 border-b border-[#02150a] bg-[#152a1e] px-4 py-1.5 text-[11px] font-mono text-[#fdf9f0]">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 bg-[#b4d25b]" />
          <span className="truncate">{STUDIO_NEXT.chainName} · {STUDIO_NEXT.chainId}</span>
        </span>
        <span className="hidden truncate text-[#ffb59c] sm:inline">Test GEN has no monetary value</span>
      </div>
      {wrongNetwork ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#d04400] px-4 py-2 text-sm text-white">
          <p className="font-mono text-xs">
            {wallet.walletName ?? "Wallet"} is on another chain. Reads still work. Writes need {STUDIO_NEXT.chainName} ({STUDIO_NEXT.chainId}).
          </p>
          <button
            type="button"
            className="bg-white px-3 py-1 font-semibold text-[#a63500]"
            onClick={() => void Promise.resolve(wallet.switchToStudioNext()).catch(() => undefined)}
          >
            Switch network
          </button>
        </div>
      ) : null}
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-display text-[22px] font-bold tracking-tight text-primary">
            AgentPay
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#424843]">
            Studio Next mandates
          </span>
        </Link>
        <nav className="hidden items-center gap-5 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "py-2 text-[15px] whitespace-nowrap",
                  active
                    ? "border-b-2 border-primary font-bold text-primary"
                    : "text-[#424843] hover:text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <WalletArea />
          <button
            type="button"
            className="border border-[#e6e2d9] px-3 py-2 font-mono text-[11px] lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Open menu"
          >
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav className="grid gap-1 border-t border-[#e6e2d9] bg-[#f7f3ea] px-4 py-3 lg:hidden">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="py-2 text-sm font-semibold"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <DemoBanner />
    </header>
  );
}
