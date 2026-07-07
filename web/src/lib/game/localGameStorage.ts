import { browser } from "$app/environment";
import {
  deserialize,
  serialize,
  type GameState,
  type SerializedGameState,
} from "@shaxda/game-engine";

export const LOCAL_GAME_STORAGE_KEY = "shaxda:local-game:v1";

export type LocalGameStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function loadSavedLocalGame(
  storage = getBrowserStorage(),
): GameState | null {
  if (storage === null) {
    return null;
  }

  try {
    const saved = storage.getItem(LOCAL_GAME_STORAGE_KEY);
    if (saved === null) {
      return null;
    }

    return deserialize(saved as SerializedGameState);
  } catch {
    clearSavedLocalGame(storage);
    return null;
  }
}

export function loadResumableLocalGame(
  storage = getBrowserStorage(),
): GameState | null {
  const saved = loadSavedLocalGame(storage);

  return saved !== null && saved.phase !== "gameOver" ? saved : null;
}

export function saveLocalGame(
  state: GameState,
  storage = getBrowserStorage(),
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(LOCAL_GAME_STORAGE_KEY, serialize(state));
  } catch {
    // localStorage can be unavailable or full; local play should continue.
  }
}

export function clearSavedLocalGame(storage = getBrowserStorage()): void {
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(LOCAL_GAME_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable; clearing is best-effort.
  }
}

function getBrowserStorage(): LocalGameStorage | null {
  return browser ? window.localStorage : null;
}
