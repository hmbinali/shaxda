import { describe, expect, it } from "vitest";
import {
  GUEST_ID_STORAGE_KEY,
  GUEST_NAME_STORAGE_KEY,
  getOrCreateGuestId,
  loadGuestDisplayName,
  saveGuestDisplayName,
  type GuestIdentityStorage,
} from "./guestIdentity";

describe("guest identity", () => {
  it("creates and reuses a stored guest id", () => {
    const storage = memoryStorage();

    expect(getOrCreateGuestId(storage, () => "guest-id-1")).toBe("guest-id-1");
    expect(storage.values.get(GUEST_ID_STORAGE_KEY)).toBe("guest-id-1");
    expect(getOrCreateGuestId(storage, () => "guest-id-2")).toBe("guest-id-1");
  });

  it("loads and saves trimmed display names", () => {
    const storage = memoryStorage();

    saveGuestDisplayName(" Ayaan ", storage);

    expect(storage.values.get(GUEST_NAME_STORAGE_KEY)).toBe("Ayaan");
    expect(loadGuestDisplayName(storage)).toBe("Ayaan");
  });
});

function memoryStorage(): GuestIdentityStorage & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();

  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
