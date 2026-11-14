import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  createRankFixture,
  studyRankFreshness,
  studyRankSnapshot,
} from "./e6-rank-snapshot.mjs";

const requireFromWeb = createRequire(
  new URL("../../../web/package.json", import.meta.url),
);
const requireFromWrangler = createRequire(
  requireFromWeb.resolve("wrangler/package.json"),
);
const { Miniflare } = requireFromWrangler("miniflare");
const requireFromMiniflare = createRequire(
  requireFromWrangler.resolve("miniflare/package.json"),
);

const day = 86_400_000;
const asOf = Date.UTC(2026, 10, 14);
const owner = "p00000";
const matchCount = 5_000;
const playerCount = 5_000;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const playerId = (n) => "p" + String(n).padStart(5, "0");

function matchId(n) {
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix = alphabet[n % 32] + suffix;
    n = Math.floor(n / 32);
  }
  return "A".repeat(16) + suffix;
}

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function sqlBlock(path, heading) {
  return read(path).split(heading)[1].split("```sql\n")[1].split("```")[0];
}

async function schema(db) {
  const ddl = [
    read("../../../packages/db/migrations/0000_accounts.sql"),
    sqlBlock("../v2-contracts.md", "### 2.1 H1 tables"),
    sqlBlock("../v2-contracts.md", "### 2.5 R1 extension"),
    read("../a3-account-deletion.md").match(
      /```sql\n(ALTER TABLE user ADD COLUMN deletion_requested_at[\s\S]+?)```/,
    )[1],
    sqlBlock("../r6-ranking-integrity.md", "### 3.1 R6-core tables"),
  ].join("\n");
  const statements = ddl
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((sql) => sql.trim())
    .filter(Boolean);
  await db.batch(statements.map((sql) => db.prepare(sql)));
  await db
    .prepare(
      "INSERT INTO rating_processor_state VALUES (1, 0, NULL, NULL, 0, 1, 1, ?)",
    )
    .bind(asOf)
    .run();
}

const seatStats = {
  capturesMade: 0,
  capturesSuffered: 0,
  jareEvents: 0,
  repeatedJareEvents: 0,
  firstPlacementJare: false,
  movementTurns: 0,
  turnsBeforeFirstCapture: null,
  maxPieceAdvantage: 0,
  blockedPlayerEvents: 0,
  spaceMakingTurns: 0,
  comeback: false,
};
const stats = JSON.stringify({
  v: 1,
  replayV: 1,
  players: { A: seatStats, B: seatStats },
  match: { phaseTransitions: [], longestNoCaptureRun: 0 },
});
const replay = JSON.stringify({ v: 1, s: "A", a: Array(160).fill("M:O1>O2") });
async function insertFixtureRows(db, table, columns, rows) {
  if (!rows.length) return;
  const fields = columns
    .split(",")
    .map((_, i) => `json_extract(value, '$[${i}]')`);
  await db
    .prepare(
      `INSERT INTO ${table} (${columns}) SELECT ${fields.join(", ")} FROM json_each(?1)`,
    )
    .bind(JSON.stringify(rows))
    .run();
}

