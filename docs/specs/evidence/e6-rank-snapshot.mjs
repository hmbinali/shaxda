import assert from "node:assert/strict";

const second = 1_000;
const refreshDelay = 10 * second;
const maxCacheSeconds = 25;
const maximumAge = 55 * second;

// Disposable proof schema. This module is only imported by the E6 evidence runner.
const schema = [
  `CREATE TABLE evidence_rank (
    rank INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    rating REAL NOT NULL,
    sort_rating REAL GENERATED ALWAYS AS (-rating) STORED,
    board_key INTEGER NOT NULL,
    rated_games INTEGER NOT NULL,
    rated_wins INTEGER NOT NULL,
    rated_losses INTEGER NOT NULL,
    rated_draws INTEGER NOT NULL,
    streak_kind TEXT,
    streak_len INTEGER NOT NULL,
    form TEXT NOT NULL,
    eligible_until INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX evidence_rank_cursor_idx ON evidence_rank(sort_rating, board_key)",
  `CREATE TABLE evidence_rank_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    as_of INTEGER,
    next_expiry INTEGER,
    dirty_since INTEGER,
    privacy_dirty INTEGER NOT NULL DEFAULT 0 CHECK (privacy_dirty IN (0, 1))
  )`,
  "INSERT INTO evidence_rank_state (id) VALUES (1)",
];

const publish = `INSERT INTO evidence_rank (
  rank, user_id, rating, board_key, rated_games, rated_wins, rated_losses, rated_draws,
  streak_kind, streak_len, form, eligible_until
)
SELECT row_number() OVER (ORDER BY p.rating DESC, p.board_key), p.user_id, p.rating,
  p.board_key, p.rated_games, p.rated_wins, p.rated_losses, p.rated_draws,
  p.streak_kind, p.streak_len, p.form, p.eligible_until
