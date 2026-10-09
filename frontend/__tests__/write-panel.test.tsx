import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WriteTxPanel } from "../components/shared/WriteTxPanel";
import { DeliveryStatus } from "../components/shared/DeliveryStatus";
import type { PayoutRecord } from "../lib/contract/delivery";

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
  GenLayerTransactionPanel: ({ userValue }: { userValue?: bigint }) => (
    <div>
      <p>Fee quote panel</p>
      <p>Hold to sign</p>
      {userValue !== undefined ? <p>payable {userValue.toString()}</p> : null}
    </div>
  ),
}));

const prepared = {
  method: "create_mandate",
  args: ["m-1"],
  userValue: 2500000000000000000n,
};

afterEach(() => {
  cleanup();
  wallet.isConnected = true;
  wallet.isOnCorrectNetwork = true;
  wallet.canWrite = true;
  wallet.address = "0x1234567890123456789012345678901234567890";
});

describe("WriteTxPanel", () => {
  it("asks to connect when the wallet is disconnected", () => {
    wallet.isConnected = false;
    wallet.address = "";
    render(<WriteTxPanel prepared={prepared} />);
    expect(screen.getByText(/Connect a wallet on Studio Next/)).toBeInTheDocument();
  });

  it("shows wrong network and a switch control", () => {
    wallet.isOnCorrectNetwork = false;
    render(<WriteTxPanel prepared={prepared} />);
    expect(screen.getByText(/Writes require/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch network/ })).toBeInTheDocument();
  });

  it("renders the fee quote panel with payable wei", () => {
    render(<WriteTxPanel prepared={prepared} />);
    expect(screen.getByText("Fee quote panel")).toBeInTheDocument();
    expect(screen.getByText("Hold to sign")).toBeInTheDocument();
    expect(screen.getByText("payable 2500000000000000000")).toBeInTheDocument();
  });
});

describe("DeliveryStatus", () => {
  const finalized: PayoutRecord = {
    id: "p1",
    chainId: 61997,
    contractAddress: "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F",
    kind: "withdraw",
    mandateId: "m-1",
    recipient: "0xabc",
    amountWei: "1",
    txHash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    contractBefore: "1",
    recipientBefore: "0",
    finalized: true,
    executionOk: true,
    settled: false,
    deliveryChecked: true,
    deliveryVerified: false,
    contractDrop: "0",
    recipientGain: "0",
    updatedAt: 1,
  };

  it("does not show paid for a finalized parent without native delivery", () => {
    render(<DeliveryStatus phase="tx_finalized" record={finalized} creditWei={0n} />);
    expect(screen.getAllByText(/Transaction finalized/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Native delivery confirmed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Explorer/)).toBeInTheDocument();
  });

  it("shows unresolved when delivery cannot be confirmed", () => {
    render(<DeliveryStatus phase="unresolved" record={finalized} creditWei={0n} />);
    expect(screen.getAllByText(/Delivery unresolved/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Native delivery confirmed/i)).not.toBeInTheDocument();
  });

  it("identifies a finalized payout whose execution failed", () => {
    render(<DeliveryStatus phase="unresolved" record={{ ...finalized, executionOk: false }} creditWei={1n} />);
    expect(screen.getByText("Execution failed")).toBeInTheDocument();
    expect(screen.queryByText("Delivery unresolved")).not.toBeInTheDocument();
    expect(screen.queryByText("Native delivery confirmed")).not.toBeInTheDocument();
  });

  it("keeps an explorer link when delivery is unresolved", () => {
    render(<DeliveryStatus phase="unresolved" record={finalized} creditWei={0n} />);
    expect(screen.getByText(/Explorer/)).toBeInTheDocument();
    expect(screen.queryByText(/Native delivery confirmed/i)).not.toBeInTheDocument();
  });

  it("does not show paid for zero remaining credit without a verified payout", () => {
    render(<DeliveryStatus phase="none" record={null} creditWei={0n} />);
    expect(screen.queryByText(/Native delivery confirmed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Paid$/i)).not.toBeInTheDocument();
  });

  it("shows paid only for native_delivered", () => {
    render(
      <DeliveryStatus
        phase="native_delivered"
        record={{ ...finalized, settled: true }}
        creditWei={0n}
      />,
    );
    expect(screen.getAllByText(/Native delivery confirmed/i).length).toBeGreaterThan(0);
  });
});
