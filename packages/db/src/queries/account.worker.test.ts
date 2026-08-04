import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  changeUsername,
  claimUsername,
  isUsernameAvailable,
  resolveProfile,
  setAvatarMode,
} from "./account";

type TestEnvironment = {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};

const testEnv = env as unknown as TestEnvironment;
const db = testEnv.DB;
const start = new Date("2026-01-01T00:00:00.000Z");

beforeAll(async () => {
  await applyD1Migrations(db, testEnv.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM session"),
    db.prepare("DELETE FROM account"),
    db.prepare("DELETE FROM username_claim"),
    db.prepare("DELETE FROM verification"),
    db.prepare("DELETE FROM user"),
  ]);
});

describe("account migration", () => {
  it("installs the expected indexes and database constraints", async () => {
    const schema = await db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name",
      )
      .all<{ name: string; sql: string | null }>();
    const byName = new Map(schema.results.map((row) => [row.name, row.sql]));

    expect(byName.has("account_provider_account_unique")).toBe(true);
    expect(byName.has("account_userId_idx")).toBe(true);
    expect(byName.has("session_token_unique")).toBe(true);
    expect(byName.has("session_userId_idx")).toBe(true);
    expect(byName.has("user_username_unique")).toBe(true);
    expect(byName.has("username_claim_user_released_idx")).toBe(true);
    expect(byName.get("user")).toContain("user_username_normalized_check");
    expect(byName.get("user")).toContain("user_avatar_mode_check");
    expect(byName.get("username_claim")).toContain(
      "username_claim_normalized_check",
    );
  });

  it("rejects denormalized usernames and invalid avatar modes", async () => {
    await insertUser("u1");
    await expect(
      db.prepare("UPDATE user SET username = 'Bad-Name' WHERE id = 'u1'").run(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare("UPDATE user SET avatar_mode = 'upload' WHERE id = 'u1'")
        .run(),
    ).rejects.toThrow();
  });
});

describe("username confirmation", () => {
  it("claims a username and starts cooldown atomically", async () => {
    await insertUser("u1", {
      image: "https://lh3.googleusercontent.com/a/photo",
    });
    await expect(
      claimUsername(db, "u1", "Mahamed", "google", start),
    ).resolves.toEqual({
      kind: "claimed",
    });

    expect(await tableRows("user")).toMatchObject([
      {
        id: "u1",
        name: "mahamed",
        username: "mahamed",
        username_changed_at: start.getTime(),
        avatar_mode: "google",
      },
    ]);
    expect(await tableRows("username_claim")).toEqual([
      {
        username: "mahamed",
        user_id: "u1",
        claimed_at: start.getTime(),
        released_at: null,
      },
    ]);
  });

  it("leaves all account state unchanged on negative outcomes", async () => {
    await insertUser("complete");
    await claimUsername(db, "complete", "existing", "initial", start);
    await insertUser("incomplete");

    const before = await accountSnapshot();
    await expect(
      claimUsername(db, "complete", "secondname", "initial", start),
    ).resolves.toEqual({ kind: "alreadyComplete" });
    expect(await accountSnapshot()).toEqual(before);

    await expect(
      claimUsername(db, "incomplete", "existing", "initial", start),
    ).resolves.toEqual({ kind: "taken" });
    expect(await accountSnapshot()).toEqual(before);

    await expect(
      claimUsername(db, "missing", "available", "initial", start),
    ).resolves.toEqual({ kind: "missing" });
    expect(await accountSnapshot()).toEqual(before);
  });

  it("returns one winner for concurrent claims", async () => {
    await insertUser("u1");
    await insertUser("u2");

    const outcomes = await Promise.all([
      claimUsername(db, "u1", "racing", "initial", start),
      claimUsername(db, "u2", "racing", "initial", start),
    ]);
    expect(outcomes.map((outcome) => outcome.kind).sort()).toEqual([
      "claimed",
      "taken",
    ]);
    expect(await tableRows("username_claim")).toHaveLength(1);
  });
});

