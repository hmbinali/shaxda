# Shaxda V2 — Canonical Contracts

| Field     | Value                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| Status    | `revised` — freezes with the specs (see [README](README.md))                              |
| Source    | `docs/specs-revision-plan.md` §4, refined by the proofs in §12 and the notes in §13       |
| Register  | F, P, and Q IDs are defined in [README](README.md#decision-register)                      |
| Consumers | Every V2 spec. Specs link here and never restate competing SQL, enums, or message shapes. |

A spec may add detail that does not contradict this file (copy, tests,
slices). A change after the freeze is a contract-change commit that edits
this file, the register, and every consuming spec together.

---

## 1. Vocabulary

| Term              | Meaning                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room instance     | One Durable Object lifetime for a room code, identified by `(room_code, room_created_at)`. Codes are reused after cleanup; instances are not.               |
| Match number      | `matchNumber` inside a room instance: 1 for the first game, +1 per started rematch.                                                                         |
| Mode              | How the room was formed: `invite` or `quick`.                                                                                                               |
| Rated request     | The room's request for rated play: the creator's choice at `POST /rooms`, or the queue's for `quick`. Stored in room state. Not consent.                    |
| Consent           | One seat's answer for one match: accept or decline, with the disclosure version it saw (§6.3).                                                              |
| Rated (agreed)    | Both seats are complete accounts and both accepted the same current disclosure before play began (P3). Frozen at play began. Stored as `match.rated = 1`.   |
| Friendly          | A saved account game that is not rated. Private to its two players (P2).                                                                                    |
| Play began        | The first accepted non-terminal action: `place`, `removeInitial`, `move`, or `capture` (P1).                                                                |
| Persistable match | Both seats are account seats, play began, and the match reached `gameOver` by an action or a valid claim.                                                   |
| Outbox entry      | The frozen payload of one persistable match waiting for D1, under storage key `outbox:<matchNumber>` (§3.2).                                                |
| Save status       | Room-side state of one match's ledger write: `pending` (in the outbox), `saved` (D1 acknowledged), `stalled` (retained after retries or an integrity stop). |
| Rating status     | `pending` (no `match_rating` row yet) → `processed`, `skipped`, or `held` (§4.2).                                                                           |
| Skip reason       | `friendly`, `pairCap`, or `invalidated`. Nothing else in V2.                                                                                                |
| Public record     | Numbers built from processed rated events only (P8).                                                                                                        |
| Neutral label     | The one Somali label for a pending-deletion or deleted account (draft: `Xubin la tirtiray`). No link, avatar, or old name.                                  |
| Effective RD      | The RD of a stored rating after applying the empty-period growth up to a given `asOf` instant (§7.3). Never written back.                                   |

Retired terms (must not appear in revised specs except in the README change
log): `competition_status`, `aborted`, `competitive` as a status,
`username_snapshot`, `matchSaved`, `replay_json`, `starting_player`,
`first_advantage_how`, `pieces_a`, `captured_a`, `dailyCap`, `lateLedgerEvent`,
"rated by default".

---

## 2. Ledger schema

H1 owns the ledger. R1 adds rating tables beside it and never alters it
(§2.5).

### 2.1 H1 tables

H1's hand-written migration creates exactly this shape. Migration numbers are
assigned at merge (§11).

```sql
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
  pieces_left INTEGER NOT NULL CHECK (pieces_left BETWEEN 0 AND 12),
  captured    INTEGER NOT NULL CHECK (captured BETWEEN 0 AND 12),
  ended_at    INTEGER NOT NULL,                           -- denormalised for the owner index
  PRIMARY KEY (match_id, seat),
  UNIQUE (match_id, user_id)                              -- never the same account twice
);

CREATE INDEX match_player_owner_idx ON match_player (user_id, ended_at DESC, match_id DESC);
CREATE INDEX match_rated_ended_idx  ON match (rated, ended_at);
```

There is no username, avatar, email, or display snapshot anywhere in the
ledger (P5). Readers join the current account row (§5). The game Worker
writes these two tables and nothing else, apart from the P13 counters (§9).

### 2.2 Writer invariants and the payload

At game over the Match Durable Object freezes one `MatchPayload` for the
match and stores it in the outbox entry, so every retry writes identical
values:

```ts
type MatchPayload = {
  id: string; // §2.3
  roomCode: string;
  roomCreatedAt: number;
  matchNumber: number;
  mode: "invite" | "quick";
  rated: 0 | 1;
  consentPolicyV: number | null;
  rulesV: number;
  replayV: 1;
  replay: string; // JSON text of the compact replay
  startingSeat: "A" | "B";
  firstAdvantageSeat: "A" | "B" | null;
  firstAdvantageBy: "placementJare" | "noJareFallback" | null;
  winnerSeat: "A" | "B" | null;
  endReason: GameEndReason;
  onlineEndReason: "abandoned" | "idle" | null;
  actionCount: number;
  statsV: number | null;
  statsStatus: "none" | "ok" | "error";
  statsJson: string | null;
  startedAt: number;
  endedAt: number;
  players: [MatchPlayerPayload, MatchPlayerPayload]; // seat A first
};
type MatchPlayerPayload = {
  seat: "A" | "B";
  userId: string; // from the verified seat identity only
  result: "win" | "loss" | "draw";
  piecesLeft: number;
  captured: number;
};
```

- `payload_hash` is the lowercase hex SHA-256 of the canonical JSON of the
  payload: keys in the order above, `players` ordered A then B, no
  whitespace. `saved_at` and `seq` are not part of it.
- One D1 batch inserts the `match` row and exactly two `match_player` rows
  with distinct account ids and results consistent with `winner_seat` (win /
  loss, or draw for both).
- A retry that meets an existing `(room_code, room_created_at,
match_number)` compares `payload_hash`: equal means the earlier attempt
  committed (success, same `id`); different means an integrity failure —
  the entry becomes `stalled` with reason `integrity` and an alert fires. It
  is never reported as success.
- Nothing from a client message is used: user ids come from the verified
  seat identity, results from the engine state.

### 2.3 Public match id

20 characters from `ROOM_CODE_ALPHABET` (32 symbols, 100 bits) drawn with
`crypto.getRandomValues`. Readers validate with
`^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{20}$` before any query. The id never
encodes the room code or match number.

### 2.4 Compact replay

Frozen when H1 merges.

`{"v":1,"s":"<A|B>","a":[...]}` with codes `P:<point>` place, `X:<point>`
initial removal, `M:<from>><to>` move, `C:<point>` capture, and `R:<seat>`
resignation by that seat (claim-win's synthetic resignation included). The
acting player for every other code is derived from state. H1 owns the pure
encoder/decoder in `packages/game-engine` and the Zod schema in
`packages/shared`.

Size (proof E4, §12): a legal game has at most **1,403 actions** (24
placements + 2 removals + 17 × (79 quiet turns + 1 jare move + 1 capture)),
and its canonical JSON is at most **13,922 bytes**. Validation rejects a log
over 1,403 actions or an encoding over **16,384 bytes**. Typical games are
about 1.4 KB (p50) and 2.8 KB (p95). Both SQLite-backed Durable Object
values and D1 rows allow 2 MB, so the limit is the game, not the store.

### 2.5 R1 extension

R1's migration adds rating tables **beside** the ledger; it never alters
`match` or `match_player`. Keeping per-match rating state in narrow rows is
what makes a correction swap cheap (proof E1, §12): rewriting the wide ledger
rows, which carry the replay, took several seconds and about 1 GiB of
write-ahead log at 10× scale.

```sql
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
-- The migration seeds the singleton row: (1, 0, NULL, NULL, 0, 1, 1, <now>).
CREATE TABLE rating_fence (ok INTEGER NOT NULL CONSTRAINT rating_fence_guard CHECK (ok = 1));  -- §7.2

-- Same shapes, empty outside a correction rebuild (§7.4).
CREATE TABLE match_rating_next        AS SELECT * FROM match_rating        WHERE 0;
CREATE TABLE match_player_rating_next AS SELECT * FROM match_player_rating WHERE 0;
CREATE TABLE player_rating_next       AS SELECT * FROM player_rating       WHERE 0;
```

`player_rating` carries the whole public record (P8): count, W/L/D, streak,
best win streak, five-result form, and peak. R3, R4, and R5 read it and add
no second projection table. A player with no processed event has no row:
"not rated yet", never a fabricated 1500.

---

## 3. Room lifecycle

H1 owns the room lifecycle; R2 and K1 consume it.

### 3.1 States

```txt
init ─► seats filled ─► [rated requested and both seats accounts?]
          ─► consent: each seat accepts or declines (rateConsent) ─┐
first non-terminal action = play began: rated frozen ◄─────────────┘
  ─► playing ─► gameOver
gameOver (persistable) ─► put({ room, log, "outbox:<n>" }) in one storage write ─► broadcast
outbox:<n> ─► D1 batch ─► saved: key deleted, matchStatus.save = saved + matchId
            └─► retry with backoff ─► 72 h since first attempt ─► stalled (retained, listed)
gameOver before play began, or any guest seat ─► no outbox, no row
rematch ─► both vote accept ─► new matchNumber, new log, alternated starting seat;
           earlier outbox entries are untouched
```

### 3.2 Storage and alarms

- Keys: `room`; `log` (current match, written with `room` in one `put`);
  `outbox:<matchNumber>` holding `{ payload, payloadHash, status, attempts,
firstAttemptAt, nextAttemptAt, lastError, stalledReason }`.
- The terminal action or claim writes the final `room`, `log`, and the new
  outbox entry in one `ctx.storage.put({...})` **before** broadcasting. A
  crash after the put and before the broadcast loses nothing: clients
  reconnect to the stored state and the alarm drives the save.
- Retry schedule after the first attempt: 5 s, 30 s, 2 min, 10 min, 30 min,
  then hourly; after 72 h since the first attempt the entry becomes
  `stalled` with reason `retriesExhausted` (P17). `stalledReason` is one of
  `retriesExhausted`, `integrity` (§2.2), or `replayMismatch` (§3.4).
- A missing D1 binding is an ordinary retryable failure, so fixing the
  deployment inside the window recovers without an operator.
- The alarm is set to the earliest of: the existing idle/claim deadlines and
  the earliest `nextAttemptAt` among pending entries. A stalled entry has no
  deadline; it never re-arms the alarm, so there is no past-due loop.
- `ctx.acceptWebSocket`, alarms, no `setInterval`, and no lifecycle
  `setTimeout` remain mandatory (`pnpm check:hibernation`).

### 3.3 Cleanup, codes, and limits

- Idle expiry (60 minutes without activity) with an empty outbox behaves as
  today: close sockets, release the code, `deleteAll()`.
- Idle expiry with a non-empty outbox closes sockets but **keeps storage and
  the coordinator reservation**. `initializeRoom` already refuses a code
  whose storage exists (409), so the code cannot be reused. The room tells
  the coordinator `holdsUnsaved: true`; the coordinator's 70-minute TTL skips
  such reservations and lists them for operations. When the last entry is
  saved or discarded, the deferred cleanup runs and the flag clears.
- At most **3** unsaved entries (pending or stalled) per room. A rematch
  that would start a fourth is refused with error `savingEarlierGames` and a
  Somali message. Play elsewhere is unaffected.
- Operators list and act through `pnpm match:ops -- list-unsaved | retry |
discard --database <env>`, which calls an internal game-Worker route guarded
  by a Worker secret. `discard` requires a reason, and the CLI appends an
  audit row through Wrangler; nothing is discarded by a timer (P17). H1 owns
  the details.

### 3.4 Game rules inside the room

- Starting seat: random for a room's first game (`crypto.getRandomValues`),
  alternating on every rematch, for every room including guests. `/local`
  keeps its own rule. The client never assumes seat A starts.
- The transport accepts a player's own off-turn `resign` (the engine already
  does); every other action keeps the acting-player check.
- Claim-win appends the synthetic `R:<absent or idle seat>` and records the
  online end reason (`abandoned` or `idle`).
- Replay validation runs before the outbox entry is created: decode →
  replay → final state equals the room's state (compared as `serialize()`
  strings). A mismatch creates the entry as `stalled: replayMismatch`, keeps
  the log, logs `matchReplayMismatch` without user ids, and never writes D1.
