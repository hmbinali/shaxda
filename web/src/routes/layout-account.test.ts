import { describe, expect, it } from "vitest";
import { load } from "./+layout.server";

type LoadEvent = Parameters<Exclude<typeof load, undefined>>[0];

describe("root account loader privacy", () => {
  it("returns only incomplete status before username confirmation", async () => {
    const result = await load({
      locals: {
        session: session(),
        user: user({ username: null }),
      },
    } as LoadEvent);
    expect(result).toEqual({ account: { status: "incomplete" } });
    expect(JSON.stringify(result)).not.toContain("private@example.test");
    expect(JSON.stringify(result)).not.toContain("user-id");
  });

  it("returns a public-safe complete account shape", async () => {
    const result = await load({
      locals: {
        session: session(),
        user: user({ username: "mahamed", avatarMode: "initial" }),
      },
    } as LoadEvent);
    expect(result).toMatchObject({
      account: {
        status: "complete",
        username: "mahamed",
        avatarMode: "initial",
        imageUrl: null,
        initial: "M",
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private@example.test");
    expect(serialized).not.toContain("user-id");
    expect(serialized).not.toContain("Private Google Name");
  });
});

function session(): NonNullable<App.Locals["session"]> {
  return {
    id: "session-id",
    userId: "user-id",
    token: "private-token",
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function user(
  overrides: Partial<NonNullable<App.Locals["user"]>>,
): NonNullable<App.Locals["user"]> {
  return {
    id: "user-id",
    name: "Private Google Name",
    email: "private@example.test",
    emailVerified: true,
    image: "https://lh3.googleusercontent.com/a/photo",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
