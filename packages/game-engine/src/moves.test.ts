import { describe, expect, it } from "vitest";
import { getLegalMoves } from "./moves";
import { applyAction } from "./reducer";
import { createInitialState } from "./state";
import type { GameAction, GameState, PlayerId, PointId } from "./types";

function apply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);

  if (!result.ok) {
    throw new Error(
      `expected ${action.type} to succeed, got "${result.error}"`,
    );
  }

  return result.state;
}

function movementState(pieces: Partial<Record<PointId, PlayerId>>): GameState {
  const state = createInitialState("A");

  return {
    ...state,
    phase: "movement",
    currentPlayer: "A",
    firstAdvantage: "A",
    players: {
      A: { inHand: 0, captured: 0 },
      B: { inHand: 0, captured: 0 },
    },
    board: {
      ...state.board,
      ...pieces,
    },
  };
}

function placeAll(state: GameState, points: readonly PointId[]): GameState {
  return points.reduce(
    (current, point) =>
      apply(current, { type: "place", player: current.currentPlayer, point }),
    state,
  );
}

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

describe("getLegalMoves", () => {
  it("returns no moves outside the movement phase", () => {
    expect(getLegalMoves(createInitialState("A"), "A")).toEqual([]);
  });

  it("counts sparse legal moves by board degree", () => {
    expect(getLegalMoves(movementState({ O1: "A" }), "A")).toEqual([
      { from: "O1", to: "O2" },
      { from: "O1", to: "O8" },
    ]);
    expect(getLegalMoves(movementState({ O2: "A" }), "A")).toEqual([
      { from: "O2", to: "O1" },
      { from: "O2", to: "O3" },
      { from: "O2", to: "M2" },
    ]);
    expect(getLegalMoves(movementState({ M2: "A" }), "A")).toEqual([
      { from: "M2", to: "M1" },
      { from: "M2", to: "M3" },
      { from: "M2", to: "O2" },
      { from: "M2", to: "I2" },
    ]);
  });

  it("excludes occupied neighbors and fully surrounded pieces", () => {
    const state = movementState({
      O1: "A",
      O2: "B",
      O8: "A",
      M2: "A",
      M1: "B",
      M3: "B",
      I2: "B",
    });

    expect(getLegalMoves(state, "A")).toEqual([
      { from: "O8", to: "O7" },
      { from: "O8", to: "M8" },
    ]);
  });

  it("matches a hand-computed position after placement and initial removal", () => {
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
    expect(getLegalMoves(afterSecondRemoval, "B")).toEqual([
      { from: "O8", to: "O1" },
    ]);
  });
});
