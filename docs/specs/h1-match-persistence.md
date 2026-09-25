# H1 — Match Persistence Foundation (Spec)

| Field          | Value                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| Status         | Draft, not started                                                                      |
| Brief          | `docs/shaxda-v2.md` §9 (H1), §6.1, §6.5, §7.2, §7.3, §16 (D4, D5, D9)                    |
| Workspace      | `h1-match-persistence`                                                                  |
| Depends on     | V1.1-A2 (live). X1 is independent and may merge before or after.                        |
| Unblocks       | H2, H3, H4, R1–R6, K1, A3 — everything in V2 except X and S                             |
| Touches        | `packages/game-engine`, `packages/shared`, `packages/db`, `worker/`, `web/` (client compat only), Wrangler configs, `AGENTS.md`, PRD |
| Freeze point   | The compact replay format and the `match` / `match_player` shape freeze when this merges (§14 of the brief) |

This spec refines the H1 brief; it does not widen it. Every choice the brief
left open ("decisions to settle in the spec") is answered in §14 with its
rationale. Read `docs/shaxda-v2.md` §1–§9, `docs/shaxda_game.md`, the
`cloudflare-do-hibernation` and `shaxda-rules` skills, and
`docs/online-identity.md` before implementing.

---

## 1. Goal and scope

**Goal.** Every completed **account-vs-account** online game is stored once,
as a server-authoritative ledger row with a replayable compact action log.

### Must

1. The Match Durable Object keeps a compact action log for the current
   `matchNumber`, reset on rematch, including the synthetic `resign` that
   claim-win applies.
2. A versioned compact replay encoder/decoder in `packages/game-engine`
   (`{ v: 1, s, a }`), pure and dependency-free.
3. Room creation options `mode` (`invite`; `quick` reserved for K1) and
   `rated` (default `true`), Zod-validated at `POST /rooms`, stored in room
   state.
4. Fair starting seat: random for the first game of a room, alternating on
   rematch. The client renders turns only from authoritative state.
5. Persistence trigger: `phase` becomes `gameOver` by an action or a claim-win,
   both seats are `account` kind, and at least one player action was applied
   (§5.2). Guest-involved games write nothing.
6. One `match` row and two `match_player` rows in a single D1 batch,
   idempotent on the room instance and `matchNumber`; a retry after any
   failure cannot duplicate.
7. Persist-pending state in room storage with alarm-driven retry and backoff;
   a room is not cleanup-eligible while a persist is pending.
8. Replay validation before every write: decode → replay → equals the room's
   final state, else never persist and keep the room for inspection.
9. D1 binding in the game Worker's dev, preview, and production Wrangler
   configs; migration `000N_matches.sql` with every index.
10. `AGENTS.md`, the PRD, and `docs/shaxda-v2.md` updated for §6.1, §6.5, and
    the two refinements this spec makes (§4.1, §6.2) in the first commit.

### Should

