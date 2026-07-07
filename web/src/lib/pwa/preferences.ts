export const PWA_INSTALL_DISMISSED_STORAGE_KEY =
  "shaxda:pwa-install-dismissed:v1";

export type PwaPreferenceStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function loadBooleanPreference(
  key: string,
  storage: PwaPreferenceStorage | null,
): boolean {
  if (storage === null) {
    return false;
  }

  try {
    return storage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function saveBooleanPreference(
  key: string,
  value: boolean,
  storage: PwaPreferenceStorage | null,
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(key, value ? "true" : "false");
  } catch {
    // PWA preferences are convenience-only; storage failures must not block play.
  }
}

export function clearPreference(
  key: string,
  storage: PwaPreferenceStorage | null,
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Clearing preferences is best-effort when browser storage is unavailable.
  }
}
