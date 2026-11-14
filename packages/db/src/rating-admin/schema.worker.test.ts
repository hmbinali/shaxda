import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { matchPayloadHash } from "@shaxda/shared";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { beforeAll, expect, it } from "vitest";
import { saveMatch } from "../match";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};
const payload = sampleMatchPayloads.M2;
const clock = "CAST(unixepoch('subsecond') * 1000 AS INTEGER)";

beforeAll(async () => {
  await applyD1Migrations(db, TEST_MIGRATIONS);
  expect(
    await saveMatch(db, payload, await matchPayloadHash(payload)),
  ).toMatchObject({ status: "saved" });
  await db
    .prepare(
      `INSERT INTO rating_admin_audit
    (id, at, environment, actor, command, reason, outcome, plan_digest, high_water_seq)
    VALUES (1,${clock},'local','fixture','invalidate-match','fixture reason','applied','fixture-digest',1)`,
    )
    .run();
  await db
    .prepare(
      `INSERT INTO rating_rebuild VALUES
    (1,${clock},1,'fixture reason',1,1,1,1,1)`,
    )
    .run();
});

it("uses the latest action for the indexed invalidation view", async () => {
  const query =
    "SELECT match_id FROM rating_invalidation_current WHERE match_id = ?";
  const head = () => db.prepare(query).bind(payload.id).first("match_id");
  expect(await head()).toBeNull();
  const log = db.prepare(`INSERT INTO rating_invalidation_log
    (match_id, action, reason, actor, audit_id, created_at)
    VALUES (?, ?, 'fixture reason', 'fixture', 1, ${clock})`);
  await log.bind(payload.id, "invalidate").run();
  expect(await head()).toBe(payload.id);
  await log.bind(payload.id, "rescind").run();
  expect(await head()).toBeNull();
  await log.bind(payload.id, "invalidate").run();
  expect(await head()).toBe(payload.id);
  await expect(log.bind("unknown match", "invalidate").run()).rejects.toThrow(
    "FOREIGN KEY",
  );
  const plan = await db
    .prepare(`EXPLAIN QUERY PLAN ${query}`)
    .bind(payload.id)
    .all<{ detail: string }>();
  expect(
    plan.results.filter(({ detail }) =>
      detail.includes("rating_invalidation_log_match_idx"),
    ),
  ).toHaveLength(2);
});

it("protects audit, invalidation, and rebuild rows from edits or deletion", async () => {
  await db
    .prepare(
      `INSERT INTO rating_invalidation_log
    (match_id, action, reason, actor, audit_id, created_at)
    VALUES (?, 'invalidate', 'fixture reason', 'fixture', 1, ${clock})`,
    )
    .bind(payload.id)
    .run();
  for (const table of [
    "rating_admin_audit",
    "rating_invalidation_log",
    "rating_rebuild",
  ]) {
    await expect(
      db.prepare(`UPDATE ${table} SET reason = 'edited'`).run(),
    ).rejects.toThrow("append-only");
    await expect(db.prepare(`DELETE FROM ${table}`).run()).rejects.toThrow(
      "append-only",
    );
  }
});

it("indexes the public mark and private audit lookups", async () => {
  for (const [sql, index] of [
    [
      "SELECT * FROM rating_correction_mark WHERE match_id = 'A'",
      "sqlite_autoindex_rating_correction_mark_1",
    ],
    [
      "SELECT * FROM rating_admin_audit WHERE target = 'A' ORDER BY id DESC",
      "rating_admin_audit_target_idx",
    ],
    [
      "SELECT * FROM rating_admin_audit WHERE plan_digest = 'A' AND outcome = 'planned'",
      "rating_admin_audit_digest_idx",
    ],
    [
      "SELECT * FROM rating_account_exclusion WHERE user_id = 'A'",
      "sqlite_autoindex_rating_account_exclusion_1",
    ],
  ]) {
    const plan = await db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .first<string>("detail");
    expect(plan).toContain(index);
  }
});
