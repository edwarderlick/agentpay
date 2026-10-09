"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TrackedStatus } from "@genlayer/transaction-kit-react";
import { getConfiguredContractAddress } from "@/lib/contract/config";
import {
  OPEN_CREATED_RECORD_LABEL,
  RETRY_VERIFICATION_LABEL,
  VERIFICATION_PENDING_TITLE,
  archiveCreatedWrite,
  commitCreatedWrite,
  createdWriteAbandonCopy,
  createdWriteBlocksPrepare,
  createdWriteKeepsLock,
  createdWriteLockReason,
  createdWritePendingCopy,
  createdWriteRecoveringReason,
  createdWriteScope,
  loadCreatedWrite,
  persistCreatedWrite,
  sessionOwnsCreatedWrite,
  verifyCreatedWrite,
  type CreatedRecordKind,
  type CreatedWrite,
  type CreatedWriteScope,
  type CreatedWriteVerifyReason,
} from "@/lib/contract/createdWrite";
import type { PreparedWrite } from "@/lib/contract/types";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { useInvalidateChain } from "@/lib/hooks/useChainQueries";

export function useCreatedWriteRecovery(kind: CreatedRecordKind) {
  const router = useRouter();
  const invalidate = useInvalidateChain();
  const wallet = useWallet();
  const currentScope = createdWriteScope({
    wallet: wallet.address,
    chainId: wallet.chainId,
    contractAddress: getConfiguredContractAddress(),
  });

  const liveScopeRef = useRef<CreatedWriteScope | null>(currentScope);
  const kindRef = useRef(kind);
  liveScopeRef.current = currentScope;
  kindRef.current = kind;

  const [created, setCreated] = useState<CreatedWrite | null>(null);
  const [recovering, setRecovering] = useState(() => {
    const stored = loadCreatedWrite(kind, currentScope);
    return sessionOwnsCreatedWrite(stored, currentScope, kind);
  });
  const [pendingReason, setPendingReason] = useState<CreatedWriteVerifyReason | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const createdRef = useRef<CreatedWrite | null>(null);
  const recoveryTargetRef = useRef<CreatedWrite | null>(null);
  const generationRef = useRef(0);

  const bumpGeneration = useCallback(() => {
    generationRef.current += 1;
    return generationRef.current;
  }, []);

  const liveOwns = useCallback((record: CreatedWrite | null | undefined) => {
    return sessionOwnsCreatedWrite(record, liveScopeRef.current, kindRef.current);
  }, []);

  const clearClaim = useCallback(() => {
    createdRef.current = null;
    recoveryTargetRef.current = null;
    setCreated(null);
    setPendingReason(null);
    setPendingTxHash(null);
    setRecovering(false);
  }, []);

  const applyVerified = useCallback(
    (
      stored: CreatedWrite,
      verified: Awaited<ReturnType<typeof verifyCreatedWrite>>,
      generation: number,
    ) => {
      if (generationRef.current !== generation) return;
      if (!liveOwns(stored)) return;
      if (verified.ok) {
        createdRef.current = stored;
        recoveryTargetRef.current = stored;
        setCreated(stored);
        setPendingReason(null);
        setPendingTxHash(null);
        setRecovering(false);
        return;
      }
      createdRef.current = null;
      setCreated(null);
      if (!createdWriteKeepsLock(verified.reason)) {
        archiveCreatedWrite(stored);
        setPendingReason(null);
        setPendingTxHash(null);
        setRecovering(false);
        return;
      }
      setPendingReason(verified.reason);
      setPendingTxHash(stored.txHash);
      setRecovering(false);
    },
    [liveOwns],
  );

  const verifyStored = useCallback(
    async (stored: CreatedWrite, generation: number) => {
      const verified = await verifyCreatedWrite(stored);
      if (generationRef.current !== generation) return;
      if (!liveOwns(stored)) return;
      applyVerified(stored, verified, generation);
    },
    [applyVerified, liveOwns],
  );

  const onReachCreatedRecord = useCallback(() => {
    const record = sessionOwnsCreatedWrite(createdRef.current, currentScope, kind)
      ? createdRef.current
      : loadCreatedWrite(kind, currentScope);
    if (!sessionOwnsCreatedWrite(record, currentScope, kind) || !record) return;
    archiveCreatedWrite(record);
    if (liveOwns(record)) clearClaim();
  }, [clearClaim, currentScope, kind, liveOwns]);

  const onAbandonRecovery = useCallback(() => {
    const record = sessionOwnsCreatedWrite(createdRef.current, currentScope, kind)
      ? createdRef.current
      : loadCreatedWrite(kind, currentScope);
    if (!sessionOwnsCreatedWrite(record, currentScope, kind) || !record) return;
    archiveCreatedWrite(record);
    if (liveOwns(record)) clearClaim();
  }, [clearClaim, currentScope, kind, liveOwns]);

  const onRetryVerification = useCallback(async () => {
    const stored = recoveryTargetRef.current ?? loadCreatedWrite(kind, liveScopeRef.current);
    if (!liveOwns(stored) || !stored) return;
    const generation = bumpGeneration();
    setRecovering(true);
    await verifyStored(stored, generation);
  }, [bumpGeneration, kind, liveOwns, verifyStored]);

  useEffect(() => {
    const generation = bumpGeneration();
    const stored = loadCreatedWrite(kind, currentScope);
    if (!sessionOwnsCreatedWrite(stored, currentScope, kind)) {
      clearClaim();
      return () => {
        bumpGeneration();
      };
    }
    recoveryTargetRef.current = stored;
    setRecovering(true);
    void verifyStored(stored, generation);
    return () => {
      bumpGeneration();
    };
  }, [
    kind,
    currentScope?.wallet,
    currentScope?.chainId,
    currentScope?.contractAddress,
    bumpGeneration,
    clearClaim,
    verifyStored,
  ]);

  const onWriteDone = useCallback(
    async (prepared: PreparedWrite | null, status: TrackedStatus) => {
      const originScope = currentScope;
      const record = commitCreatedWrite(kind, prepared, status, originScope);
      if (record) persistCreatedWrite(record);

      const claimIfLive = () => {
        if (!liveOwns(record) || !record) return false;
        createdRef.current = record;
        recoveryTargetRef.current = record;
        setCreated(record);
        setPendingReason(null);
        setPendingTxHash(null);
        return true;
      };

      claimIfLive();
      await invalidate();
      if (!liveOwns(record) || !record) return;
      if (!claimIfLive()) return;
      archiveCreatedWrite(record);
      router.push(record.href);
    },
    [currentScope, invalidate, kind, liveOwns, router],
  );

  const onRetryRefresh = useCallback(async () => {
    const record = createdRef.current ?? recoveryTargetRef.current;
    await invalidate();
    if (!liveOwns(record) || !record) return;
    archiveCreatedWrite(record);
    router.push(record.href);
  }, [invalidate, liveOwns, router]);

  const pending = pendingReason !== null;
  const locked = recovering || pending || createdWriteBlocksPrepare(created);
  const storedTxHash = created?.txHash ?? pendingTxHash;

  return {
    created,
    recovering,
    pending,
    pendingReason,
    locked,
    lockReason: created
      ? createdWriteLockReason(kind)
      : pending && pendingReason
        ? createdWritePendingCopy(pendingReason).body
        : recovering
          ? createdWriteRecoveringReason()
          : createdWriteLockReason(kind),
    verificationTitle: pending ? VERIFICATION_PENDING_TITLE : null,
    retryVerificationLabel: RETRY_VERIFICATION_LABEL,
    pendingCopy: pending && pendingReason ? createdWritePendingCopy(pendingReason) : null,
    abandonCopy: createdWriteAbandonCopy(),
    onWriteDone,
    onRetryRefresh,
    onRetryVerification,
    onAbandonRecovery,
    onReachCreatedRecord,
    recordHref: created?.href ?? null,
    recordLabel: OPEN_CREATED_RECORD_LABEL,
    txHash: storedTxHash,
  };
}
