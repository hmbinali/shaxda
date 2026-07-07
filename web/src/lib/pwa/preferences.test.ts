import { describe, expect, it } from "vitest";
import {
  clearPreference,
  loadBooleanPreference,
  saveBooleanPreference,
  type PwaPreferenceStorage,
} from "./preferences";

describe("PWA preferences", () => {
  it("reads and writes boolean preferences", () => {
    const storage = createMemoryStorage();

    expect(loadBooleanPreference("key", storage)).toBe(false);

    saveBooleanPreference("key", true, storage);
    expect(loadBooleanPreference("key", storage)).toBe(true);

    clearPreference("key", storage);
    expect(loadBooleanPreference("key", storage)).toBe(false);
  });

  it("tolerates null and throwing storage", () => {
    const storage = createThrowingStorage();

    expect(loadBooleanPreference("key", null)).toBe(false);
    expect(loadBooleanPreference("key", storage)).toBe(false);
    expect(() => saveBooleanPreference("key", true, null)).not.toThrow();
    expect(() => saveBooleanPreference("key", true, storage)).not.toThrow();
    expect(() => clearPreference("key", null)).not.toThrow();
    expect(() => clearPreference("key", storage)).not.toThrow();
  });
});

function createMemoryStorage(): PwaPreferenceStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function createThrowingStorage(): PwaPreferenceStorage {
  return {
    getItem: () => {
      throw new Error("getItem failed");
    },
    setItem: () => {
      throw new Error("setItem failed");
    },
    removeItem: () => {
      throw new Error("removeItem failed");
    },
  };
}
