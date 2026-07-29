import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import InvalidToast from "./InvalidToast.svelte";

describe("InvalidToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cannot intercept board pointer input", () => {
    render(InvalidToast, {
      message: "Tallaabada lama aqbalin.",
      nonce: 1,
      testId: "invalid-feedback",
    });

    const toast = screen.getByTestId("invalid-feedback");
    expect(toast).toHaveStyle({ pointerEvents: "none" });
    expect(toast).toHaveAttribute("role", "status");
  });

  it("fades after two seconds and is removed by 2.2 seconds", async () => {
    vi.useFakeTimers();
    render(InvalidToast, {
      message: "Tallaabada lama aqbalin.",
      nonce: 1,
      testId: "invalid-feedback",
    });

    await vi.advanceTimersByTimeAsync(1_999);
    expect(screen.getByTestId("invalid-feedback")).not.toHaveClass("fading");

    await vi.advanceTimersByTimeAsync(1);
    expect(screen.getByTestId("invalid-feedback")).toHaveClass("fading");

    await vi.advanceTimersByTimeAsync(200);
    expect(screen.queryByTestId("invalid-feedback")).not.toBeInTheDocument();
  });

  it("restarts the lifetime when a new nonce repeats the same message", async () => {
    vi.useFakeTimers();
    const { rerender } = render(InvalidToast, {
      message: "Tallaabada lama aqbalin.",
      nonce: 1,
      testId: "invalid-feedback",
    });

    await vi.advanceTimersByTimeAsync(1_900);
    await rerender({
      message: "Tallaabada lama aqbalin.",
      nonce: 2,
      testId: "invalid-feedback",
    });
    await vi.advanceTimersByTimeAsync(200);

    expect(screen.getByTestId("invalid-feedback")).not.toHaveClass("fading");
    expect(screen.getByTestId("invalid-feedback")).toHaveAttribute(
      "data-feedback-nonce",
      "2",
    );
  });
});
