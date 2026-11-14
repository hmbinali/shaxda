import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsHash } from "@shaxda/shared/analytics/hash";
import { POST as active } from "./active/+server";
import { POST as event } from "./event/+server";

const mocks = vi.hoisted(() => ({
  settings: { dev: false },
  getSession: vi.fn(),
  recordActivity: vi.fn(),
  incrementLocalEvent: vi.fn(),
  readDeletion: vi.fn(),
}));
vi.mock("$app/environment", () => ({
  get dev() {
    return mocks.settings.dev;
  },
}));
vi.mock("$lib/server/auth", () => ({
  getAuth: () => ({ api: { getSession: mocks.getSession } }),
}));
vi.mock("@shaxda/db/analytics", () => mocks);
vi.mock("@shaxda/db", () => ({
  readDeletion: mocks.readDeletion,
  revokeSession: vi.fn(),
}));

const origin = "https://shaxda.example";
const salt = "a".repeat(32);
const rate = vi.fn();
const env = {
  AUTH_BASE_URL: origin,
  ANALYTICS_ENABLED: "true",
  ANALYTICS_SALT: salt,
  ANALYTICS_RATE_LIMIT: { limit: rate },
  DB: {},
};
const beacon = { v: 1, guestId: "browser-fixture-id" };
const localEvent = { v: 1, event: "local_started" };
const now = Date.parse("2026-11-14T23:59:59Z");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.settings.dev = false;
  vi.spyOn(Date, "now").mockReturnValue(now);
  rate.mockResolvedValue({ success: true });
  mocks.readDeletion.mockResolvedValue({
    deletion_due_at: null,
    deleted_at: null,
  });
});

function post(
  handler: typeof active | typeof event,
  {
    body = JSON.stringify(beacon),
    headers = {
      origin,
      "content-type": "application/json",
      "cf-connecting-ip": "192.0.2.1",
    },
    platform = { env },
  }: {
    body?: string;
    headers?: HeadersInit;
    platform?: { env?: Partial<typeof env> };
  } = {},
) {
  const request = new Request(origin + "/api/analytics", {
    method: "POST",
    headers,
    body,
  });
  const input = { platform, request, locals: { user: null, session: null } };
  return handler === active
    ? active(input as Parameters<typeof active>[0])
    : event(input as Parameters<typeof event>[0]);
}

describe("analytics route guards", () => {
  it.each([
    [{ platform: {} }, 503],
    [{ platform: { env: { ANALYTICS_ENABLED: "false" } }, headers: {} }, 204],
    [{ headers: { "content-type": "application/json" } }, 403],
    [
      {
        headers: {
          origin: origin + ".invalid",
          "content-type": "application/json",
        },
      },
      403,
    ],
    [{ headers: { origin, "content-type": "text/plain" } }, 415],
    [{ body: "é".repeat(513) }, 413],
    [
      {
        headers: {
          origin,
          "content-type": "application/json",
          "content-length": "1025",
        },
      },
      413,
    ],
    [{ body: "[" }, 400],
    [{ body: JSON.stringify({ ...beacon, userId: "browser-input" }) }, 400],
    [{ platform: { env: { ...env, ANALYTICS_RATE_LIMIT: undefined } } }, 503],
    [{ platform: { env: { ...env, ANALYTICS_SALT: "short" } } }, 503],
  ] as const)("returns the guard response for %j", async (params, status) => {
    const response = await post(active, params);
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.recordActivity).not.toHaveBeenCalled();
  });

  it("uses one IP key for both routes and blocks limited requests", async () => {
    rate.mockResolvedValue({ success: false });
    expect((await post(active)).status).toBe(429);
    expect(
      (await post(event, { body: JSON.stringify(localEvent) })).status,
    ).toBe(429);
    expect(rate.mock.calls).toEqual([
      [{ key: "192.0.2.1" }],
      [{ key: "192.0.2.1" }],
    ]);
    expect(mocks.incrementLocalEvent).not.toHaveBeenCalled();
  });

  it("allows an unbound limiter only during Vite development", async () => {
    const platform = { env: { ...env, ANALYTICS_RATE_LIMIT: undefined } };
    mocks.settings.dev = true;
    expect((await post(active, { platform })).status).toBe(200);
    mocks.settings.dev = false;
    expect((await post(active, { platform })).status).toBe(503);
  });
});

describe("analytics writes", () => {
  it.each([
    [null, "guest"],
    [{ id: "session-user-id", username: null }, "account"],
    [{ id: "session-user-id", username: "ayaan" }, "account:ayaan"],
  ] as const)(
    "returns the %s identity with only hashed D1 arguments",
    async (user, identity) => {
      mocks.getSession.mockResolvedValue(user === null ? null : { user });
      const response = await post(active);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        day: "2026-11-14",
        identity,
      });
      const rows = [
        {
          kind: "guest",
          anonId: await analyticsHash(salt, "guest", beacon.guestId),
        },
      ];
      if (user !== null) {
        rows.push({
          kind: "account",
          anonId: await analyticsHash(salt, "account", user.id),
        });
      }
      expect(mocks.recordActivity).toHaveBeenCalledWith(
        env.DB,
        "2026-11-14",
        rows,
      );
    },
  );

  it("accepts just local counter names and stays sessionless", async () => {
    for (const name of ["online_room_created_guest", "active_accounts_1d"]) {
      expect(
        (await post(event, { body: JSON.stringify({ v: 1, event: name }) }))
          .status,
      ).toBe(400);
    }
    expect(
      (await post(event, { body: JSON.stringify(localEvent) })).status,
    ).toBe(204);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.incrementLocalEvent).toHaveBeenCalledExactlyOnceWith(
      env.DB,
      "local_started",
      "2026-11-14",
      now,
    );
  });

  it("records pending accounts as guests", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "pending-user", username: "ayaan" },
    });
    mocks.readDeletion.mockResolvedValue({
      deletion_due_at: now + 100,
      deleted_at: null,
    });
    const response = await post(active);
    await expect(response.json()).resolves.toMatchObject({ identity: "guest" });
    expect(mocks.recordActivity.mock.calls[0]?.[2]).toEqual([
      {
        kind: "guest",
        anonId: await analyticsHash(salt, "guest", beacon.guestId),
      },
    ]);
  });

  it("returns 503 for D1 failures", async () => {
    mocks.recordActivity.mockRejectedValue(Error("D1 failure"));
    mocks.incrementLocalEvent.mockRejectedValue(Error("D1 failure"));
    expect((await post(active)).status).toBe(503);
    expect(
      (await post(event, { body: JSON.stringify(localEvent) })).status,
    ).toBe(503);
  });
});
