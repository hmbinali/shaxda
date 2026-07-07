import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SOUND_PREFERENCE_STORAGE_KEY,
  SoundPlayer,
  loadSoundPreference,
  saveSoundPreference,
  type SoundPreferenceStorage,
} from "./sound";

describe("sound preference", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to enabled", () => {
    const storage = createMemoryStorage();

    expect(loadSoundPreference(storage)).toBe(true);
  });

  it("roundtrips the persisted preference", () => {
    const storage = createMemoryStorage();

    saveSoundPreference(false, storage);

    expect(storage.getItem(SOUND_PREFERENCE_STORAGE_KEY)).toBe("false");
    expect(loadSoundPreference(storage)).toBe(false);

    saveSoundPreference(true, storage);

    expect(storage.getItem(SOUND_PREFERENCE_STORAGE_KEY)).toBe("true");
    expect(loadSoundPreference(storage)).toBe(true);
  });

  it("tolerates unavailable storage", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } satisfies SoundPreferenceStorage;

    expect(loadSoundPreference(storage)).toBe(true);
    expect(() => saveSoundPreference(false, storage)).not.toThrow();
  });
});

describe("SoundPlayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no-ops safely when Web Audio is unavailable", async () => {
    vi.stubGlobal("AudioContext", undefined);
    Object.defineProperty(window, "webkitAudioContext", {
      configurable: true,
      value: undefined,
    });

    await expect(new SoundPlayer().play(["place"])).resolves.toBeUndefined();
  });
});

function createMemoryStorage(): SoundPreferenceStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
