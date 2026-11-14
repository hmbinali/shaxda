import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UTC_DAY_MS, utcDay } from "@shaxda/shared/analytics/events";
import { analyticsHash } from "@shaxda/shared/analytics/hash";
import { changeUsername, claimUsername } from "../queries/account";
import { JobLeaseLost, acquireJobLease, fencedJobBatch } from "../jobs/lease";
import { runAnalyticsNightly } from "../jobs/analyticsNightly";
import { incrementCounter } from "./counters";
import {
  ACTIVITY_GAUGES_SQL,
  ACTIVITY_PRUNE_SQL,
  EVENT_START_SQL,
  EVENT_TREND_SQL,
  REGISTRATIONS_GAUGE_SQL,
  TODAY_ACTIVITY_SQL,
  incrementLocalEvent,
  readAnalyticsStats,
  recordActivity,
} from "./queries";

const bindings = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};
const db = bindings.DB;
const now = Date.parse("2026-05-01T00:15:00Z");
const day = (offset: number) => utcDay(now + offset * UTC_DAY_MS);
const id = (value: number) => String(value).padStart(43, "A");

beforeAll(async () => applyD1Migrations(db, bindings.TEST_MIGRATIONS));

beforeEach(async () => {
  await db.batch(
    [
      "active_user_day",
      "event_daily",
      "job_state",
      "job_fence",
      "username_claim",
      "user",
    ].map((table) => db.prepare(`DELETE FROM ${table}`)),
  );
});

