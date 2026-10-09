import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../lib/contract/readClient";
import {
  CHAIN_READ_RETRY_LIMIT,
  shouldRetryChainRead,
} from "../lib/query/chainReadRetry";

describe("withRetry for gen_call / RPC reads", () => {
  it("does not retry gen_call Failed to fetch", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("gen_call: Failed to fetch"));
    await expect(withRetry(fn, 8, 1)).rejects.toThrow(/Failed to fetch/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries Server busy then returns", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server busy"))
      .mockResolvedValueOnce("ok");
    await expect(withRetry(fn, 8, 1)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("React Query chain-read retry policy", () => {
  it("retries a transient Failed to fetch a finite number of times", () => {
    const error = new Error("gen_call: Failed to fetch");
    expect(shouldRetryChainRead(0, error)).toBe(true);
    expect(shouldRetryChainRead(1, error)).toBe(true);
    expect(shouldRetryChainRead(CHAIN_READ_RETRY_LIMIT, error)).toBe(false);
  });

  it("stops retrying a persistent non-transient read failure", () => {
    const error = new Error("Mandate not found");
    expect(shouldRetryChainRead(0, error)).toBe(false);
    expect(shouldRetryChainRead(1, error)).toBe(false);
  });
});
