import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { UTC_DAY_MS, utcDay } from "@shaxda/shared/analytics/events";
import { runAnalyticsNightly } from "../jobs/analyticsNightly";
import {
  COHORT_GAUGES_SQL,
  LEDGER_CHANGES_SQL,
  SAVED_GAUGES_SQL,
  WEEK_GAUGES_SQL,
} from "./ledger";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};
const monday = Date.parse("2026-02-02");
const date = (offset: number) => monday + offset * UTC_DAY_MS;
const day = (offset: number) => utcDay(date(offset));
const now = (offset: number) => date(offset) + 15 * 60_000;

beforeAll(async () => {
  expect(TEST_MIGRATIONS.map(({ name }) => name).slice(0, 3)).toEqual([
    "0000_accounts.sql",
    "0001_analytics.sql",
    "0002_match_ledger.sql",
  ]);
  await applyD1Migrations(db, TEST_MIGRATIONS);
});

beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM match_player"),
    db.prepare("DELETE FROM match"),
    db.prepare("DELETE FROM user"),
    db.prepare("DELETE FROM event_daily"),
    db.prepare("DELETE FROM job_state"),
    db.prepare("DELETE FROM active_user_day"),
  ]);
});

type Ending = "opponentBelowThree" | "resignation" | "drawTermination";

async function match(
  id: string,
  offset: number,
  users: [string, string],
  {
    rated = 0,
    ending = "opponentBelowThree",
    idle = false,
    number = 1,
    room = id,
  }: {
    rated?: 0 | 1;
    ending?: Ending;
    idle?: boolean;
    number?: number;
    room?: string;
  } = {},
) {
  const winner = ending === "drawTermination" ? null : idle ? "B" : "A";
  const ended = date(offset) + 60_000;
  const insertPlayer = db.prepare(
    "INSERT INTO match_player (match_id, seat, user_id, result, pieces_left, captured, ended_at) VALUES (?, ?, ?, ?, 2, 0, ?)",
  );
  const [row] = await db.batch<{ seq: number }>([
    db
      .prepare(
        `INSERT INTO match (
         id, room_code, room_created_at, match_number, mode, rated,
         consent_policy_v, rules_v, replay_v, replay, starting_seat, winner_seat,
         end_reason, online_end_reason, action_count, payload_hash, started_at, ended_at
       ) VALUES (?, ?, 0, ?, 'invite', ?, ?, 1, 1, '{}', 'A', ?, ?, ?, 1, 'fixture', ?, ?)
       RETURNING seq`,
      )
      .bind(
        id,
        room,
        number,
        rated,
        rated ? 1 : null,
        winner,
        ending,
        idle ? "idle" : null,
        ended - 1,
        ended,
      ),
    ...users.map((idOfUser, index) => {
      const seat = index === 0 ? "A" : "B";
      return insertPlayer.bind(
        id,
        seat,
        idOfUser,
        winner === null ? "draw" : winner === seat ? "win" : "loss",
        ended,
      );
    }),
  ]);
  return row!.results[0]!.seq;
}

async function gauges(offset: number) {
  const { results } = await db
    .prepare(
      `SELECT event, count FROM event_daily WHERE day = ? AND event IN (
      'saved_friendly', 'saved_rated', 'week_players', 'week_returning',
      'cohort_size', 'cohort_d7', 'cohort_d30', 'cohort_within_7d'
    )`,
    )
    .bind(day(offset))
    .all<{ event: string; count: number }>();
  return Object.fromEntries(results.map(({ event, count }) => [event, count]));
}

function tick(offset: number, minute = 0) {
  const clock = now(offset) + minute * 60_000;
  return runAnalyticsNightly(db, clock, () => clock);
}

async function finish(offset: number) {
  for (let minute = 0; minute < 40; minute += 1) {
    await tick(offset, minute);
    const success = await db
      .prepare("SELECT last_success_at FROM job_state")
      .first<number>("last_success_at");
    if (success !== null && success >= now(offset)) return;
  }
  throw new Error("Nightly ledger work did not finish.");
}

it.each([
  [LEDGER_CHANGES_SQL, [0], ["INTEGER PRIMARY KEY"]],
  [
    SAVED_GAUGES_SQL,
    [day(0), date(0), date(1), 10, now(1)],
    ["match_rated_ended_idx"],
  ],
  [
    COHORT_GAUGES_SQL,
    [day(0), date(0), date(1), 10, now(1), date(40)],
    ["match_rated_ended_idx", "match_id=?", "match_player_owner_idx"],
  ],
  [
    WEEK_GAUGES_SQL,
    [day(0), date(0), date(7), 10, now(1), date(40)],
    ["match_rated_ended_idx", "match_id=?", "match_player_owner_idx"],
  ],
] as const)(
  "uses indexed ledger reads for %#",
  async (sql, params, indexes) => {
    const { results } = await db
      .prepare("EXPLAIN QUERY PLAN " + sql)
      .bind(...params)
      .all<{ detail: string }>();
    const plan = results.map(({ detail }) => detail).join("\n");
    for (const index of indexes) expect(plan).toContain(index);
  },
);

