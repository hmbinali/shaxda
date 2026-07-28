import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import GameActionsMenuHarness from "./GameActionsMenuHarness.svelte";

describe("GameActionsMenu", () => {
  it("dismisses with Escape and restores focus to its trigger", async () => {
    render(GameActionsMenuHarness);
    const trigger = screen.getByLabelText("More actions");

    trigger.focus();
    await fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "More actions",
    });
    await waitFor(() =>
      expect(screen.getByTestId("game-actions-close")).toHaveFocus(),
    );

    await fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("dismisses from the backdrop and visible close control", async () => {
    render(GameActionsMenuHarness);
    const trigger = screen.getByLabelText("More actions");

    await fireEvent.click(trigger);
    await fireEvent.click(await screen.findByTestId("game-actions-backdrop"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await fireEvent.click(trigger);
    await fireEvent.click(await screen.findByTestId("game-actions-close"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
