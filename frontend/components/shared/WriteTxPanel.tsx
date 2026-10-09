"use client";

import { useMemo } from "react";
import {
  GenLayerTransactionPanel,
  type SubmitInput,
  type TrackedStatus,
} from "@genlayer/transaction-kit-react";
import { useTransactionKit } from "@/lib/genlayer/kit";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { getConfiguredContractAddress, isContractReady } from "@/lib/contract/adapter";
import { STUDIO_NEXT } from "@/lib/constants";
import type { PreparedWrite } from "@/lib/contract/types";

export function WriteTxPanel({
  prepared,
  onDone,
  trackUntil = "finalized",
}: {
  prepared: PreparedWrite;
  onDone?: (status: TrackedStatus) => void;
  trackUntil?: "decided" | "finalized";
}) {
  const wallet = useWallet();
  const kit = useTransactionKit(wallet.address);
  const address = getConfiguredContractAddress() as `0x${string}`;

  const tx = useMemo<SubmitInput>(
    () => ({
      kind: "write",
      address,
      method: prepared.method,
      args: prepared.args,
    }),
    [address, prepared.method, prepared.args],
  );

  if (!isContractReady()) {
    return (
      <p className="font-mono text-[11px] text-[#424843]">
        Connect a dedicated product contract address before submitting.
      </p>
    );
  }

  if (!wallet.isConnected || !wallet.address) {
    return <p className="text-sm text-[#424843]">Connect a wallet on Studio Next to continue.</p>;
  }

  if (!wallet.isOnCorrectNetwork) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#424843]">
          This wallet can read public data. Writes require {STUDIO_NEXT.chainName} (chain {STUDIO_NEXT.chainId}).
        </p>
        <button
          type="button"
          className="bg-[#d04400] px-4 py-2 font-bold text-white"
          onClick={() => void Promise.resolve(wallet.switchToStudioNext()).catch(() => undefined)}
        >
          Switch network
        </button>
      </div>
    );
  }

  if (!wallet.canWrite || !kit) {
    return (
      <p className="text-sm text-[#424843]">
        The selected wallet is not ready to sign. Reconnect it, then submit through the same wallet shown in the header.
      </p>
    );
  }

  return (
    <div className="gltk-light border border-[#e6e2d9] bg-white p-3">
      <GenLayerTransactionPanel
        kit={kit}
        tx={tx}
        userValue={prepared.userValue}
        network={STUDIO_NEXT.chainName}
        theme="light"
        trackUntil={trackUntil}
        onDone={onDone}
      />
    </div>
  );
}
