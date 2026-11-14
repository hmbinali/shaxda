import {
  applyD1Migrations,
  env,
  reset,
  type D1Migration,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FINALIZE_DELETION_JOB,
  RELEASE_USERNAME_JOB,
  runAccountDeletionJob,
} from "../jobs/accountDeletion";
import { claimUsername, isUsernameAvailable, resolveProfile } from "./account";
import {
  cancelDeletion,
  DELETION_GRACE_MS,
  exportDeletions,
  readDeletion,
  replayDeletions,
  requestDeletion,
  USERNAME_HOLD_MS,
} from "./account-deletion";

const { DB: db, TEST_MIGRATIONS } = env as unknown as {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
};
const now = Date.parse("2026-11-14T00:15:00Z");
const due = now + DELETION_GRACE_MS;

async function addAccount(id: string) {
  await db
    .prepare(
      "INSERT INTO user (id, name, email, updated_at, image) VALUES (?1, ?1, ?2, ?3, 'private-image')",
    )
    .bind(id, `${id}@example.test`, now)
    .run();
}

function addSession(id: string, created = now - 1) {
  return db
    .prepare(
      `INSERT INTO session (id, token, user_id, created_at, updated_at, expires_at)
     VALUES (?2, ?2, ?1, ?3, ?3, ?4)`,
    )
    .bind(id, `${id}-session`, created, due)
    .run();
}

beforeEach(() => applyD1Migrations(db, TEST_MIGRATIONS));
afterEach(() => reset());

