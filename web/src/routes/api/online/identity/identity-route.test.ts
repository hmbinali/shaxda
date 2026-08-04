import { verifyIdentityTicket } from "@shaxda/shared/identity";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./+server";

const SECRET = "route-test-online-identity-secret";
const NOW = 1_800_000_000_000;

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

describe("/api/online/identity", () => {
  it.each([
    [null, { status: "signedOut" }],
    [user({ username: null }), { status: "incomplete" }],
  ])("returns the non-complete status", async (currentUser, expected) => {
    const response = await GET({
      locals: { user: currentUser },
    } as Parameters<typeof GET>[0]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(expected);
  });

  it("returns only the public account identity", async () => {
    const response = await GET({
      locals: {
        user: user({
          username: "ayaan_7",
          avatarMode: "google",
          image: "https://lh3.googleusercontent.com/a/photo",
        }),
      },
    } as Parameters<typeof GET>[0]);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "complete",
      account: {
        username: "ayaan_7",
        avatar: { mode: "google", initial: "A" },
      },
    });
    expect(JSON.stringify(body)).not.toContain("user-id");
    expect(JSON.stringify(body)).not.toContain("private@example.test");
  });

  it("mints a verifiable scoped ticket", async () => {
    const response = await post({ action: "join", roomCode: "ABCDEFGH" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      ticket: string;
      expiresAt: number;
    };
    expect(body.expiresAt).toBe(NOW + 90_000);
    await expect(
      verifyIdentityTicket(
        body.ticket,
        [SECRET],
        { allowedActions: ["join"], roomCode: "ABCDEFGH" },
        NOW,
      ),
    ).resolves.toMatchObject({
      ok: true,
      payload: {
        userId: "user-id",
        usernameSnapshot: "ayaan_7",
        imageUrl: "https://lh3.googleusercontent.com/a/photo",
      },
    });
  });

  it("drops an unusable Google image without blocking minting", async () => {
    const response = await post(
      { action: "create" },
      user({ image: `https://lh3.googleusercontent.com/${"x".repeat(520)}` }),
    );
    const body = (await response.json()) as { ticket: string };
    await expect(
      verifyIdentityTicket(
        body.ticket,
        [SECRET],
        { allowedActions: ["create"] },
        NOW,
      ),
    ).resolves.toMatchObject({ ok: true, payload: { imageUrl: null } });
  });

  it.each([
    [null, 401],
    [user({ username: null }), 409],
  ])("rejects an unusable session", async (currentUser, status) => {
    expect((await post({ action: "create" }, currentUser)).status).toBe(status);
  });

  it("returns 503 when the ticket secret is missing", async () => {
    expect(
      (await post({ action: "create" }, user(), "http://localhost:5173", null))
        .status,
    ).toBe(503);
  });

  it("rejects cross-origin and non-JSON POST requests", async () => {
    expect(
      (await post({ action: "create" }, user(), "https://evil.test")).status,
    ).toBe(403);
    const response = await POST({
      locals: { user: user() },
      platform: { env: environment(SECRET) },
      request: new Request("http://localhost:5173/api/online/identity", {
        method: "POST",
        headers: { origin: "http://localhost:5173" },
        body: "action=create",
      }),
    } as Parameters<typeof POST>[0]);
    expect(response.status).toBe(415);
  });
});

async function post(
  body: unknown,
  currentUser: App.Locals["user"] = user(),
  origin = "http://localhost:5173",
  secret: string | null = SECRET,
): Promise<Response> {
  return await POST({
    locals: { user: currentUser },
    platform: { env: environment(secret) },
    request: new Request("http://localhost:5173/api/online/identity", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    }),
  } as Parameters<typeof POST>[0]);
}

function environment(secret: string | null): App.Platform["env"] {
  return {
    AUTH_BASE_URL: "http://localhost:5173",
    ...(secret === null ? {} : { ONLINE_IDENTITY_SECRET: secret }),
  } as App.Platform["env"];
}

function user(
  overrides: Partial<NonNullable<App.Locals["user"]>> = {},
): NonNullable<App.Locals["user"]> {
  return {
    id: "user-id",
    name: "Private Google Name",
    email: "private@example.test",
    emailVerified: true,
    image: "https://lh3.googleusercontent.com/a/photo",
    username: "ayaan_7",
    avatarMode: "google",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