- Statistics are derived after replay validation (H4). A derivation error
  stores `stats_status = 'error'`, `stats_json = NULL`; the save goes ahead
  (P21).
- Optional `matchNumber` on `gameAction`, `claimWin`, and `rematch` must
  equal the room's current match number, else error `staleMatch` (P6).

---

## 4. Result and rating policy

### 4.1 Which endings write a row

| Ending                                       | Before play began | After play began                                     |
| -------------------------------------------- | ----------------- | ---------------------------------------------------- |
| Engine win / draw                            | impossible        | row; engine result                                   |
| Manual resign (any phase, including capture) | no row            | row; resigner loses                                  |
| Abandon/idle claim (any phase)               | no row            | row; absent/idle seat loses; `online_end_reason` set |
| Room cleaned up without `gameOver`           | no row            | no row (never an invented result)                    |
| Any seat is a guest                          | no row            | no row                                               |

### 4.2 Rating decision

The processor decides each row once, in `seq` order (P4):

1. **Validate** structure: two seats with distinct account ids, results
   consistent with `winner_seat`, `mode`/`rated`/`consent_policy_v`
   consistent, supported `replay_v` and `rules_v`. A failure marks the row
   `held` and alerts. A held row has no rating effect and **never blocks**
   later rows; resolving it is an R6 correction (§7.4).
