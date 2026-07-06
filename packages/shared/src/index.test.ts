import {
  POINT_IDS,
  applyActionLog,
  deserialize,
  replayActions,
  serialize,
} from "@shaxda/game-engine";
import type { GameState } from "@shaxda/game-engine";
import { describe, expect, it } from "vitest";
import {
  a2ConformanceActionScripts,
  bothBlockedFixture,
  clientMessageSchema,
  fullGameActionScripts,
  gameActionSchema,
  gameFixtures,
  gameStateSchema,
  healthResponseSchema,
  protocolVersion,
  serverMessageSchema,
} from "./index";

describe("healthResponseSchema", () => {
  it("accepts the scaffold health payload", () => {
    expect(healthResponseSchema.parse({ ok: true, service: "shaxda" })).toEqual(
      {
        ok: true,
        service: "shaxda",
      },
    );
  });
});

describe("game contract schemas", () => {
  it("accepts every canonical fixture", () => {
    for (const fixture of Object.values(gameFixtures)) {
      expect(gameStateSchema.parse(fixture)).toEqual(fixture);
    }
  });

  it("keeps draw fixtures above the below-three win threshold", () => {
    for (const fixture of [
      gameFixtures.draw,
      bothBlockedFixture,
      gameFixtures.drawByEightyTurns,
      gameFixtures.drawByRepetition,
      gameFixtures.forcedJareSpaceMaking,
    ]) {
      const pieceCounts = Object.fromEntries(
        ["A", "B"].map((player) => [
          player,
          Object.values(fixture.board).filter((owner) => owner === player)
            .length,
        ]),
      );

      expect(pieceCounts.A).toBeGreaterThanOrEqual(3);
      expect(pieceCounts.B).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps canonical fixtures internally consistent", () => {
    for (const fixture of Object.values(gameFixtures)) {
      assertFixtureInvariants(fixture);
    }
    assertFixtureInvariants(bothBlockedFixture);
  });

  it("includes A3 draw and blocked fixtures", () => {
    expect(gameFixtures.blockedSpaceMade.phase).toBe("movement");
    expect(gameFixtures.blockedSpaceMade.currentPlayer).toBe("B");
    expect(bothBlockedFixture).toMatchObject({
      phase: "gameOver",
      winner: null,
      endReason: "bothBlocked",
    });
    expect(gameFixtures.drawByEightyTurns).toMatchObject({
      phase: "gameOver",
      winner: null,
      endReason: "drawTermination",
    });
    expect(gameFixtures.drawByRepetition).toMatchObject({
      phase: "gameOver",
      winner: null,
      endReason: "drawTermination",
    });
    expect(gameFixtures.forcedJareSpaceMaking).toMatchObject({
      phase: "gameOver",
      winner: null,
      endReason: "forcedJareSpaceMaking",
    });
  });

  it("roundtrips every fixture through engine serialization", () => {
    for (const fixture of Object.values(gameFixtures)) {
      expect(deserialize(serialize(fixture))).toEqual(fixture);
    }
  });

  it("accepts public game actions", () => {
    expect(
      gameActionSchema.parse({
        type: "move",
        player: "A",
        from: "O1",
        to: "O2",
      }),
    ).toEqual({ type: "move", player: "A", from: "O1", to: "O2" });
  });
});

describe("WebSocket protocol schemas", () => {
  it("requires protocol version 1 on client messages", () => {
    expect(
      clientMessageSchema.parse({
        v: protocolVersion,
        type: "gameAction",
        roomCode: "ABCD",
        action: { type: "resign", player: "A" },
      }),
    ).toEqual({
      v: 1,
      type: "gameAction",
      roomCode: "ABCD",
      action: { type: "resign", player: "A" },
    });

    expect(() =>
      clientMessageSchema.parse({
        v: 2,
        type: "ping",
      }),
    ).toThrow();
  });

  it("accepts state broadcasts", () => {
    expect(
      serverMessageSchema.parse({
        v: protocolVersion,
        type: "state",
        roomCode: "ROOM-1",
        state: gameFixtures.emptyBoard,
      }),
    ).toMatchObject({
      v: 1,
      type: "state",
      roomCode: "ROOM-1",
    });
  });
});

describe("fixture action scripts", () => {
  it("replays to expected final states", () => {
    for (const script of fullGameActionScripts) {
      const result = replayActions(script.startingPlayer, script.actions);

      expect(result).toEqual({ ok: true, state: script.expectedFinalState });
    }
  });

  it("replays A2 conformance scenarios from explicit initial states", () => {
    for (const script of a2ConformanceActionScripts) {
      const result = applyActionLog(script.initialState, script.actions);

      expect(result).toEqual({ ok: true, state: script.expectedFinalState });
    }
  });

  it("covers first advantage, repeated jare, and capture-win conformance", () => {
    expect(gameFixtures.placementJare).toMatchObject({
      phase: "placement",
      firstAdvantage: "A",
    });

    const repeatedJareResult = applyActionLog(gameFixtures.repeatedJare, [
      { type: "move", player: "A", from: "O4", to: "O3" },
    ]);
    expect(repeatedJareResult).toMatchObject({
      ok: true,
      state: {
        phase: "capture",
        currentPlayer: "A",
        pendingCapture: { player: "A", formedAt: "O3" },
      },
    });

    const captureWinState: GameState = {
      ...gameFixtures.win,
      phase: "capture",
      currentPlayer: "A",
      board: {
        ...gameFixtures.win.board,
        O6: "B",
      },
      pendingCapture: { player: "A", formedAt: "O3" },
      winner: null,
      endReason: null,
    };
    const captureWinResult = applyActionLog(captureWinState, [
      { type: "capture", player: "A", point: "O4" },
    ]);

    expect(captureWinResult).toMatchObject({
      ok: true,
      state: {
        phase: "gameOver",
        winner: "A",
        endReason: "opponentBelowThree",
      },
    });
  });
});

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

function assertFixtureInvariants(state: GameState): void {
  expect(Object.keys(state.board).sort()).toEqual([...POINT_IDS].sort());

  for (const point of POINT_IDS) {
    expect(["A", "B", null]).toContain(state.board[point]);
  }

  if (state.phase === "capture") {
    expect(state.pendingCapture).not.toBeNull();
    expect(state.pendingCapture?.player).toBe(state.currentPlayer);
  } else {
    expect(state.pendingCapture).toBeNull();
  }

  expect(state.draw.turnsSinceCapture).toBeGreaterThanOrEqual(0);
  for (const count of Object.values(state.draw.repeatedPositions)) {
    expect(count).toBeGreaterThanOrEqual(0);
  }

  if (state.phase !== "gameOver") {
    expect(state.winner).toBeNull();
    expect(state.endReason).toBeNull();
    return;
  }

  expect(state.endReason).not.toBeNull();
  if (state.endReason !== null && DRAW_REASONS.has(state.endReason)) {
    expect(state.winner).toBeNull();
  } else if (state.endReason !== null && WIN_REASONS.has(state.endReason)) {
    expect(state.winner).not.toBeNull();
  } else {
    throw new Error(`unknown fixture end reason ${state.endReason}`);
  }
}
