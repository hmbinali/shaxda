import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { messages } from "@shaxda/i18n";
import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it, vi } from "vitest";
import { buildGameStatus } from "$lib/game/status";
import GameResultOverlay from "./GameResultOverlay.svelte";

const copy = messages.so.localGame;
const playerName = (player: "A" | "B") => copy.playerNames[player];

describe("GameResultOverlay", () => {
  it("renders one labelled modal local result and focuses its primary action", async () => {
    const onNewGame = vi.fn();
    const onExit = vi.fn();
    const outside = document.createElement("button");
    document.body.append(outside);

    render(GameResultOverlay, {
      status: buildGameStatus(gameFixtures.win),
      playerName,
      reason: copy.result.reasons.opponentBelowThree,
      testId: "game-result",
      actions: [
        {
          id: "new-game",
          label: copy.controls.newGame,
          variant: "primary",
          onSelect: onNewGame,
        },
        {
          id: "exit",
          label: copy.controls.exit,
          variant: "outline",
          onSelect: onExit,
        },
      ],
      inertTargets: [outside],
    });

    const dialog = screen.getByRole("dialog", {
      name: `${copy.result.winnerLabel}: ${copy.playerNames.A}`,
    });
    const newGame = screen.getByRole("button", {
      name: copy.controls.newGame,
    });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getAllByTestId("game-result-panel")).toHaveLength(1);
    expect(dialog).toHaveTextContent(copy.result.reasons.opponentBelowThree);
    await waitFor(() => expect(newGame).toHaveFocus());
    expect(outside.inert).toBe(true);

    const exit = screen.getByRole("button", { name: copy.controls.exit });
    await fireEvent.keyDown(newGame, { key: "Tab", shiftKey: true });
    expect(exit).toHaveFocus();
    await fireEvent.keyDown(exit, { key: "Tab" });
    expect(newGame).toHaveFocus();
    await fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog).toBeInTheDocument();

    await fireEvent.click(newGame);
    await fireEvent.click(exit);

    expect(onNewGame).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
    outside.remove();
  });

  it("renders one online action and describes the rematch notice", async () => {
    const onNewMatch = vi.fn();
    const onlineCopy = messages.so.onlineGame;

    render(GameResultOverlay, {
      status: buildGameStatus(gameFixtures.draw),
      playerName,
      notice: onlineCopy.rematch.notices.requested,
      testId: "online-game-result",
      actions: [
        {
          id: "new-match",
          label: onlineCopy.newRoom,
          variant: "primary",
          onSelect: onNewMatch,
          testId: "online-new-match",
        },
      ],
    });

    const dialog = screen.getByRole("dialog", { name: copy.result.drawLabel });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      onlineCopy.rematch.notices.requested,
    );
    expect(screen.getAllByTestId("game-result-panel")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: copy.controls.newGame }),
    ).not.toBeInTheDocument();

    const newMatch = screen.getByTestId("online-new-match");
    expect(newMatch).toHaveTextContent(onlineCopy.newRoom);
    await waitFor(() => expect(newMatch).toHaveFocus());
    await fireEvent.click(newMatch);

    expect(onNewMatch).toHaveBeenCalledOnce();
  });

  it("keeps a three-action rematch choice reachable in order", async () => {
    const onlineCopy = messages.so.onlineGame;
    const onAccept = vi.fn();
    const onDecline = vi.fn();

    render(GameResultOverlay, {
      status: buildGameStatus(gameFixtures.win),
      playerName,
      notice: onlineCopy.rematch.notices.opponentRequested,
      testId: "online-game-result",
      actions: [
        {
          id: "rematch",
          label: onlineCopy.rematch.accept,
          variant: "primary",
          onSelect: onAccept,
        },
        {
          id: "rematch-decline",
          label: onlineCopy.rematch.decline,
          variant: "outline",
          onSelect: onDecline,
        },
        {
          id: "new-match",
          label: onlineCopy.newRoom,
          variant: "outline",
          onSelect: vi.fn(),
        },
      ],
    });

    const accept = screen.getByRole("button", {
      name: onlineCopy.rematch.accept,
    });
    const decline = screen.getByRole("button", {
      name: onlineCopy.rematch.decline,
    });
    const newMatch = screen.getByRole("button", { name: onlineCopy.newRoom });
    await waitFor(() => expect(accept).toHaveFocus());

    await fireEvent.keyDown(accept, { key: "Tab", shiftKey: true });
    expect(newMatch).toHaveFocus();
    await fireEvent.keyDown(newMatch, { key: "Tab" });
    expect(accept).toHaveFocus();

    await fireEvent.click(accept);
    await fireEvent.click(decline);

    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });
});
