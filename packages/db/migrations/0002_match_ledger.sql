CREATE TABLE match (
  seq                  INTEGER PRIMARY KEY AUTOINCREMENT, -- private ingestion order (P4)
  id                   TEXT    NOT NULL UNIQUE,           -- public opaque id (§2.3)
  room_code            TEXT    NOT NULL,
  room_created_at      INTEGER NOT NULL,                  -- identifies the room instance
  match_number         INTEGER NOT NULL CHECK (match_number >= 1),
  mode                 TEXT    NOT NULL CHECK (mode IN ('invite','quick')),
  rated                INTEGER NOT NULL CHECK (rated IN (0,1)),  -- agreed (P3); visibility derives (P2)
  consent_policy_v     INTEGER,                           -- disclosure version both seats accepted
  rules_v              INTEGER NOT NULL,                  -- engine RULES_VERSION at game over
  replay_v             INTEGER NOT NULL,
  replay               TEXT    NOT NULL,                  -- {"v":1,"s":"B","a":[...]} (§2.4)
  starting_seat        TEXT    NOT NULL CHECK (starting_seat IN ('A','B')),
  first_advantage_seat TEXT    CHECK (first_advantage_seat IN ('A','B')),
  first_advantage_by   TEXT    CHECK (first_advantage_by IN ('placementJare','noJareFallback')),
  winner_seat          TEXT    CHECK (winner_seat IN ('A','B')),
  end_reason           TEXT    NOT NULL CHECK (end_reason IN ('opponentBelowThree','opponentCapturedAll',
                         'resignation','drawTermination','bothBlocked','forcedJareSpaceMaking')),
  online_end_reason    TEXT    CHECK (online_end_reason IN ('abandoned','idle')),
  action_count         INTEGER NOT NULL CHECK (action_count >= 1),
  stats_v              INTEGER,
  stats_status         TEXT    NOT NULL DEFAULT 'none' CHECK (stats_status IN ('none','ok','error')),
  stats_json           TEXT,
  payload_hash         TEXT    NOT NULL,                  -- §2.2
  started_at           INTEGER NOT NULL,                  -- play began (P1)
  ended_at             INTEGER NOT NULL,
  saved_at             INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  UNIQUE (room_code, room_created_at, match_number),
  CHECK (ended_at >= started_at),
  CHECK ((rated = 1) = (consent_policy_v IS NOT NULL)),
  CHECK (mode = 'invite' OR rated = 1),                   -- quick is always rated (F1)
  CHECK ((first_advantage_seat IS NULL) = (first_advantage_by IS NULL)),
  CHECK ((winner_seat IS NULL) = (end_reason IN ('drawTermination','bothBlocked','forcedJareSpaceMaking'))),
  CHECK (online_end_reason IS NULL OR end_reason = 'resignation'),
  CHECK ((stats_status = 'ok') = (stats_json IS NOT NULL)),
  CHECK (stats_status = 'none' OR stats_v IS NOT NULL)
);

CREATE TABLE match_player (
  match_id    TEXT    NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  seat        TEXT    NOT NULL CHECK (seat IN ('A','B')),
  user_id     TEXT    NOT NULL,                           -- private; no FK to user (deletion-safe)
  result      TEXT    NOT NULL CHECK (result IN ('win','loss','draw')),
  pieces_left INTEGER NOT NULL CHECK (pieces_left BETWEEN 0 AND 12),  -- on the board at game over
  captured    INTEGER NOT NULL CHECK (captured BETWEEN 0 AND 12),
  ended_at    INTEGER NOT NULL,                           -- denormalised for the owner index
  PRIMARY KEY (match_id, seat),
  UNIQUE (match_id, user_id)                              -- never the same account twice
);

CREATE INDEX match_player_owner_idx ON match_player (user_id, ended_at DESC, match_id DESC);
CREATE INDEX match_rated_ended_idx  ON match (rated, ended_at);

CREATE TABLE match_ops_audit (           -- append-only: the command only inserts
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  at              INTEGER NOT NULL,
  actor           TEXT    NOT NULL,      -- git user.name + `wrangler whoami` account id; one operator
  command         TEXT    NOT NULL CHECK (command IN ('retry','discard')),
  phase           TEXT    NOT NULL CHECK (phase IN ('requested','done','failed')),
  room_code       TEXT    NOT NULL,      room_created_at INTEGER NOT NULL,
  match_number    INTEGER NOT NULL CHECK (match_number >= 1),
  match_id        TEXT    NOT NULL,      payload_hash    TEXT    NOT NULL,
  entry_status    TEXT    NOT NULL CHECK (entry_status IN ('pending','retriesExhausted','integrity','replayMismatch')),
  reason          TEXT,                  -- required for discard
  detail          TEXT,                  -- outcome or error text
  CHECK (command = 'retry' OR reason IS NOT NULL)
);
CREATE INDEX match_ops_audit_match_idx ON match_ops_audit (match_id, id);
