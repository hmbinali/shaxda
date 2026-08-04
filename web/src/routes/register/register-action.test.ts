import { describe, expect, it, vi } from "vitest";

const claimUsername = vi.fn();

vi.mock("@shaxda/db", () => ({
  claimUsername: (...args: unknown[]) => claimUsername(...args),
}));

import { actions, load } from "./+page.server";

type ConfirmEvent = Parameters<(typeof actions)["confirm"]>[0];

const DB = {} as NonNullable<App.Platform["env"]>["DB"];

function locals(username: string | null = null): App.Locals {
  return {
    session: {
      id: "session-id",
      userId: "user-id",
      token: "private-token",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    user: {
      id: "user-id",
      name: "pending_abc",
      email: "ma.hamed@example.test",
      emailVerified: true,
      image: null,
      username,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}

function confirm(fields: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);

  return actions.confirm({
    locals: locals(),
    platform: { env: { DB } },
    request: new Request("http://localhost/register?/confirm", {
      method: "POST",
      body,
    }),
  } as unknown as ConfirmEvent);
}

describe("/register confirm action", () => {
  it("offers suggestions without confirming one", async () => {
    // `load` redirects once a username exists, so its declared return type
    // includes `void`; an incomplete account always reaches the form branch.
    const result = (await load({
      locals: locals(),
      url: new URL("http://localhost/register"),
    } as unknown as Parameters<typeof load>[0])) as unknown as {
      suggestions: string[];
    };

    expect(result.suggestions.length).toBeGreaterThan(0);
    // The loader may derive candidates from the private email, but it must not
    // decide the public username on the user's behalf.
    expect(result).not.toHaveProperty("username");
    expect(claimUsername).not.toHaveBeenCalled();
  });

  it.each([
    ["", "invalid"],
    ["ab", "invalid"],
    ["magac-qof", "invalid"],
    ["admin", "reserved"],
  ])("rejects %j without writing anything", async (username, error) => {
    claimUsername.mockClear();

    const result = await confirm({ username, avatarMode: "initial" });

    expect(result).toMatchObject({ status: 400, data: { error } });
    expect(claimUsername).not.toHaveBeenCalled();
  });

  it("stores only what the user explicitly submitted", async () => {
    claimUsername.mockClear();
    claimUsername.mockResolvedValue({ kind: "claimed" });

    await expect(
      confirm({ username: " Cabdi_Shaxda ", avatarMode: "initial" }),
    ).rejects.toMatchObject({ status: 303, location: "/" });

    expect(claimUsername).toHaveBeenCalledWith(
      DB,
      "user-id",
      "cabdi_shaxda",
      "initial",
    );
  });
});
