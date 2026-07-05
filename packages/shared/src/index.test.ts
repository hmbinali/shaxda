import { deserialize, replayActions, serialize } from "@shaxda/game-engine";
import { describe, expect, it } from "vitest";
import {
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
    const pieceCounts = Object.fromEntries(
      ["A", "B"].map((player) => [
        player,
        Object.values(gameFixtures.draw.board).filter(
          (owner) => owner === player,
        ).length,
      ]),
    );

    expect(pieceCounts).toEqual({ A: 3, B: 3 });
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
});
