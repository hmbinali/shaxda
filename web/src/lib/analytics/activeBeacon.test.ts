import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveIdentity } from "@shaxda/shared/analytics/events";
import { ACTIVE_STORAGE_KEY, createActiveBeacon } from "./activeBeacon";

const today = "2026-11-14";
const tomorrow = "2026-11-15";

beforeEach(() => localStorage.clear());

function setup(identity: ActiveIdentity = "guest") {
  let day = today;
  let online = true;
  const fetcher = vi.fn(async () => Response.json({ day, identity }));
  const record = createActiveBeacon(
    localStorage,
    fetcher,
    () => Date.parse(day),
    () => online,
  );
  return {
    record,
    fetcher,
    setDay: (next: string) => {
      day = next;
    },
    setOnline: (value: boolean) => {
      online = value;
    },
  };
}

describe("daily activity beacon", () => {
  it.each(["guest", "account", "account:ayaan", undefined] as const)(
    "uses today's marker for %s, and skips a repeat attempt",
    async (identity) => {
      const responseIdentity = identity ?? "account:ayaan";
      const { record, fetcher, setDay } = setup(responseIdentity);
      localStorage.setItem(
        ACTIVE_STORAGE_KEY,
        JSON.stringify({ [responseIdentity]: today }),
      );
      await record(identity);
      expect(fetcher).not.toHaveBeenCalled();
      setDay(tomorrow);
      await record(identity);
      await record(identity);
      expect(fetcher).toHaveBeenCalledExactlyOnceWith(
        "/api/analytics/active",
        expect.objectContaining({ keepalive: true }),
      );
      expect(JSON.parse(localStorage.getItem(ACTIVE_STORAGE_KEY)!)).toEqual({
        [responseIdentity]: tomorrow,
      });
    },
  );

  it("records a second signed-in identity even when the browser marked the guest", async () => {
    localStorage.setItem(
      ACTIVE_STORAGE_KEY,
      JSON.stringify({ guest: today, "account:ayaan": today }),
    );
    const { record, fetcher } = setup("account:cabdi");
    await record("account:cabdi");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(ACTIVE_STORAGE_KEY)!)).toEqual({
      guest: today,
      "account:ayaan": today,
      "account:cabdi": today,
    });
  });

  it("drops offline attempts and never retries a server failure on that load", async () => {
    const { record, fetcher, setDay, setOnline } = setup();
    setOnline(false);
    await record("guest");
    expect(fetcher).not.toHaveBeenCalled();

    setOnline(true);
    fetcher.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await record("guest");
    setDay(tomorrow);
    await record("guest");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(localStorage.getItem(ACTIVE_STORAGE_KEY)).toBeNull();
  });

  it("stores the server's UTC day and keeps only eight markers", async () => {
    localStorage.setItem(
      ACTIVE_STORAGE_KEY,
      JSON.stringify(
        Object.fromEntries(
          Array.from({ length: 8 }, (_, index) => [
            `account:person${index}`,
            tomorrow,
          ]),
        ),
      ),
    );
    const { record, fetcher } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ day: tomorrow, identity: "guest" }),
    );
    await record("guest");
    await record("guest");
    expect(fetcher).toHaveBeenCalledOnce();
    const markers = JSON.parse(localStorage.getItem(ACTIVE_STORAGE_KEY)!);
    expect(markers.guest).toBe(tomorrow);
    expect(Object.keys(markers)).toHaveLength(8);
  });
});
