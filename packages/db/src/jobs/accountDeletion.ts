import type { D1Database } from "@cloudflare/workers-types";
import {
  USERNAME_HOLD_MS,
  deletionScrubStatements,
  type DeletionRecord,
} from "../queries/account-deletion";
import {
  acquireJobLease,
  fencedJobBatch,
  JobLeaseLost,
  recordJobError,
  releaseJobLease,
} from "./lease";

export const FINALIZE_DELETION_JOB = "a3.finalize";
export const RELEASE_USERNAME_JOB = "a3.release";
const LIMIT = 25;

export async function runAccountDeletionJob(
  db: D1Database,
  job: typeof FINALIZE_DELETION_JOB | typeof RELEASE_USERNAME_JOB,
  now: number,
  clock: () => number = Date.now,
) {
  const lease = await acquireJobLease(db, job, now);
  if (!lease) return;
  const finalize = job === FINALIZE_DELETION_JOB;
  const cutoff = finalize ? now : now - USERNAME_HOLD_MS;
  const candidates = finalize
    ? `SELECT id FROM user WHERE deletion_due_at <= ?1 AND deleted_at IS NULL
       ORDER BY deletion_due_at, id LIMIT ?2`
    : `SELECT id FROM user WHERE deleted_at <= ?1
       AND EXISTS (SELECT 1 FROM username_claim WHERE user_id = user.id)
       ORDER BY deleted_at, id LIMIT ?2`;
  let failures = 0;
  try {
    const { results } = await db
      .prepare(candidates)
      .bind(cutoff, LIMIT)
      .all<Pick<DeletionRecord, "id">>();
    for (const { id } of results) {
      const guard = db
        .prepare(
          finalize
            ? `INSERT INTO job_fence (ok) VALUES (EXISTS (
             SELECT 1 FROM user WHERE id = ?1 AND deleted_at IS NULL AND deletion_due_at <= ?2))`
            : `INSERT INTO job_fence (ok) VALUES (EXISTS (
             SELECT 1 FROM user WHERE id = ?1 AND deleted_at <= ?2))`,
        )
        .bind(id, cutoff);
      const writes = finalize
        ? deletionScrubStatements(db, { id, deleted_at: now })
        : [db.prepare("DELETE FROM username_claim WHERE user_id = ?").bind(id)];
      try {
        await fencedJobBatch(db, lease, clock(), writes, null, guard);
      } catch (error) {
        if (error instanceof JobLeaseLost) {
          // A stale candidate can fail its own guard. Stop only if this
          // worker also lost the job lease.
          const held = await db
            .prepare(
              "SELECT 1 FROM job_state WHERE name = ?1 AND lease_token = ?2 AND lease_expires_at > ?3",
            )
            .bind(lease.name, lease.token, clock())
            .first();
          if (!held) return;
          continue;
        }
        failures++;
        console.warn(finalize ? "a3FinalizeFailed" : "a3ReleaseFailed", {
          errorClass: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
    await releaseJobLease(
      db,
      lease,
      clock(),
      results.length < LIMIT || failures === LIMIT,
      failures > 0 ? "account_deletion_step_failed" : null,
    );
  } catch (error) {
    if (error instanceof JobLeaseLost) return;
    await recordJobError(db, lease, clock(), "account_deletion_job_failed");
    throw new Error("Account deletion job failed.");
  }
}
