import { browser } from "$app/environment";

export const soundCues = [
  "place",
  "move",
  "jare",
  "capture",
  "invalid",
  "win",
] as const;

export type SoundCue = (typeof soundCues)[number];

export const SOUND_PREFERENCE_STORAGE_KEY = "shaxda:sound-enabled:v1";

export type SoundPreferenceStorage = Pick<Storage, "getItem" | "setItem">;

type BrowserAudioContext = AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export class SoundPlayer {
  #context: BrowserAudioContext | null = null;
  #buffers = new Map<SoundCue, Promise<AudioBuffer | null>>();

  async play(cues: readonly SoundCue[]): Promise<void> {
    for (const cue of cues) {
      await this.playCue(cue);
    }
  }

  async unlock(cue: SoundCue = "place"): Promise<void> {
    await this.play([cue]);
  }

  private async playCue(cue: SoundCue): Promise<void> {
    try {
      const context = this.getContext();
      if (context === null) {
        return;
      }

      if (context.state === "suspended") {
        await context.resume();
      }

      const buffer = await this.loadBuffer(context, cue);
      if (buffer === null) {
        return;
      }

      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0.9;
      source.buffer = buffer;
      source.connect(gain).connect(context.destination);
      source.start();
    } catch {
      // Sound is feedback only; playback failures must never block local play.
    }
  }

  private getContext(): BrowserAudioContext | null {
    if (!browser) {
      return null;
    }

    if (this.#context !== null) {
      return this.#context;
    }

    const AudioContextConstructor =
      window.AudioContext ?? window.webkitAudioContext;
    if (AudioContextConstructor === undefined) {
      return null;
    }

    try {
      this.#context = new AudioContextConstructor();
      return this.#context;
    } catch {
      return null;
    }
  }

  private loadBuffer(
    context: BrowserAudioContext,
    cue: SoundCue,
  ): Promise<AudioBuffer | null> {
    const cached = this.#buffers.get(cue);
    if (cached !== undefined) {
      return cached;
    }

    const loading = fetch(`/sounds/${cue}.wav`)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((data) => (data === null ? null : context.decodeAudioData(data)))
      .catch(() => null);

    this.#buffers.set(cue, loading);
    return loading;
  }
}

export function loadSoundPreference(storage = getBrowserStorage()): boolean {
  if (storage === null) {
    return true;
  }

  try {
    return storage.getItem(SOUND_PREFERENCE_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveSoundPreference(
  enabled: boolean,
  storage = getBrowserStorage(),
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(SOUND_PREFERENCE_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // localStorage can be unavailable or full; local play should continue.
  }
}

function getBrowserStorage(): SoundPreferenceStorage | null {
  return browser ? window.localStorage : null;
}
