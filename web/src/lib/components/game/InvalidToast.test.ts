import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import InvalidToast from "./InvalidToast.svelte";

describe("InvalidToast", () => {
  it("cannot intercept board pointer input", () => {
    render(InvalidToast, {
      message: "Tallaabada lama aqbalin.",
      testId: "invalid-feedback",
    });

    const toast = screen.getByTestId("invalid-feedback");
    expect(toast).toHaveStyle({ pointerEvents: "none" });
    expect(toast).toHaveAttribute("role", "status");
  });
});
