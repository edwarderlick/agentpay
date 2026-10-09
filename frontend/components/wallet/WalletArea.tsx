"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { formatGen, shortenHex } from "@/lib/format";
import { STUDIO_NEXT } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function formatWeiToGen(weiHex: string): string {
  try {
    const wei = BigInt(weiHex);
    const whole = wei / 10n ** 18n;
    const frac = wei % 10n ** 18n;
    const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
    return `${whole.toString()}.${fracStr}`;
  } catch {
    return "";
  }
}

export function WalletArea() {
  const wallet = useWallet();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!wallet.address || !wallet.isOnCorrectNetwork || !wallet.provider) {
        setBalance(null);
        return;
      }
      try {
        const wei = await wallet.provider.request({
          method: "eth_getBalance",
          params: [wallet.address, "latest"],
        });
        if (!cancelled) setBalance(formatWeiToGen(String(wei)));
      } catch {
        if (!cancelled) setBalance(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [wallet.address, wallet.isOnCorrectNetwork, wallet.provider, wallet.connectorId]);

  const connected = wallet.isConnected && wallet.address;

  return (
    <>
      {!connected ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-primary px-3 py-2 font-display text-sm font-bold text-white sm:px-4"
            onClick={() => {
              wallet.openChooser();
              void Promise.resolve(wallet.connectWallet()).catch(() => undefined);
            }}
          >
            {wallet.isLoading ? "Waiting for wallet" : "Connect wallet"}
          </button>
          {wallet.isLoading || wallet.discoveryError ? (
            <button
              type="button"
              className="px-2 py-1 font-mono text-[11px] underline"
              onClick={() => {
                if (wallet.discoveryError) {
                  void Promise.resolve(wallet.retryDiscovery()).catch(() => undefined);
                  return;
                }
                wallet.openChooser();
                void Promise.resolve(wallet.connectWallet()).catch(() => undefined);
              }}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          {!wallet.isOnCorrectNetwork ? (
            <button
              type="button"
              className="bg-[#d04400] px-2 py-2 font-mono text-[11px] font-bold text-white sm:px-3"
              onClick={() => void Promise.resolve(wallet.switchToStudioNext()).catch(() => undefined)}
            >
              Switch to {STUDIO_NEXT.chainId}
            </button>
          ) : (
            <span className="hidden border border-[#e6e2d9] bg-[#f7f3ea] px-2 py-1 font-mono text-[11px] font-semibold sm:inline">
              {balance ? formatGen(balance) : STUDIO_NEXT.symbol}
            </span>
          )}
          <button
            type="button"
            className="max-w-[9.5rem] truncate border border-[#e6e2d9] bg-white px-2 py-1 text-left font-mono text-[11px]"
            onClick={() => void Promise.resolve(wallet.switchWalletAccount()).catch(() => undefined)}
            title={wallet.walletName ? `${wallet.walletName} ${wallet.address ?? ""}` : wallet.address ?? undefined}
          >
            <span className="block truncate text-[10px] uppercase tracking-wider text-[#424843]">
              {wallet.walletName ?? "Wallet"}
            </span>
            <span>{shortenHex(wallet.address ?? "")}</span>
          </button>
          <button
            type="button"
            className="px-2 py-1 font-mono text-[11px] text-[#424843] underline"
            onClick={wallet.disconnectWallet}
          >
            Disconnect
          </button>
        </div>
      )}

      <Dialog open={wallet.chooserOpen} onOpenChange={(open) => (open ? wallet.openChooser() : wallet.closeChooser())}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none border border-[#152a1e] bg-[#fdf9f0] p-0 shadow-none sm:rounded-none">
          <DialogHeader className="border-b border-[#e6e2d9] px-5 py-4">
            <DialogTitle className="font-display text-xl font-bold normal-case tracking-tight text-primary">
              Connect a wallet
            </DialogTitle>
            <DialogDescription className="text-sm text-[#424843]">
              AgentPay uses the wallet you pick here for every signature. EVM injected wallets and WalletConnect
              (when configured) are supported. Non-EVM wallets are not.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-5 py-4">
            {wallet.options.length === 0 ? (
              <p className="text-sm text-[#424843]">
                No browser wallet detected. Install an EIP-6963 wallet such as MetaMask or Rabby, or configure
                WalletConnect for mobile QR.
              </p>
            ) : (
              wallet.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!option.ready}
                  className={cn(
                    "flex w-full items-center justify-between border border-[#e6e2d9] bg-white px-3 py-3 text-left",
                    option.ready ? "hover:border-primary" : "opacity-60",
                  )}
                  onClick={() => void Promise.resolve(wallet.connectWallet(option.id)).catch(() => undefined)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {option.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={option.icon} alt="" className="h-6 w-6" />
                    ) : (
                      <span className="h-6 w-6 bg-[#152a1e]" />
                    )}
                    <span>
                      <span className="block font-display text-sm font-semibold text-primary">{option.name}</span>
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-[#424843]">
                        {option.kind === "walletconnect"
                          ? "Mobile / QR"
                          : option.kind === "unavailable"
                            ? "Not configured"
                            : "Browser extension"}
                      </span>
                    </span>
                  </span>
                  {option.hint ? (
                    <span className="max-w-[10rem] text-right font-mono text-[10px] text-[#424843]">{option.hint}</span>
                  ) : null}
                </button>
              ))
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                className="font-mono text-[11px] underline"
                onClick={() => void Promise.resolve(wallet.retryDiscovery()).catch(() => undefined)}
              >
                Retry detection
              </button>
              {!wallet.walletConnectConfigured ? (
                <p className="font-mono text-[11px] text-[#424843]">
                  WalletConnect project ID is not set. Injected wallets still work.
                </p>
              ) : null}
              {wallet.discoveryError ? (
                <p className="font-mono text-[11px] text-[#ba1a1a]">{wallet.discoveryError}</p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
