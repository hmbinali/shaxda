CREATE TABLE rating_admin_audit (                  -- append-only
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL,
  environment    TEXT NOT NULL CHECK (environment IN ('local','preview','production')),
  actor          TEXT NOT NULL,                    -- §3.2
  command        TEXT NOT NULL,                    -- no CHECK: R6-detect adds commands
  target         TEXT,                             -- match, user, or flag id; NULL for rebuild-ratings
  reason         TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  outcome        TEXT NOT NULL CHECK (outcome IN ('planned','applied','noop','rejected','failed')),
  plan_digest    TEXT NOT NULL, high_water_seq INTEGER NOT NULL,
  detail         TEXT NOT NULL DEFAULT '{}'        -- JSON: counts, rejection cause, restore point
);
CREATE INDEX rating_admin_audit_target_idx ON rating_admin_audit (target, id DESC);
CREATE INDEX rating_admin_audit_digest_idx ON rating_admin_audit (plan_digest, outcome);

CREATE TABLE rating_invalidation_log (             -- append-only
  id INTEGER PRIMARY KEY AUTOINCREMENT, match_id TEXT NOT NULL REFERENCES match(id),
  action   TEXT NOT NULL CHECK (action IN ('invalidate','rescind')),
  reason   TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  actor    TEXT NOT NULL, audit_id INTEGER NOT NULL REFERENCES rating_admin_audit(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX rating_invalidation_log_match_idx ON rating_invalidation_log (match_id, id DESC);
CREATE VIEW rating_invalidation_current AS         -- v2-contracts §4.2 step 1
  SELECT l.match_id FROM rating_invalidation_log l WHERE l.action = 'invalidate'
     AND l.id = (SELECT MAX(m.id) FROM rating_invalidation_log m WHERE m.match_id = l.match_id);

CREATE TABLE rating_account_exclusion (            -- source of player_rating.excluded (§7.5)
  user_id  TEXT PRIMARY KEY,                       -- private; no FK to user, like the ledger
  excluded INTEGER NOT NULL CHECK (excluded IN (0,1)),
  reason   TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  audit_id INTEGER NOT NULL REFERENCES rating_admin_audit(id), changed_at INTEGER NOT NULL
);

CREATE TABLE rating_rebuild (                      -- append-only; one row per published correction
  id INTEGER PRIMARY KEY AUTOINCREMENT, published_at INTEGER NOT NULL,
  audit_id INTEGER NOT NULL UNIQUE REFERENCES rating_admin_audit(id),
  reason TEXT NOT NULL, high_water_seq INTEGER NOT NULL,
  policy_v INTEGER NOT NULL, algorithm_v INTEGER NOT NULL,
  changed_events INTEGER NOT NULL CHECK (changed_events >= 0),
  marked_events  INTEGER NOT NULL CHECK (marked_events BETWEEN 0 AND changed_events)
);

CREATE TABLE rating_correction_mark (              -- public: "rating corrected"
  match_id   TEXT PRIMARY KEY REFERENCES match(id),
  rebuild_id INTEGER NOT NULL REFERENCES rating_rebuild(id)
);

CREATE TRIGGER rating_admin_audit_no_update
BEFORE UPDATE ON rating_admin_audit
BEGIN
  SELECT RAISE(ABORT, 'append-only');
END;

CREATE TRIGGER rating_admin_audit_no_delete
BEFORE DELETE ON rating_admin_audit
BEGIN
  SELECT RAISE(ABORT, 'append-only');
END;

CREATE TRIGGER rating_invalidation_log_no_update
BEFORE UPDATE ON rating_invalidation_log
BEGIN
  SELECT RAISE(ABORT, 'append-only');
END;

CREATE TRIGGER rating_invalidation_log_no_delete
BEFORE DELETE ON rating_invalidation_log
BEGIN
  SELECT RAISE(ABORT, 'append-only');
END;

CREATE TRIGGER rating_rebuild_no_update
BEFORE UPDATE ON rating_rebuild
BEGIN
  SELECT RAISE(ABORT, 'append-only');
END;

CREATE TRIGGER rating_rebuild_no_delete
BEFORE DELETE ON rating_rebuild
BEGIN
  SELECT RAISE(ABORT, 'append-only');
END;
