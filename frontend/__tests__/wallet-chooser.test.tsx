import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletArea } from "../components/wallet/WalletArea";
import { SiteHeader } from "../components/layout/SiteHeader";
import { DemoModeProvider } from "../lib/demo/DemoMode";

const wallet = vi.hoisted(() => ({
  address: null as string | null,
  isConnected: false,
  isOnCorrectNetwork: false,
  isLoading: true,
  isHydrating: true,
  canWrite: false,
  walletName: null as string | null,
  provider: null,
  hasInjectedWallet: false,
  walletConnectConfigured: false,
  discoveryError: null as string | null,
  chooserOpen: false,
  options: [] as Array<{
    id: string;
    name: string;
    rdns: string | null;
    icon: string | null;
    kind: "injected" | "walletconnect" | "unavailable";
    ready: boolean;
    hint?: string;
  }>,
  openChooser: vi.fn(() => {
    wallet.chooserOpen = true;
  }),
  closeChooser: vi.fn(() => {
    wallet.chooserOpen = false;
  }),
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  switchWalletAccount: vi.fn(),
  switchToStudioNext: vi.fn(),
  retryDiscovery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/genlayer/WalletProvider", () => ({
  useWallet: () => wallet,
}));

afterEach(() => {
  cleanup();
  wallet.address = null;
  wallet.isConnected = false;
  wallet.isLoading = false;
  wallet.isHydrating = true;
  wallet.chooserOpen = false;
  wallet.walletConnectConfigured = false;
  wallet.options = [];
});

describe("wallet header", () => {
  it("never leaves the header on a stuck Wallet… label", () => {
    wallet.isLoading = true;
    render(<WalletArea />);
    expect(screen.queryByText("Wallet…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Waiting for wallet|Connect wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("swallows a rejected connect so the button does not surface an unhandled error", async () => {
    wallet.isLoading = false;
    wallet.connectWallet.mockRejectedValueOnce(new Error("Request rejected in the wallet."));
    render(<WalletArea />);
    fireEvent.click(screen.getByRole("button", { name: /Connect wallet/i }));
    await Promise.resolve();
    expect(wallet.connectWallet).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeInTheDocument();
  });

  it("shows Retry when discovery failed", () => {
    wallet.discoveryError = "Wallet discovery failed.";
    render(<WalletArea />);
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(wallet.retryDiscovery).toHaveBeenCalled();
    wallet.discoveryError = null;
  });

  it("opens a chooser with injected and unconfigured WalletConnect rows", () => {
    wallet.options = [
      {
        id: "rabby",
        name: "Rabby",
        rdns: "io.rabby",
        icon: null,
        kind: "injected",
        ready: true,
      },
      {
        id: "walletconnect-unconfigured",
        name: "WalletConnect",
        rdns: null,
        icon: null,
        kind: "unavailable",
        ready: false,
        hint: "Needs a Reown project ID",
      },
    ];
    wallet.chooserOpen = true;
    render(<WalletArea />);
    expect(screen.getByText("Rabby")).toBeInTheDocument();
    expect(screen.getByText("WalletConnect")).toBeInTheDocument();
    expect(screen.getByText(/project ID is not set/i)).toBeInTheDocument();
  });

  it("shows connected wallet name, address, and a wrong-network control", () => {
    wallet.address = "0x1234567890123456789012345678901234567890";
    wallet.isConnected = true;
    wallet.isOnCorrectNetwork = false;
    wallet.walletName = "Rabby";
    render(<WalletArea />);
    expect(screen.getByText("Rabby")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Switch to 61997/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disconnect/i })).toBeInTheDocument();
  });
});

describe("mobile wallet chrome", () => {
  it("keeps Connect wallet visible next to the menu on a compact header", () => {
    render(
      <DemoModeProvider>
        <SiteHeader />
      </DemoModeProvider>,
    );
    expect(screen.getByRole("button", { name: /Connect wallet/i })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(screen.getByText("Issue invoice")).toBeInTheDocument();
  });
});
