import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./schema.generated";

export * from "./schema.generated";

// `schema.generated.ts` must stay byte-identical to the Better Auth CLI output
// (`schema:check` enforces this), so the hardening applied to its tables cannot
// be declared here. `migrations/0000_accounts.sql` is hand-written and adds, on
// top of what this model describes:
//
//   - UNIQUE INDEX `user_username_unique` on `user (username)`;
//   - UNIQUE INDEX `account_provider_account_unique` on
//     `account (provider_id, account_id)`;
//   - CHECK `user_username_normalized_check`;
//   - CHECK `user_avatar_mode_check`;
//   - NOT NULL on `user.avatar_mode`.
//
// `migrations/meta/` therefore does not describe them either, and it is left
// that way on purpose: syncing the snapshot by hand would make the next
// `drizzle-kit generate` emit DROP statements for constraints this model does
// not declare. Migrations here are hand-written; no script runs `drizzle-kit
// generate`. If you ever do generate one, review the SQL and re-apply the list
// above whenever `user` or `account` is rebuilt. The migration test in
// `queries/account.worker.test.ts` fails if any of them stops being applied.

export const usernameClaim = sqliteTable(
  "username_claim",
  {
    username: text("username").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    claimedAt: integer("claimed_at", { mode: "timestamp_ms" }).notNull(),
    releasedAt: integer("released_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("username_claim_user_released_idx").on(
      table.userId,
      table.releasedAt,
    ),
    index("username_claim_claimed_at_idx").on(table.claimedAt),
    check(
      "username_claim_normalized_check",
      sql`length(${table.username}) between 3 and 20 and ${table.username} = lower(${table.username}) and ${table.username} not glob '*[^a-z0-9_]*'`,
    ),
  ],
);

// The hand-written migration also makes this table WITHOUT ROWID.
export const activeUserDay = sqliteTable(
  "active_user_day",
  {
    day: text("day").notNull(),
    anonId: text("anon_id").notNull(),
    kind: text("kind", { enum: ["guest", "account"] }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.day, table.anonId] }),
    check("active_user_day_day", sql`length(${table.day}) = 10`),
    check("active_user_day_anon_id", sql`length(${table.anonId}) = 43`),
    check("active_user_day_kind", sql`${table.kind} in ('guest', 'account')`),
  ],
);

export const eventDaily = sqliteTable(
  "event_daily",
  {
    day: text("day").notNull(),
    event: text("event").notNull(),
    count: integer("count").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.day, table.event] }),
    index("event_daily_event_day_idx").on(table.event, table.day),
    check("event_daily_day", sql`length(${table.day}) = 10`),
    check("event_daily_event", sql`length(${table.event}) between 1 and 64`),
    check("event_daily_count", sql`${table.count} >= 0`),
  ],
);

export const jobState = sqliteTable(
  "job_state",
  {
    name: text("name").primaryKey(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: integer("lease_expires_at"),
    cursor: text("cursor"),
    lastSuccessAt: integer("last_success_at"),
    lastError: text("last_error"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check("job_state_name", sql`length(${table.name}) between 1 and 64`),
    check(
      "job_state_lease",
      sql`(${table.leaseToken} is null) = (${table.leaseExpiresAt} is null)`,
    ),
  ],
);

export const jobFence = sqliteTable(
  "job_fence",
  { ok: integer("ok").notNull() },
  (table) => [check("job_fence_guard", sql`${table.ok} = 1`)],
);
