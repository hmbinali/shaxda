import { ADJACENCY, POINT_IDS } from "./board";
import { formsNewJare } from "./jare";
import type { GameState, PlayerId, PointId } from "./types";

export interface Move {
  from: PointId;
  to: PointId;
}

export function getLegalMoves(
  state: GameState,
  player: PlayerId,
): readonly Move[] {
  if (state.phase !== "movement") {
    return [];
  }

  return POINT_IDS.flatMap((from) => {
    if (state.board[from] !== player) {
      return [];
    }

    return ADJACENCY[from]
      .filter((to) => state.board[to] === null)
      .map((to) => ({ from, to }));
  });
}

export function hasLegalMoves(state: GameState, player: PlayerId): boolean {
  return getLegalMoves(state, player).length > 0;
}

export function getSpaceMakingMoves(
  state: GameState,
  blockedPlayer: PlayerId,
): readonly Move[] {
  if (state.phase !== "movement") {
    return [];
  }

  const opponent = blockedPlayer === "A" ? "B" : "A";

  return getLegalMoves(state, opponent).filter(({ from, to }) => {
    const board = {
      ...state.board,
      [from]: null,
      [to]: opponent,
    };
    const afterMove = { ...state, board };

    return (
      hasLegalMoves(afterMove, blockedPlayer) &&
      !formsNewJare(state.board, board, to, opponent)
    );
  });
}
