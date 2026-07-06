import { describe, expect, it } from "vitest";
import { POINT_IDS } from "./board";
import { applyAction, getActingPlayer } from "./reducer";
import { createInitialState } from "./state";
import type {
  BoardOccupancy,
  GameAction,
  GameState,
  PlayerId,
  PointId,
} from "./types";

function apply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);

  if (!result.ok) {
    throw new Error(
      `expected ${action.type} to succeed, got "${result.error}"`,
    );
  }

  return result.state;
}

function expectError(
  state: GameState,
  action: GameAction,
  error: string,
): void {
  expect(applyAction(state, action)).toEqual({ ok: false, error });
}

/** Places each point in order, alternating from the current player. */
function placeAll(state: GameState, points: readonly PointId[]): GameState {
  return points.reduce(
    (current, point) =>
      apply(current, { type: "place", player: current.currentPlayer, point }),
    state,
  );
}

function piecesOnBoard(state: GameState): number {
  return POINT_IDS.filter((point) => state.board[point] !== null).length;
}

function piecesFor(state: GameState, player: "A" | "B"): number {
  return POINT_IDS.filter((point) => state.board[point] === player).length;
}

function createMovementState(): GameState {
  const afterFirstRemoval = apply(
    placeAll(createInitialState("A"), NO_JARE_ORDER),
    { type: "removeInitial", player: "B", point: "O1" },
  );

  return apply(afterFirstRemoval, {
    type: "removeInitial",
    player: "A",
    point: "O2",
  });
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

/**
 * Full 24-placement order in which neither player ever completes a jare.
 * The starter ends up on {ring odds of O/I, ring evens of M}, the other
 * player on the complement; every jare line mixes both players.
 */
const NO_JARE_ORDER: readonly PointId[] = [
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
];

/**
 * Full 24-placement order where the starter's final piece (placement 23,
 * I2) completes the only jare of the phase: O2-M2-I2.
 */
const STARTER_LAST_JARE_ORDER: readonly PointId[] = [
  "O2",
  "O1",
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
  "I3",
  "I1",
  "I5",
  "I4",
  "I7",
  "I6",
  "I2",
  "I8",
];

describe("placement", () => {
  it("places a piece, decrements the hand, and passes the turn", () => {
    const state = apply(createInitialState("A"), {
      type: "place",
      player: "A",
      point: "O1",
    });

    expect(state.phase).toBe("placement");
    expect(state.board.O1).toBe("A");
    expect(state.players.A.inHand).toBe(11);
    expect(state.players.B.inHand).toBe(12);
    expect(state.currentPlayer).toBe("B");
    expect(state.firstAdvantage).toBeNull();
  });

  it("does not mutate the input state", () => {
    const state = createInitialState("A");
    const snapshot = structuredClone(state);

    apply(state, { type: "place", player: "A", point: "O1" });

    expect(state).toEqual(snapshot);
  });

  it("rejects placing out of turn", () => {
    expectError(
      createInitialState("A"),
      { type: "place", player: "B", point: "O1" },
      "notYourTurn",
    );
  });

  it("rejects placing on an occupied point", () => {
    const state = apply(createInitialState("A"), {
      type: "place",
      player: "A",
      point: "O1",
    });

    expectError(
      state,
      { type: "place", player: "B", point: "O1" },
      "pointOccupied",
    );
  });

  it("rejects placement when the player has no pieces in hand", () => {
    const state: GameState = {
      ...createInitialState("A"),
      players: {
        A: { inHand: 0, captured: 0 },
        B: { inHand: 12, captured: 0 },
      },
    };

    expectError(
      state,
      { type: "place", player: "A", point: "O1" },
      "noPiecesInHand",
    );
  });

  it("rejects placement outside the placement phase", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);

    expect(state.phase).toBe("initialRemoval");
    expectError(
      state,
      { type: "place", player: state.currentPlayer, point: "O1" },
      "wrongPhase",
    );
  });

  it("gives first advantage to the starter forming the first jare", () => {
    const state = placeAll(createInitialState("A"), [
      "O1",
      "M1",
      "O2",
      "M3",
      "O3",
    ]);

    expect(state.firstAdvantage).toBe("A");
    expect(state.phase).toBe("placement");
  });

  it("gives first advantage to the non-starter forming the first jare", () => {
    const state = placeAll(createInitialState("A"), [
      "O1",
      "M1",
      "O3",
      "M2",
      "O5",
      "M3",
    ]);

    expect(state.firstAdvantage).toBe("B");
  });

  it("removes nothing when a placement jare forms", () => {
    const state = placeAll(createInitialState("A"), [
      "O1",
      "M1",
      "O2",
      "M3",
      "O3",
    ]);

    expect(piecesOnBoard(state)).toBe(5);
    expect(state.players.A).toEqual({ inHand: 9, captured: 0 });
    expect(state.players.B).toEqual({ inHand: 10, captured: 0 });
  });

  it("keeps first advantage with the first jare when a later jare forms", () => {
    const afterFirstJare = placeAll(createInitialState("A"), [
      "O1",
      "M1",
      "O2",
      "M3",
      "O3",
    ]);
    const afterSecondJare = apply(afterFirstJare, {
      type: "place",
      player: "B",
      point: "M2",
    });

    expect(afterSecondJare.firstAdvantage).toBe("A");
  });

  it("falls back to the non-starting player when no jare forms", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);

    expect(state.firstAdvantage).toBe("B");
  });

  it("applies the no-jare fallback relative to the starting player", () => {
    const state = placeAll(createInitialState("B"), NO_JARE_ORDER);

    expect(state.firstAdvantage).toBe("A");
  });

  it("lets a jare on the final placement beat the fallback", () => {
    const state = placeAll(createInitialState("A"), STARTER_LAST_JARE_ORDER);

    expect(state.firstAdvantage).toBe("A");
    expect(state.currentPlayer).toBe("A");
  });

  it("transitions to initial removal once all 24 points are filled", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);

    expect(state.phase).toBe("initialRemoval");
    expect(piecesOnBoard(state)).toBe(24);
    expect(state.players.A.inHand).toBe(0);
    expect(state.players.B.inHand).toBe(0);
    expect(state.currentPlayer).toBe(state.firstAdvantage);
  });
});

