import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from "../components/shared/EmptyState";

afterEach(() => {
  cleanup();
});

describe("empty-state action contrast", () => {
  it("uses an explicit light text color on the dark action link", () => {
    render(
      <EmptyState
        title="No merchant credit"
        body="Withdraw later."
        actionHref="/explore"
        actionLabel="View public activity"
      />,
    );
    const action = screen.getByRole("link", { name: /View public activity/ });
    expect(action.className).toMatch(/text-white/);
    expect(action.className).toMatch(/bg-primary/);
  });
});
