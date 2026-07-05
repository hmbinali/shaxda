import { describe, expect, it } from "vitest";
import { POINT_IDS } from "./board";
import { applyAction } from "./reducer";
import { createInitialState } from "./state";
import type { GameAction, GameState, PointId } from "./types";

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

describe("unsupported actions", () => {
  it("rejects capture and resign until M3", () => {
    const state = createInitialState("A");

    expectError(
      state,
      { type: "capture", player: "A", point: "O1" },
      "unsupportedAction",
    );
    expectError(state, { type: "resign", player: "A" }, "unsupportedAction");
  });
});