describe("account deletion", () => {
  it("enforces timestamps and indexes the two sweep probes", async () => {
    await addAccount("owner");
    for (const set of [
      "deletion_due_at = 100",
      "deletion_requested_at = 100",
      "deletion_requested_at = 100, deletion_due_at = 100",
      "deletion_requested_at = 100, deletion_due_at = 200, deleted_at = 199",
    ]) {
      await expect(
        db.prepare(`UPDATE user SET ${set} WHERE id='owner'`).run(),
      ).rejects.toThrow();
    }
    for (const [predicate, index] of [
      [
        "deletion_due_at <= ? AND deleted_at IS NULL ORDER BY deletion_due_at, id",
        "user_deletion_due_idx",
      ],
      ["deleted_at <= ? ORDER BY deleted_at, id", "user_deleted_at_idx"],
    ]) {
      const plan = await db
        .prepare(
          `EXPLAIN QUERY PLAN SELECT id FROM user WHERE ${predicate} LIMIT 25`,
        )
        .bind(now)
        .all<{ detail: string }>();
      expect(plan.results.map(({ detail }) => detail).join(" ")).toContain(
        index,
      );
    }
  });

  it("sets one due time, cuts off the profile, and only cancels before its deadline", async () => {
    await addAccount("owner");
    await addSession("owner");
    await claimUsername(db, "owner", "deletion_owner", "initial");
    expect(await requestDeletion(db, "owner", now)).toBe(due);
    expect(await requestDeletion(db, "owner", now + 1)).toBe(due);
    expect(
      await db.prepare("SELECT COUNT(*) AS n FROM session").first("n"),
    ).toBe(0);
    expect(await resolveProfile(db, "deletion_owner")).toEqual({
      kind: "missing",
    });
    expect(await isUsernameAvailable(db, "deletion_owner")).toBe(false);
    expect(await cancelDeletion(db, "owner", due)).toBe(false);
    expect(await cancelDeletion(db, "owner", due + 1)).toBe(false);
    expect(await cancelDeletion(db, "owner", due - 1)).toBe(true);
    expect(await cancelDeletion(db, "owner", due - 1)).toBe(true);
    expect(await resolveProfile(db, "deletion_owner")).toMatchObject({
      kind: "current",
    });
  });

  it("scrubs attributable data atomically, keeps other rows and releases claims at 30 days", async () => {
    await addAccount("owner");
    await addAccount("other");
    await claimUsername(db, "owner", "deletion_owner", "initial");
    await requestDeletion(db, "owner", now);
    await addSession("owner", now + 1);
    await db.batch([
      db.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES ('a', 'subject', 'google', 'owner', 0)",
      ),
      ...[
        ["value-owner", "owner"],
        ["link-owner", JSON.stringify({ link: { userId: "owner" } })],
        ["link-other", JSON.stringify({ link: { userId: "other" } })],
        ["state", "opaque state"],
      ].map(([key, value]) =>
        db
          .prepare(
            "INSERT INTO verification (id, identifier, value, expires_at) VALUES (?1, ?1, ?2, 1)",
          )
          .bind(key, value),
      ),
    ]);
    await runAccountDeletionJob(db, FINALIZE_DELETION_JOB, due, () => due);
    expect(
      await db
        .prepare(
          "SELECT username, image, name, email, deleted_at FROM user WHERE id='owner'",
        )
        .first(),
    ).toEqual({
      username: null,
      image: null,
      name: "deleted",
      email: expect.stringMatching(/^[a-f0-9]{32}@deleted\.invalid$/),
      deleted_at: due,
    });
    expect(
      await db.prepare("SELECT COUNT(*) AS n FROM account").first("n"),
    ).toBe(0);
    expect(
      await db.prepare("SELECT COUNT(*) AS n FROM session").first("n"),
    ).toBe(0);
    expect(
      (await db.prepare("SELECT id FROM verification ORDER BY id").all())
        .results,
    ).toEqual([{ id: "link-other" }, { id: "state" }]);
    const release = due + USERNAME_HOLD_MS;
    await runAccountDeletionJob(
      db,
      RELEASE_USERNAME_JOB,
      release - 1,
      () => release - 1,
    );
    expect(await isUsernameAvailable(db, "deletion_owner")).toBe(false);
    await runAccountDeletionJob(
      db,
      RELEASE_USERNAME_JOB,
      release,
      () => release,
    );
    expect(await isUsernameAvailable(db, "deletion_owner")).toBe(true);
  });

  it("replays pending and final records over an older copy without moving the hold", async () => {
    for (const id of ["final", "pending", "cancelled"]) await addAccount(id);
    await requestDeletion(db, "final", now);
    await runAccountDeletionJob(db, FINALIZE_DELETION_JOB, due, () => due);
    await requestDeletion(db, "pending", now + 100);
    const records = await exportDeletions(db);
    await db
      .prepare(
        "UPDATE user SET deleted_at=NULL, deletion_requested_at=NULL, deletion_due_at=NULL",
      )
      .run();
    await addSession("pending");
    await requestDeletion(db, "cancelled", now);
    await replayDeletions(db, records, due + 1000);
    await replayDeletions(db, records, due + 2000);
    expect(await exportDeletions(db)).toEqual(records);
    expect(
      (await readDeletion(db, "cancelled"))?.deletion_requested_at,
    ).toBeNull();
    expect(
      await db.prepare("SELECT COUNT(*) AS n FROM session").first("n"),
    ).toBe(0);
  });

  it("bounds a sweep at 25 and rolls back a failed account without blocking its neighbors", async () => {
    await db.batch(
      Array.from({ length: 26 }, (_, index) => {
        const id = `due-${String(index).padStart(2, "0")}`;
        return db
          .prepare(
            `INSERT INTO user (id, name, email, updated_at, deletion_requested_at, deletion_due_at)
         VALUES (?1, ?1, ?2, ?3, ?3, ?4)`,
          )
          .bind(id, `${id}@example.test`, now, due);
      }),
    );
    await runAccountDeletionJob(db, FINALIZE_DELETION_JOB, due, () => due);
    const count = () =>
      db
        .prepare("SELECT COUNT(*) AS n FROM user WHERE deleted_at IS NOT NULL")
        .first("n");
    expect(await count()).toBe(25);
    await runAccountDeletionJob(
      db,
      FINALIZE_DELETION_JOB,
      due + 1,
      () => due + 1,
    );
    expect(await count()).toBe(26);

    for (const id of ["fail", "ok"]) {
      await addAccount(id);
      await requestDeletion(db, id, now);
      await addSession(id, now + 1);
    }
    await db
      .prepare(
        `CREATE TRIGGER reject_one_tombstone BEFORE UPDATE OF deleted_at ON user
       WHEN OLD.id = 'fail' BEGIN SELECT RAISE(ABORT, 'test failure'); END`,
      )
      .run();
    await runAccountDeletionJob(
      db,
      FINALIZE_DELETION_JOB,
      due + 2,
      () => due + 2,
    );
    expect((await readDeletion(db, "fail"))?.deleted_at).toBeNull();
    expect((await readDeletion(db, "ok"))?.deleted_at).toBe(due + 2);
    expect(
      (await db.prepare("SELECT user_id FROM session").all()).results,
    ).toEqual([{ user_id: "fail" }]);
  });
});
