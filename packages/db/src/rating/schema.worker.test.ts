import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};

const ledgerSchema = () =>
  db
    .prepare(
      "SELECT name, sql FROM sqlite_schema WHERE name IN ('match','match_player') ORDER BY name",
    )
    .all();

let before: Awaited<ReturnType<typeof ledgerSchema>>["results"];
beforeAll(async () => {
  const firstRating = TEST_MIGRATIONS.findIndex(
    (m) => m.name === "0003_ratings.sql",
  );
  expect(firstRating).toBeGreaterThan(0);
  await applyD1Migrations(db, TEST_MIGRATIONS.slice(0, firstRating));
  before = (await ledgerSchema()).results;
  await applyD1Migrations(db, TEST_MIGRATIONS.slice(firstRating));
});

it("extends the ledger beside the original tables and seeds the singleton", async () => {
  expect((await ledgerSchema()).results).toEqual(before);
  expect(
    await db.prepare("SELECT * FROM rating_processor_state").first(),
  ).toEqual({
    id: 1,
    cursor_seq: 0,
    lease_token: null,
    lease_expires_at: null,
    maintenance: 0,
    policy_v: 1,
    algorithm_v: 1,
    updated_at: expect.any(Number),
  });
  expect(
    await db.prepare("SELECT COUNT(*) FROM rating_fence").first("COUNT(*)"),
  ).toBe(0);
  for (const table of [
    "match_rating_next",
    "match_player_rating_next",
    "player_rating_next",
  ]) {
    expect(
      await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first("n"),
    ).toBe(0);
  }
});

it("rejects false or missing fence guards", async () => {
  await expect(
    db.prepare("INSERT INTO rating_fence VALUES (0)").run(),
  ).rejects.toThrow("rating_fence_guard");
  await expect(
    db.prepare("INSERT INTO rating_fence VALUES (NULL)").run(),
  ).rejects.toThrow("rating_fence.ok");
});

it("indexes decisions, seats, players, the board, and pending ledger work", async () => {
  for (const [sql, index] of [
    [
      "SELECT * FROM match_rating WHERE match_id = 'A'",
      "sqlite_autoindex_match_rating_1",
    ],
    [
      "SELECT * FROM match_rating WHERE seq > 9 ORDER BY seq LIMIT 1",
      "sqlite_autoindex_match_rating_2",
    ],
    [
      "SELECT * FROM match_player_rating WHERE match_id = 'A'",
      "sqlite_autoindex_match_player_rating_1",
    ],
    [
      "SELECT * FROM player_rating WHERE user_id = 'A'",
      "sqlite_autoindex_player_rating_1",
    ],
    [
      "SELECT board_key,rating FROM player_rating WHERE excluded = 0 ORDER BY rating DESC, board_key LIMIT 10",
      "player_rating_board_idx",
    ],
    [
      "SELECT seq FROM match WHERE seq > 9 ORDER BY seq LIMIT 1",
      "INTEGER PRIMARY KEY",
    ],
  ]) {
    const plan = await db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .first<string>("detail");
    expect(plan).toContain(index);
  }
});
