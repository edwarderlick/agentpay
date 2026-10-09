import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageControls } from "../components/shared/PageControls";
import AgentPayAdapter, { PAGE } from "../lib/contract/adapter";

const PRODUCT = "0x754E97a763ed0Ae12da496A68d7a47090F3f1c2F";
const OWNER = "0x1111111111111111111111111111111111111111";

const views = vi.hoisted(() => ({
  readView: vi.fn(),
}));

vi.mock("../lib/contract/readClient", () => ({
  readView: views.readView,
  readNativeBalance: vi.fn(async () => 0n),
}));

describe("PageControls", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves between page one and page two", async () => {
    const user = userEvent.setup();
    let offset = 0;
    const onPrev = vi.fn(() => {
      offset = Math.max(0, offset - PAGE);
    });
    const onNext = vi.fn(() => {
      offset += PAGE;
    });
    const { rerender } = render(
      <PageControls
        offset={offset}
        limit={PAGE}
        total={40}
        hasMore
        onPrev={onPrev}
        onNext={onNext}
        label="Owned mandates"
      />,
    );
    expect(screen.getByText(/Owned mandates 1 of 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    rerender(
      <PageControls
        offset={PAGE}
        limit={PAGE}
        total={40}
        hasMore={false}
        onPrev={onPrev}
        onNext={onNext}
        label="Owned mandates"
      />,
    );
    expect(screen.getByText(/Owned mandates 2 of 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});

describe("paginated adapter views", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    views.readView.mockReset();
  });

  it("requests page two at offset 20 for owner mandates", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", PRODUCT);
    views.readView.mockImplementation(async (method: string, args: unknown[]) => {
      if (method === "list_mandates_for_owner") {
        const offset = Number(args[1]);
        const limit = Number(args[2]);
        const ids = Array.from({ length: 40 }, (_, i) => `m-${i}`);
        return {
          ids: ids.slice(offset, offset + limit),
          total: 40,
          offset,
          limit,
          has_more: offset + limit < 40,
        };
      }
      if (method === "get_mandate") {
        const id = String(args[0]);
        return {
          id,
          title: id,
          purpose: "GPU",
          owner: OWNER,
          agent: OWNER,
          merchants: [OWNER],
          per_payment_cap: 1,
          total_budget: 2,
          remaining_budget: 2,
          expiry: 4102444800,
          closed: false,
          status: "active",
        };
      }
      return {};
    });

    const adapter = new AgentPayAdapter(OWNER);
    const pageTwo = await adapter.listMandatesForOwner(OWNER, PAGE);
    expect(PAGE).toBe(20);
    expect(pageTwo.ok).toBe(true);
    if (!pageTwo.ok) return;
    expect(pageTwo.data.offset).toBe(20);
    expect(pageTwo.data.items).toHaveLength(20);
    expect(pageTwo.data.items[0]?.id).toBe("m-20");
    expect(pageTwo.data.hasMore).toBe(false);
    expect(views.readView).toHaveBeenCalledWith("list_mandates_for_owner", [OWNER, 20, 20]);
  });
});
