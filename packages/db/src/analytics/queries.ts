import type { D1Database } from "@cloudflare/workers-types";
import {
  clientEventNames,
  type ClientEventName,
} from "@shaxda/shared/analytics/events";

export type ActivityKind = "guest" | "account";

export interface ActivityIdentity {
  kind: ActivityKind;
  anonId: string;
}

export const ANALYTICS_JOB_NAME = "x1.nightly";

export async function recordActivity(
  db: D1Database,
  day: string,
  identities: ActivityIdentity[],
): Promise<void> {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO active_user_day (day, anon_id, kind) VALUES (?1, ?2, ?3)",
  );
  await db.batch(
    identities.map(({ anonId, kind }) => insert.bind(day, anonId, kind)),
  );
}

export async function incrementLocalEvent(
  db: D1Database,
  event: ClientEventName,
  day: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO event_daily (day, event, count, updated_at) VALUES (?1, ?2, 1, ?3)
     ON CONFLICT (day, event) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
    )
    .bind(day, clientEventNames.parse(event), now)
    .run();
}

export const ACTIVITY_GAUGES_SQL = `
  WITH windows (suffix, first_day) AS (VALUES ('1d', ?1), ('7d', ?2), ('30d', ?3)),
       kinds (kind, prefix) AS (VALUES ('guest', 'active_browsers_'), ('account', 'active_accounts_'))
  INSERT INTO event_daily (day, event, count, updated_at)
    SELECT ?1, prefix || suffix, (
      SELECT COUNT(DISTINCT anon_id)
      FROM active_user_day
      WHERE day BETWEEN first_day AND ?1 AND active_user_day.kind = kinds.kind
    ), ?4
    FROM windows CROSS JOIN kinds WHERE true
  ON CONFLICT (day, event) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at
`;

// A rename-back can remove an early claim. Keep an already published day
// intact even if an operator resets the job cursor.
export const REGISTRATIONS_GAUGE_SQL = `
  INSERT INTO event_daily (day, event, count, updated_at)
    SELECT ?1, 'registrations', COUNT(DISTINCT claim.user_id), ?4
    FROM username_claim claim
    WHERE claim.claimed_at >= ?2 AND claim.claimed_at < ?3
      AND NOT EXISTS (
        SELECT 1 FROM username_claim prior
        WHERE prior.user_id = claim.user_id AND prior.claimed_at < ?2
      )
  ON CONFLICT (day, event) DO NOTHING
`;

export const ACTIVITY_PRUNE_SQL = `
  DELETE FROM active_user_day
  WHERE (day, anon_id) IN (
    SELECT day, anon_id FROM active_user_day WHERE day < ?1 ORDER BY day, anon_id LIMIT 5000
  )
`;
export const ACTIVITY_PRUNE_LIMIT = 5000;

export const EVENT_TREND_SQL =
  "SELECT day, event, count FROM event_daily WHERE day BETWEEN ?1 AND ?2 ORDER BY day, event";
export const EVENT_START_SQL =
  "SELECT MIN(day) AS day FROM event_daily WHERE event = ?1";
export const TODAY_ACTIVITY_SQL =
  "SELECT kind, COUNT(*) AS count FROM active_user_day WHERE day = ?1 GROUP BY kind";

export interface DailyEvent {
  day: string;
  event: string;
  count: number;
}

export async function readAnalyticsStats(
  db: D1Database,
  firstDay: string,
  today: string,
  events: readonly string[],
) {
  // MIN(day) is one indexed lookup per metric, independent of retained history.
  const [trend, todayCounts, lastRun, ...starts] = await db.batch<
    DailyEvent & { kind: ActivityKind; last_success_at: number | null }
  >([
    db.prepare(EVENT_TREND_SQL).bind(firstDay, today),
    db.prepare(TODAY_ACTIVITY_SQL).bind(today),
    db
      .prepare("SELECT last_success_at FROM job_state WHERE name = ?1")
      .bind(ANALYTICS_JOB_NAME),
    ...events.map((event) => db.prepare(EVENT_START_SQL).bind(event)),
  ]);

  return {
    daily:
      trend?.results.map(({ day, event, count }) => ({ day, event, count })) ??
      [],
    today: {
      guest:
        todayCounts?.results.find(({ kind }) => kind === "guest")?.count ?? 0,
      account:
        todayCounts?.results.find(({ kind }) => kind === "account")?.count ?? 0,
    },
    lastSuccessAt: lastRun?.results[0]?.last_success_at ?? null,
    recordedSince: Object.fromEntries(
      events.map((event, index) => [
        event,
        starts[index]?.results[0]?.day ?? null,
      ]),
    ),
  };
}
