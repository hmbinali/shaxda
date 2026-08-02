import {
  applyAction,
  deserialize,
  legalActions,
  serialize,
} from "@shaxda/game-engine";
import type { GameAction, GameState } from "@shaxda/game-engine";
import { describe, expect, it } from "vitest";
import { gameFixtures } from "./fixtures";
import { learningActionScripts, learningFixtures } from "./learning-fixtures";
import { gameStateSchema } from "./schemas";

describe("learning fixtures", () => {
  it("builds every repeated-jare snapshot from engine-legal actions", () => {
    const script = learningActionScripts.repeatedJareIrmaan;
    let state: GameState = script.initialState;

    for (const action of script.actions) {
      expect(legalActions(state)).toContainEqual(action);
      state = apply(state, action);
    }

    expect(state).toEqual(learningFixtures.repeatedJareReformed);
    expect(learningFixtures.repeatedJareFormed).toMatchObject({
      phase: "capture",
      currentPlayer: "A",
      pendingCapture: { player: "A", formedAt: "O3" },
    });
    expect(learningFixtures.repeatedJareReformed).toMatchObject({
      phase: "capture",
      currentPlayer: "A",
      pendingCapture: { player: "A", formedAt: "O2" },
    });
  });

  it("keeps the open repeated-jare key point unreachable by B", () => {
    const state = learningFixtures.repeatedJareOpened;

    expect(state).toMatchObject({ phase: "movement", currentPlayer: "B" });
    expect(state.board.O2).toBeNull();
    expect(
      legalActions(state).filter(
        (action) => action.type === "move" && action.to === "O2",
      ),
    ).toEqual([]);
  });

  it("rejects both movement examples annotated as illegal", () => {
    const state = learningFixtures.legalMovement;

    expect(legalActions(state)).toEqual(
      expect.arrayContaining([
        { type: "move", player: "A", from: "O1", to: "O2" },
        { type: "move", player: "A", from: "O1", to: "O8" },
      ]),
    );
    expect(
      applyAction(state, {
        type: "move",
        player: "A",
        from: "O1",
        to: "O3",
      }),
    ).toEqual({ ok: false, error: "notAdjacent" });
    expect(
      applyAction(state, {
        type: "move",
        player: "A",
        from: "O1",
        to: "M2",
      }),
    ).toEqual({ ok: false, error: "notAdjacent" });
  });

  it("roundtrips every teaching state through schemas and serialization", () => {
    for (const fixture of Object.values(learningFixtures)) {
      expect(gameStateSchema.parse(fixture)).toEqual(fixture);
      expect(deserialize(serialize(fixture))).toEqual(fixture);
    }
  });

  it("does not add teaching states to the canonical gallery contract", () => {
    expect(Object.keys(gameFixtures)).toEqual([
      "emptyBoard",
      "midPlacement",
      "placementJare",
      "initialRemoval",
      "movement",
      "capturePending",
      "repeatedJare",
      "blockedPlayer",
      "blockedSpaceMade",
      "drawByEightyTurns",
      "drawByRepetition",
      "forcedJareSpaceMaking",
      "win",
      "draw",
    ]);
  });
});

function apply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.state;
}
