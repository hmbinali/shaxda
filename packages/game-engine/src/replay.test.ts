import { describe, expect, it } from "vitest";
import {
  decodeCompactReplay,
  encodeAction,
  encodeCompactReplay,
  MAX_REPLAY_ACTIONS,
  summarizeReplay,
} from "./replay";
import type { GameAction } from "./types";
import { maximumReplay } from "./fixtures/e4-maximum";

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
    expect(maximumReplay.a).toHaveLength(MAX_REPLAY_ACTIONS);
    expect(
      new TextEncoder().encode(JSON.stringify(maximumReplay)),
    ).toHaveLength(13_922);
    const decoded = decodeCompactReplay(maximumReplay);
    expect(decoded).toMatchObject({
      ok: true,
      state: {
        phase: "gameOver",
        endReason: "opponentBelowThree",
        winner: "B",
      },
    });
    if (!decoded.ok) throw new Error(decoded.error);
    expect(encodeCompactReplay(maximumReplay.s, decoded.actions)).toEqual(
      maximumReplay,
    );
    let quiet = 0;
    for (const action of decoded.actions.slice(26)) {
      if (action.type === "move") quiet++;
      if (action.type === "capture") {
        expect(quiet).toBe(80);
        quiet = 0;
      }
    }
  });
});