async function seed(db, ranksOnly) {
  const accounts = Array.from({ length: playerCount }, (_, n) => {
    const id = playerId(n);
    return [
      id,
      "Evidence",
      id + "@example.invalid",
      n === 1 ? null : id,
      asOf,
      asOf,
      n === 3 ? asOf : null,
      n === 3 ? asOf + day : null,
    ];
  }).filter(([id]) => id !== playerId(2)); // missing opponent
  await insertFixtureRows(
    db,
    "user",
    `id, name, email, username, created_at, updated_at,
    deletion_requested_at, deletion_due_at`,
    accounts,
  );
  await db
    .prepare(
      `INSERT INTO username_claim (username, user_id, claimed_at)
    SELECT username, id, ? FROM user WHERE username IS NOT NULL`,
    )
    .bind(asOf)
    .run();

  for (let start = 1; start <= (ranksOnly ? 0 : 25_000); start += 250) {
    const matches = [];
    const seats = [];
    const decisions = [];
    const events = [];
    for (let n = start; n < start + 250; n++) {
      const id = matchId(n);
      const owned = n <= matchCount;
      const other = owned ? 1 + (n % 50) : 102 + (n % 4_898);
      const first = owned ? owner : playerId(51 + (n % 50));
      const second = playerId(other);
      // Five consecutive ids tie on ended_at. About 1,800 games fall in 90 days.
      const endedAt =
        n === matchCount
          ? asOf + 1
          : asOf -
            ((1 + Math.floor(((owned ? matchCount + 2 : 25_000) - n) / 5)) *
              day) /
              4;
      const rated = n % 5 < 3;
      const processed = rated && n % 17 !== 0 && n % 19 !== 0 && n % 23 !== 0;
      const outcome = n % 11 === 0 ? "draw" : n % 2 === 0 ? "win" : "loss";
      const seat = n % 3 === 0 ? "B" : "A";
      const otherSeat = seat === "A" ? "B" : "A";
      const otherOutcome =
        outcome === "draw" ? "draw" : outcome === "win" ? "loss" : "win";
      matches.push([
        id,
        "FIXTURE",
        n,
        1,
        "invite",
        Number(rated),
        rated ? 1 : null,
        1,
        1,
        replay,
        "A",
        outcome === "draw" ? null : outcome === "win" ? seat : otherSeat,
        outcome === "draw" ? "drawTermination" : "resignation",
        160,
        1,
        "ok",
        stats,
        "fixture",
        endedAt - 60_000,
        endedAt,
        asOf + 1,
      ]);
      seats.push(
        [id, seat, first, outcome, 5, 3, endedAt],
        [id, otherSeat, second, otherOutcome, 5, 3, endedAt],
      );
      if (n % 17 !== 0) {
        const status = processed
          ? "processed"
          : rated && n % 19 === 0
            ? "held"
            : "skipped";
        const reason =
          status === "skipped" ? (rated ? "pairCap" : "friendly") : null;
        decisions.push([id, n, status, reason, 1, processed ? 1 : null, asOf]);
      }
      if (processed) {
        events.push(
          [id, "A", 1500, 1502, 110, 109, 0.06, 0.06, 2],
          [id, "B", 1500, 1498, 110, 109, 0.06, 0.06, -2],
        );
      }
    }
    await insertFixtureRows(
      db,
      "match",
      `id, room_code, room_created_at, match_number, mode, rated, consent_policy_v,
      rules_v, replay_v, replay, starting_seat, winner_seat, end_reason, action_count,
      stats_v, stats_status, stats_json, payload_hash, started_at, ended_at, saved_at`,
      matches,
    );
    await insertFixtureRows(
      db,
      "match_player",
      "match_id, seat, user_id, result, pieces_left, captured, ended_at",
      seats,
    );
    await insertFixtureRows(
      db,
      "match_rating",
      "match_id, seq, rating_status, rating_skip_reason, rating_policy_v, rating_algorithm_v, decided_at",
      decisions,
    );
    await insertFixtureRows(
      db,
      "match_player_rating",
      `match_id, seat, rating_before, rating_after, rd_before, rd_after,
      volatility_before, volatility_after, rating_delta`,
      events,
    );
  }

  // Rating projection is synthetic and deliberately scaled independently of this ledger.
  const ratings = Array.from({ length: playerCount }, (_, n) => [
    playerId(n),
    n + 1,
    2400 - Math.floor(n / 4) * 0.625,
    100,
    0.06,
    20,
    10,
    5,
    5,
    "win",
    2,
    4,
    "WLDWW",
    1600,
    100,
    asOf - day,
    asOf + day,
    150,
    Number(n === 4),
  ]);
  await insertFixtureRows(
    db,
    "player_rating",
    `user_id, board_key, rating, rd, volatility,
    rated_games, rated_wins, rated_losses, rated_draws, streak_kind, streak_len, best_win_streak,
    form, peak_rating, peak_seq, last_rated_at, eligible_until, last_seq, excluded`,
    ratings,
  );
  if (ranksOnly) return;
  await db
    .prepare(
      `INSERT INTO rating_admin_audit
    (id, at, environment, actor, command, outcome, reason, plan_digest, high_water_seq)
    VALUES (1, ?1, 'local', 'operator', 'apply', 'applied', 'fixture', 'fixture', 5000)`,
    )
    .bind(asOf)
    .run();
  await db
    .prepare(
      `INSERT INTO rating_rebuild VALUES (1, ?, 1, 'fixture', 5000, 1, 1, 1, 1)`,
    )
    .bind(asOf)
    .run();
  await db
    .prepare("INSERT INTO rating_correction_mark VALUES (?, 1)")
    .bind(matchId(4997))
    .run();
}

