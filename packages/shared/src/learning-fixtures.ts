import {
  POINT_IDS,
  applyActionLog,
  createInitialState,
} from "@shaxda/game-engine";
import type {
  BoardOccupancy,
  GameAction,
  GameState,
  PlayerId,
  PointId,
} from "@shaxda/game-engine";

const legalMovementFixture = movementState("A", {
  O1: "A",
  M5: "A",
  I7: "A",
  O5: "B",
  M1: "B",
  I5: "B",
});

const repeatedJareInitialState = movementState("A", {
  O1: "A",
  O2: "A",
  O4: "A",
  M7: "A",
  I5: "A",
  O5: "B",
  O6: "B",
  M5: "B",
  M1: "B",
  I7: "B",
});

const repeatedJareIrmaanActions = [
  { type: "move", player: "A", from: "O4", to: "O3" },
  { type: "capture", player: "A", point: "M1" },
  { type: "move", player: "B", from: "I7", to: "I8" },
  { type: "move", player: "A", from: "O2", to: "M2" },
  { type: "move", player: "B", from: "I8", to: "I7" },
  { type: "move", player: "A", from: "M2", to: "O2" },
] as const satisfies readonly GameAction[];

export const learningActionScripts = {
  repeatedJareIrmaan: {
    initialState: repeatedJareInitialState,
    actions: repeatedJareIrmaanActions,
  },
} as const;

export const learningFixtures = {
  legalMovement: legalMovementFixture,
  repeatedJareFormed: mustApply(
    repeatedJareInitialState,
    repeatedJareIrmaanActions.slice(0, 1),
  ),
  repeatedJareOpened: mustApply(
    repeatedJareInitialState,
    repeatedJareIrmaanActions.slice(0, 4),
  ),
  repeatedJareReformed: mustApply(
    repeatedJareInitialState,
    repeatedJareIrmaanActions,
  ),
} as const;

function movementState(
  currentPlayer: PlayerId,
  pieces: Partial<Record<PointId, PlayerId>>,
): GameState {
  const state = createInitialState("A");

  return {
    ...state,
    phase: "movement",
    board: boardWith(pieces),
    currentPlayer,
    players: {
      A: { inHand: 0, captured: 0 },
      B: { inHand: 0, captured: 0 },
    },
    firstAdvantage: "A",
    initialRemoval: {
      removedBy: { A: true, B: true },
    },
  };
}

function boardWith(pieces: Partial<Record<PointId, PlayerId>>): BoardOccupancy {
  return Object.fromEntries(
    POINT_IDS.map((point) => [point, pieces[point] ?? null]),
  ) as BoardOccupancy;
}

function mustApply(
  initialState: GameState,
  actions: readonly GameAction[],
): GameState {
  const result = applyActionLog(initialState, actions);

  if (!result.ok) {
    throw new Error(
      `learning fixture failed at action ${result.actionIndex}: ${result.error}`,
    );
  }

  return result.state;
}