describe("initial removal", () => {
  it("lets the first-advantage player remove first, then passes removal to the opponent", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);

    expect(state.firstAdvantage).toBe("B");
    expect(state.currentPlayer).toBe("B");

    const afterRemoval = apply(state, {
      type: "removeInitial",
      player: "B",
      point: "O1",
    });

    expect(afterRemoval.board.O1).toBeNull();
    expect(afterRemoval.phase).toBe("initialRemoval");
    expect(afterRemoval.currentPlayer).toBe("A");
    expect(afterRemoval.initialRemoval.removedBy).toEqual({
      A: false,
      B: true,
    });
    expect(piecesOnBoard(afterRemoval)).toBe(23);
  });

  it("rejects out-of-turn initial removal", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);

    expectError(
      state,
      { type: "removeInitial", player: "A", point: "O2" },
      "notYourTurn",
    );
  });

  it("rejects initial removal outside the initial-removal phase", () => {
    expectError(
      createInitialState("A"),
      { type: "removeInitial", player: "A", point: "O1" },
      "wrongPhase",
    );
  });

  it("rejects removing empty points and own pieces", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);

    expectError(
      { ...state, board: { ...state.board, O1: null } },
      { type: "removeInitial", player: "B", point: "O1" },
      "pointEmpty",
    );
    expectError(
      state,
      { type: "removeInitial", player: "B", point: "O2" },
      "notOpponentPiece",
    );
  });

  it("rejects a player removing twice in hand-built initial-removal states", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);

    expectError(
      {
        ...state,
        initialRemoval: {
          removedBy: { ...state.initialRemoval.removedBy, B: true },
        },
      },
      { type: "removeInitial", player: "B", point: "O1" },
      "alreadyRemovedInitial",
    );
  });

  it("allows removing an opponent piece inside a jare", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);
    const withOpponentJare: GameState = {
      ...state,
      currentPlayer: "A",
      firstAdvantage: "A",
      board: {
        ...state.board,
        O1: "B",
        O2: "B",
        O3: "B",
      },
    };

    const afterRemoval = apply(withOpponentJare, {
      type: "removeInitial",
      player: "A",
      point: "O2",
    });

    expect(afterRemoval.board.O2).toBeNull();
  });

  it("transitions to movement after both players remove one piece", () => {
    const afterFirstRemoval = apply(
      placeAll(createInitialState("A"), NO_JARE_ORDER),
      { type: "removeInitial", player: "B", point: "O1" },
    );
    const afterSecondRemoval = apply(afterFirstRemoval, {
      type: "removeInitial",
      player: "A",
      point: "O2",
    });

    expect(afterSecondRemoval.phase).toBe("movement");
    expect(afterSecondRemoval.currentPlayer).toBe("B");
    expect(piecesOnBoard(afterSecondRemoval)).toBe(22);
    expect(piecesFor(afterSecondRemoval, "A")).toBe(11);
    expect(piecesFor(afterSecondRemoval, "B")).toBe(11);
    expect(afterSecondRemoval.players.A.captured).toBe(0);
    expect(afterSecondRemoval.players.B.captured).toBe(0);
    expect(afterSecondRemoval.initialRemoval.removedBy).toEqual({
      A: true,
      B: true,
    });
  });

  it("does not mutate the input state", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);
    const snapshot = structuredClone(state);

    apply(state, { type: "removeInitial", player: "B", point: "O1" });

    expect(state).toEqual(snapshot);
  });
});