FROM player_rating AS p CROSS JOIN user AS u ON u.id = p.user_id
WHERE p.excluded = 0 AND p.eligible_until > ?1 AND p.rated_games >= 10
  AND u.username IS NOT NULL AND u.deletion_requested_at IS NULL AND u.deleted_at IS NULL`;

const publishState = `UPDATE evidence_rank_state SET as_of = ?1,
  next_expiry = (SELECT min(eligible_until) FROM evidence_rank),
  dirty_since = NULL, privacy_dirty = 0 WHERE id = 1`;
const stateQuery = `SELECT s.as_of, s.next_expiry, s.dirty_since, s.privacy_dirty, (SELECT maintenance FROM rating_processor_state WHERE id = 1) AS maintenance
  FROM evidence_rank_state AS s WHERE s.id = 1`;
const fields = `r.rank, r.rating, r.board_key, r.rated_games, r.rated_wins, r.rated_losses,
  r.rated_draws, r.streak_kind, r.streak_len, r.form, u.username, u.avatar_mode,
  CASE WHEN u.avatar_mode = 'google' THEN u.image END AS image`;
const reads =
  "FROM evidence_rank AS r CROSS JOIN user AS u ON u.id = r.user_id";
const firstRankAfter = `SELECT rank FROM evidence_rank
  WHERE (sort_rating, board_key) > (-?1, ?2) ORDER BY sort_rating, board_key LIMIT 1`;
const firstPage = `SELECT ${fields} ${reads} WHERE r.rank >= 1 ORDER BY r.rank LIMIT 101`;
const cursorPage = `SELECT ${fields} ${reads}
  WHERE r.rank >= (${firstRankAfter}) ORDER BY r.rank LIMIT 101`;
const publicRank = "SELECT rank FROM evidence_rank WHERE user_id = ?1";
const neighbours = (offset) => `SELECT ${fields} ${reads}
  WHERE r.rank BETWEEN (SELECT rank - ${offset} FROM evidence_rank WHERE user_id = ?1)
    AND (SELECT rank + ${offset} FROM evidence_rank WHERE user_id = ?1) ORDER BY r.rank`;
const viewer = `SELECT p.rating, p.rd, p.volatility, p.rated_games, p.last_rated_at,
  p.excluded, u.username, u.deletion_requested_at, u.deleted_at
  FROM player_rating AS p LEFT JOIN user AS u ON u.id = p.user_id WHERE p.user_id = ?1`;

function listedAfter(row, [rating, key]) {
  return row.rating < rating || (row.rating === rating && row.board_key > key);
}

function prepare(db, sql, args = []) {
  const stmt = db.prepare(sql);
  return args.length ? stmt.bind(...args) : stmt;
}

function cost(results) {
  return results.reduce(
    (out, { meta }) => ({
      rowsRead: out.rowsRead + meta.rows_read,
      rowsWritten: out.rowsWritten + meta.rows_written,
      d1Ms: out.d1Ms + meta.duration,
    }),
    { rowsRead: 0, rowsWritten: 0, d1Ms: 0 },
  );
}

function publication(db, asOf) {
  return [
    db.prepare("DELETE FROM evidence_rank"),
    prepare(db, publish, [asOf]),
    prepare(db, publishState, [asOf]),
  ];
}

async function refresh(db, asOf) {
  const started = performance.now();
  const results = await db.batch(publication(db, asOf));
  return { ...cost(results), wallMs: Math.round(performance.now() - started) };
}

function dueSince(state) {
  return Math.min(state.dirty_since ?? Infinity, state.next_expiry ?? Infinity);
}

function cachePolicy(state, now) {
  const remaining = dueSince(state) + maximumAge - now;
  if (state.as_of === null || state.privacy_dirty || remaining <= 0) {
    return { status: 503, seconds: 0 };
  }
  return {
    status: 200,
    seconds: Math.min(maxCacheSeconds, Math.floor(remaining / second)),
  };
}

function dirty(db, now, privacy = false) {
  return prepare(
    db,
    `UPDATE evidence_rank_state
    SET dirty_since = coalesce(dirty_since, ?1), privacy_dirty = max(privacy_dirty, ?2)
    WHERE id = 1`,
    [now, Number(privacy)],
  );
}

async function readPage(db, cursor) {
  const [state, rows] = await db.batch([
    db.prepare(stateQuery),
    cursor ? prepare(db, cursorPage, cursor) : db.prepare(firstPage),
  ]);
  return {
    state: state.results[0],
    rows: rows.results,
    ...cost([state, rows]),
  };
}

function keys(rows) {
  return rows.map(({ board_key, rank }) => [board_key, rank]);
}

export async function createRankFixture(db) {
  await db.batch(schema.map((sql) => db.prepare(sql)));
}

export async function studyRankSnapshot(db, asOf, oracle, label, userId) {
  const notes = [];
  const pages = [];
  const initial = await refresh(db, asOf);

  async function measure(name, statements) {
    const prepared = statements.map(([sql, args]) => prepare(db, sql, args));
    const results = await db.batch(prepared);
    const plan = [];
    for (const [sql, args] of statements) {
      const { results } = await prepare(
        db,
        "EXPLAIN QUERY PLAN " + sql,
        args,
      ).all();
      const steps = results.map(({ detail }) => detail);
      assert.ok(
        steps.every(
          (step) =>
            step === "SCAN rating_processor_state" ||
            !/SCAN |USE TEMP B-TREE/.test(step),
        ),
        name + ": " + steps,
      );
      plan.push(steps);
    }
    const metrics = cost(results);
    assert.equal(metrics.rowsWritten, 0);
    assert.ok(metrics.rowsRead <= 2_000, name);
    assert.ok(metrics.d1Ms <= 100, name);
    notes.push({
      name,
      returned: results.map((r) => r.results.length),
      ...metrics,
      plan,
    });
    return results.map((r) => r.results);
  }

  const deep = oracle[Math.floor(oracle.length * 0.75) - 1];
  const probe = oracle[Math.floor(oracle.length / 2)];
  const tail = oracle.at(-1);
  const cursor = (row) => [row.rating, row.board_key];
  for (const [name, after] of [
    ["page 1", null],
    ["page 2", cursor(oracle[99])],
    ["75% depth", cursor(deep)],
    ["edited key inside tie", [probe.rating, probe.board_key - 1]],
    ["edited maximum key inside tie", [probe.rating, Number.MAX_SAFE_INTEGER]],
    ["edited rating between groups", [probe.rating + 0.3125, probe.board_key]],
    ["edited above leaders", [Number.MAX_VALUE, 1]],
    ["edited below tail", [-Number.MAX_VALUE, 1]],
    ["past last", cursor(tail)],
  ]) {
    const expected = oracle
      .filter((row) => !after || listedAfter(row, after))
      .slice(0, 101);
    const [state, rows] = await measure(name, [
      [stateQuery],
      after ? [cursorPage, after] : [firstPage],
    ]);
    assert.equal(state[0].as_of, asOf);
    assert.deepEqual(
      keys(rows),
      expected.map(({ board_key, rank }) => [board_key, rank]),
      name,
    );
  }

  // Real keyset traversal exercises every listed row, including ties split across pages.
  let after = null;
  let batch;
  do {
    batch = await readPage(db, after);
    pages.push(...batch.rows.slice(0, 100));
    after = batch.rows.length === 101 ? cursor(batch.rows[99]) : null;
    assert.ok(batch.rowsRead <= 2_000);
  } while (after);
  assert.deepEqual(keys(pages), keys(oracle));

  for (const [name, row] of [
    ["middle", probe],
    ["last", tail],
  ]) {
    const [, , rank, around] = await measure("standing " + name, [
      [stateQuery],
      [viewer, [row.username]],
      [publicRank, [row.username]],
      [neighbours(3), [row.username]],
    ]);
    assert.equal(rank[0].rank, row.rank);
    assert.deepEqual(
      keys(around),
      keys(oracle.slice(Math.max(0, row.rank - 4), row.rank + 3)),
    );
  }
  const [, inactive, rank] = await measure("standing unlisted", [
    [stateQuery],
    [viewer, [userId(3)]],
    [publicRank, [userId(3)]],
  ]);
  assert.ok(inactive[0].deletion_requested_at);
  assert.deepEqual(rank, []);
  const [, profileRank] = await measure("R4 profile rank last", [
    [stateQuery],
    [publicRank, [tail.username]],
  ]);
  assert.equal(profileRank[0].rank, tail.rank);

  // A failing batch after replacement SQL leaves the old generation visible.
  await assert.rejects(
    db.batch([
      ...publication(db, asOf + 1),
      db.prepare("INSERT INTO evidence_rank_state (id) VALUES (2)"),
    ]),
  );
  const afterRollback = await readPage(db, null);
  assert.equal(afterRollback.state.as_of, asOf);
  assert.deepEqual(keys(afterRollback.rows), keys(oracle.slice(0, 101)));

  return { density: label, listed: oracle.length, initial, notes };
}

export async function studyRankFreshness(db, asOf, oracle, label, userId) {
  const challenger = userId(6);
  const expiring = oracle[10].username;
  const excluded = oracle[11].username;
  const pending = oracle[12].username;
  // Keep other expirations outside this fixture's 60-second freshness envelope.
  await db.batch([
    prepare(
      db,
      "UPDATE player_rating SET eligible_until = ?1 WHERE eligible_until > ?2",
      [asOf + 300 * second, asOf],
    ),
    prepare(
      db,
      "UPDATE player_rating SET eligible_until = ?1 WHERE user_id = ?2",
      [asOf + 1, expiring],
    ),
    prepare(
      db,
      "UPDATE player_rating SET rated_games=9, rated_wins=4, rated_losses=3, rated_draws=2, eligible_until=?1 WHERE user_id=?2",
      [asOf + 300 * second, challenger],
    ),
  ]);
  const before = await refresh(db, asOf);
  const beforePage = await readPage(db, null);
  assert.equal(cachePolicy(beforePage.state, asOf).seconds, maxCacheSeconds);
  assert.ok(!beforePage.rows.some((row) => row.username === challenger));

  const eventAt = asOf + 1;
  assert.equal(beforePage.state.next_expiry, eventAt);
  assert.equal(dueSince(beforePage.state), eventAt);
  // Show action and dirty mark in one D1 transaction, as for a writer hook.
  await db.batch([
    prepare(
      db,
      "UPDATE player_rating SET rating=2500, rated_games=10, rated_wins=5 WHERE user_id=?1",
      [challenger],
    ),
    dirty(db, eventAt),
  ]);
  const refreshAt = eventAt + refreshDelay;
  const justBeforeRefresh = await readPage(db, null);
  assert.equal(dueSince(justBeforeRefresh.state), eventAt);
  const staleRefillAt = refreshAt - 1;
  const ttl = cachePolicy(justBeforeRefresh.state, staleRefillAt).seconds;
  assert.equal(ttl, maxCacheSeconds);
  const rebuilt = await refresh(db, refreshAt);
  assert.ok(
    rebuilt.wallMs < 5 * second,
    "refresh lost its 5-second local allowance",
  );

  // The real D1 replacement has run. Model the latest cache fill during an
  // in-flight publication using its measured latency and the absolute cap.
  const replacementAt = refreshAt + rebuilt.wallMs;
  const committedAt = refreshAt + 5 * second;
  assert.ok(replacementAt <= committedAt);
  // Origin budget includes up to 15 s for completion, save and R1 processing
  // on the healthy hint path. The exact-expiry path has no such prerequisite.
  const completionAllowanceMs = 15 * second;
  const lastPreCommitFill = replacementAt - 1;
  const lastPreCommitTtl = cachePolicy(
    justBeforeRefresh.state,
    lastPreCommitFill,
  ).seconds;
  const firstNewCachedReadAt = Math.max(
    replacementAt,
    lastPreCommitFill + lastPreCommitTtl * second,
  );
  const fresh = await readPage(db, null);
  assert.equal(fresh.rows[0].username, challenger);
  assert.equal(fresh.rows[0].rank, 1);
  assert.ok(!fresh.rows.some((row) => row.username === expiring));
  assert.equal(cachePolicy(fresh.state, firstNewCachedReadAt).status, 200);
  assert.ok(
    firstNewCachedReadAt - eventAt + completionAllowanceMs < 60 * second,
  );
  // Bound a cache fill while a publication is in flight, and after a missed
  // trigger when a generation has reached the age limit.
  for (const readAt of [
    asOf,
    refreshAt,
    committedAt - 1,
    eventAt + maximumAge - 1,
  ]) {
    const response = cachePolicy(justBeforeRefresh.state, readAt);
    assert.ok(readAt + response.seconds * second <= eventAt + maximumAge);
  }

  // An expired-but-unreplaced generation loses cacheability and fails closed.
  assert.equal(
    cachePolicy(justBeforeRefresh.state, eventAt + maximumAge - 1).seconds,
    0,
  );
  assert.equal(
    cachePolicy(justBeforeRefresh.state, eventAt + maximumAge).status,
    503,
  );

  const changeAt = firstNewCachedReadAt + 1;
  await db.batch([
    prepare(db, "UPDATE player_rating SET excluded=1 WHERE user_id=?1", [
      excluded,
    ]),
    prepare(
      db,
      "UPDATE user SET deletion_requested_at=?1, deletion_due_at=?2 WHERE id=?3",
      [changeAt, changeAt + 86_400_000, pending],
    ),
    dirty(db, changeAt, true),
  ]);
  const invalidated = await readPage(db, null);
  assert.equal(cachePolicy(invalidated.state, changeAt).status, 503);
  const afterPrivacy = await refresh(db, changeAt + refreshDelay);
  const reloaded = await readPage(db, null);
  assert.equal(
    cachePolicy(reloaded.state, changeAt + refreshDelay).status,
    200,
  );
  assert.ok(
    !reloaded.rows.some(
      (row) => row.username === excluded || row.username === pending,
    ),
  );
  assert.deepEqual(
    reloaded.rows.map((row) => row.rank),
    reloaded.rows.map((_, i) => i + 1),
  );

  await db.batch([
    prepare(db, "UPDATE player_rating SET excluded=0 WHERE user_id=?1", [
      excluded,
    ]),
    prepare(
      db,
      "UPDATE user SET deletion_requested_at=NULL, deletion_due_at=NULL WHERE id=?1",
      [pending],
    ),
    prepare(
      db,
      "UPDATE player_rating SET rating=2400 - 0.625, rated_games=20, rated_wins=10, rated_losses=5, rated_draws=5 WHERE user_id=?1",
      [challenger],
    ),
  ]);

  return {
    density: label,
    clock:
      "logical time, actual Miniflare D1 metadata and wall time for publication",
    initial: before,
    ratingAndExpiryRefresh: rebuilt,
    privacyRefresh: afterPrivacy,
    lastPreCommitCacheSeconds: lastPreCommitTtl,
    firstNewCachedReadMsAfterChange: firstNewCachedReadAt - eventAt,
    firstNewCachedReadMsWithCompletionAllowance:
      firstNewCachedReadAt - eventAt + completionAllowanceMs,
    policyBoundMs:
      completionAllowanceMs +
      refreshDelay +
      5 * second +
      maxCacheSeconds * second,
  };
}
