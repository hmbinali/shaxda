import { describe, expect, it } from "vitest";
import { legalActions } from "./actions";
import { applyAction } from "./reducer";
import { createInitialState } from "./state";
import type { GameAction, GameState, PointId } from "./types";

function apply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);

  if (!result.ok) {
    throw new Error(`expected ${action.type} to succeed, got ${result.error}`);
  }

  return result.state;
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

describe("legalActions", () => {
  it("enumerates placements from an empty board", () => {
    const actions = legalActions(createInitialState("A"));

    expect(actions.filter((action) => action.type === "place")).toHaveLength(
      24,
    );
    expect(actions).toContainEqual({ type: "place", player: "A", point: "O1" });
    expect(actions).toContainEqual({ type: "resign", player: "A" });
  });

  it("enumerates initial removals for the current player", () => {
    const state = placeAll(createInitialState("A"), NO_JARE_ORDER);
    const actions = legalActions(state);

    expect(state.currentPlayer).toBe("B");
    expect(
      actions.filter((action) => action.type === "removeInitial"),
    ).toHaveLength(12);
    expect(actions).toContainEqual({
      type: "removeInitial",
      player: "B",
      point: "O1",
    });
  });

  it("enumerates captures while capture is pending", () => {
    const state: GameState = {
      ...createInitialState("A"),
      phase: "capture",
      currentPlayer: "A",
      pendingCapture: { player: "A", formedAt: "O3" },
      board: {
        ...createInitialState("A").board,
        O1: "A",
        O2: "A",
        O3: "A",
        O4: "B",
        O5: "B",
      },
    };

    expect(legalActions(state)).toEqual([
      { type: "capture", player: "A", point: "O4" },
      { type: "capture", player: "A", point: "O5" },
      { type: "resign", player: "A" },
    ]);
  });

  it("returns no actions after game over", () => {
    expect(
      legalActions({
        ...createInitialState("A"),
        phase: "gameOver",
        winner: "A",
        endReason: "resignation",
      }),
    ).toEqual([]);
  });
});
