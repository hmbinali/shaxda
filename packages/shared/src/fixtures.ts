import {
  POINT_IDS,
  applyAction,
  applyActionLog,
  createInitialState,
  replayActions,
} from "@shaxda/game-engine";
import type {
  BoardOccupancy,
  GameAction,
  GameState,
  PlayerId,
  PointId,
} from "@shaxda/game-engine";

export const noJarePlacementOrder = [
  "O1",
  "O2",
  "O3",
  "O4",
  "O5",
  "O6",
  "O7",
  "O8",
  "M2",
  "M1",
  "M4",
  "M3",
  "M6",
  "M5",
  "M8",
  "M7",
  "I1",
  "I2",
  "I3",
  "I4",
  "I5",
  "I6",
  "I7",
  "I8",
] as const satisfies readonly PointId[];

export const placementJareActions = [
  { type: "place", player: "A", point: "O1" },
  { type: "place", player: "B", point: "M1" },
  { type: "place", player: "A", point: "O2" },
  { type: "place", player: "B", point: "M3" },
  { type: "place", player: "A", point: "O3" },
] as const satisfies readonly GameAction[];

const midPlacementActions = placementJareActions.slice(0, 4);

const initialRemovalActions = noJarePlacementOrder.map(
  (point, index) =>
    ({
      type: "place",
      player: index % 2 === 0 ? "A" : "B",
      point,
    }) as const,
) satisfies readonly GameAction[];

const movementActions = [
  ...initialRemovalActions,
  { type: "removeInitial", player: "B", point: "O1" },
  { type: "removeInitial", player: "A", point: "O2" },
] as const satisfies readonly GameAction[];

const resignationScriptActions = [
  { type: "place", player: "A", point: "O1" },
  { type: "place", player: "B", point: "O2" },
  { type: "resign", player: "B" },
] as const satisfies readonly GameAction[];

export const emptyBoardFixture = createInitialState("A");
export const midPlacementFixture = mustReplay("A", midPlacementActions);
export const placementJareFixture = mustReplay("A", placementJareActions);
export const initialRemovalFixture = mustReplay("A", initialRemovalActions);
export const movementFixture = mustReplay("A", movementActions);
export const capturePendingFixture = mustApply(
  baseMovementState("A", {
    O1: "A",
    O2: "A",
    O4: "A",
    O5: "B",
    O6: "B",
    O8: "B",
  }),
  { type: "move", player: "A", from: "O4", to: "O3" },
);

export const repeatedJareFixture = baseMovementState(
  "A",
  {
    O1: "A",
    O2: "A",
    O4: "A",
    O5: "B",
    O6: "B",
    O7: "B",
  },
  {
    draw: {
      turnsSinceCapture: 2,
      repeatedPositions: {},
    },
  },
);

export const blockedPlayerFixture = baseMovementState("B", {
  O1: "B",
  M1: "B",
  I1: "B",
  O2: "A",
  O8: "A",
  M2: "A",
  M8: "A",
  I2: "A",
  I8: "A",
});

export const blockedSpaceMadeFixture = mustApply(blockedPlayerFixture, {
  type: "move",
  player: "A",
  from: "O2",
  to: "O3",
});

const drawByEightyInitialState = baseMovementState(
  "A",
  {
    O1: "A",
    O5: "A",
    M5: "A",
    I1: "B",
    I5: "B",
    M1: "B",
  },
  {
    draw: {
      turnsSinceCapture: 79,
      repeatedPositions: {},
    },
  },
);

export const drawByEightyTurnsFixture = mustApply(drawByEightyInitialState, {
  type: "move",
  player: "A",
  from: "O1",
  to: "O2",
});

const drawByRepetitionBeforeState = baseMovementState("A", {
  O1: "A",
  O5: "A",
  M5: "A",
  I1: "B",
  I5: "B",
  M1: "B",
});
const drawByRepetitionAfterState: GameState = {
  ...drawByRepetitionBeforeState,
  board: {
    ...drawByRepetitionBeforeState.board,
    O1: null,
    O2: "A",
  },
  currentPlayer: "B",
};
const drawByRepetitionKey = movementPositionKey(drawByRepetitionAfterState);
const drawByRepetitionInitialState: GameState = {
  ...drawByRepetitionBeforeState,
  draw: {
    turnsSinceCapture: 4,
    repeatedPositions: {
      [drawByRepetitionKey]: 2,
    },
  },
};

export const drawByRepetitionFixture = mustApply(drawByRepetitionInitialState, {
  type: "move",
  player: "A",
  from: "O1",
  to: "O2",
});

const forcedJareSpaceMakingInitialState = baseMovementState("A", {
  O1: "B",
  O3: "B",
  O5: "B",
  O4: "A",
  O6: "A",
  O7: "A",
  O8: "A",
  M1: "A",
  M2: "A",
  M3: "A",
  M5: "A",
  M7: "A",
});