function historyPage(filter, cursor, labels) {
  return `SELECT mp.match_id, mp.ended_at, mp.result, mp.pieces_left, mp.captured,
    m.mode, m.rated, m.starting_seat, m.first_advantage_seat, m.first_advantage_by,
    m.winner_seat, m.end_reason, m.online_end_reason, m.started_at, m.action_count,
    op.result AS opponent_result, op.pieces_left AS opponent_pieces_left,
    op.captured AS opponent_captured, u.username, u.avatar_mode, u.image, u.deletion_requested_at
    ${labels ? ", mr.rating_status, mr.rating_skip_reason" : ""}
    FROM match_player AS mp
    CROSS JOIN match AS m ON m.id = mp.match_id
    CROSS JOIN match_player AS op ON op.match_id = mp.match_id
      AND op.seat = CASE mp.seat WHEN 'A' THEN 'B' ELSE 'A' END
    LEFT JOIN user AS u ON u.id = op.user_id
    ${labels ? "LEFT JOIN match_rating AS mr ON mr.match_id = m.id" : ""}
    WHERE mp.user_id = ?1 ${filter} ${cursor ? "AND (mp.ended_at, mp.match_id) < (?3, ?4)" : ""}
    ORDER BY mp.ended_at DESC, mp.match_id DESC LIMIT 21`;
}

function matchDetail(labels) {
  return `SELECT m.id, m.mode, m.rated, m.starting_seat, m.first_advantage_seat,
    m.first_advantage_by, m.winner_seat, m.end_reason, m.online_end_reason,
    m.action_count, m.started_at, m.ended_at, mp.seat, mp.user_id,
    mp.result, mp.pieces_left, mp.captured, u.username, u.avatar_mode, u.image, u.deletion_requested_at
    ${labels ? ", mr.rating_status, mr.rating_skip_reason" : ""}
    FROM match AS m CROSS JOIN match_player AS mp ON mp.match_id = m.id
    LEFT JOIN user AS u ON u.id = mp.user_id
    ${labels ? "LEFT JOIN match_rating AS mr ON mr.match_id = m.id" : ""}
    WHERE m.id = ?1`;
}

const record = `SELECT rating, rd, volatility, last_rated_at, rated_games,
  rated_wins, rated_losses, rated_draws, streak_kind, streak_len, best_win_streak,
  form, peak_rating, peak_seq FROM player_rating WHERE user_id = ?1`;
const maintenance =
  "SELECT maintenance FROM rating_processor_state WHERE id = 1";
const listed = `p.excluded = 0 AND p.eligible_until > ?1 AND p.rated_games >= 10
  AND u.username IS NOT NULL AND u.deletion_requested_at IS NULL AND u.deleted_at IS NULL`;
const fromBoard =
  "FROM player_rating AS p CROSS JOIN user AS u ON u.id = p.user_id";
const boardFields = `p.rating, p.board_key, p.rated_games, p.rated_wins, p.rated_losses,
  p.rated_draws, p.streak_kind, p.streak_len, p.form, u.username, u.avatar_mode, u.image`;
const boardOrder = "ORDER BY p.rating DESC, p.board_key";
const ahead = "p.rating >= ?2 AND (p.rating > ?2 OR p.board_key < ?3)";
const behind = "p.rating <= ?2 AND (p.rating < ?2 OR p.board_key > ?3)";

