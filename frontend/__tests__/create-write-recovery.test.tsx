import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreatedWriteRecoveryStatus } from "../components/shared/CreatedWriteRecoveryStatus";
import { WriteDialog } from "../components/shared/WriteDialog";
import {
  CREATED_WRITE_ARCHIVE_KEY,
  CREATED_WRITE_STORAGE_KEY,
  OPEN_CREATED_RECORD_LABEL,
  RETRY_VERIFICATION_LABEL,
  VERIFICATION_PENDING_TITLE,
  archiveCreatedWrite,
  clearCreatedWriteStorage,
  commitCreatedWrite,
  createdRecordHref,
  createdWriteBlocksPrepare,
  createdWriteIdentityMatch,
  createdWriteScope,
  listCreatedWrites,
  loadCreatedWrite,
  matchesCreatedWriteScope,
  persistCreatedWrite,
  sessionOwnsCreatedWrite,
  verifyCreatedWrite,
} from "../lib/contract/createdWrite";
import { useCreatedWriteRecovery } from "../lib/hooks/useCreatedWriteRecovery";
import type { PreparedWrite } from "../lib/contract/types";
import type { TrackedStatus } from "@genlayer/transaction-kit-react";

const PRODUCT = "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F";
const WALLET = "0x1234567890123456789012345678901234567890";
const OTHER_WALLET = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const OTHER_CONTRACT = "0x1111111111111111111111111111111111111111";

const push = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn(async () => undefined));
const reads = vi.hoisted(() => ({
  readView: vi.fn(),
  readTransactionLifecycle: vi.fn(),
}));
const configuredContract = vi.hoisted(() => ({ current: "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/hooks/useChainQueries", () => ({
  useInvalidateChain: () => invalidate,
}));

const wallet = vi.hoisted(() => ({
  address: "0x1234567890123456789012345678901234567890" as string | null,
  chainId: 61997 as string | number | null,
  isConnected: true,
  isOnCorrectNetwork: true,
  canWrite: true,
  provider: { request: vi.fn() },
  switchToStudioNext: vi.fn(),
}));

vi.mock("@/lib/genlayer/WalletProvider", () => ({
  useWallet: () => wallet,
}));

vi.mock("@/lib/genlayer/kit", () => ({
  useTransactionKit: () => ({ id: "mock-kit" }),
}));

vi.mock("@/lib/contract/adapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contract/adapter")>();
  return {
    ...actual,
    isContractReady: () => true,
    getConfiguredContractAddress: () => configuredContract.current,
  };
});

vi.mock("../lib/contract/readClient", () => ({
  readView: reads.readView,
  readTransactionLifecycle: reads.readTransactionLifecycle,
}));

vi.mock("@/lib/contract/readClient", () => ({
  readView: reads.readView,
  readTransactionLifecycle: reads.readTransactionLifecycle,
}));

vi.mock("../lib/contract/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contract/config")>();
  return {
    ...actual,
    getConfiguredContractAddress: () => configuredContract.current,
  };
});

vi.mock("@/lib/contract/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/contract/config")>();
  return {
    ...actual,
    getConfiguredContractAddress: () => configuredContract.current,
  };
});

const panelStatus = vi.hoisted(() => ({
  current: {
    phase: "finalized",
    successful: true,
    executionResultName: "FINISHED_WITH_RETURN",
    genlayerTxId: "0xabc",
  } as TrackedStatus,
}));

vi.mock("@genlayer/transaction-kit-react", () => ({
  GenLayerTransactionPanel: ({ onDone }: { onDone?: (status: TrackedStatus) => void }) => {
    onDone?.(panelStatus.current);
    return <div>Fee quote panel</div>;
  },
}));

const success: TrackedStatus = {
  phase: "finalized",
  successful: true,
  executionResultName: "FINISHED_WITH_RETURN",
  genlayerTxId: "0xabc",
};
const executionFailed: TrackedStatus = {
  phase: "finalized",
  successful: false,
  executionResultName: "FINISHED_WITH_ERROR",
  genlayerTxId: "0xdead",
};

const mandateWrite: PreparedWrite = { method: "create_mandate", args: ["m-created-1"] };
const invoiceWrite: PreparedWrite = { method: "issue_invoice", args: ["inv-created-1"] };
const requestWrite: PreparedWrite = { method: "request_payment", args: ["req-created-1"] };

