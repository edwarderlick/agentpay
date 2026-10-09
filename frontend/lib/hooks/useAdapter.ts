"use client";

import { useMemo } from "react";
import AgentPayAdapter from "@/lib/contract/adapter";
import { useWallet } from "@/lib/genlayer/WalletProvider";

export function useAdapter(): AgentPayAdapter {
  const wallet = useWallet();
  return useMemo(() => new AgentPayAdapter(wallet.address), [wallet.address]);
}
