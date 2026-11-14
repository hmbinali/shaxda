import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from "@cloudflare/workers-types";
const LEASE_DURATION_MS = 5 * 60_000;

export interface JobLease {
  name: string;
  token: string;
  cursor: string | null;
}

export class JobLeaseLost extends Error {
  constructor() {
    super("Job lease lost.");
    this.name = "JobLeaseLost";
  }
}

export async function acquireJobLease(
  db: D1Database,
  name: string,
  now: number,
): Promise<JobLease | null> {
  const token = crypto.randomUUID();
  const [, result] = await db.batch<{ cursor: string | null }>([
    db
      .prepare(
        "INSERT OR IGNORE INTO job_state (name, updated_at) VALUES (?1, ?2)",
      )
      .bind(name, now),
    db
      .prepare(
        `UPDATE job_state SET lease_token = ?2, lease_expires_at = ?3, updated_at = ?4
       WHERE name = ?1 AND (lease_token IS NULL OR lease_expires_at <= ?4)
       RETURNING cursor`,
      )
      .bind(name, token, now + LEASE_DURATION_MS, now),
  ]);
  return result?.meta.changes === 1
    ? { name, token, cursor: result.results[0]?.cursor ?? null }
    : null;
}

export async function fencedJobBatch(
  db: D1Database,
  lease: JobLease,
  now: number,
  writes: D1PreparedStatement[],
  cursor: string | null,
  guard?: D1PreparedStatement,
): Promise<D1Result[]> {
  try {
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO job_fence (ok) VALUES (
          (SELECT lease_token = ?2 AND lease_expires_at > ?3 FROM job_state WHERE name = ?1))`,
        )
        .bind(lease.name, lease.token, now),
      ...(guard ? [guard] : []),
      ...writes,
      db
        .prepare(
          "UPDATE job_state SET cursor = ?2, updated_at = ?3 WHERE name = ?1",
        )
        .bind(lease.name, cursor, now),
      db.prepare("DELETE FROM job_fence"),
    ]);
    return results.slice(guard ? 2 : 1, -2);
  } catch (error) {
    for (let cause = error; cause instanceof Error; cause = cause.cause) {
      if (/\b(?:job_fence_guard|job_fence\.ok)\b/.test(cause.message)) {
        throw new JobLeaseLost();
      }
    }
    throw error;
  }
}

export async function releaseJobLease(
  db: D1Database,
  lease: JobLease,
  now: number,
  completed: boolean,
  errorCode: string | null = null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE job_state SET lease_token = NULL, lease_expires_at = NULL,
      last_success_at = CASE WHEN ?4 THEN ?3 ELSE last_success_at END,
      last_error = CASE WHEN ?4 OR ?5 IS NOT NULL THEN ?5 ELSE last_error END, updated_at = ?3
     WHERE name = ?1 AND lease_token = ?2 AND lease_expires_at > ?3`,
    )
    .bind(lease.name, lease.token, now, Number(completed), errorCode)
    .run();
}

export async function recordJobError(
  db: D1Database,
  lease: JobLease,
  now: number,
  code: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE job_state SET last_error = ?4, updated_at = ?3
     WHERE name = ?1 AND lease_token = ?2 AND lease_expires_at > ?3`,
    )
    .bind(lease.name, lease.token, now, code)
    .run();
}