function okLife(partial: Record<string, unknown> = {}) {
  return {
    finalized: true,
    executionOk: true,
    statusName: "FINALIZED",
    executionName: "FINISHED_WITH_RETURN",
    contractAddress: PRODUCT.toLowerCase(),
    sender: WALLET.toLowerCase(),
    createdIds: [] as string[],
    transfers: [],
    ...partial,
  };
}

function RecoveryHost() {
  const recovery = useCreatedWriteRecovery("mandate");
  return (
    <div>
      <p>{recovery.locked ? "form-locked" : "form-unlocked"}</p>
      <CreatedWriteRecoveryStatus recovery={recovery} />
    </div>
  );
}

function storedMandate(partial: Partial<Parameters<typeof persistCreatedWrite>[0]> = {}) {
  return {
    kind: "mandate" as const,
    id: "m-created-1",
    href: "/mandates/m-created-1",
    txHash: "0xabc",
    wallet: WALLET,
    chainId: 61997,
    contractAddress: PRODUCT,
    ...partial,
  };
}

function scopeOf(walletAddress = WALLET, chainId: string | number = 61997, contract = PRODUCT) {
  return createdWriteScope({
    wallet: walletAddress,
    chainId,
    contractAddress: contract,
  });
}

function loadMandate(walletAddress = WALLET) {
  return loadCreatedWrite("mandate", scopeOf(walletAddress));
}

function CreateHost({
  prepared,
  onDone,
  onRetryRefresh,
  recordHref,
}: {
  prepared: PreparedWrite;
  onDone: (status: TrackedStatus) => void | Promise<void>;
  onRetryRefresh?: () => void | Promise<void>;
  recordHref?: string | null;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <p>{open ? "dialog-open" : "dialog-closed"}</p>
      <WriteDialog
        open={open}
        onOpenChange={setOpen}
        title="Create"
        description="Test"
        prepared={prepared}
        onRetryRefresh={onRetryRefresh}
        recordHref={recordHref}
        recordLabel={OPEN_CREATED_RECORD_LABEL}
        onDone={onDone}
      />
    </div>
  );
}

afterEach(() => {
  cleanup();
  push.mockReset();
  invalidate.mockReset();
  invalidate.mockResolvedValue(undefined);
  panelStatus.current = success;
  wallet.address = WALLET;
  wallet.chainId = 61997;
  configuredContract.current = PRODUCT;
  wallet.provider.request.mockReset();
  reads.readView.mockReset();
  reads.readTransactionLifecycle.mockReset();
  clearCreatedWriteStorage();
  window.localStorage.removeItem(CREATED_WRITE_STORAGE_KEY);
  window.localStorage.removeItem(CREATED_WRITE_ARCHIVE_KEY);
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", PRODUCT);
  reads.readTransactionLifecycle.mockResolvedValue(okLife());
  reads.readView.mockImplementation(async (_method: string, args: unknown[]) => ({ id: args[0] }));
});

describe("created write hrefs", () => {
  it("maps mandate invoice and decision ids to detail routes", () => {
    expect(createdRecordHref("mandate", "m-1")).toBe("/mandates/m-1");
    expect(createdRecordHref("invoice", "inv-1")).toBe("/invoices/inv-1");
    expect(createdRecordHref("decision", "req-1")).toBe("/decisions/req-1");
  });

  it("commits a created record only after successful finalization", () => {
    expect(commitCreatedWrite("mandate", mandateWrite, success)?.id).toBe("m-created-1");
    expect(commitCreatedWrite("mandate", mandateWrite, executionFailed)).toBeNull();
    expect(createdWriteBlocksPrepare(commitCreatedWrite("invoice", invoiceWrite, success))).toBe(true);
    expect(createdWriteBlocksPrepare(commitCreatedWrite("invoice", invoiceWrite, executionFailed))).toBe(false);
  });
});

