import {
  activeBeaconResponseSchema,
  activeIdentitySchema,
  analyticsDaySchema,
  utcDay,
  type ActiveIdentity,
} from "@shaxda/shared/analytics/events";
import { getOrCreateGuestId } from "$lib/online/guestIdentity";

export const ACTIVE_STORAGE_KEY = "shaxda:analytics-active:v1";
const MAX_IDENTITIES = 8;
type ActiveMarker = [ActiveIdentity, string];

function readMarkers(storage: Storage | null): ActiveMarker[] {
  try {
    const raw = JSON.parse(
      storage?.getItem(ACTIVE_STORAGE_KEY) ?? "{}",
    ) as unknown;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return [];

    const markers: ActiveMarker[] = [];
    for (const [identity, day] of Object.entries(raw)) {
      if (
        activeIdentitySchema.safeParse(identity).success &&
        analyticsDaySchema.safeParse(day).success
      ) {
        markers.push([identity as ActiveIdentity, day]);
      }
    }
    return markers;
  } catch {
    return [];
  }
}

function storeMarker(
  storage: Storage | null,
  day: string,
  identity: ActiveIdentity,
): void {
  const today = readMarkers(storage).filter(
    ([name, date]) => name !== identity && date === day,
  );
  today.push([identity, day]);
  try {
    storage?.setItem(
      ACTIVE_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(today.slice(-MAX_IDENTITIES))),
    );
  } catch {
    // Storage can be disabled or full.
  }
}

export function getAnalyticsStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createActiveBeacon(
  storage = getAnalyticsStorage(),
  send = fetch,
  now = Date.now,
  online = () => navigator.onLine,
) {
  let pending = false;
  let stopped = false;
  let attemptedDay: string | undefined;

  return async (identity: ActiveIdentity | undefined): Promise<void> => {
    const day = utcDay(now());
    if (stopped || pending || attemptedDay === day || !online()) return;
    if (
      readMarkers(storage).some(
        ([name, date]) =>
          date === day && (identity === undefined || identity === name),
      )
    )
      return;

    pending = true;
    attemptedDay = day;
    try {
      const response = await send("/api/analytics/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ v: 1, guestId: getOrCreateGuestId(storage) }),
        keepalive: true,
      });
      if (response.status !== 200) {
        stopped = true;
        return;
      }
      const parsed = activeBeaconResponseSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success) {
        stopped = true;
        return;
      }
      storeMarker(storage, parsed.data.day, parsed.data.identity);
    } catch {
      stopped = true;
    } finally {
      pending = false;
    }
  };
}
