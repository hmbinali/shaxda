import { serialize } from "@shaxda/game-engine";
import { gameFixtures } from "@shaxda/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalGameController } from "./localGame.svelte";
import {
  LOCAL_GAME_STORAGE_KEY,
  type LocalGameStorage,
} from "./localGameStorage";

describe("LocalGameController", () => {
  let storage: LocalGameStorage;
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map();
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
  });

  it("places through the engine and persists unfinished state", () => {
    const game = createLocalGameController({ storage });

    game.clickPoint("O1");

    expect(game.state.board.O1).toBe("A");
    expect(values.get(LOCAL_GAME_STORAGE_KEY)).toBeDefined();
  });

  it("tracks invalid point feedback", () => {
    const game = createLocalGameController({ storage });

    game.clickPoint("O1");
    game.clickPoint("O1");

    expect(game.invalid?.reason).toBe("illegalPoint");
  });

  it("resigns with the legal resign action", () => {
    const game = createLocalGameController({
      initialState: gameFixtures.capturePending,
      storage,
    });

    game.resign();

    expect(game.state.phase).toBe("gameOver");
    expect(game.state.winner).toBe("B");
    expect(game.state.endReason).toBe("resignation");
  });

  it("clears saved game when starting over after confirmation", () => {
    const game = createLocalGameController({
      initialState: gameFixtures.movement,
      storage,
      confirmNewGame: () => true,
    });
    values.set(LOCAL_GAME_STORAGE_KEY, serialize(gameFixtures.movement));

    expect(game.startNewGame()).toBe(true);

    expect(game.state.phase).toBe("placement");
    expect(values.get(LOCAL_GAME_STORAGE_KEY)).toBeUndefined();
  });

  it("resumes saved unfinished games", () => {
    values.set(LOCAL_GAME_STORAGE_KEY, serialize(gameFixtures.movement));

    const game = createLocalGameController({ storage });

    expect(game.state).toEqual(gameFixtures.movement);
  });
});
