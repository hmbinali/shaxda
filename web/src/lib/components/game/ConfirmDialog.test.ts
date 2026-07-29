import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ConfirmDialogHarness from "./ConfirmDialogHarness.svelte";

describe("ConfirmDialog", () => {
  it("traps focus, dismisses with Escape, restores focus, and inerts the background", async () => {
    render(ConfirmDialogHarness);
    const opener = screen.getByRole("button", { name: "Open" });

    opener.focus();
    await fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Confirm" });
    const cancel = screen.getAllByRole("button", { name: "Cancel" })[1];
    const confirm = screen.getByRole("button", { name: "Continue" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveAttribute("data-edge");
    await waitFor(() => expect(confirm).toHaveFocus());
    expect(screen.getByTestId("dialog-background")).toHaveProperty(
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
    expect(screen.getByTestId("dialog-background")).toHaveProperty(
      "inert",
      false,
    );
  });

  it("dismisses from the backdrop and confirms from the primary action", async () => {
    render(ConfirmDialogHarness);
    const opener = screen.getByRole("button", { name: "Open" });

    await fireEvent.click(opener);
    await fireEvent.click(screen.getByTestId("confirm-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await fireEvent.click(opener);
    await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("confirmed")).toBeInTheDocument();
  });

  it("keeps short-height content internally scrollable", async () => {
    render(ConfirmDialogHarness);
    await fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByTestId("confirm-dialog")).toHaveStyle({
      overflowY: "auto",
    });
  });
});
