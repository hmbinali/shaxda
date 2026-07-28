import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ConfirmSheetHarness from "./ConfirmSheetHarness.svelte";

describe("ConfirmSheet", () => {
  it("traps focus, dismisses with Escape, restores focus, and inerts the background", async () => {
    render(ConfirmSheetHarness);
    const opener = screen.getByRole("button", { name: "Open" });

    opener.focus();
    await fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Confirm" });
    const cancel = screen.getAllByRole("button", { name: "Cancel" })[1];
    const confirm = screen.getByRole("button", { name: "Continue" });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(confirm).toHaveFocus());
    expect(screen.getByTestId("sheet-background")).toHaveProperty(
      "inert",
      true,
    );

    await fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();
    await fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();

    await fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.getByTestId("sheet-background")).toHaveProperty(
      "inert",
      false,
    );
  });

  it("dismisses from the backdrop and confirms from the primary action", async () => {
    render(ConfirmSheetHarness);
    const opener = screen.getByRole("button", { name: "Open" });

    await fireEvent.click(opener);
    await fireEvent.click(screen.getByTestId("confirm-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await fireEvent.click(opener);
    await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("confirmed")).toBeInTheDocument();
  });

  it("keeps short-height content internally scrollable", async () => {
    render(ConfirmSheetHarness);
    await fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByTestId("confirm-sheet")).toHaveStyle({
      overflowY: "auto",
    });
  });
});