describe("analytics migration and lease", () => {
  it("atomically increments an allowlisted online counter under concurrent writes", async () => {
    await Promise.all(
      Array.from({ length: 50 }, () =>
        incrementCounter(db, "online_started_invite_guest", day(0), now),
      ),
    );
    await expect(
      db.prepare("SELECT day, event, count, updated_at FROM event_daily").all(),
    ).resolves.toMatchObject({
      results: [
        {
          day: day(0),
          event: "online_started_invite_guest",
          count: 50,
          updated_at: now,
        },
      ],
    });
    await expect(
      incrementCounter(db, "local_started" as never, day(0), now),
    ).rejects.toThrow();
  });
  it("enforces the table checks and omits the activity rowid", async () => {
    for (const values of [
      ["bad-day", id(1), "guest"],
      [day(0), "short", "guest"],
      [day(0), id(1), "bad-kind"],
    ]) {
      await expect(
        db
          .prepare("INSERT INTO active_user_day VALUES (?, ?, ?)")
          .bind(...values)
          .run(),
      ).rejects.toThrow();
    }
    await expect(
      db.prepare("SELECT rowid FROM active_user_day").all(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare("INSERT INTO event_daily VALUES (?, 'metric', -1, 0)")
        .bind(day(0))
        .run(),
    ).rejects.toThrow();
  });

  it.each([
    [
      "activity window",
      ACTIVITY_GAUGES_SQL,
      [day(-1), day(-7), day(-30), now],
      ["active_user_day USING PRIMARY KEY"],
    ],
    [
      "today",
      TODAY_ACTIVITY_SQL,
      [day(0)],
      ["active_user_day USING PRIMARY KEY"],
    ],
    [
      "prune",
      ACTIVITY_PRUNE_SQL,
      [day(-90)],
      ["active_user_day USING PRIMARY KEY"],
    ],
    [
      "trend",
      EVENT_TREND_SQL,
      [day(-34), day(0)],
      ["sqlite_autoindex_event_daily_1"],
    ],
    [
      "first date",
      EVENT_START_SQL,
      ["local_started"],
      ["event_daily_event_day_idx"],
    ],
    [
      "registrations",
      REGISTRATIONS_GAUGE_SQL,
      [day(-1), now - UTC_DAY_MS, now, now],
      ["username_claim_claimed_at_idx", "username_claim_user_released_idx"],
    ],
  ] as const)(
    "uses the expected indexes for %s",
    async (_name, sql, params, indexes) => {
      const { results } = await db
        .prepare("EXPLAIN QUERY PLAN " + sql)
        .bind(...params)
        .all<{ detail: string }>();
      const plan = results.map(({ detail }) => detail).join("\n");
      for (const index of indexes) expect(plan).toContain(index);
    },
  );

  it("rolls back every write for a missing, NULL, stale, or expired lease", async () => {
    const write = db
      .prepare("INSERT INTO event_daily VALUES (?, 'local_started', 1, ?)")
      .bind(day(0), now);
    const missing = { name: "test", token: "unknown", cursor: null };
    await expect(
      fencedJobBatch(db, missing, now, [write], "{}"),
    ).rejects.toBeInstanceOf(JobLeaseLost);
    await db
      .prepare("INSERT INTO job_state (name, updated_at) VALUES ('test', 0)")
      .run();
    await expect(
      fencedJobBatch(db, missing, now, [write], "{}"),
    ).rejects.toBeInstanceOf(JobLeaseLost);

    const results = await Promise.all([
      acquireJobLease(db, "test", now),
      acquireJobLease(db, "test", now),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const lease = results.find((result) => result !== null)!;
    const expiration = now + 300_000;
    await expect(
      fencedJobBatch(db, lease, expiration, [write], "{}"),
    ).rejects.toBeInstanceOf(JobLeaseLost);
    const replacement = (await acquireJobLease(db, "test", expiration))!;
    await expect(
      fencedJobBatch(db, lease, expiration, [write], "{}"),
    ).rejects.toBeInstanceOf(JobLeaseLost);
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM event_daily")
        .first("count"),
    ).toBe(0);

    await fencedJobBatch(db, replacement, expiration, [write], "{}");
    expect(
      await db
        .prepare("SELECT cursor FROM job_state WHERE name = 'test'")
        .first("cursor"),
    ).toBe("{}");
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM job_fence")
        .first("count"),
    ).toBe(0);
  });
});

describe("analytics queries", () => {
  it("deduplicates activity within each identity and stores only pseudonyms", async () => {
    const salt = "s".repeat(32);
    const guest = {
      kind: "guest",
      anonId: await analyticsHash(salt, "guest", "guest-fixture"),
    } as const;
    const a = {
      kind: "account",
      anonId: await analyticsHash(salt, "account", "account-one"),
    } as const;
    const b = {
      kind: "account",
      anonId: await analyticsHash(salt, "account", "account-two"),
    } as const;
    await recordActivity(db, day(0), [guest]);
    await recordActivity(db, day(0), [guest, a]);
    await recordActivity(db, day(0), [guest]);
    await recordActivity(db, day(0), [guest, b]);
    const { results } = await db
      .prepare("SELECT day, anon_id, kind FROM active_user_day")
      .all();
    expect(results).toHaveLength(3);
    expect(results).toEqual(
      expect.arrayContaining(
        [guest, a, b].map(({ kind, anonId }) => ({
          day: day(0),
          anon_id: anonId,
          kind,
        })),
      ),
    );
  });

  it("keeps concurrent upserts and reads the range and first day separately", async () => {
    await incrementLocalEvent(db, "local_started", day(-45), now);
    await Promise.all(
      Array.from({ length: 50 }, () =>
        incrementLocalEvent(db, "local_started", day(-2), now),
      ),
    );
    await expect(
      readAnalyticsStats(db, day(-34), day(0), [
        "local_started",
        "local_completed",
      ]),
    ).resolves.toMatchObject({
      daily: [{ day: day(-2), event: "local_started", count: 50 }],
      recordedSince: { local_started: day(-45), local_completed: null },
    });
  });
});

describe("nightly analytics", () => {
  function run(time = now) {
    return runAnalyticsNightly(db, time, () => time);
  }

  async function counts(offset: number) {
    const { results } = await db
      .prepare("SELECT event, count FROM event_daily WHERE day = ?")
      .bind(day(offset))
      .all<{ event: string; count: number }>();
    return Object.fromEntries(
      results.map(({ event, count }) => [event, count]),
    );
  }

  it("counts distinct identities in complete UTC windows and prunes at N−91", async () => {
    for (let offset = -100; offset <= 0; offset += 1) {
      await recordActivity(db, day(offset), [
        { kind: "guest", anonId: id(100 + ((100 + offset) % 15)) },
        { kind: "account", anonId: id(200 + ((100 + offset) % 15)) },
      ]);
    }
    await run();
    const expected = {
      active_accounts_1d: 1,
      active_accounts_7d: 7,
      active_accounts_30d: 15,
      active_browsers_1d: 1,
      active_browsers_7d: 7,
      active_browsers_30d: 15,
      registrations: 0,
    };
    expect(await counts(-1)).toEqual(expected);
    expect(await counts(0)).toEqual({});
    expect(
      await db
        .prepare("SELECT MIN(day) AS day FROM active_user_day")
        .first("day"),
    ).toBe(day(-90));
    await run();
    await db.prepare("UPDATE job_state SET cursor = NULL").run();
    await run();
    expect(await counts(-1)).toEqual(expected);
  });

  it("backfills the most recent 35 days one day per invocation", async () => {
    await run(now - 45 * UTC_DAY_MS);
    await run();
    expect(await counts(-36)).toEqual({});
    expect(await counts(-35)).toMatchObject({ active_browsers_1d: 0 });
    expect(await counts(-34)).toEqual({});
    expect(await counts(-1)).toEqual({});
    for (let tick = 1; tick < 35; tick += 1) await run(now + tick * 60_000);
    expect(await counts(-1)).toMatchObject({ active_accounts_30d: 0 });
    expect(
      await db.prepare("SELECT cursor, last_success_at FROM job_state").first(),
    ).toEqual({
      cursor: JSON.stringify({ day: day(-1), ledgerSeq: 0 }),
      last_success_at: now + 34 * 60_000,
    });
  });

  it("counts a first claim, skips a rename, and preserves the recorded first day after rename-back", async () => {
    await db
      .prepare(
        "INSERT INTO user (id, name, email) VALUES ('u1', 'pending', 'user@example.test')",
      )
      .run();
    const firstClaim = new Date(now - UTC_DAY_MS);
    const rename = new Date(now + 31 * UTC_DAY_MS);
    const renameBack = new Date(now + 62 * UTC_DAY_MS);
    await expect(
      claimUsername(db, "u1", "first_name", "initial", firstClaim),
    ).resolves.toMatchObject({ kind: "claimed" });
    await run();
    expect(await counts(-1)).toMatchObject({ registrations: 1 });

    await expect(
      changeUsername(db, "u1", "second_name", rename),
    ).resolves.toMatchObject({ kind: "changed" });
    await db
      .prepare("UPDATE job_state SET cursor = ?")
      .bind(JSON.stringify({ day: day(30), ledgerSeq: 0 }))
      .run();
    await run(now + 32 * UTC_DAY_MS);
    expect(await counts(31)).toMatchObject({ registrations: 0 });

    await expect(
      changeUsername(db, "u1", "first_name", renameBack),
    ).resolves.toMatchObject({ kind: "changed" });
    await db.prepare("UPDATE job_state SET cursor = NULL").run();
    await run();
    expect(await counts(-1)).toMatchObject({ registrations: 1 });
  });

  it("records a safe error code and resumes after the failed lease expires", async () => {
    await db
      .prepare(
        `CREATE TRIGGER test_rollup_failure BEFORE INSERT ON event_daily
       BEGIN SELECT RAISE(ABORT, 'test rollup failure'); END`,
      )
      .run();
    try {
      await expect(run()).rejects.toThrow();
      expect(
        await db
          .prepare("SELECT cursor, last_error, last_success_at FROM job_state")
          .first(),
      ).toEqual({
        cursor: null,
        last_error: "analytics_nightly_failed",
        last_success_at: null,
      });
    } finally {
      await db.prepare("DROP TRIGGER test_rollup_failure").run();
    }
    await run(now + 60_000);
    expect(await counts(-1)).toEqual({});
    await run(now + 300_000);
    expect(await counts(-1)).toMatchObject({ active_browsers_1d: 0 });
    expect(
      await db.prepare("SELECT last_error FROM job_state").first("last_error"),
    ).toBeNull();
  });

  it("resumes pruning on the next tick when a full chunk was deleted", async () => {
    await db
      .prepare(
        `WITH RECURSIVE nums(n) AS (VALUES (1) UNION ALL SELECT n+1 FROM nums WHERE n < 5001)
       INSERT INTO active_user_day SELECT ?, printf('%043d', n), 'guest' FROM nums`,
      )
      .bind(day(-91))
      .run();
    await run();
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM active_user_day")
        .first("count"),
    ).toBe(1);
    expect(
      await db
        .prepare("SELECT last_success_at FROM job_state")
        .first("last_success_at"),
    ).toBeNull();
    await run(now + 60_000);
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM active_user_day")
        .first("count"),
    ).toBe(0);
    expect(
      await db
        .prepare("SELECT last_success_at FROM job_state")
        .first("last_success_at"),
    ).toBe(now + 60_000);
  });
});
