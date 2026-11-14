import type { D1Database } from "@cloudflare/workers-types";
import { UTC_DAY_MS } from "@shaxda/shared/analytics/events";

export const DELETION_GRACE_MS = 7 * UTC_DAY_MS;
export const USERNAME_HOLD_MS = 30 * UTC_DAY_MS;

export type DeletionRecord = {
  id: string;
  deletion_requested_at: number | null;
  deletion_due_at: number | null;
  deleted_at: number | null;
};

export function readDeletion(db: D1Database, id: string) {
  return db
    .prepare(
      "SELECT id, deletion_requested_at, deletion_due_at, deleted_at FROM user WHERE id = ?",
    )
    .bind(id)
    .first<DeletionRecord>();
}

export async function requestDeletion(db: D1Database, id: string, now: number) {
  const [result] = await db.batch<DeletionRecord>([
    db
      .prepare(
        `UPDATE user SET deletion_requested_at = ?2, deletion_due_at = ?3, updated_at = ?2
       WHERE id = ?1 AND deletion_requested_at IS NULL
       RETURNING deletion_due_at`,
      )
      .bind(id, now, now + DELETION_GRACE_MS),
    db
      .prepare(
        `DELETE FROM session WHERE user_id = ?1
       AND EXISTS (SELECT 1 FROM user WHERE id = ?1 AND deletion_requested_at = ?2)`,
      )
      .bind(id, now),
  ]);
  return (
    result?.results[0]?.deletion_due_at ??
    (await readDeletion(db, id))?.deletion_due_at ??
    null
  );
}

export async function cancelDeletion(db: D1Database, id: string, now: number) {
  const result = await db
    .prepare(
      `UPDATE user SET deletion_requested_at = NULL, deletion_due_at = NULL, updated_at = ?2
     WHERE id = ?1 AND deleted_at IS NULL AND deletion_due_at > ?2`,
    )
    .bind(id, now)
    .run();
  if (result.meta.changes === 1) return true;
  return (await readDeletion(db, id))?.deletion_requested_at === null;
}

export function revokeSession(db: D1Database, id: string, userId: string) {
  return db
    .prepare("DELETE FROM session WHERE id = ?1 AND user_id = ?2")
    .bind(id, userId)
    .run();
}

export function deletionScrubStatements(
  db: D1Database,
  record: { id: string; deleted_at: number },
) {
  const { id, deleted_at: now } = record;
  const email = `${crypto.randomUUID().replaceAll("-", "")}@deleted.invalid`;
  return [
    db.prepare("DELETE FROM session WHERE user_id = ?").bind(id),
    db.prepare("DELETE FROM account WHERE user_id = ?").bind(id),
    db
      .prepare(
        `DELETE FROM verification WHERE value = ?1
       OR CASE WHEN json_valid(value) THEN json_extract(value, '$.link.userId') END = ?1`,
      )
      .bind(id),
    db
      .prepare(
        "UPDATE username_claim SET released_at = COALESCE(released_at, ?2) WHERE user_id = ?1",
      )
      .bind(id, now),
    db
      .prepare(
        `UPDATE user SET username = NULL, name = 'deleted', email = ?3, email_verified = 0,
        image = NULL, avatar_mode = 'initial', username_changed_at = NULL,
        updated_at = ?2, deleted_at = ?2 WHERE id = ?1 AND deleted_at IS NOT ?2`,
      )
      .bind(id, now, email),
  ];
}

export function countDeletions(db: D1Database, now: number) {
  return db
    .prepare(
      `SELECT
       (SELECT COUNT(*) FROM user WHERE deletion_due_at IS NOT NULL AND deleted_at IS NULL) AS pending,
       (SELECT COUNT(*) FROM user WHERE deletion_due_at <= ?1 AND deleted_at IS NULL) AS overdue,
       (SELECT COUNT(*) FROM user WHERE deleted_at IS NOT NULL) AS final,
       (SELECT COUNT(DISTINCT user_id) FROM username_claim JOIN user ON user.id = user_id
        WHERE deleted_at IS NOT NULL) AS held`,
    )
    .bind(now)
    .first<{ pending: number; overdue: number; final: number; held: number }>();
}

export async function exportDeletions(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT id, deletion_requested_at, deletion_due_at, deleted_at
     FROM user WHERE deletion_due_at IS NOT NULL ORDER BY id`,
    )
    .all<DeletionRecord>();
  return results;
}

export async function replayDeletions(
  db: D1Database,
  records: readonly DeletionRecord[],
  now: number,
) {
  let restored = 0;
  const exported = new Set(records.map(({ id }) => id));
  for (const {
    id,
    deletion_requested_at: requested,
    deletion_due_at: due,
    deleted_at: final,
  } of records) {
    const current = await readDeletion(db, id);
    if (!current) {
      if (final === null) continue;
      // No historical identity fields exist in the export. Keep a scrubbed
      // tombstone even when the restored snapshot predates the account.
      const email = `${crypto.randomUUID().replaceAll("-", "")}@deleted.invalid`;
      await db
        .prepare(
          `INSERT OR IGNORE INTO user
          (id, name, email, created_at, updated_at, deletion_requested_at, deletion_due_at, deleted_at)
          VALUES (?1, 'deleted', ?2, ?3, ?4, ?3, ?5, ?4)`,
        )
        .bind(id, email, requested, final, due)
        .run();
      restored++;
      continue;
    }
    if (final === null) {
      if (current.deleted_at !== null) continue;
      await db.batch([
        db
          .prepare(
            `UPDATE user SET deletion_requested_at = ?2, deletion_due_at = ?3, updated_at = ?4
           WHERE id = ?1 AND deleted_at IS NULL
             AND (deletion_requested_at IS NOT ?2 OR deletion_due_at IS NOT ?3)`,
          )
          .bind(id, requested, due, now),
        db
          .prepare(
            "DELETE FROM session WHERE user_id = ?1 AND created_at <= ?2",
          )
          .bind(id, requested),
      ]);
    } else {
      await db.batch([
        db
          .prepare(
            `UPDATE user SET deletion_requested_at = ?2, deletion_due_at = ?3, deleted_at = NULL
           WHERE id = ?1 AND deleted_at IS NOT ?4`,
          )
          .bind(id, requested, due, final),
        ...deletionScrubStatements(db, { id, deleted_at: final }),
      ]);
    }
    restored++;
  }
  const pending = await exportDeletions(db);
  for (const record of pending) {
    if (record.deleted_at !== null || exported.has(record.id)) continue;
    await db
      .prepare(
        `UPDATE user SET deletion_requested_at = NULL, deletion_due_at = NULL, updated_at = ?2
       WHERE id = ?1 AND deleted_at IS NULL`,
      )
      .bind(record.id, now)
      .run();
  }
  return {
    exported: records.length,
    restored,
    absent: records.length - restored,
  };
}