2. `rated = 0` → `skipped:friendly`.
3. An R6 invalidation exists for the match → `skipped:invalidated`.
4. Pair cap (P7): count this unordered pair's earlier-`seq` **processed**
   events whose `ended_at` is in `(candidate.ended_at − 24 h,
candidate.ended_at]`; if the count is already 3 → `skipped:pairCap`. A
   skipped event never consumes a slot.
5. Otherwise `processed`: both seats update simultaneously from their
   pre-event states.

Each decision is one `match_rating` row: `rating_policy_v = 1` on every
row, `rating_algorithm_v = 1` on processed rows. A later policy or algorithm
change is a new version plus a full rebuild, never an in-place
reinterpretation.

### 4.3 Canonical sample matches

Every spec that shows, counts, rates, replays, or deletes a match must give
these answers. The README walkthrough table records that they do.

| ID  | Setup                                           | Ending                                  | Ledger                                  | Who can open it           | Rating                              |
| --- | ----------------------------------------------- | --------------------------------------- | --------------------------------------- | ------------------------- | ----------------------------------- |
| M1  | A, B accounts; friendly                         | A wins by pieces                        | row, `rated = 0`                        | A and B only              | `skipped:friendly`                  |
| M2  | Rated agreed                                    | B resigns in placement after 3 actions  | row, B loss                             | public                    | `processed`                         |
| M3  | Rated agreed                                    | Idle claim while A owes a capture       | row, `end_reason = resignation`, `idle` | public                    | `processed`, A loses                |
| M4  | Same pair, 4th rated game in 24 h               | Normal win                              | row                                     | public, "not counted"     | `skipped:pairCap`                   |
| M5  | Rated agreed                                    | Draw: 80 movement turns without capture | row, draw, `drawTermination`            | public                    | `processed`                         |
| M6  | Guest vs account                                | Any                                     | none                                    | —                         | —                                   |
| M7  | Rated agreed                                    | Creator resigns before any action       | none (pre-play cancel)                  | —                         | —                                   |
| M8  | Rated agreed, later invalidated by the operator | A wins                                  | row unchanged                           | public, "rating removed"  | `skipped:invalidated` after rebuild |
| M9  | Rated room; one player votes a friendly rematch | Rematch played                          | rematch row, `rated = 0`                | A and B only              | `skipped:friendly`                  |
| M10 | B requests deletion after M2, then finalizes    | —                                       | M2 unchanged                            | public; B = neutral label | A's and B's M2 events unchanged     |

---

## 5. Access matrix

Every loader and data path, not just pages. Unauthorized access to a private
match is indistinguishable from an unknown id; tests request each data path
with a guessed id, signed out and as an unrelated account.

