-- One row per decided match. A ledger row without one is pending (§7.1).
CREATE TABLE match_rating (
  match_id           TEXT    PRIMARY KEY REFERENCES match(id) ON DELETE CASCADE,
  seq                INTEGER NOT NULL UNIQUE,            -- copy of match.seq: the decision order
  rating_status      TEXT    NOT NULL CHECK (rating_status IN ('processed','skipped','held')),
  rating_skip_reason TEXT    CHECK (rating_skip_reason IN ('friendly','pairCap','invalidated')),
  rating_policy_v    INTEGER NOT NULL,
  rating_algorithm_v INTEGER,
  decided_at         INTEGER NOT NULL,
  CHECK ((rating_status = 'skipped') = (rating_skip_reason IS NOT NULL)),
  CHECK ((rating_status = 'processed') = (rating_algorithm_v IS NOT NULL))
);

-- Both seats of every processed match; full-precision REALs.
CREATE TABLE match_player_rating (
  match_id          TEXT NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  seat              TEXT NOT NULL CHECK (seat IN ('A','B')),
  rating_before     REAL NOT NULL,
  rating_after      REAL NOT NULL,
  rd_before         REAL NOT NULL,                        -- after inactivity growth
  rd_after          REAL NOT NULL,
  volatility_before REAL NOT NULL,
  volatility_after  REAL NOT NULL,
  rating_delta      REAL NOT NULL,                        -- rating_after - rating_before
  PRIMARY KEY (match_id, seat)
);

CREATE TABLE player_rating (
  user_id         TEXT    PRIMARY KEY,                 -- private; no FK to user
  board_key       INTEGER NOT NULL UNIQUE,             -- P20: 1, 2, 3… in first-processed order
  rating          REAL    NOT NULL,
  rd              REAL    NOT NULL,                    -- post-event RD; readers derive effective RD
  volatility      REAL    NOT NULL,
  rated_games     INTEGER NOT NULL,                    -- the public record (P8) starts here
  rated_wins      INTEGER NOT NULL,
  rated_losses    INTEGER NOT NULL,
  rated_draws     INTEGER NOT NULL,
  streak_kind     TEXT    CHECK (streak_kind IN ('win','loss','draw')),
  streak_len      INTEGER NOT NULL,
  best_win_streak INTEGER NOT NULL,                    -- P9
  form            TEXT    NOT NULL,                    -- up to five of W/L/D, oldest first
  peak_rating     REAL    NOT NULL,                    -- P9: highest post-event rating, no floor
  peak_seq        INTEGER NOT NULL,                    -- event that first reached the peak
  last_rated_at   INTEGER NOT NULL,                    -- max ended_at over processed events
  eligible_until  INTEGER NOT NULL,                    -- §7.3: first instant P19's time rules fail
  last_seq        INTEGER NOT NULL,
  excluded        INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0,1)),  -- projection (§7.5)
  CHECK (rated_games = rated_wins + rated_losses + rated_draws)
);
CREATE INDEX player_rating_board_idx ON player_rating (excluded, rating DESC, board_key);
-- R3 may add an index on eligible_until if E6 shows the rating walk reads too many rows.

CREATE TABLE rating_processor_state (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  cursor_seq       INTEGER NOT NULL,                   -- seq of the last decided match
  lease_token      TEXT,
  lease_expires_at INTEGER,
  maintenance      INTEGER NOT NULL DEFAULT 0 CHECK (maintenance IN (0,1)),
  policy_v         INTEGER NOT NULL,
  algorithm_v      INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
INSERT INTO rating_processor_state
VALUES (1, 0, NULL, NULL, 0, 1, 1, CAST(unixepoch('subsec') * 1000 AS INTEGER));
CREATE TABLE rating_fence (ok INTEGER NOT NULL CONSTRAINT rating_fence_guard CHECK (ok = 1));  -- §7.2

-- Same shapes, empty outside a correction rebuild (§7.4).
CREATE TABLE match_rating_next        AS SELECT * FROM match_rating        WHERE 0;
CREATE TABLE match_player_rating_next AS SELECT * FROM match_player_rating WHERE 0;
CREATE TABLE player_rating_next       AS SELECT * FROM player_rating       WHERE 0;