describe("create-form recovery after finalization", () => {
  beforeEach(() => {
    invalidate.mockResolvedValue(undefined);
  });

  it("finalized → refresh failure → retry → mandate detail route", async () => {
    invalidate.mockRejectedValueOnce(new Error("query refetch failed")).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await act(async () => {
      await expect(result.current.onWriteDone(mandateWrite, success)).rejects.toThrow(/query refetch failed/);
    });
    expect(result.current.created?.id).toBe("m-created-1");
    expect(result.current.locked).toBe(true);
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.onRetryRefresh();
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/mandates/m-created-1");
  });

  it("finalized → refresh failure → retry → invoice detail route", async () => {
    invalidate.mockRejectedValueOnce(new Error("query refetch failed")).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCreatedWriteRecovery("invoice"));
    await act(async () => {
      await expect(result.current.onWriteDone(invoiceWrite, success)).rejects.toThrow(/query refetch failed/);
    });
    await act(async () => {
      await result.current.onRetryRefresh();
    });
    expect(push).toHaveBeenCalledWith("/invoices/inv-created-1");
  });

  it("finalized → refresh failure → retry → decision detail route", async () => {
    invalidate.mockRejectedValueOnce(new Error("query refetch failed")).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCreatedWriteRecovery("decision"));
    await act(async () => {
      await expect(result.current.onWriteDone(requestWrite, success)).rejects.toThrow(/query refetch failed/);
    });
    await act(async () => {
      await result.current.onRetryRefresh();
    });
    expect(push).toHaveBeenCalledWith("/decisions/req-created-1");
  });

  it("finalized → refresh failure → no duplicate submission", async () => {
    invalidate.mockRejectedValueOnce(new Error("query refetch failed"));
    const prepare = vi.fn(() => ({ method: "create_mandate", args: ["m-new"] }));
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    function submit() {
      if (result.current.locked) return;
      prepare();
    }
    submit();
    expect(prepare).toHaveBeenCalledTimes(1);
    await act(async () => {
      await expect(result.current.onWriteDone(mandateWrite, success)).rejects.toThrow(/query refetch failed/);
    });
    submit();
    submit();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(result.current.created?.id).toBe("m-created-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("failed execution keeps the form retryable without claiming a created record", async () => {
    const prepare = vi.fn(() => ({ method: "issue_invoice", args: ["inv-retry"] }));
    const { result } = renderHook(() => useCreatedWriteRecovery("invoice"));
    function submit() {
      if (result.current.locked) return;
      prepare();
    }
    await act(async () => {
      await result.current.onWriteDone(invoiceWrite, executionFailed);
    });
    expect(result.current.created).toBeNull();
    expect(result.current.locked).toBe(false);
    expect(result.current.recordHref).toBeNull();
    expect(loadCreatedWrite("invoice", scopeOf())).toBeNull();
    expect(push).not.toHaveBeenCalled();
    submit();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("persists the finalized record before refreshing queries", async () => {
    invalidate.mockImplementation(async () => {
      const stored = loadMandate();
      expect(stored?.id).toBe("m-created-1");
      expect(stored?.txHash).toBe("0xabc");
      expect(stored?.kind).toBe("mandate");
      expect(stored?.wallet).toBe(WALLET.toLowerCase());
      expect(stored?.chainId).toBe(61997);
      expect(stored?.contractAddress).toBe(PRODUCT.toLowerCase());
      throw new Error("query refetch failed");
    });
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await act(async () => {
      await expect(result.current.onWriteDone(mandateWrite, success)).rejects.toThrow(/query refetch failed/);
    });
    expect(loadMandate()?.id).toBe("m-created-1");
    expect(result.current.locked).toBe(true);
  });
});

describe("create WriteDialog recovery banner", () => {
  it("keeps Open created record while refresh remains unavailable", async () => {
    invalidate.mockRejectedValue(new Error("query refetch failed"));
    render(
      <CreateHost
        prepared={mandateWrite}
        recordHref="/mandates/m-created-1"
        onRetryRefresh={async () => {
          throw new Error("still stale");
        }}
        onDone={async () => {
          throw new Error("query refetch failed");
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("dialog-closed")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: OPEN_CREATED_RECORD_LABEL })).toHaveAttribute(
      "href",
      "/mandates/m-created-1",
    );
    expect(screen.getByRole("link", { name: /Explorer/i })).toHaveAttribute("href", expect.stringMatching(/\/tx\/0xabc/));
    fireEvent.click(screen.getByRole("button", { name: "Retry on-chain read" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: OPEN_CREATED_RECORD_LABEL })).toBeInTheDocument();
    expect(screen.queryByText(/Native delivery confirmed/i)).not.toBeInTheDocument();
  });
});

describe("created write persist and verify", () => {
  it("parses Studio Next hex chain ids and scopes restoration", () => {
    const scope = createdWriteScope({
      wallet: WALLET,
      chainId: `0x${(61997).toString(16)}`,
      contractAddress: PRODUCT,
    });
    expect(scope).toEqual({
      wallet: WALLET.toLowerCase(),
      chainId: 61997,
      contractAddress: PRODUCT.toLowerCase(),
    });
    expect(matchesCreatedWriteScope(storedMandate(), scope!)).toBe(true);
    expect(
      matchesCreatedWriteScope(storedMandate(), {
        wallet: OTHER_WALLET.toLowerCase(),
        chainId: 61997,
        contractAddress: PRODUCT.toLowerCase(),
      }),
    ).toBe(false);
  });

  it("does not throw when browser storage is unavailable", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => persistCreatedWrite(storedMandate())).not.toThrow();
    expect(persistCreatedWrite(storedMandate())).toBe(false);
    expect(() => loadMandate()).not.toThrow();
    expect(loadMandate()).toBeNull();
    expect(() => archiveCreatedWrite(storedMandate())).not.toThrow();
    setItem.mockRestore();
    getItem.mockRestore();
  });

  it("verifyCreatedWrite requires successful execution and an on-chain record", async () => {
    reads.readTransactionLifecycle.mockResolvedValueOnce({ ...okLife(), executionOk: false });
    await expect(verifyCreatedWrite(storedMandate())).resolves.toEqual({ ok: false, reason: "failed_execution" });
    reads.readTransactionLifecycle.mockResolvedValueOnce(okLife());
    reads.readView.mockResolvedValueOnce({});
    await expect(verifyCreatedWrite(storedMandate())).resolves.toEqual({ ok: false, reason: "missing_record" });
    reads.readTransactionLifecycle.mockResolvedValueOnce(okLife());
    reads.readView.mockResolvedValueOnce({ id: "m-created-1" });
    await expect(verifyCreatedWrite(storedMandate())).resolves.toEqual({ ok: true });
  });

  it("does not treat a successful tx to another contract plus a record read as proof", async () => {
    reads.readTransactionLifecycle.mockResolvedValueOnce(
      okLife({ contractAddress: OTHER_CONTRACT.toLowerCase() }),
    );
    reads.readView.mockResolvedValueOnce({ id: "m-created-1" });
    await expect(verifyCreatedWrite(storedMandate())).resolves.toEqual({ ok: false, reason: "wrong_contract" });
  });

  it("matches sender and created id when the lifecycle exposes them", async () => {
    reads.readTransactionLifecycle.mockResolvedValueOnce(okLife({ sender: OTHER_WALLET.toLowerCase() }));
    reads.readView.mockResolvedValueOnce({ id: "m-created-1" });
    await expect(verifyCreatedWrite(storedMandate())).resolves.toEqual({ ok: false, reason: "wrong_sender" });
    reads.readTransactionLifecycle.mockResolvedValueOnce(okLife({ createdIds: ["m-other"] }));
    reads.readView.mockResolvedValueOnce({ id: "m-created-1" });
    await expect(verifyCreatedWrite(storedMandate())).resolves.toEqual({ ok: false, reason: "wrong_id" });
    reads.readTransactionLifecycle.mockResolvedValueOnce(
      okLife({ createdIds: ["m-created-1"], sender: WALLET.toLowerCase() }),
    );
    reads.readView.mockResolvedValueOnce({ id: "m-created-1" });
    await expect(verifyCreatedWrite(storedMandate())).resolves.toEqual({ ok: true });
  });
});

