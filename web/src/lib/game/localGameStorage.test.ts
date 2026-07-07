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
  it("treats unavailable storage as empty", () => {
    expect(loadSavedLocalGame(null)).toBeNull();
    expect(loadResumableLocalGame(null)).toBeNull();
    expect(() => saveLocalGame(gameFixtures.movement, null)).not.toThrow();
    expect(() => clearSavedLocalGame(null)).not.toThrow();
  });

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

  it("tolerates storage read and write failures", () => {
    const getThrowingStorage = createThrowingStorage("getItem");
    const setThrowingStorage = createThrowingStorage("setItem");
    const removeThrowingStorage = createThrowingStorage("removeItem");

    expect(loadSavedLocalGame(getThrowingStorage)).toBeNull();
    expect(loadResumableLocalGame(getThrowingStorage)).toBeNull();
    expect(() =>
      saveLocalGame(gameFixtures.movement, setThrowingStorage),
    ).not.toThrow();
    expect(() => clearSavedLocalGame(removeThrowingStorage)).not.toThrow();
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

function createThrowingStorage(
  method: keyof LocalGameStorage,
): LocalGameStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => {
      if (method === "getItem") {
        throw new Error("getItem failed");
      }

      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (method === "setItem") {
        throw new Error("setItem failed");
      }

      values.set(key, value);
    },
    removeItem: (key) => {
      if (method === "removeItem") {
        throw new Error("removeItem failed");
      }

      values.delete(key);
    },
  };
}
