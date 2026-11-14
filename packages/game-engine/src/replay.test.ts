import { describe, expect, it } from "vitest";
import { legalActions } from "./actions";
import { applyAction } from "./reducer";
import {
  decodeCompactReplay,
  encodeAction,
  encodeCompactReplay,
  MAX_REPLAY_ACTIONS,
  summarizeReplay,
} from "./replay";
import { serialize } from "./serialization";
import { createInitialState } from "./state";
import type { GameAction, GameState, PlayerId } from "./types";

describe("compact replay", () => {
  it("encodes all action kinds and replays an off-turn resignation", () => {
    expect(
      [
        { type: "place", player: "A", point: "O1" },
        { type: "removeInitial", player: "A", point: "M1" },
        { type: "move", player: "A", from: "M2", to: "I2" },
        { type: "capture", player: "A", point: "I3" },
        { type: "resign", player: "B" },
      ].map((action) => encodeAction(action as GameAction)),
    ).toEqual(["P:O1", "X:M1", "M:M2>I2", "C:I3", "R:B"]);
    expect(summarizeReplay({ v: 1, s: "A", a: ["R:B"] })).toMatchObject({
      ok: true,
      state: { winner: "A", endReason: "resignation" },
      actionCount: 1,
      firstAdvantageBy: null,
    });
  });

  it.each([
    ["Q:O1", "invalidActionCode"],
    ["P:X9", "invalidActionCode"],
    ["R:C", "invalidActionCode"],
    ["P:O1", "pointOccupied"],
    ["M:O1>O1", "wrongPhase"],
  ])("rejects %s at its index", (code, error) => {
    expect(decodeCompactReplay({ v: 1, s: "A", a: ["P:O1", code] })).toEqual({
      ok: false,
      error,
      actionIndex: 1,
    });
  });

  it("rejects versions and checks the bound first", () => {
    expect(decodeCompactReplay({ v: 2, s: "A", a: [] })).toMatchObject({
      ok: false,
      actionIndex: 0,
    });
    expect(
      decodeCompactReplay({
        v: 1,
        s: "A",
        a: Array(MAX_REPLAY_ACTIONS + 1).fill("invalid"),
      }),
    ).toEqual({
      ok: false,
      error: "tooManyActions",
      actionIndex: MAX_REPLAY_ACTIONS,
    });
  });

  it.each([
    ["A", ["P:O1", "P:I1", "P:O2", "P:I3", "P:O3"]],
    ["B", ["P:I1", "P:O1", "P:I3", "P:O2", "P:M1", "P:O3"]],
  ] as const)("identifies %s's placement jare", (seat, a) => {
    expect(summarizeReplay({ v: 1, s: "A", a })).toMatchObject({
      ok: true,
      firstAdvantageBy: "placementJare",
      state: { firstAdvantage: seat },
    });
  });

  it.each([
    [
      "placementJare",
      "I3 I1 I5 I2 I7 I4 I8 I6 M1 M3 M2 M6 M4 M7 M5 O1 M8 O4 O2 O5 O6 O8 O7 O3",
    ],
    [
      "noJareFallback",
      "I2 I1 I4 I3 I6 I5 I7 I8 M3 M1 M5 M2 M8 M4 O1 M6 O3 M7 O4 O2 O6 O5 O8 O7",
    ],
  ])("distinguishes %s on the last placement", (firstAdvantageBy, points) => {
    const a = points.split(" ").map((point) => `P:${point}`);
    expect(summarizeReplay({ v: 1, s: "A", a: a.slice(0, -1) })).toMatchObject({
      ok: true,
      firstAdvantageBy: null,
    });
    expect(summarizeReplay({ v: 1, s: "A", a })).toMatchObject({
      ok: true,
      firstAdvantageBy,
      state: { firstAdvantage: "B" },
    });
  });

  it("round-trips the maximal legal game under the E4 bound", () => {
    const game = maximalGame();
    const replay = encodeCompactReplay("A", game.actions);
    expect(replay.a).toHaveLength(MAX_REPLAY_ACTIONS);
    expect(new TextEncoder().encode(JSON.stringify(replay))).toHaveLength(
      13_922,
    );
    const decoded = decodeCompactReplay(replay);
    expect(decoded.ok && serialize(decoded.state)).toEqual(
      serialize(game.state),
    );
  }, 60_000);
});

// E4 construction. Hold each capture until the 80th movement turn and
// let each side capture eight times before the final capture.
function maximalGame(): { state: GameState; actions: GameAction[] } {
  let seed = 0x4eed_beef;
  const pick = <T>(values: T[]): T | undefined => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return values[Math.floor((seed / 0x1_0000_0000) * values.length)];
  };
  const advance = (state: GameState, action: GameAction): GameState => {
    const result = applyAction(state, action);
    if (!result.ok) throw new Error(result.error);
    return result.state;
  };

  for (let game = 0; game < 8; game++) {
    let state = createInitialState("A");
    const actions: GameAction[] = [];
    for (let turn = 0; turn < 26; turn++) {
      const action = pick(
        legalActions(state).filter((a) => a.type !== "resign"),
      );
      if (!action) throw new Error("Missing opening action");
      actions.push(action);
      state = advance(state, action);
    }
    for (let capture = 0; capture < 17; capture++) {
      const capturer: PlayerId = capture < 8 ? "A" : "B";
      let found = false;
      for (let walk = 0; walk < 400 && !found; walk++) {
        let trial = state;
        const steps: GameAction[] = [];
        for (let turn = 0; turn < 80; turn++) {
          const target = turn === 79 ? "capture" : "movement";
          if (turn === 79 && trial.currentPlayer !== capturer) break;
          const action = pick(
            legalActions(trial).flatMap((action) => {
              if (action.type !== "move") return [];
              const next = advance(trial, action);
              return next.phase === target ? [{ action, next }] : [];
            }),
          );
          if (!action) break;
          steps.push(action.action);
          trial = action.next;
        }
        if (trial.phase !== "capture") continue;
        const removal = pick(
          legalActions(trial).filter((action) => action.type === "capture"),
        );
        if (!removal) throw new Error("Jare has no legal capture");
        state = advance(trial, removal);
        actions.push(...steps, removal);
        found = true;
      }
      if (!found) break;
      if (capture === 16 && state.phase === "gameOver")
        return { state, actions };
    }
  }
  throw new Error("Could not regenerate the E4 maximum");
}
