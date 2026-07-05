import { ADJACENCY, POINT_IDS } from "./board";
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
