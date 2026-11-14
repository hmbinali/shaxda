import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import { matchPayloadHash } from "@shaxda/shared";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { saveMatch } from "../match";
import { foldLedger } from "./fold";
import { guard, PAIR_SELECT, pendingEvents } from "./queries";
import { processPendingRatings } from "./processor";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};

beforeAll(async () => applyD1Migrations(db, TEST_MIGRATIONS));

async function save(i: number) {
  const base =
    i === 1
      ? sampleMatchPayloads.M1
      : i === 6
        ? sampleMatchPayloads.M5
        : sampleMatchPayloads.M2;
  const payload = {
    ...base,
    id: (i + 1000).toString(32).padStart(20, "X").toUpperCase(),
    matchNumber: i,
    rated: i === 1 ? (0 as const) : (1 as const),
    consentPolicyV: i === 1 ? null : 1,
    endedAt: base.startedAt + 100 + i,
  };
  expect(
    await saveMatch(db, payload, await matchPayloadHash(payload)),
  ).toMatchObject({ status: "saved" });
  if (i === 3) {
    await db
      .prepare("UPDATE match SET replay_v = 99 WHERE id = ?")
      .bind(payload.id)
      .run();
  }
}

it("decides ledger-ordered batches bit for bit with the fold under competing triggers", async () => {
  for (let i = 1; i <= 30; i++) await save(i);
  const first = await Promise.all([
    processPendingRatings(db),
    processPendingRatings(db),
    processPendingRatings(db),
  ]);
  expect(first.sort((a, b) => a - b)).toEqual([0, 0, 25]);
  expect(await processPendingRatings(db)).toBe(5);
  expect(await processPendingRatings(db)).toBe(0);
  const { results: ledger } = await pendingEvents(db, 0, 30);
  const candidate = ledger.at(-1)!;
  const pair = db
    .prepare(PAIR_SELECT)
    .bind(
      candidate.a_id,
      candidate.b_id,
      candidate.ended_at - 86_400_000,
      candidate.ended_at,
      candidate.seq,
    );
  expect((await pair.all()).meta.rows_read).toBeLessThanOrEqual(
    3 * ledger.length + 12,
  );
  const plan = await db
    .prepare(`EXPLAIN QUERY PLAN ${PAIR_SELECT}`)
    .bind(
      candidate.a_id,
      candidate.b_id,
      candidate.ended_at - 86_400_000,
      candidate.ended_at,
      candidate.seq,
    )
    .all<{ detail: string }>();
  expect(plan.results.map((row) => row.detail).join("\n")).toContain(
    "match_player_owner_idx",
  );
  const folded = foldLedger(ledger, {
    invalidations: new Set(),
    exclusions: new Set(),
  });
  const matches = await db
    .prepare("SELECT * FROM match_rating ORDER BY seq")
    .all();
  expect(
    matches.results.map(({ decided_at, ...row }) => {
      void decided_at;
      return row;
    }),
  ).toEqual(folded.matches);
  expect(
    (
      await db
        .prepare(
          "SELECT r.* FROM match_player_rating r JOIN match m ON m.id = r.match_id ORDER BY m.seq, r.seat",
        )
        .all()
    ).results,
  ).toEqual(folded.seats);
  expect(
    (await db.prepare("SELECT * FROM player_rating ORDER BY board_key").all())
      .results,
  ).toEqual(folded.players);
  expect(folded.matches.some((m) => m.rating_status === "held")).toBe(true);
  expect(folded.matches.some((m) => m.rating_skip_reason === "pairCap")).toBe(
    true,
  );
});

it("aborts an entire D1 batch on an invalid fence", async () => {
  await db
    .prepare(
      "UPDATE rating_processor_state SET lease_token = 'fixture', lease_expires_at = 1000",
    )
    .run();
  for (const [token, now, seq] of [
    ["other", 5, 0],
    ["fixture", 1000, 0],
    ["fixture", 5, 1],
  ] as const) {
    await expect(
      db.batch([
        db.prepare("UPDATE rating_processor_state SET updated_at = 8"),
        guard(db, token, now, seq, 0),
      ]),
    ).rejects.toThrow("rating_fence_guard");
    expect(
      await db
        .prepare("SELECT updated_at FROM rating_processor_state")
        .first("updated_at"),
    ).not.toBe(8);
  }
  await db.prepare("DELETE FROM rating_processor_state").run();
  await expect(guard(db, "fixture", 5, 0, 0).run()).rejects.toThrow(
    "rating_fence.ok",
  );
});