async function study(db) {
  const observations = [];
  async function measure(name, sql, args, expectedRows) {
    const statement = db.prepare(sql.trim());
    const explain = db.prepare("EXPLAIN QUERY PLAN " + sql.trim());
    const bind = (prepared) =>
      args.length ? prepared.bind(...args) : prepared;
    const { results, meta } = await bind(statement).all();
    const plan = (await bind(explain).all()).results.map((row) => row.detail);
    assert.equal(meta.rows_written, 0, name);
    assert.ok(Number.isInteger(meta.rows_read), name);
    if (expectedRows !== undefined)
      assert.equal(results.length, expectedRows, name);
    observations.push({
      name,
      returned: results.length,
      rowsRead: meta.rows_read,
      plan,
      d1Ms: meta.duration,
    });
    return results;
  }

  assert.equal(
    await db
      .prepare("SELECT count(*) AS n FROM match_player WHERE user_id = ?1")
      .bind(owner)
      .first("n"),
    matchCount,
  );
  assert.equal(
    await db.prepare("SELECT count(*) AS n FROM player_rating").first("n"),
    playerCount,
  );
  const filters = {
    all: ["", null],
    wins: ["AND mp.result = ?2", "win"],
    losses: ["AND mp.result = ?2", "loss"],
    draws: ["AND mp.result = ?2", "draw"],
    rated: ["AND m.rated = ?2", 1],
    friendly: ["AND m.rated = ?2", 0],
  };
  for (const labels of [false, true]) {
    const phase = labels ? "H2+R1" : "H2";
    for (const [name, [filter, value]] of Object.entries(filters)) {
      const args = value === null ? [owner] : [owner, value];
      const first = await measure(
        `${phase} page ${name}`,
        historyPage(filter, false, labels),
        args,
        21,
      );
      const lastShown = first[19];
      const next = await measure(
        `${phase} cursor ${name}`,
        historyPage(filter, true, labels),
        [owner, value, lastShown.ended_at, lastShown.match_id],
        21,
      );
      assert.equal(next[0].match_id, first[20].match_id);
      assert.ok(
        next.every(
          (row) =>
            !first
              .slice(0, 20)
              .some((prior) => row.match_id === prior.match_id),
        ),
      );
      if (name === "all")
        assert.equal(
          next[0].ended_at,
          lastShown.ended_at,
          "cursor goes through a timestamp tie",
        );
    }
    await measure(
      `${phase} detail rated`,
      matchDetail(labels),
      [matchId(4997)],
      2,
    );
    await measure(
      `${phase} detail friendly`,
      matchDetail(labels),
      [matchId(4994)],
      2,
    );
    await measure(
      `${phase} detail missing`,
      matchDetail(labels),
      [matchId(30_000)],
      0,
    );
  }
  const totals = await measure(
    "H2 summary counts",
    `SELECT count(*) AS games,
    sum(result = 'win') AS wins, sum(result = 'loss') AS losses, sum(result = 'draw') AS draws
    FROM match_player WHERE user_id = ?1`,
    [owner],
    1,
  );
  assert.equal(totals[0].games, matchCount);
  await measure(
    "H2 summary form",
    `SELECT result FROM match_player WHERE user_id = ?1
    ORDER BY ended_at DESC, match_id DESC LIMIT 20`,
    [owner],
    20,
  );
  const h2h = `SELECT v.match_id, v.ended_at, v.result, m.rated
    FROM match_player AS v CROSS JOIN match_player AS t CROSS JOIN match AS m
    WHERE v.user_id = ?1 AND t.match_id = v.match_id
    AND t.seat = CASE v.seat WHEN 'A' THEN 'B' ELSE 'A' END
    AND t.user_id = ?2 AND m.id = v.match_id
    ORDER BY v.ended_at DESC, v.match_id DESC`;
  await measure("R5 head-to-head", h2h, [owner, playerId(8)], 100);
  await measure("R5 head-to-head empty", h2h, [owner, playerId(51)], 0);
  await measure("R5 viewer record", record, [owner], 1);
  await measure("R5 target record", record, [playerId(8)], 1);
  const window = (
    upperBound,
  ) => `SELECT mp.match_id, mp.ended_at, mp.result, r.rating_before, r.rating_after
    FROM match_player AS mp
    JOIN match_player_rating AS r ON r.match_id = mp.match_id AND r.seat = mp.seat
    WHERE mp.user_id = ?1 AND mp.ended_at >= ?2 ${upperBound ? "AND mp.ended_at <= ?3" : ""}
    ORDER BY mp.ended_at ASC, mp.match_id ASC`;
  const openWindow = await measure(
    "R5 printed SQL (no upper bound)",
    window(false),
    [owner, asOf - 90 * day],
  );
  assert.equal(openWindow.at(-1).ended_at, asOf + 1);
  for (const days of [7, 30, 90]) {
    const result = await measure(`R5 rating window ${days}d`, window(true), [
      owner,
      asOf - days * day,
      asOf,
    ]);
    assert.ok(
      result.length > 0 &&
        result.every(
          (row) => row.ended_at <= asOf && row.ended_at >= asOf - days * day,
        ),
    );
  }
  await measure(
    "R5 rating peak",
    `SELECT id, ended_at FROM match
    WHERE seq = (SELECT peak_seq FROM player_rating WHERE user_id = ?1)`,
    [owner],
    1,
  );

  await measure(
    "R4 profile resolution",
    `SELECT u.id, u.username, u.image, u.avatar_mode, c.released_at
    FROM username_claim AS c JOIN user AS u ON u.id = c.user_id
    WHERE c.username = ?1 AND u.deletion_requested_at IS NULL AND u.deleted_at IS NULL LIMIT 1`,
    [owner],
    1,
  );
  await measure("R4 public record", record, [owner], 1);
  await measure("R4 maintenance flag", maintenance, [], 1);
  const profileList = `SELECT mp.match_id, mp.result, m.ended_at, m.end_reason, m.online_end_reason,
    u.username, u.avatar_mode, u.image, u.deletion_requested_at, mr.rating_status,
    mr.rating_skip_reason, r.rating_before, r.rating_after, (rc.match_id IS NOT NULL) AS corrected
    FROM match_player AS mp CROSS JOIN match AS m ON m.id = mp.match_id
    CROSS JOIN match_player AS op ON op.match_id = m.id AND op.seat = CASE mp.seat WHEN 'A' THEN 'B' ELSE 'A' END
    LEFT JOIN match_rating AS mr ON mr.match_id = m.id
    LEFT JOIN match_player_rating AS r ON r.match_id = m.id AND r.seat = mp.seat
    LEFT JOIN rating_correction_mark AS rc ON rc.match_id = m.id
    LEFT JOIN user AS u ON u.id = op.user_id
    WHERE mp.user_id = ?1 AND m.rated = 1 ORDER BY mp.ended_at DESC, mp.match_id DESC LIMIT 10`;
  const included = `SELECT mp.seat, mp.result, m.started_at, m.ended_at, m.end_reason,
    m.stats_status, m.stats_v, m.stats_json FROM match_player AS mp
    CROSS JOIN match_rating AS mr ON mr.match_id = mp.match_id AND mr.rating_status = 'processed'
    CROSS JOIN match AS m ON m.id = mp.match_id WHERE mp.user_id = ?1`;
  await measure("R4 rated list mixed", profileList, [owner], 10);
  await measure("R4 lifetime stats mixed", included, [owner]);

  const active = `SELECT u.username, p.board_key, count(*) AS games
    FROM match AS m CROSS JOIN match_rating AS mr ON mr.match_id = m.id
    CROSS JOIN match_player AS mp ON mp.match_id = m.id
    CROSS JOIN player_rating AS p ON p.user_id = mp.user_id
    CROSS JOIN user AS u ON u.id = p.user_id
    WHERE m.rated = 1 AND m.ended_at > ?1 AND m.ended_at <= ?2
      AND mr.rating_status = 'processed' AND p.excluded = 0
      AND u.username IS NOT NULL AND u.deletion_requested_at IS NULL AND u.deleted_at IS NULL
    GROUP BY p.user_id ORDER BY games DESC, p.board_key LIMIT 20`;

  const board = `SELECT ${boardFields} ${fromBoard} WHERE ${listed}`;
  const count = `SELECT count(*) AS n ${fromBoard} WHERE ${listed}`;
  const reverseOrder = "ORDER BY p.rating ASC, p.board_key DESC";
  const viewer = `SELECT p.rating, p.board_key, p.rd, p.volatility, p.last_rated_at,
    p.rated_games, p.eligible_until, p.excluded, u.username, u.deletion_requested_at, u.deleted_at
    FROM player_rating AS p LEFT JOIN user AS u ON u.id = p.user_id WHERE p.user_id = ?1`;

  async function boardCase(label) {
    const name = "R3 " + label;
    const ranked = (await db.prepare(`${board} ${boardOrder}`).bind(asOf).all())
      .results;
    const deep = ranked[Math.floor(ranked.length * 0.75) - 1];
    const deepArgs = [asOf, deep.rating, deep.board_key];
    const last = ranked.at(-1);
    await measure(
      `${name} page 1`,
      `${board} ${boardOrder} LIMIT 101`,
      [asOf],
      101,
    );
    const deepPage = await measure(
      `${name} deep page`,
      `${board} AND ${behind} ${boardOrder} LIMIT 101`,
      deepArgs,
    );
    assert.equal(
      deepPage[0].board_key,
      ranked[Math.floor(ranked.length * 0.75)].board_key,
    );
    const cursorCount = await measure(
      `${name} deep page offset`,
      `${count} AND p.rating >= ?2 AND (p.rating > ?2 OR p.board_key <= ?3)`,
      deepArgs,
      1,
    );
    assert.equal(cursorCount[0].n, Math.floor(ranked.length * 0.75));
    // The standing batch resolves the fresh key in each statement instead of
    // reusing a rating from the first read, so a concurrent swap cannot mix states.
    const standingFrom = `FROM player_rating AS self
      CROSS JOIN player_rating AS p CROSS JOIN user AS u ON u.id = p.user_id`;
    const selfKey = (clause) =>
      clause.replaceAll("?2", "self.rating").replaceAll("?3", "self.board_key");
    const activeSelf = `self.user_id = ?2 AND self.excluded = 0 AND self.eligible_until > ?1 AND self.rated_games >= 10
      AND EXISTS (SELECT 1 FROM user AS su WHERE su.id = self.user_id
        AND su.username IS NOT NULL AND su.deletion_requested_at IS NULL AND su.deleted_at IS NULL)`;
    const standing = `${standingFrom} WHERE ${activeSelf} AND ${listed}`;
    await measure(`${name} listed viewer`, viewer, [ranked[0].username], 1);
    await measure(`${name} unlisted viewer`, viewer, [playerId(3)], 1);
    const lastRank = await measure(
      `${name} last rank count`,
      `SELECT count(*) AS n ${standing} AND ${selfKey(ahead)}`,
      [asOf, last.username],
      1,
    );
    assert.equal(lastRank[0].n + 1, ranked.length);
    await measure(
      `${name} neighbours above`,
      `SELECT ${boardFields} ${standing} AND ${selfKey(ahead)} ${reverseOrder} LIMIT 3`,
      [asOf, last.username],
      3,
    );
    await measure(
      `${name} neighbours below`,
      `SELECT ${boardFields} ${standing} AND ${selfKey(behind)} ${boardOrder} LIMIT 3`,
      [asOf, deep.username],
      3,
    );
    await measure(
      `${name} active (Should)`,
      active,
      [asOf - 7 * day, asOf],
      20,
    );
    return ranked.length;
  }

  await measure("R3 maintenance flag (each page)", maintenance, [], 1);
  const densities = await forEachDensity(db, async (label) => boardCase(label));

  await db
    .prepare(
      "CREATE INDEX evidence_eligible_until_idx ON player_rating (eligible_until)",
    )
    .run();
  await db.prepare("ANALYZE").run();
  await measure(
    "R3 d=0.1 index candidate page 1",
    `${board} ${boardOrder} LIMIT 101`,
    [asOf],
    101,
  );
  await measure(
    "R3 d=0.1 forced eligible_until (diagnostic)",
    `${board.replace("AS p CROSS JOIN", "AS p INDEXED BY evidence_eligible_until_idx CROSS JOIN")}
     ${boardOrder} LIMIT 101`,
    [asOf],
    101,
  );
  const sparseRanks = (
    await db.prepare(`${board} ${boardOrder}`).bind(asOf).all()
  ).results;
  const sparseDeep = sparseRanks[Math.floor(sparseRanks.length * 0.75) - 1];
  const sparseArgs = [asOf, sparseDeep.rating, sparseDeep.board_key];
  const offset = "p.rating >= ?2 AND (p.rating > ?2 OR p.board_key <= ?3)";
  await measure(
    "R3 d=0.1 index candidate deep page",
    `${board} AND ${behind} ${boardOrder} LIMIT 101`,
    sparseArgs,
  );
  await measure(
    "R3 d=0.1 index candidate deep page offset",
    `${count} AND ${offset}`,
    sparseArgs,
    1,
  );
  await measure(
    "R3 d=0.1 forced eligible_until offset (diagnostic)",
    `${count.replace("AS p CROSS JOIN", "AS p INDEXED BY evidence_eligible_until_idx CROSS JOIN")} AND ${offset}`,
    sparseArgs,
    1,
  );
  await db.prepare("DROP INDEX evidence_eligible_until_idx").run();

  // Upper envelope for the lifetime walk and dense processed chart.
  await db.batch([
    db.prepare(
      `UPDATE match SET rated = 1, consent_policy_v = 1 WHERE seq BETWEEN 1 AND 5000`,
    ),
    db
      .prepare(
        `INSERT INTO match_rating
      SELECT id, seq, 'processed', NULL, 1, 1, ?1 FROM match WHERE seq BETWEEN 1 AND 5000
      ON CONFLICT(match_id) DO UPDATE SET rating_status = 'processed',
        rating_skip_reason = NULL, rating_algorithm_v = 1`,
      )
      .bind(asOf),
    db.prepare(`INSERT OR IGNORE INTO match_player_rating
      SELECT mp.match_id, mp.seat, 1500, 1502, 110, 109, 0.06, 0.06, 2
      FROM match_player AS mp JOIN match AS m ON m.id = mp.match_id WHERE m.seq BETWEEN 1 AND 5000`),
  ]);
  await measure("R4 rated list all processed", profileList, [owner], 10);
  await measure(
    "R4 lifetime stats all processed",
    included,
    [owner],
    matchCount,
  );
  await measure("R5 rating window 90d all processed", window(true), [
    owner,
    asOf - 90 * day,
    asOf,
  ]);

  // Worst-case list and aggregate with ten old rated games.
  await db.batch([
    db
      .prepare(
        `DELETE FROM match_player_rating WHERE match_id IN
      (SELECT match_id FROM match_player WHERE user_id = ?1) AND match_id NOT IN
        (SELECT id FROM match WHERE seq <= 16 AND seq % 5 < 3)`,
      )
      .bind(owner),
    db.prepare(`UPDATE match_rating SET rating_status = 'skipped', rating_skip_reason = 'friendly',
      rating_algorithm_v = NULL WHERE seq BETWEEN 1 AND 5000 AND (seq > 16 OR seq % 5 >= 3)`),
    db.prepare(
      `UPDATE match SET rated = 0, consent_policy_v = NULL WHERE seq BETWEEN 1 AND 5000 AND (seq > 16 OR seq % 5 >= 3)`,
    ),
  ]);
  await measure("R4 rated list friendly-heavy", profileList, [owner], 10);
  await measure("R4 lifetime stats friendly-heavy", included, [owner], 10);

  return { densities, observations };
}