export const forcedJareSpaceMakingFixture = mustApply(
  forcedJareSpaceMakingInitialState,
  {
    type: "move",
    player: "A",
    from: "M2",
    to: "O2",
  },
);

export const winFixture: GameState = {
  ...baseMovementState("A", {
    O1: "A",
    O2: "A",
    O3: "A",
    O4: "B",
    O5: "B",
  }),
  phase: "gameOver",
  winner: "A",
  endReason: "opponentBelowThree",
};

export const drawFixture: GameState = {
  ...baseMovementState("A", {
    O1: "A",
    O2: "A",
    O3: "A",
    O5: "B",
    O6: "B",
    O7: "B",
  }),
  phase: "gameOver",
  players: {
    A: { inHand: 0, captured: 8 },
    B: { inHand: 0, captured: 8 },
  },
  winner: null,
  endReason: "drawTermination",
  draw: {
    turnsSinceCapture: 80,
    repeatedPositions: {},
  },
};

export const fullGameActionScripts = [
  {
    name: "early-resignation",
    startingPlayer: "A",
    actions: resignationScriptActions,
    expectedFinalState: mustReplay("A", resignationScriptActions),
  },
] as const;

export const a2ConformanceActionScripts = [
  {
    name: "blocked-space-making",
    initialState: blockedPlayerFixture,
    actions: [{ type: "move", player: "A", from: "O2", to: "O3" }],
    expectedFinalState: blockedSpaceMadeFixture,
  },
  {
    name: "draw-by-80-turns",
    initialState: drawByEightyInitialState,
    actions: [{ type: "move", player: "A", from: "O1", to: "O2" }],
    expectedFinalState: drawByEightyTurnsFixture,
  },
  {
    name: "draw-by-repetition",
    initialState: drawByRepetitionInitialState,
    actions: [{ type: "move", player: "A", from: "O1", to: "O2" }],
    expectedFinalState: drawByRepetitionFixture,
  },
  {
    name: "forced-jare-space-making",
    initialState: forcedJareSpaceMakingInitialState,
    actions: [{ type: "move", player: "A", from: "M2", to: "O2" }],
    expectedFinalState: forcedJareSpaceMakingFixture,
  },
] as const satisfies readonly {
  name: string;
  initialState: GameState;
  actions: readonly GameAction[];
  expectedFinalState: GameState;
}[];

export const gameFixtures = {
  emptyBoard: emptyBoardFixture,
  midPlacement: midPlacementFixture,
  placementJare: placementJareFixture,
  initialRemoval: initialRemovalFixture,
  movement: movementFixture,
  capturePending: capturePendingFixture,
  repeatedJare: repeatedJareFixture,
  blockedPlayer: blockedPlayerFixture,
  blockedSpaceMade: blockedSpaceMadeFixture,
  drawByEightyTurns: drawByEightyTurnsFixture,
  drawByRepetition: drawByRepetitionFixture,
  forcedJareSpaceMaking: forcedJareSpaceMakingFixture,
  win: winFixture,
  draw: drawFixture,
} as const;

function mustReplay(
  startingPlayer: PlayerId,
  actions: readonly GameAction[],
): GameState {
  const result = replayActions(startingPlayer, actions);

  if (!result.ok) {
    throw new Error(
      `fixture replay failed at action ${result.actionIndex}: ${result.error}`,
    );
  }

  return result.state;
}

function mustApply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);

  if (!result.ok) {
    throw new Error(`fixture action failed: ${result.error}`);
  }

  return result.state;
}

export function mustApplyActionLog(
  initialState: GameState,
  actions: readonly GameAction[],
): GameState {
  const result = applyActionLog(initialState, actions);

  if (!result.ok) {
    throw new Error(
      `fixture action log failed at action ${result.actionIndex}: ${result.error}`,
    );
  }

  return result.state;
}

function baseMovementState(
  currentPlayer: PlayerId,
  pieces: Partial<Record<PointId, PlayerId>>,
  overrides: Partial<GameState> = {},
): GameState {
  const state = createInitialState("A");

  return {
    ...state,
    ...overrides,
    phase: "movement",
    currentPlayer,
    firstAdvantage: "A",
    players: {
      A: { inHand: 0, captured: 0 },
      B: { inHand: 0, captured: 0 },
    },
    initialRemoval: {
      removedBy: { A: true, B: true },
    },
    board: boardWith(pieces),
    pendingCapture: null,
    winner: null,
    endReason: null,
  };
}

function boardWith(
  pieces: Partial<Record<PointId, PlayerId | null>>,
): BoardOccupancy {
  const emptyBoard = Object.fromEntries(
    POINT_IDS.map((point) => [point, null]),
  ) as BoardOccupancy;

  return { ...emptyBoard, ...pieces };
}

function movementPositionKey(state: GameState): string {
  const board = POINT_IDS.map((point) => state.board[point] ?? "-").join("");

  return `${state.phase}|${state.pendingCapture === null ? "none" : "capture"}|${state.currentPlayer}|${board}`;
}