describe("movement", () => {
  it("slides a piece to an adjacent empty point and passes the turn", () => {
    const state = createMovementState();

    expect(state.currentPlayer).toBe("B");

    const afterMove = apply(state, {
      type: "move",
      player: "B",
      from: "O8",
      to: "O1",
    });

    expect(afterMove.board.O8).toBeNull();
    expect(afterMove.board.O1).toBe("B");
    expect(afterMove.currentPlayer).toBe("A");
    expect(afterMove.phase).toBe("movement");
    expect(afterMove.draw.turnsSinceCapture).toBe(1);
  });

  it("rejects movement outside the movement phase", () => {
    expectError(
      createInitialState("A"),
      { type: "move", player: "A", from: "O1", to: "O2" },
      "wrongPhase",
    );
  });

  it("rejects movement out of turn", () => {
    expectError(
      createMovementState(),
      { type: "move", player: "A", from: "O3", to: "O2" },
      "notYourTurn",
    );
  });

  it("rejects moving from an empty point or an opponent piece", () => {
    const state = createMovementState();

    expectError(
      state,
      { type: "move", player: "B", from: "O2", to: "O1" },
      "notOwnPiece",
    );
    expectError(
      state,
      { type: "move", player: "B", from: "O3", to: "O2" },
      "notOwnPiece",
    );
  });

  it("rejects non-adjacent destinations and occupied destinations", () => {
    const state = createMovementState();

    expectError(
      state,
      { type: "move", player: "B", from: "O8", to: "O2" },
      "notAdjacent",
    );
    expectError(
      state,
      { type: "move", player: "B", from: "O8", to: "M8" },
      "destinationOccupied",
    );
  });

  it("does not mutate the input state", () => {
    const state = createMovementState();
    const snapshot = structuredClone(state);

    apply(state, { type: "move", player: "B", from: "O8", to: "O1" });

    expect(state).toEqual(snapshot);
  });

  it("enters capture phase when movement newly forms a jare", () => {
    const state = createMovementState();
    const withJareThreat: GameState = {
      ...state,
      currentPlayer: "A",
      board: {
        ...state.board,
        O1: "A",
        O2: "A",
        O3: null,
        O4: "A",
        O8: "B",
      },
    };

    const afterMove = apply(withJareThreat, {
      type: "move",
      player: "A",
      from: "O4",
      to: "O3",
    });

    expect(afterMove.phase).toBe("capture");
    expect(afterMove.currentPlayer).toBe("A");
    expect(afterMove.pendingCapture).toEqual({ player: "A", formedAt: "O3" });
  });

  it("does not capture from a standing unchanged jare", () => {
    const state = baseMovementState("A", {
      O1: "A",
      O2: "A",
      O3: "A",
      O4: "A",
      O6: "B",
      O8: "B",
      M1: "B",
    });

    const afterMove = apply(state, {
      type: "move",
      player: "A",
      from: "O4",
      to: "O5",
    });

    expect(afterMove.phase).toBe("movement");
    expect(afterMove.pendingCapture).toBeNull();
    expect(afterMove.currentPlayer).toBe("B");
  });

  it("allows a broken jare to be re-formed for another capture", () => {
    let state = baseMovementState("A", {
      O1: "A",
      O2: "A",
      O4: "A",
      O5: "B",
      O6: "B",
      O8: "B",
      M1: "B",
      M2: "B",
    });

    state = apply(state, { type: "move", player: "A", from: "O4", to: "O3" });

    expect(state.phase).toBe("capture");

    state = apply(state, { type: "capture", player: "A", point: "M1" });
    state = apply(state, { type: "move", player: "B", from: "M2", to: "M3" });
    state = apply(state, { type: "move", player: "A", from: "O3", to: "O4" });
    state = apply(state, { type: "move", player: "B", from: "M3", to: "M2" });
    state = apply(state, { type: "move", player: "A", from: "O4", to: "O3" });

    expect(state.phase).toBe("capture");
    expect(state.pendingCapture).toEqual({ player: "A", formedAt: "O3" });
  });

  it("requires the opponent to make immediate non-jare space for a blocked player", () => {
    const state = baseMovementState("A", {
      O1: "A",
      M1: "A",
      I1: "A",
      O2: "B",
      O4: "B",
      O8: "B",
      M2: "B",
      M8: "B",
      I2: "B",
      I8: "B",
    });

    expect(getActingPlayer(state)).toBe("B");
    expectError(
      state,
      { type: "move", player: "A", from: "O1", to: "O2" },
      "notYourTurn",
    );
    expectError(
      state,
      { type: "move", player: "B", from: "O4", to: "O5" },
      "notSpaceMaking",
    );

    const afterSpaceMaking = apply(state, {
      type: "move",
      player: "B",
      from: "O2",
      to: "O3",
    });

    expect(afterSpaceMaking.phase).toBe("movement");
    expect(afterSpaceMaking.currentPlayer).toBe("A");
    expect(getActingPlayer(afterSpaceMaking)).toBe("A");
    expect(afterSpaceMaking.board.O2).toBeNull();
    expect(afterSpaceMaking.draw.turnsSinceCapture).toBe(1);
  });

  it("ends in a draw after 80 movement turns without capture", () => {
    const state = baseMovementState(
      "A",
      {
        O1: "A",
        M5: "B",
      },
      {
        draw: {
          turnsSinceCapture: 79,
          repeatedPositions: {},
        },
      },
    );

    const afterMove = apply(state, {
      type: "move",
      player: "A",
      from: "O1",
      to: "O2",
    });

    expect(afterMove.phase).toBe("gameOver");
    expect(afterMove.winner).toBeNull();
    expect(afterMove.endReason).toBe("drawTermination");
    expect(afterMove.draw.turnsSinceCapture).toBe(80);
  });

  it("ends in a draw when a movement position occurs for the third time", () => {
    const before = baseMovementState("A", {
      O1: "A",
      M5: "B",
    });
    const afterBoard: BoardOccupancy = {
      ...before.board,
      O1: null,
      O2: "A",
    };
    const repeatedState = {
      ...before,
      board: afterBoard,
      currentPlayer: "B" as const,
    };
    const repeatedKey = movementPositionKey(repeatedState);
    const state: GameState = {
      ...before,
      draw: {
        turnsSinceCapture: 4,
        repeatedPositions: {
          [repeatedKey]: 2,
        },
      },
    };

    const afterMove = apply(state, {
      type: "move",
      player: "A",
      from: "O1",
      to: "O2",
    });

    expect(afterMove.phase).toBe("gameOver");
    expect(afterMove.winner).toBeNull();
    expect(afterMove.endReason).toBe("drawTermination");
    expect(afterMove.draw.repeatedPositions[repeatedKey]).toBe(3);
  });
});

