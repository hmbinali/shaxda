import type { D1Database } from "@cloudflare/workers-types";
import { UTC_DAY_MS, utcDay } from "@shaxda/shared/analytics/events";
import { prepareLedgerStep, type LedgerCursor } from "../analytics/ledger";
import {
  ACTIVITY_GAUGES_SQL,
  ACTIVITY_PRUNE_LIMIT,
  ACTIVITY_PRUNE_SQL,
  ANALYTICS_JOB_NAME,
  REGISTRATIONS_GAUGE_SQL,
} from "../analytics/queries";
import {
  JobLeaseLost,
  acquireJobLease,
  fencedJobBatch,
  recordJobError,
  releaseJobLease,
} from "./lease";

interface AnalyticsCursor extends LedgerCursor {
  day: string;
}

const MAX_CATCH_UP_DAYS = 35;

export async function runAnalyticsNightly(
  db: D1Database,
  now: number,
  clock = Date.now,
): Promise<void> {
  const lease = await acquireJobLease(db, ANALYTICS_JOB_NAME, clock());
  if (lease === null) return;

  try {
    const today = Date.parse(utcDay(now));
    const yesterday = today - UTC_DAY_MS;
    const previous =
      lease.cursor === null
        ? null
        : (JSON.parse(lease.cursor) as AnalyticsCursor);
    const nextDay =
      previous === null
        ? yesterday
        : Math.max(
            Date.parse(previous.day) + UTC_DAY_MS,
            today - MAX_CATCH_UP_DAYS * UTC_DAY_MS,
          );
    let progress: AnalyticsCursor = previous ?? {
      day: utcDay(yesterday),
      ledgerSeq: 0,
    };

    if (nextDay <= yesterday) {
      const day = utcDay(nextDay);
      const writeTime = clock();
      progress = { ...progress, day };
      await fencedJobBatch(
        db,
        lease,
        writeTime,
        [
          db
            .prepare(ACTIVITY_GAUGES_SQL)
            .bind(
              day,
              utcDay(nextDay - 6 * UTC_DAY_MS),
              utcDay(nextDay - 29 * UTC_DAY_MS),
              writeTime,
            ),
          db
            .prepare(REGISTRATIONS_GAUGE_SQL)
            .bind(day, nextDay, nextDay + UTC_DAY_MS, writeTime),
        ],
        JSON.stringify(progress),
      );
    }

    let ledgerComplete = false;
    if (nextDay >= yesterday) {
      const ledger = await prepareLedgerStep(db, progress, yesterday, clock());
      progress = { day: progress.day, ...ledger.cursor };
      if (ledger.writes.length > 0) {
        await fencedJobBatch(
          db,
          lease,
          clock(),
          ledger.writes,
          JSON.stringify(progress),
        );
      }
      ledgerComplete = ledger.complete;
    }

    const [pruned] = await fencedJobBatch(
      db,
      lease,
      clock(),
      [db.prepare(ACTIVITY_PRUNE_SQL).bind(utcDay(today - 90 * UTC_DAY_MS))],
      JSON.stringify(progress),
    );
    await releaseJobLease(
      db,
      lease,
      clock(),
      ledgerComplete && (pruned?.meta.changes ?? 0) < ACTIVITY_PRUNE_LIMIT,
    );
  } catch (error) {
    if (error instanceof JobLeaseLost) return;
    await recordJobError(db, lease, clock(), "analytics_nightly_failed");
    throw error;
  }
}
