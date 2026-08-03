import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SOUND_PREFERENCE_STORAGE_KEY,
  SoundPlayer,
  getSoundPlayer,
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

  it("shares one player and preloads every cue in parallel", async () => {
    let contextCount = 0;
    let activeFetches = 0;
    let peakFetches = 0;
    const releases: Array<() => void> = [];

    class FakeAudioContext {
      state = "running";
      destination = {};

      constructor() {
        contextCount += 1;
      }

      decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);
    }

    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            activeFetches += 1;
            peakFetches = Math.max(peakFetches, activeFetches);
            releases.push(() => {
              activeFetches -= 1;
              resolve({
                ok: true,
                arrayBuffer: async () => new ArrayBuffer(1),
              } as Response);
            });
          }),
      ),
    );

    const first = getSoundPlayer();
    const second = getSoundPlayer();
    const loading = first.preload();
    await vi.waitFor(() => expect(releases).toHaveLength(6));
    for (const release of releases) release();
    await loading;
    await second.preload();

    expect(second).toBe(first);
    expect(contextCount).toBe(1);
    expect(peakFetches).toBe(6);
    expect(fetch).toHaveBeenCalledTimes(6);
  });
});

function createMemoryStorage(): SoundPreferenceStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
