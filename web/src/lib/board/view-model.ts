import {
  JARE_LINES,
  POINT_IDS,
  completedJareLines,
  legalActions,
} from "@shaxda/game-engine";
import type { JareLine } from "@shaxda/game-engine";
import type {
  GameAction,
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
  isRemovalTarget: boolean;
}

export interface BoardJareLineView {
  id: string;
  points: JareLine;
  isCompleted: boolean;
  owner: PlayerId | null;
  isActivePendingCapture: boolean;
}

export interface BoardView {
  points: BoardPointView[];
  lines: typeof BOARD_LINES;
  jareLines: BoardJareLineView[];
  movablePoints: Set<PointId>;
}

export function buildBoardView(
  state: GameState,
  options: BoardViewOptions = {},
): BoardView {
  const selected = options.selected ?? null;
  const actions = legalActions(state);
  const legalHintPoints = getLegalHintPoints(state, selected, actions);
  const captureTargetPoints = getCaptureTargetPoints(state, actions);
  const removalTargetPoints = getRemovalTargetPoints(state, actions);

  return {
    lines: BOARD_LINES,
    jareLines: buildJareLineViews(state),
    movablePoints: getMovablePoints(actions),
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
        isRemovalTarget: removalTargetPoints.has(id),
      };
    }),
  };
}

function buildJareLineViews(state: GameState): BoardJareLineView[] {
  const activePendingCaptureLineIds = getActivePendingCaptureLineIds(state);

  return JARE_LINES.map((line) => {
    const owner = getLineOwner(state, line);
    const id = line.join("-");

    return {
      id,
      points: line,
      isCompleted: owner !== null,
      owner,
      isActivePendingCapture: activePendingCaptureLineIds.has(id),
    };
  });
}

function getLineOwner(state: GameState, line: JareLine): PlayerId | null {
  const [firstPoint] = line;
  const firstOccupant = state.board[firstPoint];

  if (firstOccupant === null) {
    return null;
  }

  return line.every((point) => state.board[point] === firstOccupant)
    ? firstOccupant
    : null;
}

function getActivePendingCaptureLineIds(state: GameState): Set<string> {
  if (state.pendingCapture === null) {
    return new Set();
  }

  return new Set(
    completedJareLines(
      state.board,
      state.pendingCapture.formedAt,
      state.pendingCapture.player,
    ).map((line) => line.join("-")),
  );
}

function getLegalHintPoints(
  state: GameState,
  selected: PointId | null,
  actions: readonly GameAction[],
): Set<PointId> {
  if (state.phase !== "movement" || selected === null) {
    return new Set();
  }

  return new Set(
    actions
      .filter(
        (action): action is Extract<GameAction, { type: "move" }> =>
          action.type === "move" && action.from === selected,
      )
      .map((action) => action.to),
  );
}

function getCaptureTargetPoints(
  state: GameState,
  actions: readonly GameAction[],
): Set<PointId> {
  if (state.phase !== "capture" || state.pendingCapture === null) {
    return new Set();
  }

  return new Set(
    actions
      .filter((action) => action.type === "capture")
      .filter((action) => isCaptureByPendingPlayer(action.player, state))
      .map((action) => action.point),
  );
}

function isCaptureByPendingPlayer(player: PlayerId, state: GameState): boolean {
  return player === state.pendingCapture?.player;
}

function getRemovalTargetPoints(
  state: GameState,
  actions: readonly GameAction[],
): Set<PointId> {
  if (state.phase !== "initialRemoval") {
    return new Set();
  }

  return new Set(
    actions
      .filter((action) => action.type === "removeInitial")
      .map((action) => action.point),
  );
}

function getMovablePoints(actions: readonly GameAction[]): Set<PointId> {
  return new Set(
    actions
      .filter(
        (action): action is Extract<GameAction, { type: "move" }> =>
          action.type === "move",
      )
      .map((action) => action.from),
  );
}
