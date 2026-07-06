import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { legalActions } from "./actions";
import { POINT_IDS } from "./board";
import { applyAction } from "./reducer";
import { deserialize, serialize } from "./serialization";
import { createInitialState } from "./state";
import type { GameState, PlayerId } from "./types";

const DRAW_REASONS = new Set([
  "drawTermination",
  "bothBlocked",
  "forcedJareSpaceMaking",
]);

describe("engine fuzz", () => {
  it("terminates seeded random legal playouts without invalid states", () => {
    const gameCount = 1_000;
    const actionCap = 1_200;

    for (let gameIndex = 0; gameIndex < gameCount; gameIndex += 1) {
      const seed = 0x5eed_0000 + gameIndex;
      const random = mulberry32(seed);
      let state = createInitialState(random() < 0.5 ? "A" : "B");
      let previous = state;

      for (let step = 0; step < actionCap; step += 1) {
        assertInvariants(state, previous, seed, step);

        if (state.phase === "gameOver") {
          assertEndState(state, seed, step);
          break;
        }

        const actions = legalActions(state).filter(
          (action) => action.type !== "resign",
        );

        if (actions.length === 0) {
          throw new Error(`seed ${seed} step ${step}: no non-resign actions`);
        }

        const action = actions[Math.floor(random() * actions.length)]!;
        const result = applyAction(state, action);

        if (!result.ok) {
          throw new Error(
            `seed ${seed} step ${step}: ${action.type} failed with ${result.error}`,
          );
        }

        previous = state;
        state = result.state;
      }

      if (state.phase !== "gameOver") {
        throw new Error(
          `seed ${seed}: did not terminate within ${actionCap} actions`,
        );
      }
    }
  }, 30_000);

  it("allows resignation from each non-terminal phase", () => {
    const captureState: GameState = {
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
      },
    };
    const states: readonly [GameState, PlayerId][] = [
      [createInitialState("A"), "A"],
      [
        {
          ...createInitialState("A"),
          phase: "initialRemoval",
          currentPlayer: "B",
          firstAdvantage: "B",
        },
        "B",
      ],
      [
        {
          ...createInitialState("A"),
          phase: "movement",
          currentPlayer: "A",
        },
        "A",
      ],
      [captureState, "A"],
    ];

    for (const [state, player] of states) {
      const result = applyAction(state, { type: "resign", player });

      expect(result).toEqual({
        ok: true,
        state: {
          ...state,
          phase: "gameOver",
          currentPlayer: player === "A" ? "B" : "A",
          pendingCapture: null,
          winner: player === "A" ? "B" : "A",
          endReason: "resignation",
        },
      });
    }
  });
});

function assertInvariants(
  state: GameState,
  previous: GameState,
  seed: number,
  step: number,
): void {
  if (Object.keys(state.board).length !== POINT_IDS.length) {
    throw new Error(`seed ${seed} step ${step}: board has wrong point count`);
  }

  for (const point of POINT_IDS) {
    if (
      state.board[point] !== "A" &&
      state.board[point] !== "B" &&
      state.board[point] !== null
    ) {
      throw new Error(`seed ${seed} step ${step}: invalid point ${point}`);
    }
  }

  for (const player of ["A", "B"] as const) {
    if (state.players[player].inHand < 0) {
      throw new Error(`seed ${seed} step ${step}: ${player} inHand below zero`);
    }
    if (state.players[player].inHand > previous.players[player].inHand) {
      throw new Error(`seed ${seed} step ${step}: ${player} inHand increased`);
    }
    if (state.players[player].captured < previous.players[player].captured) {
      throw new Error(`seed ${seed} step ${step}: ${player} captured fell`);
    }
  }

  if (state.phase === "capture") {
    if (state.pendingCapture === null) {
      throw new Error(`seed ${seed} step ${step}: capture without pending`);
    }
  }

  const roundTrip = deserialize(serialize(state));
  if (!isDeepStrictEqual(roundTrip, state)) {
    throw new Error(`seed ${seed} step ${step}: serialization mismatch`);
  }
}

function assertEndState(state: GameState, seed: number, step: number): void {
  if (state.endReason === null) {
    throw new Error(`seed ${seed} step ${step}: gameOver without endReason`);
  }

  if (DRAW_REASONS.has(state.endReason)) {
    if (state.winner !== null) {
      throw new Error(`seed ${seed} step ${step}: draw has winner`);
    }
  } else if (state.winner === null) {
    throw new Error(`seed ${seed} step ${step}: win has no winner`);
  }
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