| Surface                                                         | Signed out / unrelated     | Participant                              | Notes                                                                                                      |
| --------------------------------------------------------------- | -------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/match/<id>`, its replay data, stats, rating status — rated    | full                       | full                                     | Public OG with current names and result. Indexable.                                                        |
| `/match/<id>`, its replay data, stats, rating status — friendly | same 404 as an unknown id  | full                                     | `no-store`, `noindex`, generic non-identifying OG, never in a sitemap or the PWA cache.                    |
| `/history`                                                      | redirect to login          | own saved games, all labelled            | `no-store`, `noindex`. Owner key from the session only.                                                    |
| `/u/<username>` numbers (rating, rank, W/L/D, form, stats)      | public record (P8)         | same                                     | The owner additionally sees a `/history` link.                                                             |
| `/u/<username>` match list                                      | rated matches only         | same; friendly games stay in `/history`  | Pending, cap-skipped, and invalidated rated matches are listed with their label and excluded from numbers. |
| Head-to-head card                                               | hidden                     | viewer vs target, all shared saved games | Private, `no-store`.                                                                                       |
| `/leaderboard`                                                  | public list, edge-cached   | + private rank context (`no-store`)      | Page HTML must be session-independent before shared caching.                                               |
| Pending/deleted account                                         | neutral label; profile 404 | neutral label                            | Excluded from leaderboard and public profile reads.                                                        |

Participants are the two `match_player.user_id` values, compared on the
server with the session's user id. No loader returns a user id, email, room
code, provider identity, ticket, or raw replay/stats JSON except the
validated replay that H3 needs.

---

## 6. Protocol additions

All additive to protocol `v: 1`.

### 6.1 HTTP

- `POST /rooms` accepts optional `options: { ratedRequest?: boolean }`
  (default `false`, F1). `mode: "quick"` exists only on the internal queue
  path (§6.4); the public route rejects it.

### 6.2 Server to client

- `matchStatus` gains optional fields: `mode`, `ratedRequest`, `consent: { A:
boolean | null, B: boolean | null }`, `rated: boolean | null` (null until
  play begins), and `save: { matchNumber, status: "pending" | "saved" |
"stalled", matchId? }` for the most recently completed persistable match.
  `save` is required behaviour in H1; it replaces the proposed `matchSaved`
  message, which would crash cached clients (a new server message **type**
  fails `serverMessageSchema.parse`; an unknown **key** is stripped).
- `rematchStatus` gains optional `ratedVotes: { A: boolean | null, B:
boolean | null }`.
- Errors reuse the existing `error { code, message }` frame. New codes:
  `staleMatch`, `consentClosed`, `consentUnavailable`, `disclosureOutdated`,
  `savingEarlierGames`, `ratedOnlyRematch`, `ratedPlayDisabled`.

### 6.3 Client to server

- New `rateConsent { roomCode, matchNumber, accept: boolean, disclosureV:
number }`. Valid only while the room requests rated play, both seats are
  complete accounts, and play has not begun (else `consentUnavailable` or
  `consentClosed`). `disclosureV` must equal the server's current
  `RATED_DISCLOSURE_V` (else `disclosureOutdated`; the client asks for a
  reload). The accepted version becomes `consent_policy_v`.
- `rematch` gains optional `rated: boolean` and `disclosureV: number`. A
  rematch is rated only when both accept votes carry `rated: true` with the
  current disclosure version; each such vote is that player's consent for
  the new match. In a `quick` room every accept vote must be a rated vote
  (else `ratedOnlyRematch`).
- Optional `matchNumber` on `gameAction`, `claimWin`, and `rematch` (P6).
- Only new clients send any of this. Old cached clients cannot consent, so
  their games stay friendly.

### 6.4 Quick-match queue

K1 owns the queue protocol.

The queue uses its own WebSocket and schema family: `joinQueue {
identityTicket, disclosureV }` as the first frame (entering is consent,
P3), `cancelQueue`, `queueStatus`, `matched`, `queueError`. Tickets never
appear in URLs. The queue creates quick rooms through an internal
coordinator path with `ratedRequest = true` and both seats' consent
recorded from their `joinQueue`.

### 6.5 Deploy order

Migration → game Worker → web Worker, for every change. A cached client
never gains rated play by accident, and a new client never sends a message
the deployed game Worker cannot parse.

---

## 7. Rating processor

R1 owns the processor.

### 7.1 Triggers and lease

- One processor, in the web Worker. Triggers: a best-effort hint from the
  game Worker after each successful save, through a service binding to a
  named `WorkerEntrypoint` exported by the web Worker (§10.2); and the
  minute cron sweep. A failed hint changes nothing; the sweep catches up.
- The processor takes the lease with one compare-and-set statement:
  `UPDATE rating_processor_state SET lease_token = ?new, lease_expires_at =
?now + 60000 WHERE id = 1 AND maintenance = 0 AND (lease_token IS NULL OR
lease_expires_at <= ?now)`, succeeding only when `meta.changes = 1`. A
  loser exits.
- It then decides the ledger rows after the cursor (`seq > cursor_seq`, the
  pending ones) in `seq` order, at most 25 per invocation, one event batch
  per row. Readers never see a half-applied event.

### 7.2 The fence

Every event batch starts with the fence and ends by deleting it:

```sql
INSERT INTO rating_fence (ok) VALUES (
  (SELECT lease_token = ?1 AND lease_expires_at > ?2 AND cursor_seq = ?3 AND maintenance = 0
     FROM rating_processor_state WHERE id = 1));