describe("create-form recovery across reload", () => {
  it("reload restores Open created record only after read-only tx and record checks", async () => {
    let release: ((value: ReturnType<typeof okLife>) => void) | undefined;
    reads.readTransactionLifecycle.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    persistCreatedWrite(storedMandate());
    const prepare = vi.fn();
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    expect(result.current.locked).toBe(true);
    expect(result.current.recordHref).toBeNull();
    expect(result.current.recovering).toBe(true);
    if (!result.current.locked) prepare();
    expect(prepare).not.toHaveBeenCalled();
    await act(async () => {
      release?.(okLife());
    });
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-created-1");
    });
    expect(result.current.recordHref).toBe("/mandates/m-created-1");
    expect(result.current.locked).toBe(true);
    expect(reads.readTransactionLifecycle).toHaveBeenCalledWith("0xabc");
    expect(reads.readView).toHaveBeenCalledWith("get_mandate", ["m-created-1"], PRODUCT.toLowerCase());
    expect(wallet.provider.request).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("wrong wallet does not claim finalization and keeps the stored entry", async () => {
    persistCreatedWrite(storedMandate());
    wallet.address = OTHER_WALLET;
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.recovering).toBe(false);
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(result.current.locked).toBe(false);
    expect(loadMandate()?.id).toBe("m-created-1");
    expect(reads.readTransactionLifecycle).not.toHaveBeenCalled();
  });

  it("wrong chain does not claim finalization and keeps the stored entry", async () => {
    persistCreatedWrite(storedMandate());
    wallet.chainId = 61999;
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.recovering).toBe(false);
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(loadMandate()?.id).toBe("m-created-1");
  });

  it("wrong contract does not claim finalization and keeps the stored entry", async () => {
    persistCreatedWrite(storedMandate());
    configuredContract.current = OTHER_CONTRACT;
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.recovering).toBe(false);
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(loadMandate()?.id).toBe("m-created-1");
  });

  it("missing on-chain record stays locked as verification pending", async () => {
    persistCreatedWrite(storedMandate());
    reads.readView.mockResolvedValue({});
    const prepare = vi.fn();
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.pending).toBe(true);
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(result.current.locked).toBe(true);
    expect(result.current.verificationTitle).toBe(VERIFICATION_PENDING_TITLE);
    expect(result.current.pendingReason).toBe("missing_record");
    expect(loadMandate()?.id).toBe("m-created-1");
    expect(push).not.toHaveBeenCalled();
    if (!result.current.locked) prepare();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("failed execution does not claim finalization and archives the entry", async () => {
    persistCreatedWrite(storedMandate());
    reads.readTransactionLifecycle.mockResolvedValue({
      ...okLife(),
      executionOk: false,
      executionName: "FINISHED_WITH_ERROR",
    });
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.recovering).toBe(false);
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(loadMandate()).toBeNull();
  });

  it("reaching the created record archives recovery and allows a new form later", async () => {
    persistCreatedWrite(storedMandate());
    const prepare = vi.fn(() => ({ method: "create_mandate", args: ["m-new"] }));
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-created-1");
    });
    act(() => {
      result.current.onReachCreatedRecord();
    });
    expect(result.current.created).toBeNull();
    expect(result.current.locked).toBe(false);
    expect(loadMandate()).toBeNull();
    expect(window.localStorage.getItem(CREATED_WRITE_ARCHIVE_KEY)).toContain("m-created-1");
    if (!result.current.locked) prepare();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("temporary RPC failure keeps the form locked until retry succeeds", async () => {
    persistCreatedWrite(storedMandate());
    reads.readTransactionLifecycle.mockRejectedValueOnce(new Error("Server busy -32006"));
    const prepare = vi.fn();
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.pendingReason).toBe("read_error");
    });
    expect(result.current.locked).toBe(true);
    expect(result.current.recordHref).toBeNull();
    expect(loadMandate()?.id).toBe("m-created-1");
    if (!result.current.locked) prepare();
    expect(prepare).not.toHaveBeenCalled();
    reads.readTransactionLifecycle.mockResolvedValue(okLife());
    await act(async () => {
      await result.current.onRetryVerification();
    });
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-created-1");
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.recordHref).toBe("/mandates/m-created-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("delayed record visibility stays locked then claims after retry", async () => {
    persistCreatedWrite(storedMandate());
    reads.readView.mockResolvedValueOnce({});
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.pendingReason).toBe("missing_record");
    });
    expect(result.current.locked).toBe(true);
    expect(result.current.recordHref).toBeNull();
    reads.readView.mockResolvedValue({ id: "m-created-1" });
    await act(async () => {
      await result.current.onRetryVerification();
    });
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-created-1");
    });
    expect(result.current.recordHref).toBe("/mandates/m-created-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("transient not-finalized stays locked then claims after retry", async () => {
    persistCreatedWrite(storedMandate());
    reads.readTransactionLifecycle.mockResolvedValueOnce(okLife({ finalized: false, executionOk: false }));
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.pendingReason).toBe("not_finalized");
    });
    expect(result.current.locked).toBe(true);
    expect(result.current.recordHref).toBeNull();
    expect(loadMandate()?.id).toBe("m-created-1");
    reads.readTransactionLifecycle.mockResolvedValue(okLife());
    await act(async () => {
      await result.current.onRetryVerification();
    });
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-created-1");
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("a transaction for another contract does not claim the stored record", async () => {
    persistCreatedWrite(storedMandate());
    reads.readTransactionLifecycle.mockResolvedValue(
      okLife({ contractAddress: OTHER_CONTRACT.toLowerCase() }),
    );
    reads.readView.mockResolvedValue({ id: "m-created-1" });
    const prepare = vi.fn();
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.pendingReason).toBe("wrong_contract");
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(result.current.locked).toBe(true);
    expect(loadMandate()?.id).toBe("m-created-1");
    if (!result.current.locked) prepare();
    expect(prepare).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows Verification pending with explorer and retry, and abandon explains duplicate risk", async () => {
    persistCreatedWrite(storedMandate());
    reads.readView.mockResolvedValue({});
    render(<RecoveryHost />);
    await waitFor(() => {
      expect(screen.getByTestId("created-write-verification-pending")).toBeInTheDocument();
    });
    expect(screen.getByText(VERIFICATION_PENDING_TITLE)).toBeInTheDocument();
    expect(screen.getByText("form-locked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explorer/i })).toHaveAttribute(
      "href",
      expect.stringMatching(/\/tx\/0xabc/),
    );
    expect(screen.queryByRole("link", { name: OPEN_CREATED_RECORD_LABEL })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RETRY_VERIFICATION_LABEL }));
    await waitFor(() => {
      expect(reads.readTransactionLifecycle.mock.calls.length).toBeGreaterThan(1);
    });
    expect(screen.getByTestId("created-write-verification-pending")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Unlock form anyway" }));
    expect(screen.getByRole("dialog", { name: "Unlock this form?" })).toHaveTextContent(
      /Unlocking lets this form mint a new ID/,
    );
    expect(screen.getByRole("dialog", { name: "Unlock this form?" })).toHaveTextContent(/duplicate/);
    fireEvent.click(screen.getByRole("button", { name: "Unlock and risk a duplicate write" }));
    await waitFor(() => {
      expect(screen.getByText("form-unlocked")).toBeInTheDocument();
    });
    expect(loadMandate()).toBeNull();
  });
});

