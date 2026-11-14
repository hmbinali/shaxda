import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { matchPayloadHash, type HistoryFilter } from "@shaxda/shared";
import { sampleMatchPayloads } from "@shaxda/shared/match-fixtures";
import { beforeAll, describe, expect, it } from "vitest";
import { saveMatch } from "../match";
import {
  readHistoryPage,
  readHistorySummary,
  readMatchForViewer,
} from "./history";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};
const owner = "internal-owner";
const opponent = "internal-opponent";
const outsider = "internal-outsider";
const deleted = "internal-deleted";
const missing = "Z".repeat(20);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const id = (i: number) =>
  "Q".repeat(18) + alphabet[Math.floor(i / 32)] + alphabet[i % 32];

function statements() {
  const captured: { sql: string; args: unknown[] }[] = [];
  const spy = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          captured.push({ sql, args });
          return db.prepare(sql).bind(...args);
        },
      };
    },
  } as D1Database;
  return { spy, captured };
}

const fixtures = Array.from({ length: 45 }, (_, i) => {
  const source = [
    sampleMatchPayloads.M1,
    sampleMatchPayloads.M9,
    sampleMatchPayloads.M5,
    sampleMatchPayloads.M3,
    sampleMatchPayloads.M2,
  ][i % 5]!;
  const rated = i % 2 === 0 ? 1 : 0;
  const endedAt =
    i >= 20 && i <= 30 ? 40_000 : i > 30 ? 50_000 + i : 30_000 + i;
  const a = i % 3 === 0 && (i < 20 || i > 30) ? outsider : owner;
  const b = i === 44 ? deleted : opponent;
  return {
    ...source,
    id: id(i),
    rated: rated as 0 | 1,
    mode: i === 44 ? ("quick" as const) : ("invite" as const),
    consentPolicyV: rated ? 1 : null,
    onlineEndReason: i === 4 ? ("abandoned" as const) : source.onlineEndReason,
    roomCreatedAt: 9000 + i,
    startedAt: endedAt - 1200,
    endedAt,
    players: [
      { ...source.players[0], userId: a },
      { ...source.players[1], userId: b },
    ] as typeof source.players,
  };
});

beforeAll(async () => {
  await applyD1Migrations(db, TEST_MIGRATIONS);
  for (const [userId, username] of [
    [owner, "owner_name"],
    [opponent, "new_name"],
    [outsider, "third_name"],
  ]) {
    await db
      .prepare(
        "INSERT INTO user (id, name, email, username) VALUES (?1, ?2, ?3, ?2)",
      )
      .bind(userId, username, `${username}@example.test`)
      .run();
  }
  await db
    .prepare(
      "INSERT INTO username_claim (username, user_id, claimed_at, released_at) VALUES ('old_name', ?, 1, 2)",
    )
    .bind(opponent)
    .run();
  for (const match of fixtures) {
    expect(
      await saveMatch(db, match, await matchPayloadHash(match)),
    ).toMatchObject({ status: "saved" });
  }
});

const filters = [
  "all",
  "wins",
  "losses",
  "draws",
  "rated",
  "friendly",
] as const;
function expected(filter: HistoryFilter) {
  return fixtures
    .filter((match) => {
      if (match.players[0].userId !== owner) return false;
      if (filter === "rated" || filter === "friendly")
        return match.rated === Number(filter === "rated");
      const result = { wins: "win", losses: "loss", draws: "draw" } as const;
      return filter === "all" || match.players[0].result === result[filter];
    })
    .sort((a, b) => b.endedAt - a.endedAt || (a.id < b.id ? 1 : -1));
}

async function assertIndexed(
  captured: ReturnType<typeof statements>["captured"],
  ownerRange: boolean,
) {
  for (const { sql, args } of captured) {
    expect(sql).not.toMatch(
      /\b(seq|payload_hash|room_code|room_created_at|match_number|replay|stats_json)\b/i,
    );
    const { results } = await db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .bind(...args)
      .all<{ detail: string }>();
    const plan = results.map(({ detail }) => detail).join("\n");
    expect(plan).not.toMatch(/\bSCAN\b|TEMP B-TREE/i);
    expect(plan).toContain(
      ownerRange ? "match_player_owner_idx" : "sqlite_autoindex_match_1",
    );
    if (sql.includes("LEFT JOIN match_rating")) {
      expect(plan).toMatch(/SEARCH mr USING INDEX .+\(match_id=\?\)/i);
      expect(plan).toMatch(/SEARCH rc USING COVERING INDEX .+\(match_id=\?\)/i);
    }
    const { meta } = await db
      .prepare(sql)
      .bind(...args)
      .all();
    expect(meta.rows_written).toBe(0);
    expect(meta.rows_read).toBeGreaterThanOrEqual(0);
  }
}

