import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "../components/layout/SiteHeader";
import { DemoModeProvider } from "../lib/demo/DemoMode";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/genlayer/WalletProvider", () => ({
  useWallet: () => ({
    address: null,
    isConnected: false,
    isOnCorrectNetwork: true,
    isLoading: false,
    isHydrating: false,
    openChooser: () => undefined,
  }),
}));

vi.mock("@/components/wallet/WalletArea", () => ({
  WalletArea: () => <div>Wallet</div>,
}));

afterEach(() => {
  cleanup();
});

describe("mobile layout", () => {
  it("exposes a menu that lists primary routes", () => {
    render(
      <DemoModeProvider>
        <SiteHeader />
      </DemoModeProvider>,
    );
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Credits").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Explore").length).toBeGreaterThan(0);
  });
});
