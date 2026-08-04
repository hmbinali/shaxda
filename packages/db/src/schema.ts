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
