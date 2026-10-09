import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WriteDialog } from "../components/shared/WriteDialog";
import { postFinalizeRefreshCopy } from "../lib/contract/postFinalizeRefresh";
import type { TrackedStatus } from "@genlayer/transaction-kit-react";

const wallet = vi.hoisted(() => ({
  address: "0x1234567890123456789012345678901234567890",
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
    getConfiguredContractAddress: () => "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F",
  };
});

vi.mock("@genlayer/transaction-kit-react", () => ({
  GenLayerTransactionPanel: ({ onDone }: { onDone?: (status: TrackedStatus) => void }) => {
    onDone?.({
      phase: "finalized",
      successful: true,
      executionResultName: "FINISHED_WITH_RETURN",
      genlayerTxId: "0xabc",
    });
    return <div>Fee quote panel</div>;
  },
}));

const prepared = { method: "close_mandate", args: ["m-a56f4429378650ae158a"] };

function Host({
  onDone,
  onRetryRefresh,
}: {
  onDone?: (status: TrackedStatus) => void | Promise<void>;
  onRetryRefresh?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [label, setLabel] = useState("idle");
  return (
    <div>
      <p>{open ? "dialog-open" : "dialog-closed"}</p>
      <p>{label}</p>
      <WriteDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setLabel(next ? "awaiting" : "closed-from-dialog");
        }}
        title="Close mandate"
        description="Test dialog"
        prepared={prepared}
        onRetryRefresh={onRetryRefresh}
        onDone={async (status) => {
          setLabel(`done-${status.phase}`);
          await onDone?.(status);
        }}
      />
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("post-finalization refresh copy", () => {
  it("names a UI refresh failure after a finalized transaction", () => {
    const copy = postFinalizeRefreshCopy();
    expect(copy.title).toMatch(/Transaction finalized — UI refresh failed/);
    expect(copy.body).toMatch(/This transaction finalized/);
    expect(copy.body).toMatch(/UI refresh failed/);
    expect(`${copy.kicker} ${copy.title} ${copy.body}`).not.toMatch(/execution failed/i);
    expect(`${copy.kicker} ${copy.title} ${copy.body}`).not.toMatch(/Native delivery confirmed/i);
  });
});

describe("WriteDialog onDone during panel render", () => {
  it("does not update parent or dialog state while the mocked panel is rendering", async () => {
    const renderWarnings: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      renderWarnings.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      renderWarnings.push(args.map(String).join(" "));
    });

    render(<Host />);
    expect(screen.getByText("dialog-open")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("dialog-closed")).toBeInTheDocument();
    });
    expect(screen.getByText("done-finalized")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(renderWarnings.join("\n")).not.toMatch(/while rendering a different component/i);
    expect(renderWarnings.join("\n")).not.toMatch(/Cannot update a component/i);
  });

  it("closes after successful finalization without waiting for a hanging onDone", async () => {
    render(<Host onDone={() => new Promise(() => undefined)} />);
    await waitFor(() => {
      expect(screen.getByText("dialog-closed")).toBeInTheDocument();
    });
  });

  it("does not emit an unhandled rejection when async onDone rejects", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    try {
      render(
        <Host
          onDone={async () => {
            throw new Error("query refetch failed");
          }}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText("dialog-closed")).toBeInTheDocument();
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(unhandled).toEqual([]);
    } finally {
      window.removeEventListener("unhandledrejection", onUnhandled);
    }
  });

  it("surfaces a retryable refresh error after a successful finalized onDone rejection", async () => {
    render(
      <Host
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
    expect(screen.getByText(/Transaction finalized — UI refresh failed/i)).toBeInTheDocument();
    expect(screen.getByText(/This transaction finalized/i)).toBeInTheDocument();
    expect(screen.getAllByText(/UI refresh failed/i).length).toBeGreaterThan(0);
    const explorer = screen.getByRole("link", { name: /Explorer/i });
    expect(explorer).toHaveAttribute("href", expect.stringMatching(/\/tx\/0xabc/i));
    expect(screen.getByRole("button", { name: "Retry on-chain read" })).toBeInTheDocument();
    expect(screen.queryByText(/execution failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Native delivery confirmed/i)).not.toBeInTheDocument();
  });

  it("retries the on-chain read from the post-finalization banner", async () => {
    const retry = vi
      .fn()
      .mockRejectedValueOnce(new Error("still stale"))
      .mockResolvedValueOnce(undefined);
    render(
      <Host
        onDone={async () => {
          throw new Error("query refetch failed");
        }}
        onRetryRefresh={retry}
      />,
    );
    const retryButton = async () =>
      waitFor(() => screen.getByRole("button", { name: "Retry on-chain read" }));
    fireEvent.click(await retryButton());
    await waitFor(() => {
      expect(retry).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(await retryButton());
    await waitFor(() => {
      expect(retry).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
