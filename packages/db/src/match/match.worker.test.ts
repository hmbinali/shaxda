import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { matchPayloadHash } from "@shaxda/shared";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { beforeAll, describe, expect, it } from "vitest";
import { saveMatch } from "./index";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};

beforeAll(async () => {
  await applyD1Migrations(db, TEST_MIGRATIONS);
});

describe("match ledger writer", () => {
  it("writes once, recovers an identical duplicate, and refuses a conflicting one", async () => {
    const payload = sampleMatchPayloads.M2;
    const hash = await matchPayloadHash(payload);
    const results = await Promise.all([
      saveMatch(db, payload, hash),
      saveMatch(db, payload, hash),
    ]);
    expect(results).toEqual(
      expect.arrayContaining([
        { status: "saved", matchId: payload.id, existed: false },
        { status: "saved", matchId: payload.id, existed: true },
      ]),
    );
    const conflict = { ...payload, id: "BBBBBBBBBBBBBBBBBBBB" };
    await expect(
      saveMatch(db, conflict, await matchPayloadHash(conflict)),
    ).resolves.toEqual({ status: "conflict" });
    await expect(
      db
        .prepare("SELECT count(*) AS count FROM match WHERE id = ?")
        .bind(payload.id)
        .first("count"),
    ).resolves.toBe(1);
    await expect(
      db
        .prepare(
          "SELECT seat FROM match_player WHERE match_id = ? ORDER BY seat",
        )
        .bind(payload.id)
        .all(),
    ).resolves.toMatchObject({ results: [{ seat: "A" }, { seat: "B" }] });

    const next = sampleMatchPayloads.M9;
    await expect(
      saveMatch(db, next, await matchPayloadHash(next)),
    ).resolves.toMatchObject({ status: "saved", existed: false });
    await expect(
      db.prepare("SELECT id FROM match ORDER BY seq").all(),
    ).resolves.toMatchObject({
      results: [{ id: payload.id }, { id: next.id }],
    });
  });

  it("rolls back the match and first seat if the second seat fails", async () => {
    const payload = structuredClone(sampleMatchPayloads.M2);
    payload.id = "CCCCCCCCCCCCCCCCCCCC";
    payload.roomCreatedAt++;
    payload.players[1].userId = payload.players[0].userId;
    await expect(
      saveMatch(db, payload, await matchPayloadHash(payload)),
    ).resolves.toMatchObject({ status: "failed" });
    for (const [table, column] of [
      ["match", "id"],
      ["match_player", "match_id"],
    ]) {
      await expect(
        db
          .prepare(`SELECT count(*) AS count FROM ${table} WHERE ${column} = ?`)
          .bind(payload.id)
          .first("count"),
      ).resolves.toBe(0);
    }
  });

  it("indexes duplicate recovery and downstream ledger reads", async () => {
    const queries = [
      [
        "SELECT id, payload_hash FROM match WHERE room_code=?1 AND room_created_at=?2 AND match_number=?3",
        ["ABCDEFGH", 1000, 1],
        "sqlite_autoindex_match_2",
      ],
      [
        "SELECT match_id FROM match_player WHERE user_id=?1 ORDER BY ended_at DESC, match_id DESC LIMIT 20",
        ["sample-account-a"],
        "match_player_owner_idx",
      ],
      [
        "SELECT count(*) FROM match WHERE rated=?1 AND ended_at>=?2 AND ended_at<?3",
        [0, 0, 2000],
        "match_rated_ended_idx",
      ],
    ] as const;
    for (const [query, values, index] of queries) {
      const plan = await db
        .prepare(`EXPLAIN QUERY PLAN ${query}`)
        .bind(...values)
        .first<string>("detail");
      expect(plan).toContain(index);
    }
  });
});
