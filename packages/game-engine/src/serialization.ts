import { POINT_IDS } from "./board";
import { applyAction } from "./reducer";
import { createInitialState } from "./state";
import type {
  BoardOccupancy,
  GameAction,
  GameState,
  PlayerId,
  PointState,
} from "./types";

export type SerializedGameState = string;

export type ReplayResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string; actionIndex: number };

export function serialize(state: GameState): SerializedGameState {
  return JSON.stringify(normalizeGameState(state));
}

export function deserialize(serialized: SerializedGameState): GameState {
  const parsed = JSON.parse(serialized) as unknown;

  if (!isGameStateLike(parsed)) {
    throw new Error("Invalid serialized game state");
  }

  return normalizeGameState(parsed);
}

export function applyActionLog(
  initialState: GameState,
  actions: readonly GameAction[],
): ReplayResult {
  let state = initialState;

  for (const [actionIndex, action] of actions.entries()) {
    const result = applyAction(state, action);

    if (!result.ok) {
      return { ok: false, error: result.error, actionIndex };
    }

    state = result.state;
  }

  return { ok: true, state };
}

export function replayActions(
  startingPlayer: PlayerId,
  actions: readonly GameAction[],
): ReplayResult {
  return applyActionLog(createInitialState(startingPlayer), actions);
}

function normalizeGameState(state: GameState): GameState {
  return {
    phase: state.phase,
    board: normalizeBoard(state.board),
    currentPlayer: state.currentPlayer,
    players: {
      A: {
        inHand: state.players.A.inHand,
        captured: state.players.A.captured,
      },
      B: {
        inHand: state.players.B.inHand,
        captured: state.players.B.captured,
      },
    },
    startingPlayer: state.startingPlayer,
    firstAdvantage: state.firstAdvantage,
    initialRemoval: {
      removedBy: {
        A: state.initialRemoval.removedBy.A,
        B: state.initialRemoval.removedBy.B,
      },
    },
    pendingCapture:
      state.pendingCapture === null
        ? null
        : {
            player: state.pendingCapture.player,
            formedAt: state.pendingCapture.formedAt,
          },
    draw: {
      turnsSinceCapture: state.draw.turnsSinceCapture,
      repeatedPositions: { ...state.draw.repeatedPositions },
    },
    winner: state.winner,
    endReason: state.endReason,
  };
}

function normalizeBoard(board: BoardOccupancy): BoardOccupancy {
  return Object.fromEntries(
    POINT_IDS.map((point) => [point, board[point]]),
  ) as BoardOccupancy;
}

function isGameStateLike(value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }

  const state = value as Partial<GameState>;

  return (
    isPhase(state.phase) &&
    isPlayer(state.currentPlayer) &&
    isPlayer(state.startingPlayer) &&
    (state.firstAdvantage === null || isPlayer(state.firstAdvantage)) &&
    (state.winner === null || isPlayer(state.winner)) &&
    (state.endReason === null || isGameEndReason(state.endReason)) &&
    isBoard(state.board) &&
    isRecord(state.players) &&
    isRecord(state.players.A) &&
    isRecord(state.players.B) &&
    typeof state.players.A.inHand === "number" &&
    typeof state.players.A.captured === "number" &&
    typeof state.players.B.inHand === "number" &&
    typeof state.players.B.captured === "number" &&
    isRecord(state.initialRemoval) &&
    isRecord(state.initialRemoval.removedBy) &&
    typeof state.initialRemoval.removedBy.A === "boolean" &&
    typeof state.initialRemoval.removedBy.B === "boolean" &&
    (state.pendingCapture === null ||
      (isRecord(state.pendingCapture) &&
        isPlayer(state.pendingCapture.player) &&
        isPointId(state.pendingCapture.formedAt))) &&
    isRecord(state.draw) &&
    typeof state.draw.turnsSinceCapture === "number" &&
    isRecord(state.draw.repeatedPositions)
  );
}

function isBoard(value: unknown): value is BoardOccupancy {
  if (!isRecord(value)) {
    return false;
  }

  return POINT_IDS.every((point) => isPointState(value[point]));
}

function isPointState(value: unknown): value is PointState {
  return value === null || isPlayer(value);
}

function isPlayer(value: unknown): value is PlayerId {
  return value === "A" || value === "B";
}

function isPhase(value: unknown): value is GameState["phase"] {
  return (
    value === "placement" ||
    value === "initialRemoval" ||
    value === "movement" ||
    value === "capture" ||
    value === "gameOver"
  );
}

function isGameEndReason(value: unknown): value is GameState["endReason"] {
  return (
    value === "opponentBelowThree" ||
    value === "opponentCapturedAll" ||
    value === "resignation" ||
    value === "drawTermination" ||
    value === "bothBlocked" ||
    value === "forcedJareSpaceMaking"
  );
}

function isPointId(value: unknown): value is (typeof POINT_IDS)[number] {
  return (
    typeof value === "string" &&
    (POINT_IDS as readonly string[]).includes(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
