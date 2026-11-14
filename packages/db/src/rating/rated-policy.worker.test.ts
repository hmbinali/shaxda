import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { matchPayloadHash, type MatchPayload } from "@shaxda/shared";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { PAIR_CAP_WINDOW_MS } from "@shaxda/shared/rated-play";
import { expect, it } from "vitest";
import { saveMatch } from "../match";
import { processPendingRatings } from "./processor";
import { readRatingSnapshot, verifyRebuild } from "./rebuild";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};

it("enforces the pair window over real ledger rows across rooms, seats, and modes", async () => {
  await applyD1Migrations(db, TEST_MIGRATIONS);
  const start = 200_000_000;
  const day = PAIR_CAP_WINDOW_MS;
  const cases = [
    ["M1", 0, "invite", false, "friendly"],
    ["M2", 0, "invite", false, null],
    ["M3", 1, "quick", true, null],
    ["M5", day - 1, "invite", false, null],
    ["M2", day - 1, "quick", false, "pairCap"],
    ["M2", day, "invite", true, null],
    ["M9", day, "invite", false, "friendly"],
    ["M2", 2, "quick", true, null],
    ["M2", 2, "invite", false, "pairCap"],
  ] as const;

  for (const [
    index,
    [sample, offset, mode, reverseOwners],
  ] of cases.entries()) {
    const base = sampleMatchPayloads[sample];
    const rated = sample === "M1" || sample === "M9" ? 0 : 1;
    const [a, b] = base.players;
    const payload: MatchPayload = {
      ...base,
      id: "23456789A"[index]!.padStart(20, "S"),
      roomCode: index < 3 ? "ABCDEFGH" : "JKLMNPQR",
      roomCreatedAt: index === 6 ? 5 : index,
      mode,
      rated,
      consentPolicyV: rated ? 1 : null,
      startedAt: start + offset - 1_000,
      endedAt: start + offset,
      players: reverseOwners
        ? [
            { ...a, userId: b.userId },
            { ...b, userId: a.userId },
          ]
        : [a, b],
    };
    await expect(
      saveMatch(db, payload, await matchPayloadHash(payload)),
    ).resolves.toMatchObject({ status: "saved" });
  }

  expect(await processPendingRatings(db)).toBe(cases.length);
  const snapshot = await readRatingSnapshot(db);
  expect(snapshot.matches.map((match) => match.rating_skip_reason)).toEqual(
    cases.map((entry) => entry[4]),
  );
  expect(snapshot.matches.every((match) => match.rating_policy_v === 1)).toBe(
    true,
  );
  expect(verifyRebuild(snapshot).diffs).toEqual([]);
});