- `matchStatus.savedMatchId` so the result overlay can link to the match page
  in H2 (replaces the brief's `matchSaved` message, see H1-D9).
- `match.stats_json` column present and `NULL`; H4 fills it.
- A worker-source guard in `scripts/check-hibernation.mjs` that fails on any
  reference to the auth tables or to the bare `@shaxda/db` entry point.

### Not in H1

From the brief: any UI, history reads, ratings, guest persistence, statistics
beyond counts, deletion.

Added by this spec:

- A recovery tool for failed persists. H1 logs and retains; R6's admin CLI or
  an H2 ops task can re-drive from the retained room.
- Rated/friendly UI (R2), quick mode (K1), the `rating_*` columns (R1).
- Changing local hot-seat play. `/local` keeps its current starting rule.
- Any read path from the game Worker. It writes two tables and reads back one
  id.

---

## 2. Definitions

| Term                | Definition                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Match               | One logical game inside a room, identified by `matchNumber` (1 for the first game, +1 per accepted rematch).                       |
| Room instance       | One Durable Object lifetime for a room code: `(roomCode, createdAt)`. Room codes are recycled after cleanup; instances are not.     |
| Action log          | The ordered `GameAction[]` applied to the current match, including the synthetic resign from claim-win.                           |
| Compact replay      | The frozen wire/storage form of an action log: `{ v: 1, s: PlayerId, a: string[] }` (§4).                                          |
| Persistable match   | A match whose two seats are both `account` kind and whose log holds at least one player action (§5.2).                            |
| Started at          | Timestamp of the first accepted player action of the match (H1-D3).                                                               |
| Ended at            | Timestamp of the action or claim that moved `phase` to `gameOver`.                                                                |
| Online end reason   | `abandoned` or `idle` when the game ended by claim-win, else `NULL`. Mapped from `opponentAbandoned` / `opponentIdleTimeout`.       |
| Persist state       | Room-storage record of where the ledger write stands: `idle`, `pending`, `saved`, `failed`, `skipped` (§6).                         |

---

## 3. Rule changes applied in the first commit

The brief requires these edits in the first commit of the milestone.

| Document              | Change                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md` §Locked stack | "it must not gain Better Auth, D1, or session-cookie access" → "it may bind D1 for match-ledger writes only (V2 §6.1); it must not gain Better Auth or session-cookie access, and never reads `user`, `account`, `session`, or `verification`." |
| `AGENTS.md` §Accounts / Identity | Same amendment on the "do not add Better Auth, D1, cookies…" line; add "Starting seat is random for a room's first game and alternates on rematch (V2 §6.5)."               |
| `docs/shaxda_prd.md` §16.3 | "D1 is bound only to the SvelteKit web Worker" → "D1 is bound to the web Worker for auth/profile data and to the game Worker for match-ledger writes only."                        |
| `docs/shaxda_prd.md` §15.2 | Add the §6.5 fairness rule and "the client never assumes a seat starts".                                                                                                           |
| `docs/shaxda_prd.md` §17.4 | Point to this spec for the exact columns.                                                                                                                                          |
| `docs/shaxda-v2.md` §7.3 | `R` becomes `R:<seat>` (§4.1 below); note the freeze applies at H1 merge.                                                                                                             |
| `docs/shaxda-v2.md` §7.2 | `match` uniqueness becomes `(room_code, room_created_at, match_number)` (§6.2 below).                                                                                               |
| `docs/shaxda-v2.md` §9  | Link this spec from the H1 heading (§18 of the brief).                                                                                                                                 |

---

## 4. Compact replay format (frozen at merge)

Lives in `packages/game-engine/src/replay.ts`, exported from the engine
index. Pure TypeScript, no Zod (the engine never imports Zod); the Zod schema
for the wire/storage form lives in `packages/shared`.

```ts
export type CompactReplay = {
  v: 1;
  s: PlayerId;            // starting player
  a: readonly string[];   // ordered action codes
};

export function encodeCompactReplay(
  startingPlayer: PlayerId,
  actions: readonly GameAction[],
): CompactReplay;

export type DecodeResult =
  | { ok: true; actions: GameAction[]; state: GameState }
  | { ok: false; error: string; actionIndex: number };

// Decoding is replaying: the acting player for P/X/M/C is read from the
// state reached so far, so decode cannot exist without the reducer.
export function decodeCompactReplay(replay: CompactReplay): DecodeResult;

export type FirstAdvantageOrigin = "placementJare" | "noJareFallback";

export function summarizeReplay(replay: CompactReplay):
  | { ok: true; state: GameState; actionCount: number;
      firstAdvantageBy: FirstAdvantageOrigin | null }
  | { ok: false; error: string; actionIndex: number };
```

### 4.1 Codes

| Code            | Action                    | Player                                      |
| --------------- | ------------------------- | ------------------------------------------- |
| `P:<point>`     | `place`                   | acting player, derived from state           |
| `X:<point>`     | `removeInitial`           | acting player, derived from state           |
| `M:<from>><to>` | `move`                    | acting player, derived from state           |
| `C:<point>`     | `capture`                 | acting player, derived from state           |
| `R:<seat>`      | `resign` by `<seat>`      | **explicit**, see below                     |

Refinement of the brief's `"R"`: the engine accepts a resignation from either
player at any time (`reducer.ts` `applyResign` checks only the phase, and the
shared `early-resignation` fixture has B resigning on A's turn). Claim-win
applies a resign for the *opponent* of the claimant, who may or may not be the
acting player. A bare `R` would therefore be ambiguous, so the seat is stored
for resign only. Every other code still derives its player from state.

Points are the engine's `PointId` values (`O1`…`I8`). Codes are ASCII, no
whitespace. `decodeCompactReplay` rejects unknown prefixes, malformed points,
a non-`1` version, and any code the reducer refuses, returning the failing
`actionIndex`.

Size: 24 placements + 2 removals + a typical movement phase ≈ 1–2 KB as JSON.
The worst case (no-capture clock reset by every one of 22 captures) stays
under ~20 KB, inside D1's text column comfort zone and the Durable Object
128 KiB value limit.

### 4.2 First-advantage origin

`summarizeReplay` derives `firstAdvantageBy` while replaying:

- the first state where `firstAdvantage !== null` was produced by a `place`
  that formed a jare (`completesJare` on that placement) → `placementJare`;
- otherwise `firstAdvantage` was assigned by the end-of-placement fallback →
  `noJareFallback`;
- `null` when the game ended before first advantage was decided (for example
  a resignation during placement).

This keeps "how it was decided" out of `GameState` (no F1 contract change).

### 4.3 Invariant

For every persisted row: `decodeCompactReplay(replay).state` equals the final
state the room broadcast, compared as `serialize()` strings (the serializer
normalises key order). Engine tests assert the round trip on every
`fullGameActionScripts` and `a2ConformanceActionScripts` fixture and on the
fuzz harness's random playouts.

---

## 5. Room behaviour changes (`worker/src/match-room.ts`)

### 5.1 Room state additions

```ts
type RoomOptions = { mode: "invite" | "quick"; rated: boolean };

type PersistState =
  | { status: "idle" }
  | { status: "pending"; matchNumber: number; attempts: number;
      nextAttemptAt: number; lastError: string | null }
  | { status: "saved"; matchNumber: number; matchId: string; savedAt: number }
  | { status: "failed"; matchNumber: number; reason: "replayMismatch" | "exhausted" | "noBinding";
      failedAt: number; lastError: string | null }
  | { status: "skipped"; matchNumber: number; reason: "guestSeat" | "noActions" | "logIncomplete" };

type RoomState = {
  // …existing fields unchanged…
  options: RoomOptions;                 // H1
  matchStartedAt: number | null;        // first accepted player action of the current match
  persist: PersistState;                // H1
};

type MatchLog = {
  v: 1;
  matchNumber: number;
  s: PlayerId;
  a: string[];                          // compact codes, appended per accepted action
};
```

Storage keys: `room` (existing) and `log` (new, `ROOM_LOG_KEY`). The log is
its own key (H1-D1) and is written **with** the room in one
`ctx.storage.put({ room, log })` whenever both change, so a crash between
the two can never leave them inconsistent. Activity refreshes, connection
changes, idle nudges, and rematch votes keep writing only `room`.

`normalizeRoom` defaults the new fields for rooms stored before this deploy:
`options = { mode: "invite", rated: true }`, `matchStartedAt = null`,
`persist = { status: "idle" }`. A missing or mismatched `log`
(`log.matchNumber !== room.matchNumber`) means the match began before the
deploy; such a match is marked `skipped: logIncomplete` at game over, with no
error log and no row (§6.4).

### 5.2 Where the log is written

| Handler            | Log change                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `initializeRoom`   | `{ v: 1, matchNumber: 1, s: <random seat>, a: [] }`; `gameState = createInitialState(s)`                 |
| `handleGameAction` | Append the accepted action's code; set `matchStartedAt = now` when `a` was empty                        |
| `handleClaimWin`   | Append `R:<opponent seat>` (the synthetic resign)                                                       |
| `startRematch`     | `{ v: 1, matchNumber: n + 1, s: otherPlayer(previous s), a: [] }`; `matchStartedAt = null`; `persist = idle` |

"At least one player action" (Must 5) means `log.a` held one or more codes
before the terminal action or claim. A room where the second seat joins and is
claimed against before anyone moved ends in `gameOver` with a log of exactly
`["R:B"]` and is `skipped: noActions` (H1-D4).

### 5.3 Fair starting seat (§6.5)

- `initializeRoom` picks `s` with one byte from `crypto.getRandomValues`
  (`< 128 → "A"`). This applies to every room, guest or account: one rule, one
  code path, and guests get fairness for free.
- `startRematch` uses `otherPlayer(deserialize(room.gameState).startingPlayer)`.
- Nothing else in the room changes; `getActingPlayer(state)` already drives
  turn checks, idle nudges, and claim eligibility.

Client side (`web/`), no UI work:

- `OnlineGame` keeps `createInitialState("A")` only as a placeholder before
  the first `state` message; `gameVisible` already waits for `started` and
  `mySlot`. Add a unit test that no turn indicator renders before the first
  authoritative state.
- Copy: no Somali string says which seat starts (checked); keep it that way.
- Tests: `tests/e2e/online-game.spec.ts` and `online-identity.spec.ts` click
  `O1` as the creator and expect occupant `A`. They must read the starting
  seat from the board (`data-current-player` on `online-board`, added for
  tests) and drive the seat that is on turn.

### 5.4 Room options at creation

`POST /rooms` body (`worker/src/index.ts`):

```ts
{ turnstileToken?, identityTicket?, options?: { mode?: "invite"; rated?: boolean } }
```

`roomOptionsSchema` in `packages/shared` (`mode: z.enum(["invite"])
.default("invite")`, `rated: z.boolean().default(true)`), reused by
`roomInitRequestSchema`. `quick` is accepted by the D1 `CHECK` but rejected by
the Zod enum until K1 widens it. The web client is not changed to send
options in H1 (R2 owns the friendly toggle); the field exists so R2 and K1 do
not need a protocol change.

Effective rated flag at persist time: `options.rated && bothSeatsAccounts`.
A guest-created room can never be rated, whatever it asked for.

### 5.5 Persistence trigger

At the end of `handleGameAction` and `handleClaimWin`, after `persistRoom` and
the broadcasts, when the new state's `phase === "gameOver"`:

```txt
if persist.status is saved/failed/skipped for this matchNumber → return
if either seat is not kind "account"                            → persist = skipped:guestSeat
else if log missing or log.matchNumber !== room.matchNumber    → persist = skipped:logIncomplete
else if log.a has no player action                              → persist = skipped:noActions
else build payload (§6.1), persist = pending(attempts 0, nextAttemptAt now)
     await attemptPersist(room)                                 (§6.3)
```

Broadcast first, then write: clients never wait on D1. The DO stays awake
for the one D1 round trip (tens of milliseconds), then hibernates as before.

### 5.6 Cleanup gating and alarms

`scheduleAlarm` adds two deadlines: `persist.nextAttemptAt` while `pending`,
and `persist.failedAt + FAILED_RETENTION_MS` while `failed`.

`alarm()` order:

1. If `pending` and `now >= nextAttemptAt` → `attemptPersist` (may become
   `saved`, stay `pending` with a later `nextAttemptAt`, or become `failed`).
2. Idle-expiry cleanup runs only when `persist.status` is not `pending`, and
   not `failed` within `FAILED_RETENTION_MS` (7 days). Otherwise the room is
   kept and the alarm is re-armed at the next relevant deadline.
3. Everything else (idle nudge, claimability) is unchanged.

`FAILED_RETENTION_MS` keeps the payload and the log in storage so a failed
match can be inspected or re-driven later. No `setTimeout`, no `setInterval`;
`pnpm check:hibernation` continues to pass.

### 5.7 `matchStatus.savedMatchId` (Should)

`matchStatusServerMessageSchema` gains `savedMatchId: z.string().nullable()
.optional()`. The room sets it to the saved match id when
`persist.status === "saved"` for the current `matchNumber`, else `null`. It
rides on the existing broadcast after a successful persist and on every
join/reconnect, so a reconnecting client learns it without a new message.
Old clients ignore the unknown key (Zod strips it); a new message *type* would
instead make cached PWA clients throw in `serverMessageSchema.parse`
(`onlineGameClient.ts`), which is why the brief's `matchSaved` message is not
used (H1-D9).

---

## 6. Ledger write

### 6.1 Payload captured at game over

Built once, in the DO, from room state and the log, and stored inside
`persist.pending` so every retry writes identical values:

| Field                     | Source                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `id`                      | 20 characters from `ROOM_CODE_ALPHABET` via `crypto.getRandomValues` (100 bits)          |
| `roomCode`, `roomCreatedAt`, `matchNumber` | room state                                                             |
| `mode`, `rated`           | `room.options`, `rated` made effective per §5.4                                          |
| `startingSeat`            | `log.s`                                                                                 |
| `firstAdvantageSeat`, `firstAdvantageBy` | `state.firstAdvantage`; origin from `summarizeReplay` (§4.2)              |
| `winnerSeat`              | `state.winner` (`null` on draws)                                                        |
| `endReason`               | `state.endReason` (one of the six engine values)                                        |
| `onlineEndReason`         | `room.onlineEndReason` mapped: `opponentAbandoned → "abandoned"`, `opponentIdleTimeout → "idle"`, else `null` |
| `actionCount`             | `log.a.length`                                                                          |
| `replay`                  | `JSON.stringify({ v: 1, s: log.s, a: log.a })`                                           |
| `replayV`                 | `1`                                                                                     |
| `startedAt`, `endedAt`    | `room.matchStartedAt`, `now` of the terminal handler                                    |
| per seat: `userId`, `usernameSnapshot` | `room.seats[slot]` (account kind)                                          |
| per seat: `result`        | `win` / `loss` from `winnerSeat`, `draw` when `null`                                     |
| per seat: `piecesLeft`    | count of that seat's pieces on `state.board`                                            |
| per seat: `captured`      | `state.players[slot].captured`                                                          |

Nothing from any client message is used; the user id and username snapshot
come from the verified seat identity only.

### 6.2 Schema — `packages/db/migrations/000N_matches.sql`

Numbered at merge time: `0001` if H1 lands before X1, otherwise `0002`
(X1's `0001_analytics.sql`). Hand-written, with a `meta/_journal.json` entry
and Drizzle definitions in `packages/db/src/schema.ts` for typed reads in H2.

```sql
CREATE TABLE `match` (
  `id`                   text    PRIMARY KEY NOT NULL,
  `room_code`            text    NOT NULL,
  `room_created_at`      integer NOT NULL,
  `match_number`         integer NOT NULL,
  `mode`                 text    NOT NULL,
  `rated`                integer NOT NULL,
  `starting_seat`        text    NOT NULL,
  `first_advantage_seat` text,
  `first_advantage_by`   text,
  `winner_seat`          text,
  `end_reason`           text    NOT NULL,
  `online_end_reason`    text,
  `action_count`         integer NOT NULL,
  `replay_v`             integer NOT NULL,
  `replay`               text    NOT NULL,
  `stats_json`           text,
  `started_at`           integer NOT NULL,
  `ended_at`             integer NOT NULL,
  `created_at`           integer NOT NULL,
  CONSTRAINT "match_mode_check"       CHECK (`mode` IN ('invite','quick')),
  CONSTRAINT "match_rated_check"      CHECK (`rated` IN (0,1)),
  CONSTRAINT "match_starting_check"   CHECK (`starting_seat` IN ('A','B')),
  CONSTRAINT "match_first_adv_check"  CHECK (`first_advantage_seat` IS NULL OR `first_advantage_seat` IN ('A','B')),
  CONSTRAINT "match_first_by_check"   CHECK (`first_advantage_by` IS NULL OR `first_advantage_by` IN ('placementJare','noJareFallback')),
  CONSTRAINT "match_winner_check"     CHECK (`winner_seat` IS NULL OR `winner_seat` IN ('A','B')),
  CONSTRAINT "match_end_reason_check" CHECK (`end_reason` IN ('opponentBelowThree','opponentCapturedAll','resignation','drawTermination','bothBlocked','forcedJareSpaceMaking')),
  CONSTRAINT "match_online_end_check" CHECK (`online_end_reason` IS NULL OR `online_end_reason` IN ('abandoned','idle')),
  CONSTRAINT "match_action_count_check" CHECK (`action_count` >= 1),
  CONSTRAINT "match_replay_v_check"   CHECK (`replay_v` >= 1),
  CONSTRAINT "match_times_check"      CHECK (`ended_at` >= `started_at`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_room_instance_unique` ON `match` (`room_code`, `room_created_at`, `match_number`);
--> statement-breakpoint
CREATE INDEX `match_ended_at_idx` ON `match` (`ended_at`);
--> statement-breakpoint
CREATE INDEX `match_rated_ended_at_idx` ON `match` (`rated`, `ended_at`);
--> statement-breakpoint
CREATE TABLE `match_player` (
  `match_id`          text    NOT NULL,
  `seat`              text    NOT NULL,
  `user_id`           text    NOT NULL,
  `username_snapshot` text    NOT NULL,
  `result`            text    NOT NULL,
  `pieces_left`       integer NOT NULL,
  `captured`          integer NOT NULL,
  `ended_at`          integer NOT NULL,
  PRIMARY KEY (`match_id`, `seat`),
  FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT "match_player_seat_check"   CHECK (`seat` IN ('A','B')),
  CONSTRAINT "match_player_result_check" CHECK (`result` IN ('win','loss','draw')),
  CONSTRAINT "match_player_counts_check" CHECK (`pieces_left` BETWEEN 0 AND 12 AND `captured` BETWEEN 0 AND 12)
);
--> statement-breakpoint
CREATE INDEX `match_player_user_ended_idx` ON `match_player` (`user_id`, `ended_at`);
```

Notes:

- Uniqueness is on the **room instance** plus `match_number`, a refinement of
  the brief's `(room_code, match_number)`: 8-character codes from a 32-symbol
  alphabet are recycled once a room is cleaned up, so two different rooms can
  share a code over the life of the ledger. `room_created_at` is millisecond
  precision and unique per instance (H1-D2).
- `match_player.user_id` has **no** foreign key to `user`. The ledger must
  outlive account deletion (A3 keeps a tombstone but the ledger must not
  depend on it) and the game Worker never joins to `user`.
- `match_player.ended_at` is denormalised so the `(user_id, ended_at)` index
  answers H2's history list and R1's processing order without a join.
- `match_rated_ended_at_idx` serves R1's "process rated matches in `ended_at`
  order"; it is created now because the brief asks for every index in this
  migration.
- Per-player counts (`pieces_left`, `captured`) live on `match_player`; the
  brief's "final piece counts, capture counts" are per seat.
- `rating_*` columns are R1's; SQLite `ALTER TABLE ADD COLUMN` is cheap and
  additive, so H1 does not reserve them.

Query coverage: every H2/R1 read the brief describes (`/history` by user,
`/match/<id>`, processor order, leaderboard exclusions) hits one of the
indexes above or a primary key.

### 6.3 Writer — `@shaxda/db/match`

New subpath export `packages/db/src/match/index.ts` (mirrors
`@shaxda/shared/identity`): raw `D1Database` prepared statements only, no
Drizzle, no Better Auth, no import of the package's index. This keeps the
game Worker's bundle free of auth schema and is enforced by the Should guard
in `check-hibernation.mjs` (`from "@shaxda/db"` without a subpath is
forbidden under `worker/src`).

```ts
export type PersistMatchOutcome =
  | { ok: true; matchId: string; alreadyExisted: boolean }
  | { ok: false; error: string };

export async function persistMatch(db: D1Database, payload: MatchPayload): Promise<PersistMatchOutcome>;
```

Algorithm:

1. `SELECT id FROM match WHERE room_code = ?1 AND room_created_at = ?2 AND
   match_number = ?3` — if a row exists, return `{ ok: true, matchId,
   alreadyExisted: true }` (a previous attempt committed but the DO never
   learned it).
2. `db.batch([insert match, insert match_player A, insert match_player B])`.
   D1 runs a batch as one transaction: all three rows or none. Each insert
   uses `ON CONFLICT DO NOTHING` so a concurrent-looking duplicate (impossible
   across DOs, cheap to guard) is still not an error.
3. Return `{ ok: true, matchId: payload.id, alreadyExisted: false }`.
4. Any thrown D1 error → `{ ok: false, error: message }`; the DO decides
   retry.

`attemptPersist(room)` in the DO:

```txt
if env.DB is undefined       → persist = failed:noBinding, log error, return
outcome = persistMatch(env.DB, payload)
ok   → persist = saved{ matchId }; persistRoom; broadcastMatchStatus (savedMatchId)
fail → attempts += 1
       attempts >= RETRY_DELAYS.length → persist = failed:exhausted, log error
       else nextAttemptAt = now + RETRY_DELAYS[attempts]; persistRoom (re-arms the alarm)
```

`RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000, 3_600_000]`
— six attempts over ≈ 1 h 43 min, then `failed:exhausted` (H1-D5). D1 outages
longer than that are rare; the retained room allows a later re-drive.

### 6.4 Replay validation

Before the first attempt, in the same handler that builds the payload:

```txt
summary = summarizeReplay({ v: 1, s: log.s, a: log.a })
if !summary.ok or serialize(summary.state) !== room.gameState
   → persist = failed:replayMismatch, structured error log
     { event: "matchReplayMismatch", roomCode, matchNumber, actionIndex?, error? }
   → no D1 write, room retained FAILED_RETENTION_MS
```

Logs carry room code and match number only — never user ids, usernames, or
the log itself. A mismatch means a bug in the encoder, the reducer, or the
room, so the room is kept for inspection rather than "repaired".

### 6.5 Legacy and skip paths

`skipped` states write no row and log nothing at error level:

| Reason          | When                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| `guestSeat`     | either seat is `guest` kind (D4)                                            |
| `noActions`     | the log holds only the terminal resign (§5.2)                               |
| `logIncomplete` | the room was created before this deploy or the log key is missing/mismatched |

---

## 7. Configuration by environment

| Item                          | dev / tests (`worker/wrangler.toml`)                           | e2e                                                        | preview (`wrangler.preview.toml`)               | production (`wrangler.production.toml`)          |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `[[d1_databases]]`            | `binding = "DB"`, `database_name = "shaxda-db"`, `database_id = "local-worker-database"`, `migrations_dir = "../packages/db/migrations"` | same binding; `scripts/start-worker-e2e.mjs` applies migrations into `test-results/wrangler-e2e` the way `start-web-e2e.mjs` does for the web | `database_id = 5a84ac83-…` (same DB as the web preview) | `database_id = b84cc232-…` (same DB as production web) |
| Migration application         | Workers tests apply `TEST_MIGRATIONS` in a vitest `setupFiles` hook (`readD1Migrations("../packages/db/migrations")`), same as `packages/db`; `pnpm dev:worker` users run `wrangler d1 migrations apply DB --local` once | harness step                                        | `wrangler d1 migrations apply --config web/wrangler.preview.jsonc` (web stays the single operational authority; the worker config only declares the binding) | same, from `web/wrangler.jsonc`                     |
| `MatchRoomEnv`                | `DB?: D1Database` added; absent binding → `failed:noBinding`, never a crash and never a guest downgrade |                                                            |                                                 |                                                  |

`pnpm check:e2e-isolation` reads the web config's D1 bindings; extending it to
the worker config is a Should. Either way it must keep passing.

The two Workers share one database per environment. The game Worker's
statements touch `match` and `match_player` only; the Should guard greps
`worker/src` for `user`, `account`, `session`, and `verification` table
references.

---

## 8. Cost model

| Item                             | Per completed account game                          |
| -------------------------------- | --------------------------------------------------- |
| D1 rows written                  | 3 (one batch)                                       |
| D1 rows read                     | 1 (`SELECT id`)                                     |
| Durable Object storage           | one extra key (`log`), one extra `put` per accepted action, both within the existing per-action write |
| Durable Object wall-clock        | one D1 round trip at game over; alarm wake-ups only on failure |
| Storage per match                | ~1–2 KB typical, ≤ ~20 KB worst case                |

At 10,000 completed account games/month: 30k rows written (D1 free tier is
100k/day) and ≈ 20 MB/year of replay text. No per-move rows anywhere.

---

## 9. Tests

Engine (`packages/game-engine`):

- Encode/decode every action type; `R:A` and `R:B` round-trip; the shared
  `early-resignation` fixture (B resigns on A's turn) encodes as `R:B` and
  decodes to the fixture's expected final state.
- Round trip on every `fullGameActionScripts` and `a2ConformanceActionScripts`
  entry, and on 200 random legal playouts from the fuzz harness.
- Rejections: unknown prefix, bad point, `M:O1>O1`, version `2`, a code the
  reducer refuses, each reporting the right `actionIndex`.
- `firstAdvantageBy`: starter forms first, opponent forms first, no jare
  (fallback), and `null` for a placement-phase resignation (`shaxda-rules`
  §10 cases).

Shared:

- `compactReplaySchema`, `roomOptionsSchema` (defaults, `quick` rejected),
  `matchStatus.savedMatchId` optional/nullable, `POST /rooms` options
  validation.

DB (`packages/db`, Workers pool):

- Migration applies after `0000` (and after `0001_analytics` when present);
  constraints reject bad `mode`, `seat`, `result`, `end_reason`,
  `action_count = 0`, `ended_at < started_at`; indexes exist by name.
- `persistMatch` twice with the same payload → one row, second returns
  `alreadyExisted: true`; batch atomicity (a bad `match_player` row rolls the
  `match` row back); FK cascade on `match` delete.

Worker (`worker/`, Workers pool, existing harness):

- Persist once per match across a reconnect during the game and a retried
  attempt: drop `match_player` before game over, assert `pending`, recreate
  the table, advance time past `RETRY_DELAYS_MS[0]`, run the alarm, assert
  `saved` and exactly one row.
- Rematch produces a second row with `match_number = 2` and the alternated
  `starting_seat`.
- Guest-vs-guest and account-vs-guest → no row, `skipped: guestSeat`.
- Claim-win (abandon and idle) rows carry `online_end_reason`, `end_reason =
  'resignation'`, the synthetic `R:<seat>` as the last code, and validate.
- Zero-action claim → `skipped: noActions`, no row.
- Corrupted stored log (via `runInDurableObject` storage) → `failed:
  replayMismatch`, no row, room survives idle expiry until
  `FAILED_RETENTION_MS`, then cleanup runs.
- Exhaustion: keep `match_player` dropped through all six delays → `failed:
  exhausted`; the cleanup alarm did not delete the room while `pending`.
- Legacy room (stored without `log` and `options`) normalises, plays, and
  ends as `skipped: logIncomplete`.
- Starting seat: with `crypto.getRandomValues` mocked to each outcome the
  first `state` carries that `startingPlayer`; unmocked, 20 inits produce
  both seats; rematch alternates twice in a row.
- `matchStatus.savedMatchId` is broadcast after the save and included on
  rejoin; it is `null` before the save and after a rematch starts.
- Replay column of every persisted test game equals
  `encodeCompactReplay(s, actions)` for the driven script, and
  `decodeCompactReplay` of it equals the final broadcast state.
- Determinism for the existing 100 tests: the `initializeRoom` test helper
  mocks `crypto.getRandomValues` to seat `A` for the duration of the init
  call (the same technique the room-code tests already use), so no existing
  script changes. Only the starting-seat tests run unmocked.
- `pnpm check:hibernation` passes, including the new auth-table and bare
  `@shaxda/db` guards.

Web (jsdom):

- `serverMessageSchema` strips unknown keys on `matchStatus` and the client
  exposes `savedMatchId` when present.
- No turn indicator before the first authoritative `state`.
- `OnlineGame` tests that assumed seat A starts are driven from
  `state.startingPlayer`.

Playwright:

- `online-game.spec.ts` and `online-identity.spec.ts` read the starting seat
  from `data-current-player` instead of assuming `A`.
- An account-vs-account resignation game leaves `pending`/`saved` state
  behind is **not** asserted in H1 (no UI reads it); H2's match page test
  covers the row end to end.

Checks: `pnpm check` (format, hibernation, e2e-isolation, lint, typecheck,
test, `test:worker`, build) and `pnpm test:e2e`.

---

## 10. Deploy compatibility

- Rooms stored before the deploy normalise with defaults and never persist
  (`logIncomplete`); their play is otherwise unchanged.
- Protocol stays `v: 1`; `savedMatchId` is optional and stripped by old
  clients.
- Deploy order: apply the migration, deploy the game Worker, then the web
  Worker. Old web clients keep working against the new Worker; the new web
  client only *reads* `savedMatchId`.
- A room that hibernates mid-match keeps `log` and `persist` in storage;
  instance rebuilds lose nothing.
- Guest rooms gain the random starting seat immediately. No copy references
  seat A as the starter, so no Somali text changes.

---

## 11. Rollout

1. Preview: `wrangler d1 migrations apply` from `web/wrangler.preview.jsonc`;
   deploy `shaxda-worker-preview` with the D1 binding; deploy web preview.
2. Two signed-in accounts finish one game on preview (resignation is the
   quickest); then

   ```bash
   pnpm --filter @shaxda/web exec wrangler d1 execute shaxda-db-preview --config wrangler.preview.jsonc --remote --command "SELECT id, room_code, match_number, starting_seat, winner_seat, end_reason, online_end_reason, action_count, length(replay) FROM match ORDER BY ended_at DESC LIMIT 5"
   ```

   shows exactly one row for that room, and
   `scripts/verify-match-replay.mjs <replay-json>` (Should; runs
   `decodeCompactReplay` and prints the final state's winner/endReason) agrees
   with the row. Play a rematch and confirm `match_number = 2` with the other
   `starting_seat`.
3. Production: same steps; watch Workers logs for `matchReplayMismatch` and
   `matchPersistFailed` for a week.
4. Add the D1 binding and the two log event names to
   `docs/ops/launch-runbook.md` and `docs/ops/billing-alerts.md`.

---

## 12. Implementation plan

One logical change per commit, TDD-first for the engine, db, and DO slices.

```txt
1.  docs: apply V2 §6.1/§6.5 to AGENTS.md and the PRD; refine v2 §7.2/§7.3; link the H1 spec
2.  test(engine): cover compact replay encode/decode and first-advantage origin
3.  feat(engine): add compact replay encoder, decoder, and summary
4.  feat(shared): add compact replay, room options, and savedMatchId schemas
5.  feat(db): add match and match_player migration                         (+ test(db))
6.  feat(db): add @shaxda/db/match ledger writer                            (+ tests)
7.  test(online): pin seat A in the room test helper and cover random/alternating starts
8.  feat(online): randomise the first starting seat and alternate on rematch
9.  feat(online): accept and store room options at creation
10. feat(online): record the compact action log per match
11. feat(online): persist completed account matches to D1 with alarm-driven retry
12. feat(online): gate cleanup on pending or failed persists
13. feat(online): broadcast savedMatchId on matchStatus                     (Should)
14. build(online): bind D1 in the game Worker configs and apply migrations in tests and e2e
15. chore: guard worker source against auth-table and bare @shaxda/db imports (Should)
16. fix(web): stop assuming seat A starts in online tests and e2e specs
17. docs(ops): add the H1 rollout and verification steps
```

---

## 13. Done when

From the brief: two signed-in accounts finish a game on preview and exactly
one row exists with a log that replays to the final state.

Additionally:

- `pnpm check` and `pnpm test:e2e` pass with the new tests.
- A guest-involved preview game leaves no row.
- A rematch on preview produces `match_number = 2` with the other starting
  seat.
- `docs/shaxda-v2.md` §4 marks H1 **shipped** with the merge date and §14's
  freeze point 1 is recorded as frozen.

---

## 14. Decisions

| ID     | Decision                                                                                                             | Rationale                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1-D1  | The action log lives under its own storage key (`log`), written with `room` in one multi-key `put` when both change. | `persistRoom` rewrites the whole room on activity refreshes, connection changes, and rematch votes; keeping a growing log out of that value keeps those writes small. A single `put({ room, log })` keeps the pair consistent.        |
| H1-D2  | Ledger uniqueness is `(room_code, room_created_at, match_number)`, not `(room_code, match_number)`.                  | Room codes are recycled after cleanup; `createdAt` identifies the room instance.                                                                                                                                                       |
| H1-D3  | `started_at` = first accepted player action; `ended_at` = terminal action or claim.                                  | A room with two seats and no moves is not a game. Duration statistics (H4) want move time, not lobby time.                                                                                                                             |
| H1-D4  | Matches with no player action are not persisted (`skipped: noActions`).                                              | They carry no replay value and would pollute history and ratings; K2 handles abandon-before-first-move cooldowns from the queue side.                                                                                                  |
| H1-D5  | Six retries over ≈ 1 h 43 min, then `failed: exhausted`; failed rooms are retained 7 days with the payload.          | Bounded wake-ups, long enough for a D1 incident, and nothing is lost until an operator has had a week.                                                                                                                                 |
| H1-D6  | `R:<seat>` carries the resigning seat; all other codes derive the player from state.                                 | Resignation is legal off-turn (engine and claim-win both do it), so a bare `R` is ambiguous.                                                                                                                                           |
| H1-D7  | The random starting seat applies to every room, guest included, at room init.                                        | One rule and one code path; guests get fairness for free; seats are unknown at init so an account-only rule would need a second decision point.                                                                                       |
| H1-D8  | The game Worker gets D1 through a dedicated `@shaxda/db/match` subpath with raw statements only.                     | Keeps Drizzle and the auth schema out of the game Worker bundle and makes "never reads auth tables" greppable.                                                                                                                         |
| H1-D9  | `savedMatchId` is an optional field on `matchStatus`, not a new `matchSaved` message.                                | The client throws on unknown message types; cached PWA bundles would break. Optional fields are the established additive pattern from V1.1-A2.                                                                                         |
| H1-D10 | `first_advantage_by` is derived at persist time by the engine, not stored in `GameState`.                            | Avoids an F1 contract change to `GameState`; the replay already has to run for validation.                                                                                                                                             |
| H1-D11 | `match_player.user_id` has no foreign key to `user`.                                                                 | The ledger must survive A3 deletion semantics and the game Worker never touches `user`.                                                                                                                                                |
| H1-D12 | Room options are accepted at `POST /rooms` and stored, but no client sends them in H1.                               | The brief wants the field; R2 owns the friendly toggle UI and K1 owns `quick`.                                                                                                                                                         |

---

## 15. Open questions for the founder

None block implementation; each has a default above.

1. Failed-persist retention: 7 days (chosen) or longer?
2. Should guests also get the random starting seat (chosen, H1-D7), or should
   guest rooms keep seat A starting until R2?
3. Zero-action games are dropped (H1-D4). Confirm this is acceptable for the
   R2 resign/claim policy, or R2 will need its own record of them.