-- … INSERT the match_rating row; for processed: both match_player_rating rows
--    and both player_rating rows; UPDATE rating_processor_state SET cursor_seq = <this seq> …
DELETE FROM rating_fence;
```

`ok` is `NOT NULL CONSTRAINT rating_fence_guard CHECK (ok = 1)`: a false guard
fails the `CHECK`; a missing state row, a `NULL` column, or a `NULL` bound
value makes the scalar subquery `NULL` and fails `NOT NULL`. Either failure
aborts the whole batch, wherever the fence sits in it. Classify an abort by
the constraint names `rating_fence_guard` or `rating_fence.ok`, never by the
full message text.

Proof E1 (§12) showed why this form: the plain `INSERT … SELECT … FROM
rating_processor_state` form aborted stale, expired, and wrong-cursor batches
but **passed** — applying the writes — when the state row was missing or a
token, expiry, or bound value was `NULL`, because SQLite `CHECK` constraints
pass on `NULL`. Zero-row conditional updates alone are not a guard either.

### 7.3 Arithmetic and reads

- `packages/rating` is pure: Glicko-2 per the author's 2022 paper, one match
  as one rating period, simultaneous updates from both pre-event states,
  full-precision doubles, defaults P18.
- Inactivity: before an event, apply `n = max(0, floor((ended_at −
last_rated_at) / 86 400 000))` empty periods in closed form (`φ =
min(350/173.7178, sqrt(φ² + nσ²))`). Late events therefore apply none.
- Effective RD at `asOf` uses the same function without a write. Provisional
  means effective RD > 110. Leaderboard, profile, and rank reads capture one
  `asOf` per response.
- `eligible_until` is written in the same event batch: the earlier of
  `last_rated_at + 90 days` and the first day boundary at which effective RD
  exceeds 110 (equal to `last_rated_at` when the post-event RD already
  exceeds 110). P19 eligibility at `asOf` is then `eligible_until > asOf AND
