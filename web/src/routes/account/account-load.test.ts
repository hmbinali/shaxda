import { USERNAME_CHANGE_COOLDOWN_MS } from "@shaxda/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { load } from "./+page.server";

const NOW = new Date("2026-08-04T00:00:00.000Z");

function platform(usernameChangedAt: number | null) {
  return {
    env: {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ username_changed_at: usernameChangedAt }),
          }),
        }),
      },
    },
  };
}

function locals() {
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
      name: "mahamed",
      email: "private@example.test",
      emailVerified: true,
      image: null,
      username: "mahamed",
      avatarMode: "initial",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}

// `load` redirects on incomplete accounts, so its declared return type includes
// `void`; these cases always reach the settings branch.
type AccountSettings = { settings: { nextChangeAt: string | null } };

async function loadAccount(
  usernameChangedAt: number | null,
): Promise<AccountSettings> {
  const result = await load({
    locals: locals(),
    platform: platform(usernameChangedAt),
  } as unknown as Parameters<typeof load>[0]);
  return result as unknown as AccountSettings;
}

describe("/account username cooldown display", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the next eligible date while the cooldown is running", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const result = await loadAccount(
      NOW.getTime() - USERNAME_CHANGE_COOLDOWN_MS + 1,
    );

    expect(result.settings.nextChangeAt).not.toBeNull();
  });

  it("hides the date once the account is eligible again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    // claimUsername stamps username_changed_at at registration, so every
    // account has one; a fully elapsed cooldown must not render a past date.
    await expect(
      loadAccount(NOW.getTime() - USERNAME_CHANGE_COOLDOWN_MS),
    ).resolves.toMatchObject({ settings: { nextChangeAt: null } });
    await expect(
      loadAccount(new Date("2026-01-01T00:00:00.000Z").getTime()),
    ).resolves.toMatchObject({ settings: { nextChangeAt: null } });
  });

  it("hides the date when the account has never changed its username", async () => {
    const result = await loadAccount(null);

    expect(result.settings.nextChangeAt).toBeNull();
  });

  it("never returns cooldown or provider internals to the page", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const result = await loadAccount(NOW.getTime());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("username_changed_at");
    expect(serialized).not.toContain("private-token");
    expect(serialized).not.toContain("user-id");
  });
});
