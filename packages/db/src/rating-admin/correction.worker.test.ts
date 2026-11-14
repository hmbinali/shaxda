import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import { matchPayloadHash } from "@shaxda/shared";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { saveMatch } from "../match";
import { processPendingRatings, readMatchRating } from "../rating";
import {
  applyRatingAdmin,
  checkConsistency,
  planRatingAdmin,
  readRatingSnapshot,
  verifyRebuild,
  type AdminRequest,
  type Mutation,
} from "./index";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};
const accounts = ["a", "b", "c", "d", "e", "f"];
const ids = "23456789ABCDEFGH"
  .split("")
  .map((suffix) => suffix.padStart(20, "B"));

beforeAll(async () => applyD1Migrations(db, TEST_MIGRATIONS));

async function fixture(i: number, a: number, b: number) {
  const base = i === 1 ? sampleMatchPayloads.M3 : sampleMatchPayloads.M2;
  const match = {
    ...base,
    rated: 1 as const,
    consentPolicyV: 1,
    id: ids[i]!,
    matchNumber: i + 1,
    roomCreatedAt: 1000,
    endedAt: 2000 + i,
    players: [
      { ...base.players[0], userId: accounts[a]! },
      { ...base.players[1], userId: accounts[b]! },
    ] as typeof base.players,
  };
  expect(
    await saveMatch(db, match, await matchPayloadHash(match)),
  ).toMatchObject({ status: "saved" });
}

function request(command: Mutation, target: string | null): AdminRequest {
  return {
    command,
    environment: "local",
    target,
    databaseId: "test",
    actor: "fixture",
    reason: "fixture review",
  };
}

async function correct(command: Mutation, target: string | null) {
  const input = request(command, target);
  const plan = await planRatingAdmin(db, input);
  expect(plan.outcome).toBe("planned");
  const application = await applyRatingAdmin(db, input, plan.digest);
  expect(application).toEqual({ outcome: "applied" });
  await expect(applyRatingAdmin(db, input, plan.digest)).resolves.toMatchObject(
    { outcome: "noop" },
  );
  return plan;
}

it("publishes invalidate and rescind atomically and reproduces every full-precision value", async () => {
  for (let i = 0; i < 4; i++) await fixture(i, 0, 1);
  await fixture(4, 1, 2);
  await fixture(5, 2, 3);
  expect(await processPendingRatings(db)).toBe(6);
  const before = await readRatingSnapshot(db);
  const rawBefore = await db.batch([
    db.prepare("SELECT * FROM match ORDER BY seq"),
    db.prepare("SELECT * FROM match_player ORDER BY match_id, seat"),
  ]);
  expect(before.matches[3]?.rating_skip_reason).toBe("pairCap");

  const invalidated = await correct("invalidate-match", ids[1]!);
  expect(invalidated.changed).toBeGreaterThan(3);
  const mid = await readRatingSnapshot(db);
  expect(mid.matches[1]?.rating_skip_reason).toBe("invalidated");
  expect(mid.matches[3]?.rating_status).toBe("processed");
  expect(mid.seats.some((row) => row.match_id === ids[1])).toBe(false);
  expect(mid.players.find((p) => p.user_id === "d")?.rating).not.toBe(
    before.players.find((p) => p.user_id === "d")?.rating,
  );
  expect(verifyRebuild(mid).diffs).toEqual([]);
  expect(await readMatchRating(db, ids[1]!, null)).toMatchObject({
    reason: "invalidated",
    corrected: false,
  });
  expect(await readMatchRating(db, ids[3]!, null)).toMatchObject({
    status: "processed",
    corrected: true,
  });

  await correct("rescind-invalidation", ids[1]!);
  const after = await readRatingSnapshot(db);
  const untimed = (rows: typeof before.matches) =>
    rows.map(({ decided_at, ...row }) => {
      void decided_at;
      return row;
    });
  expect(untimed(after.matches)).toEqual(untimed(before.matches));
  expect(after.seats).toEqual(before.seats);
  expect(after.players).toEqual(before.players);
  expect(verifyRebuild(after).diffs).toEqual([]);
  const rawAfter = await db.batch([
    db.prepare("SELECT * FROM match ORDER BY seq"),
    db.prepare("SELECT * FROM match_player ORDER BY match_id, seat"),
  ]);
  expect(rawAfter.map((r) => r.results)).toEqual(
    rawBefore.map((r) => r.results),
  );
  expect(await checkConsistency(db, true)).toMatchObject({
    clean: true,
    issues: {},
  });
});

it("keeps exclusions across removing every rated event and rejects stale plans", async () => {
  await fixture(6, 4, 5);
  expect(await processPendingRatings(db)).toBe(1);
  await correct("exclude-account", "e");
  await correct("invalidate-match", ids[6]!);
  expect(
    await db.prepare("SELECT * FROM player_rating WHERE user_id = 'e'").first(),
  ).toBeNull();
  await fixture(7, 4, 5);
  const plan = await planRatingAdmin(db, request("include-account", "e"));
  expect(await processPendingRatings(db)).toBe(1);
  await expect(
    applyRatingAdmin(db, request("include-account", "e"), plan.digest),
  ).resolves.toEqual({ outcome: "rejected", code: "staleHighWater" });
  expect(
    await db
      .prepare("SELECT excluded FROM player_rating WHERE user_id = 'e'")
      .first("excluded"),
  ).toBe(1);
  await correct("include-account", "e");
  expect(
    await db
      .prepare("SELECT excluded FROM player_rating WHERE user_id = 'e'")
      .first("excluded"),
  ).toBe(0);
  expect(verifyRebuild(await readRatingSnapshot(db)).diffs).toEqual([]);
});

it("holds pending saves during a pause and discards shadow rows on resume", async () => {
  await correct("pause-ratings", null);
  await fixture(8, 0, 1);
  expect(await processPendingRatings(db)).toBe(0);
  await db.prepare("INSERT INTO match_rating_next (seq) VALUES (123)").run();
  await correct("resume-ratings", null);
  expect(await processPendingRatings(db)).toBe(1);
  expect(await checkConsistency(db, false)).toMatchObject({
    clean: true,
    issues: {},
  });
});

it("resumes the exact staged prefix after an operator lease expires", async () => {
  await fixture(9, 0, 1);
  expect(await processPendingRatings(db)).toBe(1);
  const input = request("invalidate-match", ids[9]!);
  const plan = await planRatingAdmin(db, input);
  const live = await readRatingSnapshot(db);
  await expect(
    applyRatingAdmin(
      db,
      input,
      plan.digest,
      {},
      {
        afterStaging: async () => {
          // The original operator can no longer publish or clean up its staged rows.
          await db
            .prepare("UPDATE rating_processor_state SET lease_expires_at = 0")
            .run();
          throw new Error("operator stopped");
        },
      },
    ),
  ).rejects.toThrow("operator stopped");
  const paused = await readRatingSnapshot(db);
  expect(paused.state.maintenance).toBe(1);
  expect(paused.matches).toEqual(live.matches);
  expect(paused.players).toEqual(live.players);
  expect(
    await db.prepare("SELECT COUNT(*) AS n FROM match_rating_next").first("n"),
  ).toBe(live.matches.length);
  await expect(applyRatingAdmin(db, input, plan.digest)).resolves.toEqual({
    outcome: "applied",
  });
  expect(verifyRebuild(await readRatingSnapshot(db)).diffs).toEqual([]);
  expect(
    await db.prepare("SELECT COUNT(*) AS n FROM match_rating_next").first("n"),
  ).toBe(0);
});
