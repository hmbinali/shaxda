import {
  applyAction,
  legalActions,
  type GameAction,
  type GameState,
} from "@shaxda/game-engine";
import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it } from "vitest";
import { inferOpponentAction } from "./inferAction";

describe("inferOpponentAction", () => {
  it.each([
    [
      "placement",
      gameFixtures.emptyBoard,
      { type: "place", player: "A", point: "O1" },
    ],
    [
      "initial removal",
      gameFixtures.initialRemoval,
      legalActionOfType(gameFixtures.initialRemoval, "removeInitial"),
    ],
    [
      "movement",
      gameFixtures.repeatedJare,
      legalActionOfType(gameFixtures.repeatedJare, "move"),
    ],
    [
      "capture",
      gameFixtures.capturePending,
      { type: "capture", player: "A", point: "O5" },
    ],
  ] as const)("reproduces a unique %s action", (_label, previous, action) => {
    const next = apply(previous, action);

    expect(inferOpponentAction(previous, next)).toEqual(action);
  });

  it("returns null for a snapshot that is not one legal action ahead", () => {
    expect(
      inferOpponentAction(gameFixtures.movement, gameFixtures.movement),
    ).toBeNull();
  });

  it("returns null when multiple candidates reproduce the snapshot", () => {
    const previous = gameFixtures.emptyBoard;
    const action = {
      type: "place",
      player: "A",
      point: "O1",
    } as const satisfies GameAction;
    const next = apply(previous, action);

    expect(
      inferOpponentAction(previous, next, [action, { ...action }]),
    ).toBeNull();
  });
});

function legalActionOfType<T extends GameAction["type"]>(
  state: GameState,
  type: T,
): Extract<GameAction, { type: T }> {
  const action = legalActions(state).find(
    (candidate): candidate is Extract<GameAction, { type: T }> =>
      candidate.type === type,
  );

  if (!action) {
    throw new Error(`Fixture has no legal ${type} action.`);
  }

  return action;
}

function apply(state: GameState, action: GameAction): GameState {
  const result = applyAction(state, action);

  if (!result.ok) {
    throw new Error(`Expected legal action, received ${result.error}.`);
  }

  return result.state;
}