describe("capture", () => {
  it("captures one opponent piece after a movement-phase jare", () => {
    let state = createMovementState();
    state = {
      ...state,
      currentPlayer: "A",
      board: {
        ...state.board,
        O1: "A",
        O2: "A",
        O3: null,
        O4: "A",
        O8: "B",
      },
    };

    state = apply(state, {
      type: "move",
      player: "A",
      from: "O4",
      to: "O3",
    });
    state = apply(state, { type: "capture", player: "A", point: "O8" });

    expect(state.phase).toBe("movement");
    expect(state.currentPlayer).toBe("B");
    expect(state.pendingCapture).toBeNull();
    expect(state.board.O8).toBeNull();
    expect(state.players.A.captured).toBe(1);
    expect(state.draw.turnsSinceCapture).toBe(0);
  });

  it("ends the game when a capture reduces the opponent below three pieces", () => {
    let state: GameState = {
      ...createMovementState(),
      phase: "capture",
      currentPlayer: "A",
      pendingCapture: { player: "A", formedAt: "O3" },
      board: {
        ...createMovementState().board,
        O1: "A",
        O2: "A",
        O3: "A",
        O4: "B",
        O5: "B",
        O6: "B",
        O7: null,
        O8: null,
        M1: null,
        M3: null,
        M5: null,
        M7: null,
        I2: null,
        I4: null,
        I6: null,
        I8: null,
      },
    };

    state = apply(state, { type: "capture", player: "A", point: "O4" });

    expect(state.phase).toBe("gameOver");
    expect(state.winner).toBe("A");
    expect(state.endReason).toBe("opponentBelowThree");
  });
});

