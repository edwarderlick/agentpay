"use client";

import { useMemo } from "react";
import { createTransactionKit, type PolicyQuote, type SubmitInput, type TransactionKit } from "@genlayer/transaction-kit";
import { createClient } from "genlayer-js";
import type { MessageFeeAllocationInput } from "genlayer-js/types";
import { GENLAYER_CHAIN, GENLAYER_CHAIN_ID } from "./network";
import { createGuardedProvider } from "./eip1193";
import { useWallet } from "./WalletProvider";
import feeProfile from "../../fee-profile.json";

function emitsNativeTransfer(tx?: SubmitInput): tx is Extract<SubmitInput, { kind: "write" }> {
  return tx?.kind === "write" && (tx.method === "withdraw_credit" || tx.method === "close_mandate");
}

const APPEAL_ROUNDS = { low: 1n, standard: 3n, high: 5n } as const;

export function useTransactionKit(address?: string | null): TransactionKit | null {
  const wallet = useWallet();
  const account = address === undefined ? wallet.address : address;
  const provider = wallet.provider;

  return useMemo(() => {
    if (!provider || !account?.startsWith("0x")) {
      return null;
    }
    if (wallet.address && account.toLowerCase() !== wallet.address.toLowerCase()) {
      return null;
    }
    if (wallet.provider && provider !== wallet.provider) {
      return null;
    }

    const guarded = createGuardedProvider(provider, {
      address: account,
      chainId: GENLAYER_CHAIN_ID,
    });

    const base = createTransactionKit({
      chain: GENLAYER_CHAIN,
      provider: guarded,
      account: account as `0x${string}`,
      suggestions: feeProfile,
    });

    // RC2 quotes message fees, but its submit path omits messageAllocations.
    // Studio Next rejects an emit_transfer without that allocation tree.
    const sdk = createClient({
      chain: GENLAYER_CHAIN,
      provider: guarded,
      account: account as `0x${string}`,
    });
    const allocationsByQuote = new WeakMap<PolicyQuote, {
      tx: string;
      allocations: MessageFeeAllocationInput[];
    }>();

    return {
      ...base,
      async estimate(input, tx) {
        if (!emitsNativeTransfer(tx)) return base.estimate(input, tx);
        const appealRounds = input.overrides?.appealRounds ?? APPEAL_ROUNDS[input.preset ?? "standard"];
        const rotations = input.overrides?.rotations ?? Array.from(
          { length: Number(appealRounds) + 1 },
          () => 1n,
        );
        const simulation = await sdk.estimateTransactionFeesForWrite({
          address: tx.address,
          functionName: tx.method,
          args: (tx.args ?? []) as never,
          account: { address: account as `0x${string}`, type: "json-rpc" },
          value: input.userValue ?? 0n,
          leaderTimeunitsAllocation: 125n,
          validatorTimeunitsAllocation: 250n,
          appealRounds,
          rotations,
        });
        const allocations = simulation.messageAllocations;
        if (!allocations?.length) {
          throw new Error("Studio Next did not return a native-transfer fee allocation. No transaction was submitted.");
        }
        const quote = await base.estimate({
          ...input,
          overrides: { ...input.overrides, ...simulation.distribution },
        }, tx);
        const required = allocations.reduce((sum, item) => sum + BigInt(item.budget ?? 0), 0n);
        if (quote.distribution.totalMessageFees < required || quote.feeValue < simulation.feeValue) {
          throw new Error("The payout fee quote is below Studio Next's simulated requirement. Re-estimate before signing.");
        }
        allocationsByQuote.set(quote, { tx: JSON.stringify(tx), allocations });
        return quote;
      },
      async submit(quote, tx) {
        if (!emitsNativeTransfer(tx)) return base.submit(quote, tx);
        const prepared = allocationsByQuote.get(quote);
        if (!prepared || prepared.tx !== JSON.stringify(tx)) {
          throw new Error("The native-transfer fee allocation is missing or stale. Re-estimate before signing.");
        }
        const genlayerTxId = await sdk.writeContract({
          address: tx.address,
          functionName: tx.method,
          args: (tx.args ?? []) as never,
          value: quote.userValue,
          fees: {
            distribution: quote.distribution,
            feeValue: quote.feeValue,
            messageAllocations: prepared.allocations,
          },
        });
        return { genlayerTxId: genlayerTxId as `0x${string}` };
      },
    } satisfies TransactionKit;
  }, [provider, account, wallet.connectorId, wallet.chainId]);
}