it("rolls up the M1–M10 cases, exact returns, and incomplete windows", async () => {
  await match("M1", 0, ["A", "B"]);
  await match("M2", 1, ["A", "B"], { rated: 1, ending: "resignation" });
  await match("M3", 2, ["C", "D"], {
    rated: 1,
    ending: "resignation",
    idle: true,
  });
  // The rating cap and invalidation do not update the ledger's rated flag.
  await match("M4", 3, ["A", "B"], { rated: 1 });
  await match("M5", 7, ["A", "E"], { rated: 1, ending: "drawTermination" });
  // M6 (guest) and M7 (pre-play cancellation) have no ledger rows.
  await match("M8", 8, ["C", "D"], { rated: 1 });
  await match("M9", 30, ["A", "C"], { room: "M2", number: 2 });
  // M10: deleting B's account leaves M2 and B's ledger participation intact.
  await db
    .prepare(
      "INSERT INTO user (id, name, email) VALUES ('B', 'b', 'b@example.test')",
    )
    .run();
  await db.prepare("DELETE FROM user WHERE id = 'B'").run();
  await match("week-six", 36, ["C", "F"]);

  await finish(38);
  expect(await gauges(0)).toEqual({
    saved_friendly: 1,
    saved_rated: 0,
    week_players: 4,
    week_returning: 3,
    cohort_size: 2,
    cohort_d7: 1,
    cohort_d30: 1,
    cohort_within_7d: 2,
  });
  for (const offset of [1, 2, 3, 7, 8]) {
    expect(await gauges(offset)).toMatchObject({
      saved_rated: 1,
      saved_friendly: 0,
    });
  }
  expect(await gauges(4)).toMatchObject({ saved_rated: 0, saved_friendly: 0 });
  expect(await gauges(2)).toMatchObject({
    cohort_size: 2,
    cohort_d7: 0,
    cohort_d30: 0,
    cohort_within_7d: 2,
  });
  expect(await gauges(30)).toMatchObject({ saved_friendly: 1, saved_rated: 0 });
  expect(await gauges(30)).not.toHaveProperty("cohort_d30");
  expect(await gauges(36)).toMatchObject({ cohort_size: 1 });
  expect(await gauges(36)).not.toHaveProperty("cohort_d7");
  expect(await gauges(28)).not.toHaveProperty("week_returning");
  expect(await gauges(35)).toMatchObject({ week_players: 2 });
  expect(await gauges(35)).not.toHaveProperty("week_returning");

  const before = await gauges(0);
  await tick(38, 50);
  expect(await gauges(0)).toEqual(before);
});

it("advances a pinned sequence only after writing all the windows for a late save", async () => {
  const firstSeq = await match("original", 0, ["A", "B"]);
  await finish(36);
  expect(await gauges(0)).toMatchObject({
    saved_rated: 0,
    cohort_size: 2,
    cohort_d7: 0,
  });

  const secondSeq = await match("late", 7, ["A", "C"], { rated: 1 });
  await db
    .prepare("INSERT INTO active_user_day VALUES (?, ?, 'guest')")
    .bind(day(-60), "x".repeat(43))
    .run();
  await tick(37);

  async function cursor() {
    const row = await db
      .prepare("SELECT cursor FROM job_state")
      .first<string>("cursor");
    return JSON.parse(row!);
  }
  expect(await cursor()).toMatchObject({
    ledgerSeq: firstSeq,
    ledgerWork: { seq: secondSeq },
  });
  expect(
    await db
      .prepare("SELECT COUNT(*) AS count FROM active_user_day")
      .first("count"),
  ).toBe(0);
  const thirdSeq = await match("older", -1, ["A", "D"]);
  await finish(37);
  expect(await cursor()).toMatchObject({ ledgerSeq: secondSeq });
  expect(await gauges(0)).toMatchObject({
    cohort_size: 2,
    cohort_d7: 1,
    week_returning: 1,
  });
  expect(await gauges(7)).toMatchObject({ saved_rated: 1 });

  await finish(38);
  expect(await cursor()).toMatchObject({ ledgerSeq: thirdSeq });
  expect(await gauges(-1)).toMatchObject({
    saved_friendly: 1,
    cohort_size: 2,
    cohort_d7: 0,
    cohort_within_7d: 1,
  });
  expect(await gauges(0)).toMatchObject({ cohort_size: 1, cohort_d7: 0 });
});