describe("username changes and profile aliases", () => {
  it("enforces cooldown without partial writes", async () => {
    await insertUser("u1");
    await claimUsername(db, "u1", "first_name", "initial", start);
    const before = await accountSnapshot();

    const outcome = await changeUsername(
      db,
      "u1",
      "second_name",
      new Date(start.getTime() + 1_000),
    );
    expect(outcome).toEqual({
      kind: "cooldown",
      nextEligibleAt: new Date("2026-01-31T00:00:00.000Z"),
    });
    expect(await accountSnapshot()).toEqual(before);
  });

  it("preserves aliases and lets only their owner reclaim them", async () => {
    await insertUser("u1");
    await insertUser("u2");
    await claimUsername(db, "u1", "first_name", "initial", start);
    const firstChange = new Date("2026-02-01T00:00:00.000Z");
    await expect(
      changeUsername(db, "u1", "second_name", firstChange),
    ).resolves.toEqual({
      kind: "changed",
    });

    await expect(resolveProfile(db, "first_name")).resolves.toEqual({
      kind: "alias",
      currentUsername: "second_name",
    });
    await expect(resolveProfile(db, "second_name")).resolves.toMatchObject({
      kind: "current",
      profile: {
        username: "second_name",
        avatarMode: "initial",
        imageUrl: null,
      },
    });
    await expect(
      claimUsername(db, "u2", "first_name", "initial", firstChange),
    ).resolves.toEqual({ kind: "taken" });

    const reclaimAt = new Date("2026-03-03T00:00:00.000Z");
    await expect(
      changeUsername(db, "u1", "first_name", reclaimAt),
    ).resolves.toEqual({
      kind: "changed",
    });
    await expect(resolveProfile(db, "first_name")).resolves.toMatchObject({
      kind: "current",
      profile: { username: "first_name" },
    });
    expect(await tableRows("user")).toMatchObject([{ id: "u1" }, { id: "u2" }]);
  });

  it("classifies unchanged, incomplete, missing, and taken without writes", async () => {
    await insertUser("u1");
    await insertUser("u2");
    await insertUser("u3");
    await claimUsername(db, "u1", "first_name", "initial", start);
    await claimUsername(db, "u2", "taken_name", "initial", start);
    const eligible = new Date("2026-02-01T00:00:00.000Z");
    const before = await accountSnapshot();

    await expect(
      changeUsername(db, "u1", "first_name", eligible),
    ).resolves.toEqual({
      kind: "unchanged",
    });
    await expect(
      changeUsername(db, "u3", "new_name", eligible),
    ).resolves.toEqual({
      kind: "incomplete",
    });
    await expect(
      changeUsername(db, "missing", "new_name", eligible),
    ).resolves.toEqual({
      kind: "missing",
    });
    await expect(
      changeUsername(db, "u1", "taken_name", eligible),
    ).resolves.toEqual({
      kind: "taken",
    });
    expect(await accountSnapshot()).toEqual(before);
  });

  it("updates avatar mode and reports availability", async () => {
    await insertUser("u1");
    await claimUsername(db, "u1", "first_name", "initial", start);
    await expect(setAvatarMode(db, "u1", "google", start)).resolves.toEqual({
      kind: "updated",
    });
    await expect(isUsernameAvailable(db, "first_name")).resolves.toBe(false);
    await expect(isUsernameAvailable(db, "available_name")).resolves.toBe(true);
    await expect(isUsernameAvailable(db, "admin")).resolves.toBe(false);
    await expect(resolveProfile(db, "missing_name")).resolves.toEqual({
      kind: "missing",
    });
  });
});

async function insertUser(
  id: string,
  options: { image?: string | null } = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user
       (id, name, email, email_verified, image, created_at, updated_at, avatar_mode)
       VALUES (?1, ?2, ?3, 1, ?4, ?5, ?5, 'initial')`,
    )
    .bind(
      id,
      `pending_${id}`,
      `${id}@example.test`,
      options.image ?? null,
      start.getTime(),
    )
    .run();
}

async function tableRows(
  table: "user" | "username_claim",
): Promise<Record<string, unknown>[]> {
  const order = table === "user" ? "id" : "username";
  const result = await db
    .prepare(`SELECT * FROM ${table} ORDER BY ${order}`)
    .all();
  return result.results;
}

async function accountSnapshot(): Promise<{
  users: Record<string, unknown>[];
  claims: Record<string, unknown>[];
}> {
  return {
    users: await tableRows("user"),
    claims: await tableRows("username_claim"),
  };
}