rated_games >= 10 AND excluded = 0` plus a current, non-deleted username —
  no per-row inactivity arithmetic in the leaderboard query.
- The first processed event creates the row from 1500/350/0.06 and assigns
  `board_key = (SELECT COALESCE(MAX(board_key), 0) + 1 FROM player_rating)`
  in the same batch, so a rebuild in `seq` order reproduces it.

### 7.4 Corrections

Used for R6 invalidation or rescission and for a policy or algorithm change.

1. Set `maintenance = 1` with the operator's lease; the processor stops.
2. Rebuild from the ledger in `seq` order into the `*_next` tables in bounded
   chunks with a resumable cursor, up to a recorded high-water `seq`.
3. Run the verification diff (dry run shows exactly what changes).
4. Swap in **one** batch: fence (operator token, `maintenance = 1`); for
   each of `match_rating`, `match_player_rating`, and `player_rating`,
   `DELETE FROM t` then `INSERT INTO t SELECT * FROM t_next`; set
   `cursor_seq` to the high-water mark; clear `maintenance`; delete the
   fence.
5. Empty the `*_next` tables. Rows above the high-water mark are then
   processed normally.

Readers during maintenance show the last published state with a "ratings
updating" note. Proof E1 sized the swap on narrow rows: about 0.16 s at
25,000 matches and about 2 s at 250,000 locally, atomic in both, well inside
D1's documented 30-second limit for a batch. The whole database waits for the
swap, and one swap at 1× writes about 125,000 rows, so corrections are rare,
deliberate operations. **Scale trigger:** if a preview rehearsal at 10×
projected data approaches the 30-second batch limit, move to generation-keyed
tables with an active-generation pointer.

### 7.5 Exclusion projection

`player_rating.excluded` projects R6-core's `rating_account_exclusion`
table, which is the audited source. R6's commands update both in one batch;
a new `player_rating` row and every rebuild read the source table, so an
exclusion survives a rebuild that removes an account's last event.

The game Worker never reads or computes ratings.

---

## 8. Deletion

A3 owns deletion; every reader obeys it.

- States on `user`: active → pending (`deletion_requested_at`,
  `deletion_due_at`) → final (`deleted_at`, scrubbed tombstone).
- Pending: the web Worker stops minting identity tickets at once (P11);
  profile 404; neutral label everywhere; excluded from the leaderboard and
  every public read; only cancel, status, and logout work for the owner. A
  game already open may finish; rooms expire after 60 idle minutes, far
  inside the seven-day grace.
- Final: sessions, provider accounts, and attributable verification rows are
  removed; username claims are held 30 days (F5), then released. Ledger rows
  and rating events are untouched (M10). Because of P5 there is nothing in
  the ledger to scrub.
- A restored backup reapplies deletion records before serving. A reclaimed
  username never inherits old match links: links resolve by stable id.
- Analytics: the account's pseudonymous rows age out under P12; aggregates
  remain.

---

## 9. Metrics dictionary

X1 owns these definitions.

| Name                                          | Definition                                                                                                                               | Source                     | Exactness                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------- |
| Active browsers (day / 7 d / 30 d)            | Distinct keyed hashes of the guest id that sent the daily beacon                                                                         | Client beacon              | Approximate; not people                 |
| Active accounts (day / 7 d / 30 d)            | Distinct keyed hashes of the account id that sent the beacon while signed in                                                             | Client beacon              | Approximate; not additive with browsers |
| Registrations                                 | Accounts whose first `username_claim.claimed_at` falls on the day                                                                        | D1, nightly rollup         | Exact                                   |
| Online games created/joined/started/completed | By mode and guest/account                                                                                                                | Game Worker counters (P13) | Near-exact (best-effort write)          |
| Local games started/completed                 | First action / game over on `/local`                                                                                                     | Client beacon              | Approximate; offline lost               |
| Saved account games                           | Ledger rows by `ended_at` day, rated/friendly                                                                                            | D1                         | Exact                                   |
| **Weekly returning players** (primary)        | Accounts with ≥1 saved game in ISO week w that also have ≥1 in week w+1, over accounts with ≥1 in week w                                 | Ledger                     | Exact                                   |
| D7 / D30 return                               | Of accounts whose first saved game is on day d, the share with a saved game on day d+7 (d+30) exactly; "within 7 days" is a separate row | Ledger                     | Exact; immature until d+7/d+30          |
| Quick-match funnel                            | Joins, pairs, starts, completions, no-shows, wait histogram                                                                              | Queue DO counters (P13)    | Near-exact                              |

The P13 allowlist is a fixed enum in `packages/shared`: `online_room_created_{guest,account}`,
`online_room_joined_{guest,account}`, `online_started_{invite,quick}_{guest,account}`,
`online_completed_{invite,quick}_{guest,account}`, and the K1 `queue_*` names
(`queue_joined`, `queue_paired`, `queue_started`, `queue_completed`,
`queue_no_show`, `queue_wait_<bucket>`). "account" means both seats are
accounts. The game Worker upserts `event_daily` with `count = count + 1`
after broadcasting; a failed write is logged and dropped, never retried into
the game path.

Removed claims: "guest → account conversion", "exact DAU/MAU of people",
"no PII because hashed". Every admin view shows raw counts beside
percentages, the instrumentation start date, freshness, and cohort maturity.

---

## 10. Scheduled work and environments

### 10.1 One cron, one dispatcher

One web-Worker cron trigger, `* * * * *`, with a dispatcher: the rating sweep
every minute (R1); at 00:15 UTC the X1 rollup and prune, A3 finalization,
and the S2 rollup; later the R6 detectors nightly. Each non-rating job takes
a named lease in `job_state` with the same fence pattern (`job_fence`) and
resumes from a cursor, so a missed or duplicate run is harmless.

### 10.2 Web Worker entry wrapper

The SvelteKit Cloudflare adapter (7.2.9) writes its generated worker to
Wrangler's `main` and deletes whatever was there, and has no option for extra
handlers (proof E3). So `main` stays `.svelte-kit/cloudflare/_worker.js`, and
a build step after `vite build`:

1. renames the adapter's `_worker.js` to `_kit_worker.js` in the same
   directory (its relative imports stay valid);
2. writes a generated `_worker.js` that exports `fetch` (delegating
   unchanged), `scheduled` (the dispatcher), and named `WorkerEntrypoint`
   classes such as `RatingsEntrypoint`;
3. appends `_kit_worker.js` to `.assetsignore` **with a leading newline**
   (the adapter's file has none) and checks that neither worker file is
   served.

Job code runs either as pure package code imported by the wrapper or as an
internal SvelteKit request: `kit.fetch(new Request(<AUTH_BASE_URL origin> +
path, { headers: { "cache-control": "no-cache" } }), { ...env,
SHAXDA_INTERNAL_CALL: <job> }, ctx)`. Internal routes require that env
marker, which no internet request can carry. X1a lands the wrapper; later
milestones add jobs and entrypoints to it.

### 10.3 Bindings, flags, and rollout by milestone

| Milestone | New bindings (dev / e2e / preview / production)                                                                                    | Jobs                            | Kill switch                                                             | Rollout                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| H1        | Game Worker `DB` → the same D1 as the web Worker in each environment; e2e shares one local D1 (§10.4)                              | —                               | none: saving is not optional                                            | migration → game → web |
| X1a       | Web: `ANALYTICS_SALT` and `ADMIN_USER_IDS` secrets, `ANALYTICS_RATE_LIMIT` rate-limit binding, the wrapper entry, `* * * * *` cron | rollup + prune 00:15            | web var `ANALYTICS_ENABLED`                                             | migration → web        |
| X1b       | Game Worker writes P13 counters through its `DB` binding                                                                           | —                               | game var `ANALYTICS_ENABLED`                                            | game                   |
| R2 + R1   | Game Worker service binding `RATINGS` → web `RatingsEntrypoint`                                                                    | rating sweep every minute       | game var `RATED_PLAY_ENABLED` (refuse consent); processor `maintenance` | migration → game → web |
| R6-core   | none (operator CLI through Wrangler D1 access)                                                                                     | —                               | —                                                                       | migration → CLI        |
| A3        | none                                                                                                                               | finalize + release claims 00:15 | —                                                                       | migration → web        |
| K1        | Game Worker `MATCH_QUEUE` DO (SQLite class migration), production route `/queue/*`                                                 | queue alarms only               | game + web var `QUICK_MATCH_ENABLED`                                    | migration → game → web |
| S1 + S2   | Web: R2 bucket `SPONSOR_ASSETS` per environment, `SPONSOR_RATE_LIMIT`                                                              | S2 rollup 00:15                 | web var `SPONSORS_ENABLED`                                              | migration → web        |

Kill switches are independent Worker variables changed by a configuration
deploy. Local and guest play survive all of them. Environments are: dev
(local `wrangler dev` / `vite dev`, Miniflare D1), e2e (tracked e2e configs,
§10.4), preview (`*-preview` Workers, `shaxda-db-preview`), and production.

### 10.4 Shared local D1 in e2e

The game Worker's `wrangler dev --persist-to X` and the web preview's
`getPlatformProxy({ persist: { path: "X/v3" } })` share one SQLite file when
both configs use the same `database_id` (`local-e2e-database`). Playwright
starts the servers one after another (game, then web) and each launcher
deletes its own state directory, so the shared directory gets **one owner**:
the game launcher cleans it and applies the migrations before starting; the
web launcher and the account-seeding fixture only use it. Tests that read the
ledger wait for `matchStatus.save.status = "saved"` first. `pnpm
check:e2e-isolation` keeps passing because both Workers run with explicit
env files.

---

## 11. Migration ownership

Numbers are assigned at merge, never reserved in a spec. Owners: H1 ledger;
X1 analytics (`active_*` tables, `event_daily`, `job_state`, `job_fence`);
R1 rating columns and tables; R6 corrections, exclusions, flags, and audit;
A3 user deletion columns; S1 sponsor; S2 sponsor stats. Each milestone adds
the indexes its reads need in the same migration and records `EXPLAIN QUERY
PLAN` evidence.

---

## 12. Evidence

Proofs run on 2026-09-29 against the repository at the revision commits,
locally only: wrangler 4.107.0, miniflare 4.20260701.0, workerd
1.20260701.1, `@sveltejs/adapter-cloudflare` 7.2.9, `@sveltejs/kit` 2.69.1,
Node 24.20.0. Code lived in a scratch directory and is not committed.

### E1 — D1 fence and swap

Result: **pass** for the hardened fence and for a single-batch swap on narrow
rows; it changed two contracts (§7.2 fence form, §2.5 narrow rating tables).
Run in Miniflare D1 from a Node script.

| Check                                                              | Plain `INSERT … SELECT` fence      | Hardened fence (§7.2)               |
| ------------------------------------------------------------------ | ---------------------------------- | ----------------------------------- |
| Valid token, unexpired lease, matching cursor                      | commits                            | commits                             |
| Stale token / expired lease / wrong cursor                         | aborts, 0 rows changed             | aborts, 0 rows changed              |
| Fence placed last after three writes, false guard                  | aborts, earlier writes rolled back | aborts, earlier writes rolled back  |
| State row missing; `NULL` token; `NULL` expiry; `NULL` bound token | **commits (writes applied)**       | aborts (`NOT NULL`), 0 rows changed |
| Writer 2 retries with a cursor writer 1 already advanced           | aborts                             | aborts                              |
| Two identical batches race for one cursor                          | exactly one commits                | exactly one commits                 |
| Zero-row conditional `UPDATE` as the only guard                    | commits: **not a guard**           | —                                   |

| Swap (one batch; a false fence as the last statement leaves everything unchanged) | Matches / seats / players  | Median time (local)   |
| --------------------------------------------------------------------------------- | -------------------------- | --------------------- |
| Narrow rows (the §2.5 design)                                                     | 25,000 / 50,000 / 5,000    | 157 ms                |
| Narrow rows                                                                       | 250,000 / 500,000 / 50,000 | 1,975 ms              |
| Rating columns on `match` rows carrying a 1 KiB replay                            | 250,000 / 500,000 / 50,000 | 3,572 ms              |
| Rating columns on `match` rows carrying a 2 KiB replay                            | 250,000 / 500,000 / 50,000 | 6,863 ms, ≈ 1 GiB WAL |

Production context ([D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
fetched 2026-09-29): 30 seconds per query, and the same for a whole batch
call; 100 bound parameters per query; 100,000-byte statements;
2,000,000-byte rows; 10 GB per database on the paid plan (500 MB free).
Miniflare enforced the parameter, statement-length, and column limits but not
the duration, per-invocation, or size limits, so local timings are a lower
bound and production commit cost on replicated storage is unknown until a
preview rehearsal. D1 serialises queries, so every other query waits for a
swap.

### E2 — shared local D1 in e2e

Result: **pass**.

| Check                                                                                          | Result                           |
| ---------------------------------------------------------------------------------------------- | -------------------------------- |
| Game stand-in (`wrangler dev --persist-to X`) opens the file the web launcher migrated         | pass (sees the `user` table)     |
| Web stand-in (`getPlatformProxy`, `persist.path = X/v3`) reads the game's row, and the reverse | pass                             |
| 200 concurrent writes from each process                                                        | 0 errors, 2,170 ms, totals exact |
| Game config with a `DB` binding and a hostile `.dev.vars` (`DB=…`), run with `--env-file`      | nothing leaks; `DB` not shadowed |
| Control without the env file                                                                   | `.dev.vars` would shadow `DB`    |
| `pnpm check:e2e-isolation` on the unchanged repository                                         | pass                             |

Constraints for H1's harness change are in §10.4. The repository already
records `SQLITE_BUSY` when a separate `wrangler d1 execute` seeding process
races the preview Worker (`playwright.config.ts`); none occurred here, and
seeding keeps its retry.

### E3 — scheduled handler beside the adapter's fetch

Result: **pass** with the §10.2 wrapper.

| Check                                                                                   | Result                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Adapter writes its worker to `main`, deleting the previous file                         | confirmed in the adapter source: a hand-written wrapper as `main` would be deleted on every build                   |
| Production-mode build, then rename + generated wrapper                                  | pass                                                                                                                |
| `pnpm check:bundle` on the wrapped output                                               | pass                                                                                                                |
| `wrangler dev --test-scheduled`, crons `* * * * *` and `15 0 * * *`                     | handler ran, wrote D1 rows                                                                                          |
| Scheduled handler → internal SvelteKit request with the env marker                      | `/api/online/identity` → 200 `{"status":"signedOut"}`                                                               |
| `/`, `/login`, `/register`; `/account` signed out; `/api/auth/get-session`; `/u/nobody` | 200; 303; 200 `null`; 404                                                                                           |
| `/_worker.js`, `/_kit_worker.js`                                                        | 404 (not served)                                                                                                    |
| Separate process calls the wrapper's `WorkerEntrypoint` over a service binding          | `{"ok":true,"n":7}`, row written in the web Worker's D1                                                             |
| Naive `.assetsignore` append                                                            | **fails**: produced `_redirects_kit_worker.js`, which would publish the server bundle; fixed by the leading newline |

### E4 — longest game and storage limits

Result: **pass**; the numbers now fix H1's size rule and H3's frame
strategy.

| Question                             | Result                                                                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine facts used                    | 12 pieces each; 24 placements; 2 initial removals; draw at 80 quiet turns; a jare move enters capture without a clock tick; a capture resets clock and repetition; threefold repetition draws; game ends when a side has fewer than 3 pieces |
| Maximum captures                     | 17 (8 per side without ending, plus the final one); at most 9 by one seat                                                                                                                                                                    |
| Longest legal game (analytic bound)  | 1,403 actions; canonical compact JSON 13,922 bytes (14,051 if every code were a move)                                                                                                                                                        |
| Longest generated game               | exactly 1,403 actions and 13,922 bytes, replayed through the real engine and decoded from its JSON; 97.4 % of 2,135 searches reached the bound                                                                                               |
| 10,000 random playouts (fuzz policy) | p50 152 / p95 286 / p99 353 / max 503 actions; 1.4 / 2.8 / 3.4 / 4.9 KB                                                                                                                                                                      |
| All 1,404 frames of the longest game | ≈ 1.07 MB V8 heap (≈ 762 B per frame); ≈ 6.7 MB if frames lose shared shapes after a JSON round trip; built in ≈ 14 ms (Node 24, Apple Silicon)                                                                                              |
| SQLite-backed Durable Object storage | key and value combined ≤ 2 MB; string/BLOB/row ≤ 2 MB; 10 GB per object ([limits](https://developers.cloudflare.com/durable-objects/platform/limits/), fetched 2026-09-29)                                                                   |
| "128 KiB"                            | the value limit of the older key-value storage backend only; it does not apply to Shaxda's SQLite-backed objects                                                                                                                             |
| D1                                   | string/BLOB/row ≤ 2,000,000 bytes; SQL statement ≤ 100 KB ([limits](https://developers.cloudflare.com/d1/platform/limits/), fetched 2026-09-29)                                                                                              |

Consequences: H1 validates `actionCount ≤ 1,403` and the encoded replay ≤
16,384 bytes; H3 keeps every frame in memory, rebuilt from the compact
replay and never serialized. The fuzz test's 1,200-action cap is below the
legal maximum and must not be reused as a validation limit. The analysis
also shows that two engine end reasons cannot occur in legal play (both
players blocked, since two empty points always leave a piece that can move;
and all pieces captured, since the game ends at two). The ledger keeps the
full engine enum; readers must not assume those two ever appear. The
browser figure is a Node approximation; H3's physical-device gate measures
the real phone.

### E5 — small-community rating simulation

Status: pending.

Runs before R1 activation (P18) and R3 activation (P19). Pass: a report of
time to leave provisional, the share of players eligible for the
leaderboard, and farming gain with and without the pair cap, for 20–300
simulated players with sporadic play, one strong player, and a farming pair.
P18 and P19 stand unless the report contradicts them.

### E6 — query plans at 5,000 matches for one account

Status: pending.

Runs before H2, R4, and R5 implementation. Pass: every plan for the history
page, summary, head-to-head, rating window, and public record uses the owner
index or a primary key; rows read are recorded.

---

## 13. Refinements made while writing this file

Each is a clarification of the plan, not a new product decision. They are in
the README change log.

| Area           | Refinement                                                                                                                                   | Why                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Consent        | `rateConsent` carries `disclosureV`; it is the source of `consent_policy_v`.                                                                 | The plan stored a disclosure version but gave the message no field for it.                                         |
| Rematch        | `rematch` carries `rated`; `rematchStatus.ratedVotes`; quick rooms accept only rated rematches.                                              | M9 needs a way to vote a friendly rematch; F1 keeps quick rated.                                                   |
| Fence          | Scalar-subquery form with `NOT NULL` and a named `CHECK (ok = 1)`.                                                                           | The plain `INSERT … SELECT` form applied the writes when the state row was missing or a value was `NULL` (E1).     |
| Rating tables  | Per-match rating state lives in narrow `match_rating` / `match_player_rating` tables; the ledger is never altered; pending means no row yet. | E1: swapping rating columns on wide ledger rows took seconds and ≈ 1 GiB of WAL at 10×; narrow rows swap in ≈ 2 s. |
| Decision order | Validation first (`held`), and a held row never blocks later rows.                                                                           | A malformed row should not be labelled friendly, and one bad row should not stop all ratings.                      |
| Public record  | `player_rating` carries W/L/D, streaks, form, and peak (P8).                                                                                 | One atomic projection for R3–R5 instead of a second table kept in step.                                            |
| Peak           | `peak_rating`/`peak_seq` are NOT NULL because a row exists only after a processed event.                                                     | "Unrated has no peak" (P9) is represented by having no row.                                                        |
| Hint direction | The service-binding hint goes game → web (the plan's §4.10 said "web→web").                                                                  | The save that triggers it happens in the game Worker.                                                              |
| Web entry      | Generated wrapper after the adapter, `main` unchanged (§10.2).                                                                               | The adapter overwrites `main` (E3).                                                                                |
| e2e D1         | One launcher owns cleanup and migrations of the shared directory (§10.4).                                                                    | Playwright starts the servers sequentially and each deletes its own state (E2).                                    |
| Ledger checks  | Draw ⇔ no winner; online reason only with `resignation`; quick ⇒ rated; one account per match.                                               | The ledger must reject contradictory rows at the database, not only in the writer.                                 |

### Ground truth re-check

The plan's §2 facts cite `worker/src`, `packages/shared`, `packages/db`, the
web Wrangler/Svelte configs, and the e2e scripts. `git log` shows no commits
to any of them between the plan commit (`33df8b9`) and this revision;
`worker/src/match-room.ts` and `worker/src/room-coordinator.ts` last changed
on 2026-08-07.
