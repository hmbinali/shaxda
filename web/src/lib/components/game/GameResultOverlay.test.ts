import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { messages } from "@shaxda/i18n";
import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it, vi } from "vitest";
import { buildGameStatus } from "$lib/game/status";
import GameResultOverlay from "./GameResultOverlay.svelte";

const copy = messages.so.localGame;
const playerName = (player: "A" | "B") => copy.playerNames[player];

describe("GameResultOverlay", () => {
  it("renders one labelled non-modal local result and focuses its primary action", async () => {
    const onNewGame = vi.fn();
    const onExit = vi.fn();

    render(GameResultOverlay, {
      status: buildGameStatus(gameFixtures.win),
      playerName,
      reason: copy.result.reasons.opponentBelowThree,
      testId: "game-result",
      onNewGame,
      onExit,
    });

    const dialog = screen.getByRole("dialog", {
      name: `${copy.result.winnerLabel}: ${copy.playerNames.A}`,
    });
    const newGame = screen.getByRole("button", {
      name: copy.controls.newGame,
    });

    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(screen.getAllByTestId("game-result-panel")).toHaveLength(1);
    expect(dialog).toHaveTextContent(copy.result.reasons.opponentBelowThree);
    await waitFor(() => expect(newGame).toHaveFocus());

    await fireEvent.click(newGame);
    await fireEvent.click(
      screen.getByRole("button", { name: copy.controls.exit }),
    );

    expect(onNewGame).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("renders one online leave action", async () => {
    const onLeave = vi.fn();

    render(GameResultOverlay, {
      status: buildGameStatus(gameFixtures.draw),
      playerName,
      testId: "online-game-result",
      onLeave,
    });

    expect(
      screen.getByRole("dialog", { name: copy.result.drawLabel }),
    ).not.toHaveAttribute("aria-modal");
    expect(screen.getAllByTestId("game-result-panel")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: copy.controls.newGame }),
    ).not.toBeInTheDocument();

    const leave = screen.getByRole("button", {
      name: messages.so.onlineGame.leave,
    });
    await waitFor(() => expect(leave).toHaveFocus());
    await fireEvent.click(leave);

    expect(onLeave).toHaveBeenCalledOnce();
  });
});
