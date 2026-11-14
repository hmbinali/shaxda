CREATE TABLE active_user_day (
  day TEXT NOT NULL CHECK (length(day) = 10),
  anon_id TEXT NOT NULL CHECK (length(anon_id) = 43),
  kind TEXT NOT NULL CHECK (kind IN ('guest', 'account')),
  PRIMARY KEY (day, anon_id)
) WITHOUT ROWID;
--> statement-breakpoint
CREATE TABLE event_daily (
  day TEXT NOT NULL CHECK (length(day) = 10),
  event TEXT NOT NULL CHECK (length(event) BETWEEN 1 AND 64),
  count INTEGER NOT NULL CHECK (count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (day, event)
);
--> statement-breakpoint
CREATE INDEX event_daily_event_day_idx ON event_daily (event, day);
--> statement-breakpoint
CREATE TABLE job_state (
  name TEXT PRIMARY KEY NOT NULL CHECK (length(name) BETWEEN 1 AND 64),
  lease_token TEXT,
  lease_expires_at INTEGER,
  cursor TEXT,
  last_success_at INTEGER,
  last_error TEXT,
  updated_at INTEGER NOT NULL,
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);
--> statement-breakpoint
CREATE TABLE job_fence (
  ok INTEGER NOT NULL CONSTRAINT job_fence_guard CHECK (ok = 1)
);
--> statement-breakpoint
CREATE INDEX username_claim_claimed_at_idx ON username_claim (claimed_at);