describe("stale-wallet create recovery", () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((next) => {
      resolve = next;
    });
    return { promise, resolve: (value: T) => resolve(value) };
  }

  it("A verification → switch to B → A resolves does not claim in B", async () => {
    const life = deferred<ReturnType<typeof okLife>>();
    reads.readTransactionLifecycle.mockReturnValue(life.promise);
    persistCreatedWrite(storedMandate());
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    expect(result.current.recovering).toBe(true);
    wallet.address = OTHER_WALLET;
    rerender();
    await waitFor(() => {
      expect(result.current.locked).toBe(false);
      expect(result.current.created).toBeNull();
    });
    await act(async () => {
      life.resolve(okLife());
      await life.promise;
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(result.current.pending).toBe(false);
    expect(result.current.locked).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(loadMandate()?.wallet).toBe(WALLET.toLowerCase());
  });

  it("A verification → disconnect → A resolves does not claim", async () => {
    const life = deferred<ReturnType<typeof okLife>>();
    reads.readTransactionLifecycle.mockReturnValue(life.promise);
    persistCreatedWrite(storedMandate());
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    wallet.address = null;
    rerender();
    await waitFor(() => {
      expect(result.current.locked).toBe(false);
      expect(result.current.recovering).toBe(false);
    });
    await act(async () => {
      life.resolve(okLife());
      await life.promise;
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(result.current.locked).toBe(false);
    expect(loadMandate()?.id).toBe("m-created-1");
  });

  it("chain or contract switch mid-read drops the in-flight claim", async () => {
    const life = deferred<ReturnType<typeof okLife>>();
    reads.readTransactionLifecycle.mockReturnValue(life.promise);
    persistCreatedWrite(storedMandate());
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    wallet.chainId = 61999;
    rerender();
    await waitFor(() => {
      expect(result.current.locked).toBe(false);
    });
    await act(async () => {
      life.resolve(okLife());
      await life.promise;
    });
    expect(result.current.created).toBeNull();
    expect(loadMandate()?.chainId).toBe(61997);

    wallet.chainId = 61997;
    configuredContract.current = OTHER_CONTRACT;
    const life2 = deferred<ReturnType<typeof okLife>>();
    reads.readTransactionLifecycle.mockReturnValue(life2.promise);
    persistCreatedWrite(storedMandate());
    rerender();
    await waitFor(() => {
      expect(result.current.recovering).toBe(false);
      expect(result.current.locked).toBe(false);
    });
    await act(async () => {
      life2.resolve(okLife());
      await life2.promise;
    });
    expect(result.current.recordHref).toBeNull();
    expect(loadMandate()?.contractAddress).toBe(PRODUCT.toLowerCase());
  });

  it("A write finalizing after a switch does not claim in B and keeps A’s entry", async () => {
    const refresh = deferred<undefined>();
    invalidate.mockImplementation(() => refresh.promise);
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    let pendingWrite!: Promise<unknown>;
    act(() => {
      pendingWrite = result.current.onWriteDone(mandateWrite, success);
    });
    expect(loadMandate()?.wallet).toBe(WALLET.toLowerCase());
    wallet.address = OTHER_WALLET;
    rerender();
    await waitFor(() => {
      expect(result.current.created).toBeNull();
      expect(result.current.recordHref).toBeNull();
      expect(result.current.locked).toBe(false);
    });
    await act(async () => {
      refresh.resolve(undefined);
      await pendingWrite;
    });
    expect(result.current.created).toBeNull();
    expect(result.current.recordHref).toBeNull();
    expect(result.current.locked).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(loadMandate()?.id).toBe("m-created-1");
    expect(loadMandate()?.wallet).toBe(WALLET.toLowerCase());
  });

  it("retry refresh after a switch does not navigate or archive A’s entry", async () => {
    invalidate.mockRejectedValueOnce(new Error("query refetch failed"));
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await act(async () => {
      await expect(result.current.onWriteDone(mandateWrite, success)).rejects.toThrow(/query refetch failed/);
    });
    expect(result.current.created?.id).toBe("m-created-1");
    const refresh = deferred<undefined>();
    invalidate.mockImplementation(() => refresh.promise);
    let retry!: Promise<unknown>;
    act(() => {
      retry = result.current.onRetryRefresh();
    });
    wallet.address = OTHER_WALLET;
    rerender();
    await act(async () => {
      refresh.resolve(undefined);
      await retry;
    });
    expect(push).not.toHaveBeenCalled();
    expect(loadMandate()?.wallet).toBe(WALLET.toLowerCase());
    expect(result.current.recordHref).toBeNull();
  });

  it("switching back to A restores and verifies its entry", async () => {
    const life = deferred<ReturnType<typeof okLife>>();
    reads.readTransactionLifecycle.mockReturnValue(life.promise);
    persistCreatedWrite(storedMandate());
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    wallet.address = OTHER_WALLET;
    rerender();
    await waitFor(() => {
      expect(result.current.locked).toBe(false);
    });
    await act(async () => {
      life.resolve(okLife());
      await life.promise;
    });
    expect(result.current.created).toBeNull();
    reads.readTransactionLifecycle.mockResolvedValue(okLife());
    reads.readView.mockResolvedValue({ id: "m-created-1" });
    wallet.address = WALLET;
    rerender();
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-created-1");
    });
    expect(result.current.recordHref).toBe("/mandates/m-created-1");
    expect(result.current.locked).toBe(true);
    expect(sessionOwnsCreatedWrite(result.current.created, createdWriteScope({
      wallet: WALLET,
      chainId: 61997,
      contractAddress: PRODUCT,
    }), "mandate")).toBe(true);
  });
});

