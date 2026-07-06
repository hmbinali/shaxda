import { POINT_IDS, getLegalMoves, legalActions } from "@shaxda/game-engine";
import type {
  GameState,
  PlayerId,
  PointId,
  PointState,
} from "@shaxda/game-engine";
import { BOARD_LINES, POINT_COORDS } from "./layout";

export interface BoardViewOptions {
  selected?: PointId | null;
}

export interface BoardPointView {
  id: PointId;
  x: number;
  y: number;
  occupant: PointState;
  isSelected: boolean;
  isLegalHint: boolean;
  isCaptureTarget: boolean;
}

export interface BoardView {
  points: BoardPointView[];
  lines: typeof BOARD_LINES;
}

export function buildBoardView(
  state: GameState,
  options: BoardViewOptions = {},
): BoardView {
  const selected = options.selected ?? null;
  const legalHintPoints = getLegalHintPoints(state, selected);
  const captureTargetPoints = getCaptureTargetPoints(state);

  return {
    lines: BOARD_LINES,
    points: POINT_IDS.map((id) => {
      const coord = POINT_COORDS[id];

      return {
        id,
        x: coord.x,
        y: coord.y,
        occupant: state.board[id],
        isSelected: id === selected,
        isLegalHint: legalHintPoints.has(id),
        isCaptureTarget: captureTargetPoints.has(id),
      };
    }),
  };
}

function getLegalHintPoints(
  state: GameState,
  selected: PointId | null,
): Set<PointId> {
  if (
    state.phase !== "movement" ||
    selected === null ||
    state.board[selected] !== state.currentPlayer
  ) {
    return new Set();
  }

  return new Set(
    getLegalMoves(state, state.currentPlayer)
      .filter((move) => move.from === selected)
      .map((move) => move.to),
  );
}

function getCaptureTargetPoints(state: GameState): Set<PointId> {
  if (state.phase !== "capture" || state.pendingCapture === null) {
    return new Set();
  }

  return new Set(
    legalActions(state)
      .filter((action) => action.type === "capture")
      .filter((action) => isCaptureByPendingPlayer(action.player, state))
      .map((action) => action.point),
  );
}

function isCaptureByPendingPlayer(player: PlayerId, state: GameState): boolean {
  return player === state.pendingCapture?.player;
}
