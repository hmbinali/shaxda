import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { legalActions } from "./actions";
import { POINT_IDS } from "./board";
import { getLegalMoves, getSpaceMakingMoves } from "./moves";
import { applyAction } from "./reducer";
import { deserialize, serialize } from "./serialization";
import { createInitialState } from "./state";
import type {
  BoardOccupancy,
  GameAction,
  GameState,
  PlayerId,
  PointId,
} from "./types";

const DRAW_REASONS = new Set([
  "drawTermination",
  "bothBlocked",
  "forcedJareSpaceMaking",
]);
const WIN_REASONS = new Set([
  "opponentBelowThree",
  "opponentCapturedAll",
  "resignation",
]);
const RECENT_ACTION_LIMIT = 12;

interface FuzzContext {
  seed: number;
  step: number;
  state: GameState;
  action?: GameAction;
  history: readonly GameAction[];
}

describe("engine fuzz", () => {
  it("terminates seeded random legal playouts without invalid states", () => {
    const gameCount = 1_000;
    const actionCap = 1_200;

    for (let gameIndex = 0; gameIndex < gameCount; gameIndex += 1) {
      const seed = 0x5eed_0000 + gameIndex;
      const random = mulberry32(seed);
      let state = createInitialState(random() < 0.5 ? "A" : "B");
      let previous = state;
      const history: GameAction[] = [];

      for (let step = 0; step < actionCap; step += 1) {
        assertInvariants(state, previous, {
          seed,
          step,
          state,
          history,
        });

        if (state.phase === "gameOver") {
          assertEndState({ seed, step, state, history });
          break;
        }

        const actions = legalActions(state).filter(
          (action) => action.type !== "resign",
        );

        if (actions.length === 0) {
          throw new Error(
            formatFuzzError(
              {
                seed,
                step,
                state,
                history,
              },
              "no legal non-resign actions before gameOver",
            ),
          );
        }

        const action = actions[Math.floor(random() * actions.length)]!;
        const result = applyAction(state, action);

        if (!result.ok) {
          throw new Error(
            formatFuzzError(
              {
                seed,
                step,
                state,
                action,
                history,
              },
              `action failed with ${result.error}`,
            ),
          );
        }

        history.push(action);
        if (history.length > RECENT_ACTION_LIMIT) {
          history.shift();
        }
        previous = state;
        state = result.state;
      }

      if (state.phase !== "gameOver") {
        throw new Error(
          formatFuzzError(
            {
              seed,
              step: actionCap,
              state,
              history,
            },
            `did not terminate within ${actionCap} actions`,
          ),
        );
      }
    }
  }, 30_000);

  it("space-making for a blocked player resolves to that player or terminates", () => {
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
    const spaceMakingMoves = getSpaceMakingMoves(state, "A");

    expect(getLegalMoves(state, "A")).toEqual([]);
    expect(spaceMakingMoves.length).toBeGreaterThan(0);

    for (const move of spaceMakingMoves) {
      const result = applyAction(state, {
        type: "move",
        player: "B",
        ...move,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.state.phase !== "gameOver") {
        expect(result.state.currentPlayer).toBe("A");
        expect(getLegalMoves(result.state, "A").length).toBeGreaterThan(0);
        expect(result.state.pendingCapture).toBeNull();
      }
    }
  });

  it("classifies both-blocked terminal states as draws", () => {
    assertEndState({
      seed: 0,
      step: 0,
      state: {
        ...baseMovementState("A", {
          O1: "A",
          O2: "B",
          O3: "A",
          O4: "B",
          O5: "A",
          O6: "B",
          O7: "A",
          O8: "B",
          M1: "A",
          M2: "B",
          M3: "A",
          M4: "B",
          M5: "A",
          M6: "B",
          M7: "A",
          M8: "B",
          I1: "A",
          I2: "B",
          I3: "A",
          I4: "B",
          I5: "A",
          I6: "B",
          I7: "A",
          I8: "B",
        }),
        phase: "gameOver",
        winner: null,
        endReason: "bothBlocked",
      },
      history: [],
    });
  });

  it("forced-jare space-making ends as a draw instead of granting capture", () => {
    const state = baseMovementState("A", {
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
    const result = applyAction(state, {
      type: "move",
      player: "A",
      from: "M2",
      to: "O2",
    });

    expect(result).toMatchObject({
      ok: true,
      state: {
        phase: "gameOver",
        winner: null,
        endReason: "forcedJareSpaceMaking",
        pendingCapture: null,
      },
    });
    if (result.ok) {
      expect(result.state.players.A.captured).toBe(0);
      expect(result.state.players.B.captured).toBe(0);
    }
  });

  it("covers threefold repetition and 80-turn draw termination paths", () => {
    const noCaptureClockState = baseMovementState(
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
    const noCaptureResult = applyAction(noCaptureClockState, {
      type: "move",
      player: "A",
      from: "O1",
      to: "O2",
    });

    expect(noCaptureResult).toMatchObject({
      ok: true,
      state: {
        phase: "gameOver",
        winner: null,
        endReason: "drawTermination",
      },
    });

    const before = baseMovementState("A", {
      O1: "A",
      O5: "A",
      M5: "A",
      I1: "B",
      I5: "B",
      M1: "B",
    });
    const after: GameState = {
      ...before,
      board: {
        ...before.board,
        O1: null,
        O2: "A",
      },
      currentPlayer: "B",
    };
    const repeatedKey = movementPositionKey(after);
    const repetitionResult = applyAction(
      {
        ...before,
        draw: {
          turnsSinceCapture: 4,
          repeatedPositions: {
            [repeatedKey]: 2,
          },
        },
      },
      { type: "move", player: "A", from: "O1", to: "O2" },
    );

    expect(repetitionResult).toMatchObject({
      ok: true,
      state: {
        phase: "gameOver",
        winner: null,
        endReason: "drawTermination",
      },
    });
  });

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
  context: FuzzContext,
): void {
  if (Object.keys(state.board).length !== POINT_IDS.length) {
    throw new Error(formatFuzzError(context, "board has wrong point count"));
  }

  for (const point of POINT_IDS) {
    if (
      state.board[point] !== "A" &&
      state.board[point] !== "B" &&
      state.board[point] !== null
    ) {
      throw new Error(formatFuzzError(context, `invalid point ${point}`));
    }
  }

  for (const player of ["A", "B"] as const) {
    if (state.players[player].inHand < 0) {
      throw new Error(formatFuzzError(context, `${player} inHand below zero`));
    }
    if (state.players[player].inHand > previous.players[player].inHand) {
      throw new Error(formatFuzzError(context, `${player} inHand increased`));
    }
    if (state.players[player].captured < previous.players[player].captured) {
      throw new Error(formatFuzzError(context, `${player} captured fell`));
    }
    if (state.players[player].captured < 0) {
      throw new Error(
        formatFuzzError(context, `${player} captured below zero`),
      );
    }
  }

  if (state.phase === "capture") {
    if (state.pendingCapture === null) {
      throw new Error(formatFuzzError(context, "capture without pending"));
    }
    if (state.pendingCapture.player !== state.currentPlayer) {
      throw new Error(
        formatFuzzError(
          context,
          "pending capture player is not current player",
        ),
      );
    }
  } else if (state.pendingCapture !== null) {
    throw new Error(formatFuzzError(context, "stale pending capture"));
  }

  if (state.draw.turnsSinceCapture < 0) {
    throw new Error(formatFuzzError(context, "draw counter below zero"));
  }
  for (const count of Object.values(state.draw.repeatedPositions)) {
    if (count < 0) {
      throw new Error(
        formatFuzzError(context, "repeated-position counter below zero"),
      );
    }
  }

  assertPieceAccounting(state, context);

  const roundTrip = deserialize(serialize(state));
  if (!isDeepStrictEqual(roundTrip, state)) {
    throw new Error(formatFuzzError(context, "serialization mismatch"));
  }
}

function assertPieceAccounting(state: GameState, context: FuzzContext): void {
  for (const player of ["A", "B"] as const) {
    const opponent = player === "A" ? "B" : "A";
    const boardPieces = POINT_IDS.filter(
      (point) => state.board[point] === player,
    ).length;
    const initiallyRemoved = state.initialRemoval.removedBy[opponent] ? 1 : 0;
    const total =
      boardPieces +
      state.players[player].inHand +
      state.players[opponent].captured +
      initiallyRemoved;

    if (total !== 12) {
      throw new Error(
        formatFuzzError(
          context,
          `${player} piece accounting expected 12, got ${total}`,
        ),
      );
    }
  }
}

function assertEndState(context: FuzzContext): void {
  const { state } = context;

  if (state.endReason === null) {
    throw new Error(formatFuzzError(context, "gameOver without endReason"));
  }

  if (DRAW_REASONS.has(state.endReason)) {
    if (state.winner !== null) {
      throw new Error(formatFuzzError(context, "draw has winner"));
    }
  } else if (WIN_REASONS.has(state.endReason)) {
    if (state.winner === null) {
      throw new Error(formatFuzzError(context, "win has no winner"));
    }
  } else {
    throw new Error(
      formatFuzzError(context, `unknown end reason ${state.endReason}`),
    );
  }
}

function formatFuzzError(context: FuzzContext, message: string): string {
  return [
    `seed ${context.seed} step ${context.step}: ${message}`,
    `phase=${context.state.phase}`,
    `currentPlayer=${context.state.currentPlayer}`,
    `action=${context.action === undefined ? "none" : JSON.stringify(context.action)}`,
    `recentActions=${JSON.stringify(context.history.slice(-RECENT_ACTION_LIMIT))}`,
  ].join("; ");
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

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