describe("history D1 reads", () => {
  it.each(filters)("uses keyed pages for %s", async (filter) => {
    const { spy, captured } = statements();
    const first = await readHistoryPage(spy, {
      userId: owner,
      filter,
      cursor: null,
    });
    const cursor = first.nextCursor ?? { endedAt: 45_000, matchId: missing };
    const next = await readHistoryPage(spy, { userId: owner, filter, cursor });
    if (filter === "all") {
      expect(first.nextCursor?.endedAt).toBe(40_000);
      expect(next.rows[0]?.endedAt).toBe(40_000);
      expect(next.rows.map(({ id }) => id)).toEqual(
        expected("all")
          .slice(20)
          .map(({ id }) => id),
      );
    }
    await assertIndexed(captured, true);
    expect(first.rows.map(({ id }) => id)).toEqual(
      expected(filter)
        .slice(0, 20)
        .map(({ id }) => id),
    );

    // A smaller page size exercises every filter across several requests.
    const ids: string[] = [];
    let after = null;
    do {
      const page = await readHistoryPage(db, {
        userId: owner,
        filter,
        cursor: after,
        limit: 2,
      });
      ids.push(...page.rows.map(({ id }) => id));
      after = page.nextCursor;
    } while (after !== null);
    expect(ids).toEqual(expected(filter).map(({ id }) => id));
  });

  it("keeps edited cursors scoped to the signed-in owner and uses current profiles", async () => {
    const { nextCursor } = await readHistoryPage(db, {
      userId: outsider,
      filter: "all",
      cursor: null,
      limit: 3,
    });
    const page = await readHistoryPage(db, {
      userId: owner,
      filter: "all",
      cursor: nextCursor,
    });
    expect(nextCursor).not.toBeNull();
    expect(page.rows.length).toBeGreaterThan(0);
    expect(
      page.rows.every((row) => expected("all").some(({ id }) => id === row.id)),
    ).toBe(true);
    expect(page.rows[0]?.opponent?.username).toBe("new_name");
  });

  it("summarizes all owner rows and caps recent results at 20", async () => {
    const { spy, captured } = statements();
    const summary = await readHistorySummary(spy, owner);
    expect(summary).toEqual({
      games: 34,
      wins: expected("wins").length,
      losses: expected("losses").length,
      draws: expected("draws").length,
      recent: expected("all")
        .slice(0, 20)
        .map((match) => match.players[0].result),
    });
    await assertIndexed(captured, true);
    await expect(readHistorySummary(db, "no-games")).resolves.toEqual({
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      recent: [],
    });
  });

  it("opens friendly matches for either participant and rated matches for anyone", async () => {
    const friendly = id(1);
    const rated = id(44);
    const { spy, captured } = statements();
    for (const [viewer, seat] of [
      [owner, "A"],
      [opponent, "B"],
    ] as const) {
      await expect(
        readMatchForViewer(spy, friendly, viewer),
      ).resolves.toMatchObject({ kind: "found", viewerSeat: seat });
    }
    for (const viewer of [null, outsider]) {
      const unknown = await readMatchForViewer(spy, missing, viewer);
      expect(unknown).toEqual({ kind: "missing" });
      await expect(readMatchForViewer(spy, friendly, viewer)).resolves.toEqual(
        unknown,
      );
      const publicMatch = await readMatchForViewer(spy, rated, viewer);
      expect(publicMatch).toMatchObject({
        kind: "found",
        viewerSeat: null,
        match: {
          mode: "quick",
          rated: true,
          players: { B: { profile: null } },
        },
      });
      expect(JSON.stringify(publicMatch)).not.toMatch(
        /internal-|@example\.test|ABCDEFGH|payloadHash/,
      );
    }
    await assertIndexed(captured, false);
  });

  it("treats a row without two seats as missing", async () => {
    const malformed = id(43);
    await db
      .prepare("DELETE FROM match_player WHERE match_id = ? AND seat = 'B'")
      .bind(malformed)
      .run();
    await expect(readMatchForViewer(db, malformed, owner)).resolves.toEqual({
      kind: "missing",
    });
  });

  it("returns rated decisions to history owners and signed-out match readers", async () => {
    for (const [matchId, status, reason, algorithm] of [
      [id(2), "held", null, null],
      [id(4), "skipped", "pairCap", null],
      [id(6), "skipped", "invalidated", null],
      [id(8), "processed", null, 1],
    ] as const) {
      await db
        .prepare(
          "INSERT INTO match_rating SELECT id, seq, ?, ?, 1, ?, 50000 FROM match WHERE id = ?",
        )
        .bind(status, reason, algorithm, matchId)
        .run();
      const decision = reason === null ? { status } : { status, reason };
      await expect(
        readMatchForViewer(db, matchId, null),
      ).resolves.toMatchObject({
        kind: "found",
        match: { rated: true, ratingDecision: decision },
      });
      const { rows } = await readHistoryPage(db, {
        userId: owner,
        filter: "rated",
        cursor: null,
      });
      expect(rows.find((row) => row.id === matchId)).toMatchObject({
        ratingDecision: decision,
      });
    }
    await expect(readMatchForViewer(db, id(10), null)).resolves.toMatchObject({
      kind: "found",
      match: { rated: true, ratingDecision: null },
    });
  });
});
