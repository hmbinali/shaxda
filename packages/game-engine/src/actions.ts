import { POINT_IDS } from "./board";
import { getLegalMoves } from "./moves";
import { otherPlayer } from "./reducer";
import type { GameAction, GameState, PlayerId } from "./types";

export function legalActions(state: GameState): readonly GameAction[] {
  if (state.phase === "gameOver") {
    return [];
  }

  const resign = [{ type: "resign", player: state.currentPlayer }] as const;

  switch (state.phase) {
    case "placement":
      if (state.players[state.currentPlayer].inHand <= 0) {
        return resign;
      }
      return [
        ...POINT_IDS.filter((point) => state.board[point] === null).map(
          (point) =>
            ({ type: "place", player: state.currentPlayer, point }) as const,
        ),
        ...resign,
      ];
    case "initialRemoval": {
      if (state.initialRemoval.removedBy[state.currentPlayer]) {
        return resign;
      }
      return [
        ...POINT_IDS.filter(
          (point) => state.board[point] === otherPlayer(state.currentPlayer),
        ).map(
          (point) =>
            ({
              type: "removeInitial",
              player: state.currentPlayer,
              point,
            }) as const,
        ),
        ...resign,
      ];
    }
    case "movement":
      return [
        ...getLegalMoves(state, state.currentPlayer).map(
          ({ from, to }) =>
            ({ type: "move", player: state.currentPlayer, from, to }) as const,
        ),
        ...resign,
      ];
    case "capture": {
      const capturePlayer = state.pendingCapture?.player ?? state.currentPlayer;
      return [
        ...POINT_IDS.filter(
          (point) => state.board[point] === otherPlayer(capturePlayer),
        ).map(
          (point) =>
            ({ type: "capture", player: capturePlayer, point }) as const,
        ),
        { type: "resign", player: capturePlayer },
      ];
    }
  }
}

export function legalActionsForPlayer(
  state: GameState,
  player: PlayerId,
): readonly GameAction[] {
  return legalActions(state).filter((action) => action.player === player);
}
