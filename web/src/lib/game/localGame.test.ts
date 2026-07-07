import { serialize } from "@shaxda/game-engine";
import { gameFixtures, noJarePlacementOrder } from "@shaxda/shared";
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
    expect(game.feedback?.cues).toEqual(["place"]);
    expect(game.lastAction).toMatchObject({
      action: { type: "place", player: "A", point: "O1" },
      nonce: 1,
    });
    expect(game.invalidNonce).toBe(0);
    expect(values.get(LOCAL_GAME_STORAGE_KEY)).toBeDefined();
  });

  it("emits place and jare feedback for the first placement jare", () => {
    const game = createLocalGameController({ storage });

    game.clickPoint("O1");
    game.clickPoint("M1");
    game.clickPoint("O2");
    game.clickPoint("M3");
    game.clickPoint("O3");

    expect(game.state.firstAdvantage).toBe("A");
    expect(game.feedback?.cues).toEqual(["place", "jare"]);
  });

  it("does not emit jare feedback for no-jare first-advantage fallback", () => {
    const game = createLocalGameController({ storage });

    for (const point of noJarePlacementOrder) {
      game.clickPoint(point);
    }

    expect(game.state.phase).toBe("initialRemoval");
    expect(game.state.firstAdvantage).toBe("B");
    expect(game.feedback?.cues).toEqual(["place"]);
  });

  it("tracks invalid point feedback", () => {
    const game = createLocalGameController({ storage });

    game.clickPoint("O1");
    game.clickPoint("O1");

    expect(game.invalid?.reason).toBe("illegalPoint");
    expect(game.feedback?.cues).toEqual(["invalid"]);
    expect(game.invalid?.nonce).toBe(1);
    expect(game.invalidNonce).toBe(1);
  });

  it("emits move feedback for ordinary movement", () => {
    const game = createLocalGameController({
      initialState: gameFixtures.movement,
      storage,
    });

    game.clickPoint("O8");
    game.clickPoint("O1");

    expect(game.feedback?.cues).toEqual(["move"]);
  });

  it("emits move and jare feedback for movement-phase jare", () => {
    const game = createLocalGameController({
      initialState: gameFixtures.repeatedJare,
      storage,
    });

    game.clickPoint("O4");
    game.clickPoint("O3");

    expect(game.state.phase).toBe("capture");
    expect(game.feedback?.cues).toEqual(["move", "jare"]);
  });

  it("emits capture feedback for non-terminal capture", () => {
    const game = createLocalGameController({
      initialState: {
        ...gameFixtures.capturePending,
        board: {
          ...gameFixtures.capturePending.board,
          M1: "B",
        },
      },
      storage,
    });

    game.clickPoint("O5");

    expect(game.state.phase).toBe("movement");
    expect(game.feedback?.cues).toEqual(["capture"]);
  });

  it("emits capture and win feedback for terminal capture", () => {
    const game = createLocalGameController({
      initialState: gameFixtures.capturePending,
      storage,
    });

    game.clickPoint("O5");

    expect(game.state.phase).toBe("gameOver");
    expect(game.feedback?.cues).toEqual(["capture", "win"]);
  });

  it("increments successful action feedback for each applied engine action", () => {
    const game = createLocalGameController({ storage });

    game.clickPoint("O1");
    game.clickPoint("O2");

    expect(game.lastAction).toMatchObject({
      action: { type: "place", player: "B", point: "O2" },
      nonce: 2,
    });
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
    expect(game.feedback?.cues).toEqual(["win"]);
  });

  it("uses capture feedback for initial removal", () => {
    const game = createLocalGameController({
      initialState: gameFixtures.initialRemoval,
      storage,
    });

    game.clickPoint("O1");

    expect(game.feedback?.cues).toEqual(["capture"]);
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
    expect(game.lastAction).toBeNull();
    expect(game.feedback).toBeNull();
    expect(game.invalid).toBeNull();
    expect(game.invalidNonce).toBe(0);
    expect(values.get(LOCAL_GAME_STORAGE_KEY)).toBeUndefined();
  });

  it("clears transient feedback when starting a new game", () => {
    const game = createLocalGameController({
      storage,
      confirmNewGame: () => true,
    });

    game.clickPoint("O1");
    game.clickPoint("O1");

    expect(game.lastAction).not.toBeNull();
    expect(game.feedback).not.toBeNull();
    expect(game.invalidNonce).toBe(1);

    expect(game.startNewGame()).toBe(true);

    expect(game.lastAction).toBeNull();
    expect(game.feedback).toBeNull();
    expect(game.invalid).toBeNull();
    expect(game.invalidNonce).toBe(0);
  });

  it("resumes saved unfinished games", () => {
    values.set(LOCAL_GAME_STORAGE_KEY, serialize(gameFixtures.movement));

    const game = createLocalGameController({ storage });

    expect(game.state).toEqual(gameFixtures.movement);
  });
});
