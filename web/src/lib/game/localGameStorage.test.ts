import { applyAction, serialize } from "@shaxda/game-engine";
import { gameFixtures } from "@shaxda/shared";
import { describe, expect, it } from "vitest";
import {
  LOCAL_GAME_STORAGE_KEY,
  clearSavedLocalGame,
  loadResumableLocalGame,
  loadSavedLocalGame,
  saveLocalGame,
  type LocalGameStorage,
} from "./localGameStorage";

describe("local game storage", () => {
  it("roundtrips serialized engine state", () => {
    const storage = createMemoryStorage();

    saveLocalGame(gameFixtures.movement, storage);

    expect(loadSavedLocalGame(storage)).toEqual(gameFixtures.movement);
  });

  it("auto-resumes unfinished games only", () => {
    const storage = createMemoryStorage();

    storage.setItem(LOCAL_GAME_STORAGE_KEY, serialize(gameFixtures.movement));
    expect(loadResumableLocalGame(storage)?.phase).toBe("movement");

    storage.setItem(LOCAL_GAME_STORAGE_KEY, serialize(gameFixtures.win));
    expect(loadResumableLocalGame(storage)).toBeNull();
  });

  it("clears corrupt data and treats it as no save", () => {
    const storage = createMemoryStorage();
    storage.setItem(LOCAL_GAME_STORAGE_KEY, "{bad json");

    expect(loadSavedLocalGame(storage)).toBeNull();
    expect(storage.getItem(LOCAL_GAME_STORAGE_KEY)).toBeNull();
  });

  it("clears saved state", () => {
    const storage = createMemoryStorage();
    const result = applyAction(gameFixtures.emptyBoard, {
      type: "place",
      player: "A",
      point: "O1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      saveLocalGame(result.state, storage);
    }

    clearSavedLocalGame(storage);

    expect(storage.getItem(LOCAL_GAME_STORAGE_KEY)).toBeNull();
  });
});

function createMemoryStorage(): LocalGameStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