async function setDensity(db, threshold) {
  await db
    .prepare(
      `UPDATE player_rating SET eligible_until = ?1 +
    CASE WHEN (board_key - 1) % 10 < ?2 THEN 1 ELSE -1 END`,
    )
    .bind(asOf, threshold)
    .run();
}

async function forEachDensity(db, measure) {
  const results = [];
  for (const threshold of [9, 1]) {
    await setDensity(db, threshold);
    const value = await measure(`d=${threshold / 10}`);
    results.push([threshold / 10, value]);
  }
  return results;
}

async function rankStudy(db) {
  await createRankFixture(db);
  return forEachDensity(db, async (label) => {
    const { results } = await db
      .prepare(
        `SELECT ${boardFields} ${fromBoard}
      WHERE ${listed} ${boardOrder}`,
      )
      .bind(asOf)
      .all();
    const oracle = results.map((row, i) => ({ ...row, rank: i + 1 }));
    return {
      ...(await studyRankSnapshot(db, asOf, oracle, label, playerId)),
      freshness: await studyRankFreshness(db, asOf, oracle, label, playerId),
    };
  });
}

const ranksOnly = process.argv.includes("--rank-only");
const withSnapshot = ranksOnly || process.argv.includes("--rank-snapshot");

const mf = new Miniflare({
  modules: true,
  script:
    "export default { fetch() { return new Response('local evidence') } }",
  compatibilityDate: "2026-07-01",
  d1Databases: ["DB"],
  d1Persist: false,
  host: "127.0.0.1",
});

try {
  const db = await mf.getD1Database("DB");
  await schema(db);
  await seed(db, ranksOnly);
  console.error("E6 fixture seeded");
  await db.prepare("ANALYZE").run();
  const original = ranksOnly ? {} : await study(db);
  const rankSnapshot = withSnapshot
    ? (await rankStudy(db)).map(([, data]) => data)
    : [];
  console.log(
    JSON.stringify(
      {
        versions: {
          node: process.version,
          wrangler: requireFromWeb("wrangler/package.json").version,
          miniflare: requireFromWrangler("miniflare/package.json").version,
          workerd: requireFromMiniflare("workerd/package.json").version,
        },
        asOf: new Date(asOf).toISOString(),
        ...original,
        ...(rankSnapshot.length ? { rankSnapshot } : {}),
      },
      null,
      2,
    ),
  );
} finally {
  await mf.dispose();
}
