"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDemoMode } from "@/lib/demo/DemoMode";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useAdapter } from "./useAdapter";
import { useContractReady } from "./useContractReady";

export function useLiveReadsEnabled() {
  const { demoMode } = useDemoMode();
  const ready = useContractReady();
  return !demoMode && ready;
}

export function useInvalidateChain() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: ["mandate"] });
    await client.invalidateQueries({ queryKey: ["mandates"] });
    await client.invalidateQueries({ queryKey: ["invoice"] });
    await client.invalidateQueries({ queryKey: ["invoices"] });
    await client.invalidateQueries({ queryKey: ["requests"] });
    await client.invalidateQueries({ queryKey: ["decision"] });
    await client.invalidateQueries({ queryKey: ["credits"] });
    await client.invalidateQueries({ queryKey: ["accounting"] });
    await client.invalidateQueries({ queryKey: ["activity"] });
    await client.refetchQueries({ type: "active" });
  };
}

export function useOwnerMandates(offset = 0) {
  const enabled = useLiveReadsEnabled();
  const { address, connectorId, chainId } = useWallet();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["mandates", "owner", address, offset, connectorId, chainId],
    enabled: enabled && Boolean(address),
    queryFn: async () => {
      const result = await adapter.listMandatesForOwner(address!, offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useAgentMandates(offset = 0) {
  const enabled = useLiveReadsEnabled();
  const { address, connectorId, chainId } = useWallet();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["mandates", "agent", address, offset, connectorId, chainId],
    enabled: enabled && Boolean(address),
    queryFn: async () => {
      const result = await adapter.listMandatesForAgent(address!, offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useMerchantMandates(offset = 0) {
  const enabled = useLiveReadsEnabled();
  const { address, connectorId, chainId } = useWallet();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["mandates", "merchant", address, offset, connectorId, chainId],
    enabled: enabled && Boolean(address),
    queryFn: async () => {
      const result = await adapter.listMandatesForMerchant(address!, offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useAgentRequests(offset = 0) {
  const enabled = useLiveReadsEnabled();
  const { address, connectorId, chainId } = useWallet();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["requests", "agent", address, offset, connectorId, chainId],
    enabled: enabled && Boolean(address),
    queryFn: async () => {
      const result = await adapter.listRequestsForAgent(address!, offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useMandateMerchantCredits(mandateId: string | undefined, merchants: string[] | undefined) {
  const enabled = useLiveReadsEnabled();
  const adapter = useAdapter();
  const key = (merchants ?? []).map((item) => item.toLowerCase()).join(",");
  return useQuery({
    queryKey: ["credits", "mandate", mandateId, key],
    enabled: enabled && Boolean(mandateId) && Boolean(merchants?.length),
    queryFn: async () => {
      const result = await adapter.getMandateMerchantCredits(mandateId!, merchants ?? []);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useMerchantCredits(offset = 0) {
  const enabled = useLiveReadsEnabled();
  const { address, connectorId, chainId } = useWallet();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["credits", address, offset, connectorId, chainId],
    enabled: enabled && Boolean(address),
    queryFn: async () => {
      const result = await adapter.getMerchantCredit(address!, offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useMerchantInvoices(offset = 0) {
  const enabled = useLiveReadsEnabled();
  const { address, connectorId, chainId } = useWallet();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["invoices", "merchant", address, offset, connectorId, chainId],
    enabled: enabled && Boolean(address),
    queryFn: async () => {
      const result = await adapter.listInvoicesForMerchant(address!, offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function usePublicActivity(offset = 0) {
  const enabled = useLiveReadsEnabled();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["activity", "public", offset],
    enabled,
    queryFn: async () => {
      const result = await adapter.listActivity(offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useAccounting() {
  const enabled = useLiveReadsEnabled();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["accounting"],
    enabled,
    queryFn: async () => {
      const result = await adapter.getAccounting();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useMandate(id: string | undefined) {
  const enabled = useLiveReadsEnabled();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["mandate", id],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const result = await adapter.getMandate(id!);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useMandateInvoices(id: string | undefined, offset = 0) {
  const enabled = useLiveReadsEnabled();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["invoices", "mandate", id, offset],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const result = await adapter.listInvoices(id, offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useMandateRequests(id: string | undefined, offset = 0) {
  const enabled = useLiveReadsEnabled();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["requests", "mandate", id, offset],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const result = await adapter.listRequestsForMandate(id!, offset);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useInvoice(id: string | undefined) {
  const enabled = useLiveReadsEnabled();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["invoice", id],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const result = await adapter.getInvoice(id!);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}

export function useDecision(id: string | undefined) {
  const enabled = useLiveReadsEnabled();
  const adapter = useAdapter();
  return useQuery({
    queryKey: ["decision", id],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const result = await adapter.getDecision(id!);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}