describe("scripted reducer flow", () => {
  it("drives placement, initial removal, and several movement turns", () => {
    let state = placeAll(createInitialState("A"), STARTER_LAST_JARE_ORDER);

    expect(state.phase).toBe("initialRemoval");
    expect(state.firstAdvantage).toBe("A");
    expect(state.currentPlayer).toBe("A");

    state = apply(state, { type: "removeInitial", player: "A", point: "O1" });
    state = apply(state, { type: "removeInitial", player: "B", point: "O2" });

    expect(state.phase).toBe("movement");
    expect(state.currentPlayer).toBe("A");
    expect(piecesFor(state, "A")).toBe(11);
    expect(piecesFor(state, "B")).toBe(11);

    state = apply(state, { type: "move", player: "A", from: "O3", to: "O2" });

    expect(state.phase).toBe("capture");

    state = apply(state, { type: "capture", player: "A", point: "O4" });
    state = apply(state, { type: "move", player: "B", from: "O8", to: "O1" });
    state = apply(state, { type: "move", player: "A", from: "O2", to: "O3" });

    expect(state.currentPlayer).toBe("B");
    expect(state.board.O1).toBe("B");
    expect(state.board.O2).toBeNull();
    expect(state.board.O3).toBe("A");
    expect(state.board.O4).toBeNull();
  });
});

describe("terminal actions", () => {
  it("rejects capture outside a pending capture", () => {
    const state = createInitialState("A");

    expectError(
      state,
      { type: "capture", player: "A", point: "O1" },
      "wrongPhase",
    );
  });

  it("allows a player to resign", () => {
    const state = apply(createInitialState("A"), {
      type: "resign",
      player: "A",
    });

    expect(state.phase).toBe("gameOver");
    expect(state.winner).toBe("B");
    expect(state.endReason).toBe("resignation");
  });
});
