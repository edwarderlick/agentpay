"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { WalletProvider } from "@/lib/genlayer/WalletProvider";
import { DemoModeProvider } from "@/lib/demo/DemoMode";
import { ContractReadyProvider } from "@/lib/hooks/useContractReady";
import { chainReadRetryDelay, shouldRetryChainRead } from "@/lib/query/chainReadRetry";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2000,
            refetchOnWindowFocus: false,
            retry: shouldRetryChainRead,
            retryDelay: chainReadRetryDelay,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <DemoModeProvider>
          <ContractReadyProvider>{children}</ContractReadyProvider>
        </DemoModeProvider>
      </WalletProvider>
      <Toaster
        position="top-right"
        theme="light"
        closeButton
        offset="96px"
        toastOptions={{
          style: {
            background: "#fdf9f0",
            border: "1px solid #e6e2d9",
            color: "#1c1c17",
            borderRadius: 0,
          },
        }}
      />
    </QueryClientProvider>
  );
}
