import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAccounts, switchToGenLayerNetwork } from "../lib/genlayer/client";

afterEach(() => {
  Object.defineProperty(window, "ethereum", { configurable: true, value: undefined });
});

describe("wallet rejection and wrong network", () => {
  it("maps 4001 to a user-rejected connection error", async () => {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: {
        request: vi.fn().mockRejectedValue({ code: 4001, message: "denied" }),
        on: vi.fn(),
        removeListener: vi.fn(),
      },
    });
    await expect(requestAccounts()).rejects.toThrow(/rejected/i);
  });

  it("maps 4001 when switching to Studio Next", async () => {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: {
        request: vi.fn().mockRejectedValue({ code: 4001, message: "denied" }),
        on: vi.fn(),
        removeListener: vi.fn(),
      },
    });
    await expect(switchToGenLayerNetwork()).rejects.toThrow(/rejected/i);
  });
});
