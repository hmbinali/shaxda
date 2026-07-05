import { POINT_IDS } from "./board";
import type { BoardOccupancy, GameState, PlayerId } from "./types";

export const PIECES_PER_PLAYER = 12;

export function createInitialState(startingPlayer: PlayerId): GameState {
  const board = Object.fromEntries(
    POINT_IDS.map((point) => [point, null]),
  ) as BoardOccupancy;

  return {
    phase: "placement",
    board,
    currentPlayer: startingPlayer,
    startingPlayer,
    firstAdvantage: null,
    initialRemoval: {
      removedBy: { A: false, B: false },
    },
    pendingCapture: null,
    draw: {
      turnsSinceCapture: 0,
      repeatedPositions: {},
    },
    winner: null,
    endReason: null,
    players: {
      A: { inHand: PIECES_PER_PLAYER, captured: 0 },
      B: { inHand: PIECES_PER_PLAYER, captured: 0 },
    },
  };
}
