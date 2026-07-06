import { describe, expect, it } from "vitest";
import { legalActions } from "./actions";
import { POINT_IDS } from "./board";
import { applyAction } from "./reducer";
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

function baseMovementState(
  currentPlayer: PlayerId,
  pieces: Partial<Record<PointId, PlayerId>>,
): GameState {
  const state = createInitialState("A");
  const board = Object.fromEntries(
    POINT_IDS.map((point) => [point, null]),
  ) as BoardOccupancy;

  return {
    ...state,
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
    board: { ...board, ...pieces },
  };
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

  it("enumerates opponent space-making moves when the current player is blocked", () => {
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

    expect(legalActions(state)).toEqual([
      { type: "move", player: "B", from: "O2", to: "O3" },
      { type: "move", player: "B", from: "O8", to: "O7" },
      { type: "move", player: "B", from: "M2", to: "M3" },
      { type: "move", player: "B", from: "M8", to: "M7" },
      { type: "move", player: "B", from: "I2", to: "I3" },
      { type: "move", player: "B", from: "I8", to: "I7" },
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
