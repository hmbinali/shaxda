import { browser } from "$app/environment";

export const GUEST_ID_STORAGE_KEY = "shaxda:guest-id:v1";
export const GUEST_NAME_STORAGE_KEY = "shaxda:guest-name:v1";

export type GuestIdentityStorage = Pick<Storage, "getItem" | "setItem">;

export function getOrCreateGuestId(
  storage = getBrowserStorage(),
  randomId = createRandomGuestId,
): string {
  if (storage === null) {
    return randomId();
  }

  try {
    const existing = storage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing !== null && existing.length >= 8) {
      return existing;
    }

    const guestId = randomId();
    storage.setItem(GUEST_ID_STORAGE_KEY, guestId);
    return guestId;
  } catch {
    return randomId();
  }
}

export function loadGuestDisplayName(
  storage = getBrowserStorage(),
): string | null {
  if (storage === null) {
    return null;
  }

  try {
    const name = storage.getItem(GUEST_NAME_STORAGE_KEY)?.trim();
    return name && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export function saveGuestDisplayName(
  displayName: string,
  storage = getBrowserStorage(),
): void {
  if (storage === null) {
    return;
  }

  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return;
  }

  try {
    storage.setItem(GUEST_NAME_STORAGE_KEY, trimmed);
  } catch {
    // Guest identity is convenience only; online play can still proceed.
  }
}

function createRandomGuestId(): string {
  if (browser && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function getBrowserStorage(): GuestIdentityStorage | null {
  return browser ? window.localStorage : null;
}