describe("multi-wallet created-write recovery", () => {
  const mandateA = () =>
    storedMandate({
      id: "m-a",
      href: "/mandates/m-a",
      txHash: "0xaaa",
      wallet: WALLET,
    });
  const mandateB = () =>
    storedMandate({
      id: "m-b",
      href: "/mandates/m-b",
      txHash: "0xbbb",
      wallet: OTHER_WALLET,
    });

  function matchSenderToSession() {
    reads.readTransactionLifecycle.mockImplementation(async () =>
      okLife({ sender: (wallet.address ?? WALLET).toLowerCase() }),
    );
    reads.readView.mockImplementation(async (_method: string, args: unknown[]) => ({ id: args[0] }));
  }

  it("load without a session scope does not pick a wallet’s entry", () => {
    persistCreatedWrite(mandateA());
    persistCreatedWrite(mandateB());
    expect(loadCreatedWrite("mandate")).toBeNull();
    expect(loadMandate(WALLET)?.id).toBe("m-a");
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
  });

  it("migrates v1 kind-map so persisting B keeps A", () => {
    window.localStorage.setItem(
      CREATED_WRITE_STORAGE_KEY,
      JSON.stringify({ mandate: mandateA() }),
    );
    expect(loadMandate(WALLET)?.id).toBe("m-a");
    expect(persistCreatedWrite(mandateB())).toBe(true);
    expect(loadMandate(WALLET)?.id).toBe("m-a");
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
    const raw = JSON.parse(window.localStorage.getItem(CREATED_WRITE_STORAGE_KEY) ?? "{}") as {
      version?: number;
    };
    expect(raw.version).toBe(2);
    expect(listCreatedWrites().map((entry) => entry.id).sort()).toEqual(["m-a", "m-b"]);
  });

  it("A and B each keep a pending mandate and switching restores the current wallet", async () => {
    persistCreatedWrite(mandateA());
    persistCreatedWrite(mandateB());
    matchSenderToSession();
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-a");
    });
    expect(result.current.recordHref).toBe("/mandates/m-a");
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");

    wallet.address = OTHER_WALLET;
    rerender();
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-b");
    });
    expect(result.current.recordHref).toBe("/mandates/m-b");
    expect(result.current.locked).toBe(true);
    expect(loadMandate(WALLET)?.id).toBe("m-a");

    wallet.address = WALLET;
    rerender();
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-a");
    });
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
  });

  it("A finalizing late after B stores a mandate does not claim or archive B", async () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((next) => {
        resolve = next;
      });
      return { promise, resolve: (value: T) => resolve(value) };
    }
    const refresh = deferred<undefined>();
    invalidate.mockImplementation(() => refresh.promise);
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    let pendingWrite!: Promise<unknown>;
    act(() => {
      pendingWrite = result.current.onWriteDone(mandateWrite, success);
    });
    expect(loadMandate(WALLET)?.id).toBe("m-created-1");

    persistCreatedWrite(mandateB());
    wallet.address = OTHER_WALLET;
    rerender();
    await waitFor(() => {
      expect(result.current.created?.id).not.toBe("m-created-1");
    });

    await act(async () => {
      refresh.resolve(undefined);
      await pendingWrite;
    });
    expect(result.current.created?.id).not.toBe("m-created-1");
    expect(result.current.recordHref).not.toBe("/mandates/m-created-1");
    expect(push).not.toHaveBeenCalled();
    expect(loadMandate(WALLET)?.id).toBe("m-created-1");
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
  });

  it("Open created record from A archives only A", async () => {
    persistCreatedWrite(mandateA());
    persistCreatedWrite(mandateB());
    matchSenderToSession();
    const { result } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-a");
    });
    act(() => {
      result.current.onReachCreatedRecord();
    });
    expect(loadMandate(WALLET)).toBeNull();
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
    expect(window.localStorage.getItem(CREATED_WRITE_ARCHIVE_KEY)).toContain("m-a");
    expect(window.localStorage.getItem(CREATED_WRITE_ARCHIVE_KEY)).not.toContain("m-b");
  });

  it("a late Open created record from A does not archive B", async () => {
    persistCreatedWrite(mandateA());
    matchSenderToSession();
    const { result, rerender } = renderHook(() => useCreatedWriteRecovery("mandate"));
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-a");
    });
    const openA = result.current.onReachCreatedRecord;
    persistCreatedWrite(mandateB());
    wallet.address = OTHER_WALLET;
    rerender();
    await waitFor(() => {
      expect(result.current.created?.id).toBe("m-b");
    });
    act(() => {
      openA();
    });
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
    expect(result.current.created?.id).toBe("m-b");
    expect(loadMandate(WALLET)).toBeNull();
  });

  it("archiving either mandate leaves the other", () => {
    persistCreatedWrite(mandateA());
    persistCreatedWrite(mandateB());
    archiveCreatedWrite(mandateA());
    expect(loadMandate(WALLET)).toBeNull();
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
    archiveCreatedWrite(mandateB());
    expect(loadMandate(OTHER_WALLET)).toBeNull();
    expect(listCreatedWrites()).toEqual([]);
  });

  it("archive requires the exact id or tx hash and does not drop a newer slot", () => {
    persistCreatedWrite(mandateA());
    persistCreatedWrite(mandateB());
    const newerA = storedMandate({
      id: "m-a-new",
      href: "/mandates/m-a-new",
      txHash: "0xaaa-new",
      wallet: WALLET,
    });
    persistCreatedWrite(newerA);
    expect(createdWriteIdentityMatch(newerA, mandateA())).toBe(false);
    archiveCreatedWrite(mandateA());
    expect(loadMandate(WALLET)?.id).toBe("m-a-new");
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
    archiveCreatedWrite({ ...newerA, id: "m-a-new", txHash: "0xaaa-new" });
    expect(loadMandate(WALLET)).toBeNull();
    expect(loadMandate(OTHER_WALLET)?.id).toBe("m-b");
  });
});
