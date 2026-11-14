import type { D1Database } from "@cloudflare/workers-types";
import {
  UTC_DAY_MS,
  utcDay,
  utcWeekStart,
} from "@shaxda/shared/analytics/events";

const WEEK = 7 * UTC_DAY_MS;
const DAY = UTC_DAY_MS;

export const LEDGER_CHANGES_SQL =
  "SELECT MIN(ended_at) AS first_end, MAX(seq) AS last_seq FROM match WHERE seq > ?1";

// Candidate players are found through the rated/end range and match_player's
// primary key. Earlier and return games use the owner/end index.
const playersInWindow = `
  SELECT DISTINCT player.user_id
  FROM match AS game
  JOIN match_player AS player ON player.match_id = game.id
  WHERE game.rated IN (0, 1)
    AND game.ended_at >= ?2 AND game.ended_at < ?3 AND game.seq <= ?4
`;
const gaugeUpsert = `
  ON CONFLICT (day, event) DO UPDATE
  SET count = excluded.count, updated_at = excluded.updated_at
`;

export const SAVED_GAUGES_SQL = `
  WITH categories(rated, event) AS (VALUES (0, 'saved_friendly'), (1, 'saved_rated'))
  INSERT INTO event_daily (day, event, count, updated_at)
  SELECT ?1, categories.event, (
    SELECT COUNT(*) FROM match AS game
    WHERE game.rated = categories.rated AND game.ended_at >= ?2 AND game.ended_at < ?3
      AND game.seq <= ?4
  ), ?5
  FROM categories WHERE true
  ${gaugeUpsert}
`;

export const COHORT_GAUGES_SQL = `
  WITH first_players(user_id) AS MATERIALIZED (
    SELECT candidates.user_id FROM (${playersInWindow}) AS candidates
    WHERE NOT EXISTS (
      SELECT 1 FROM match_player AS prior
      JOIN match AS game ON game.id = prior.match_id
      WHERE prior.user_id = candidates.user_id AND prior.ended_at < ?2 AND game.seq <= ?4
    )
  ), metrics(event, start, end) AS (
    VALUES ('cohort_size', NULL, NULL),
           ('cohort_d7', ?2 + 7 * ${DAY}, ?2 + 8 * ${DAY}),
           ('cohort_d30', ?2 + 30 * ${DAY}, ?2 + 31 * ${DAY}),
           ('cohort_within_7d', ?3, ?2 + 8 * ${DAY})
  )
  INSERT INTO event_daily (day, event, count, updated_at)
  SELECT ?1, metrics.event, (
    SELECT COUNT(*) FROM first_players
    WHERE metrics.start IS NULL OR EXISTS (
      SELECT 1 FROM match_player AS return_game
      JOIN match AS game ON game.id = return_game.match_id
      WHERE return_game.user_id = first_players.user_id
        AND return_game.ended_at >= metrics.start AND return_game.ended_at < metrics.end
        AND game.seq <= ?4
    )
  ), ?5
  FROM metrics WHERE metrics.end IS NULL OR metrics.end <= ?6
  ${gaugeUpsert}
`;

export const WEEK_GAUGES_SQL = `
  WITH week_players(user_id) AS MATERIALIZED (${playersInWindow}),
       metrics(event) AS (VALUES ('week_players'), ('week_returning'))
  INSERT INTO event_daily (day, event, count, updated_at)
  SELECT ?1, metrics.event, (
    SELECT COUNT(*) FROM week_players
    WHERE metrics.event = 'week_players' OR EXISTS (
      SELECT 1 FROM match_player AS return_game
      JOIN match AS game ON game.id = return_game.match_id
      WHERE return_game.user_id = week_players.user_id
        AND return_game.ended_at >= ?2 + ${WEEK} AND return_game.ended_at < ?2 + 2 * ${WEEK}
        AND game.seq <= ?4
    )
  ), ?5
  FROM metrics WHERE metrics.event = 'week_players' OR ?2 + 2 * ${WEEK} <= ?6
  ${gaugeUpsert}
`;

export interface LedgerCursor {
  ledgerSeq: number;
  ledgerDay?: number;
  ledgerWork?: {
    from: number;
    through: number;
    next: number;
    seq: number;
  };
}

export async function prepareLedgerStep(
  db: D1Database,
  cursor: LedgerCursor,
  yesterday: number,
  now: number,
) {
  let work = cursor.ledgerWork;
  if (work === undefined) {
    const changes = await db
      .prepare(LEDGER_CHANGES_SQL)
      .bind(cursor.ledgerSeq)
      .first<{ first_end: number | null; last_seq: number | null }>();
    if (cursor.ledgerSeq === 0 && changes?.last_seq == null) {
      return { cursor, writes: [], complete: true };
    }

    if (cursor.ledgerDay === yesterday && changes?.last_seq == null) {
      return { cursor, writes: [], complete: true };
    }

    const firstNewDay =
      changes?.first_end == null
        ? yesterday
        : Date.parse(utcDay(changes.first_end));
    const from = Math.min(
      yesterday,
      firstNewDay,
      (cursor.ledgerDay ?? yesterday) + DAY,
    );
    work = {
      from,
      through: yesterday,
      next: Math.min(from - 30 * DAY, utcWeekStart(from - WEEK)),
      seq: changes?.last_seq ?? cursor.ledgerSeq,
    };
  }

  const saved = db.prepare(SAVED_GAUGES_SQL);
  const cohort = db.prepare(COHORT_GAUGES_SQL);
  const week = db.prepare(WEEK_GAUGES_SQL);
  const end = work.through + DAY;
  const writes = [];
  let next = work.next;
  // Cap each invocation at seven UTC days, including when a save arrives
  // months late. The snapshot and date range stay fixed across invocations.
  for (
    let processed = 0;
    next < end && processed < 7;
    processed++, next += DAY
  ) {
    const day = utcDay(next);
    if (next >= work.from) {
      writes.push(saved.bind(day, next, next + DAY, work.seq, now));
    }
    if (next >= work.from - 30 * DAY) {
      writes.push(cohort.bind(day, next, next + DAY, work.seq, now, end));
    }
    if (next === utcWeekStart(next) && next >= utcWeekStart(work.from - WEEK)) {
      writes.push(
        week.bind(day, next, Math.min(next + WEEK, end), work.seq, now, end),
      );
    }
  }

  const complete = next >= end;
  return {
    cursor: complete
      ? { ledgerSeq: work.seq, ledgerDay: work.through }
      : { ...cursor, ledgerWork: { ...work, next } },
    writes,
    complete: complete && work.through === yesterday,
  };
}
