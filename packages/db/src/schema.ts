import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
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
    check(
      "username_claim_normalized_check",
      sql`length(${table.username}) between 3 and 20 and ${table.username} = lower(${table.username}) and ${table.username} not glob '*[^a-z0-9_]*'`,
    ),
  ],
);
