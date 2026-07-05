import { describe, expect, it } from "vitest";
import {
  applyActionLog,
  deserialize,
  replayActions,
  serialize,
} from "./serialization";
import { createInitialState } from "./state";
import type { GameAction } from "./types";

describe("serialization", () => {
  it("roundtrips a game state", () => {
    const state = createInitialState("B");
    const serialized = serialize(state);

    expect(deserialize(serialized)).toEqual(state);
  });

  it("rejects invalid serialized state", () => {
    expect(() => deserialize(JSON.stringify({ phase: "placement" }))).toThrow(
      "Invalid serialized game state",
    );
  });

  it("rejects serialized states with unknown phase or end reason values", () => {
    const state = createInitialState("A");

    expect(() =>
      deserialize(JSON.stringify({ ...state, phase: "paused" })),
    ).toThrow("Invalid serialized game state");
    expect(() =>
      deserialize(JSON.stringify({ ...state, endReason: "timeout" })),
    ).toThrow("Invalid serialized game state");
  });
});

describe("action logs", () => {
  const actions: readonly GameAction[] = [
    { type: "place", player: "A", point: "O1" },
    { type: "place", player: "B", point: "O2" },
    { type: "resign", player: "B" },
  ];

  it("applies an action log from a provided state", () => {
    const result = applyActionLog(createInitialState("A"), actions);

    expect(result).toMatchObject({
      ok: true,
      state: {
        phase: "gameOver",
        winner: "A",
        endReason: "resignation",
      },
    });
  });

  it("replays an action log from the starting player", () => {
    const result = replayActions("A", actions);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe("gameOver");
      expect(result.state.winner).toBe("A");
    }
  });
});
