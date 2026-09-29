# H1 — Match Persistence (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Wave       | 1 (with H2 and X1a)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Depends on | V1.1-A2 (deployed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Register   | F1 F4 F8 P1 P2 P3 P4 P5 P6 P17 P21 ([register](README.md#decision-register))                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Contracts  | Owns [§2.1–§2.4](v2-contracts.md#2-ledger-schema) and [§3](v2-contracts.md#3-room-lifecycle); implements H1's part of [§6.1–§6.3](v2-contracts.md#6-protocol-additions); consumes [§4.1](v2-contracts.md#41-which-endings-write-a-row), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§6.5](v2-contracts.md#65-deploy-order), [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone), [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e), [§12](v2-contracts.md#12-evidence) (E2, E4) |
| Brief      | `docs/shaxda-v2.md` §9 (H1), §6.1, §6.5, §6.6, §7.2, §7.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Touches    | `packages/game-engine`, `packages/shared`, `packages/db`, `packages/i18n`, `worker/`, `web/` (online client, test hooks), `scripts/`, `tests/e2e/`, Wrangler configs, `AGENTS.md`, `docs/shaxda_prd.md`, `docs/ops/`                                                                                                                                                                                                                                                                                                                                |

H1 stores every played account-vs-account online game exactly once in the D1
ledger, with a compact replay that decodes to the final state, and loses none
to a crash, a D1 outage, a rematch, or idle expiry. It owns the ledger, the
replay format, the per-match outbox in the Match Durable Object, the fair
starting seat, and the operator command for unsaved matches. It leaves
consent and every rated-play surface to R2, so each wave-1 game is friendly
and private; quick rooms to K1; reads to H2 and H3; statistics to H4; ratings
to R1; online counters to X1b; deletion to A3.

## 1. Outcome and non-goals

**Outcome.** When two complete accounts finish an online game after play
began, one `match` row and two `match_player` rows exist, the stored replay
decodes to the state the room broadcast, and both clients learn the outcome
from `matchStatus.save`. A save that cannot reach D1 retries for 72 hours,
then stays listed until an audited operator command removes it.

### Must

| Area               | Must                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine, shared     | `RULES_VERSION = 1`; the compact replay codec with `R:<seat>` and the E4 bound; schemas for the stored replay, payload, match id, and protocol additions; `payload_hash`; `writesLedgerRow` in `@shaxda/shared/rated-play` (§3.2, §3.3).                                                                                                                                                                                                                              |
| DB                 | One migration with the §2.1 tables and `match_ops_audit`; the `@shaxda/db/match` raw-statement writer (§3.1, §3.4).                                                                                                                                                                                                                                                                                                                                                   |
| Room               | The starting-seat rule in every room; `log` written with `room`; own off-turn `resign`; the P6 guard; the rated request, consent slots, and `rated` frozen at play began; one terminal `put` before any broadcast; the outbox with retries, stall, and a three-entry limit; idle retention with `holdsUnsaved`; the `matchStatus` fields, `save` included (§3.5, §4). No new server message type: cached clients fail `serverMessageSchema.parse` on an unknown type. |
| Operations         | The token-guarded ops route, `pnpm match:ops`, and its audit table (§3.6, §3.7).                                                                                                                                                                                                                                                                                                                                                                                      |
| Configuration, web | `DB` bound to the web Worker's D1 in every environment and one shared local D1 in e2e; the client sends `matchNumber`, never assumes seat A starts, and gains two test hooks and two Somali error strings (§7, §10).                                                                                                                                                                                                                                                  |
| Guard              | `scripts/check-hibernation.mjs` fails on a bare `@shaxda/db` import, on auth-table SQL in `worker/src` or `packages/db/src/match`, and on Drizzle or Better Auth imports in `packages/db/src/match`.                                                                                                                                                                                                                                                                  |
| First commit       | Applies V2 §6.1 (ledger writes only; the P13 counters come with X1b), §6.5, and §6.6 to `AGENTS.md` and the PRD (§8).                                                                                                                                                                                                                                                                                                                                                 |

### Should

- `sampleMatchPayloads` in the `packages/shared` fixtures: §9's sample rows
  as real engine replays, for H2, H4, R1, and R2 tests.
- `pnpm match:ops -- verify <matchId>`: a read-only decode of one stored row
  that recomputes its `payload_hash`; R6-core may reuse it.

### Not in H1

- R2: `rateConsent` (an invite room's first match), rated rematch votes,
  disclosure copy, `RATED_PLAY_ENABLED`; until then `rated` is always false.
  K1: quick rooms and queue consent; until then `mode` is `invite`.
- H2 reads and save-status UI; H3 replay viewer; H4 statistics; R1 ratings
  and the save hint; X1b P13 counters; A3 deletion. `/local` is unchanged.
- Moving a `replayMismatch` payload into the ledger needs an engine fix and
  an R6 correction.

## 2. Decisions and dependencies

| ID  | How H1 applies it                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | `ratedRequest` defaults to `false`; rated needs both seats' consent, which nothing records before R2; the ledger refuses a friendly `quick` row.                                                                                                                                                                 |
| F4  | After play began, a resignation or valid claim in any phase, capture included, writes a row with that seat as loser.                                                                                                                                                                                             |
| F8  | Only a match with two `account` seats creates an outbox entry; guests write nothing permanent.                                                                                                                                                                                                                   |
| P1  | Play began is the first accepted `place`, `removeInitial`, `move`, or `capture`. It sets `started_at`; an earlier ending creates no entry. There is no other special case.                                                                                                                                       |
| P2  | No visibility column: `rated` decides. Every wave-1 row has `rated = 0` and is private to its two players.                                                                                                                                                                                                       |
| P3  | The room stores the request, keeps per-match consent slots, freezes `rated` at play began, and broadcasts all three. R2 fills the slots (`rateConsent` for an invite room's first match, rated rematch votes after it); K1 fills them from the queue. Cached clients send nothing, so their games stay friendly. |
| P4  | D1 assigns `match.seq` at insert, so a late save lands at the tail. H1 never reads `seq`.                                                                                                                                                                                                                        |
| P5  | The payload carries user ids only; no username, avatar, or display snapshot reaches the ledger.                                                                                                                                                                                                                  |
| P6  | `gameAction`, `claimWin`, and `rematch` take an optional `matchNumber`; a mismatch returns `staleMatch`.                                                                                                                                                                                                         |
| P17 | One outbox entry per match, 72 h of backoff, then `stalled`: kept and listed. Only an operator discards, with an audit row.                                                                                                                                                                                      |
| P21 | H1 writes `stats_status = 'none'`; the payload's statistics step may fail without blocking the save (tested with a stub until H4).                                                                                                                                                                               |

| Dependency                                         | What it provides                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.1-A2 (deployed)                                 | Account seats whose private `userId` comes from a verified ticket; `matchNumber`; reconnect and claim-win.                                                                                                                                                                                                                                                                                                                                                              |
| `packages/game-engine`                             | `createInitialState(startingPlayer)`, `applyAction` (off-turn `resign` is already legal), `serialize`, `replayActions`.                                                                                                                                                                                                                                                                                                                                                 |
| Proofs E2, E4 ([§12](v2-contracts.md#12-evidence)) | The shared local D1 technique; the 1,403-action and 13,922-byte bound; the 16,384-byte guard.                                                                                                                                                                                                                                                                                                                                                                           |
| Consumers                                          | H2 reads the ledger, `save`, and `matchIdSchema`, and seeds fixtures through the writer; H3 picks adapters by `rules_v`/`replay_v`; H4 fills the three stats columns, the only ones that change after insert; R1 adds tables beside the ledger ([§2.5](v2-contracts.md#25-r1-extension)) and a hint after each save ([§7.1](v2-contracts.md#71-triggers-and-lease)); R2 fills consent; K1 reuses the seat rule and room init; X1b reuses `DB`; R6-core reuses the hash. |

## 3. Contracts

H1 implements [§2.1–§2.4](v2-contracts.md#2-ledger-schema) and
[§3](v2-contracts.md#3-room-lifecycle) exactly. This section defines H1's own
interfaces.

### 3.1 Migration

`packages/db/migrations/<NNNN>_match_ledger.sql` (numbered at merge,
[§11](v2-contracts.md#11-migration-ownership)) creates the
[§2.1](v2-contracts.md#21-h1-tables) tables and indexes verbatim, with no
foreign key to `user`, then `match_ops_audit` (§3.7). H1 adds no Drizzle
definitions and never updates a row; readers use raw statements.

### 3.2 Engine — `packages/game-engine/src/replay.ts`

| Export                                                    | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RULES_VERSION = 1`, `REPLAY_VERSION = 1`                 | Stored as `rules_v` and `replay_v`. A change to legality or results bumps `RULES_VERSION` in a contract-change commit; stored rows keep replaying under their own `rules_v`.                                                                                                                                                                                                                                                               |
| `MAX_REPLAY_ACTIONS = 1_403`                              | The E4 bound. The fuzz test's 1,200-action cap is not a validation limit.                                                                                                                                                                                                                                                                                                                                                                  |
| `CompactReplay`                                           | `{ v: 1; s: PlayerId; a: readonly string[] }`                                                                                                                                                                                                                                                                                                                                                                                              |
| `encodeAction(action)`, `encodeCompactReplay(s, actions)` | `P:<point>`, `X:<point>`, `M:<from>><to>`, `C:<point>`, or `R:<seat>`; a `CompactReplay`                                                                                                                                                                                                                                                                                                                                                   |
| `decodeCompactReplay(replay)`                             | Replays from `createInitialState(s)`: `P`, `X`, `M`, and `C` take their player from the state reached so far; `R:<seat>` names the resigning seat, because resigning is legal off-turn and claim-win resigns for the other seat. Returns `{ ok: true, actions, state }`, or `{ ok: false, error, actionIndex }` for a `v` other than 1, more than 1,403 codes (checked first), an unknown prefix, a malformed point, or a reducer refusal. |
| `summarizeReplay(replay)`                                 | The decode result plus `actionCount` and `firstAdvantageBy`: `placementJare` when the `place` that first set `firstAdvantage` completed a jare, `noJareFallback` when the end-of-placement rule set it, `null` when the game ended first. Derived here, never stored in `GameState`, so the F1 engine contract is unchanged.                                                                                                               |

### 3.3 Shared — `packages/shared`

| Export                      | Contract                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compactReplaySchema`       | `v: 1`, `s` of `A` or `B`, and at most 1,403 codes, each one of the §3.2 forms over the points `O1`–`I8` and seats `A`/`B`.                                                                                                                                                                                                                                                                        |
| `parseStoredReplay(text)`   | Refuses more than 16,384 UTF-8 bytes, then parses JSON and applies the schema. The room and every reader use it. The canonical text is `JSON.stringify({ v, s, a })`.                                                                                                                                                                                                                              |
| `matchIdSchema`             | The [§2.3](v2-contracts.md#23-public-match-id) pattern.                                                                                                                                                                                                                                                                                                                                            |
| `matchPayloadSchema`        | The [§2.2](v2-contracts.md#22-writer-invariants-and-the-payload) type, with each §2.1 `CHECK` as a refinement, two distinct user ids, and results consistent with `winnerSeat`.                                                                                                                                                                                                                    |
| `matchPayloadHash(payload)` | SHA-256 (`crypto.subtle`, lowercase hex) of the canonical payload JSON without `statsV`, `statsStatus`, and `statsJson`, as §2.2 defines.                                                                                                                                                                                                                                                          |
| `roomOptionsSchema`         | `{ ratedRequest }`, default `false`, strict: `mode` or any other key fails `POST /rooms` with `createFailed`.                                                                                                                                                                                                                                                                                      |
| Protocol                    | The [§6.2](v2-contracts.md#62-server-to-client) `matchStatus` fields, all optional, with `save.matchId` as `matchIdSchema`; an optional positive `matchNumber` on `gameAction`, `claimWin`, and `rematch`.                                                                                                                                                                                         |
| `@shaxda/shared/rated-play` | A new pure subpath (no Zod, no I/O). `writesLedgerRow({ seatKinds, playBegan, endedBy })`, where `endedBy` is `action`, `claim`, or `null` for a room cleaned up without `gameOver`, is true only for two `account` seats, play began, and a non-null `endedBy`: the [§4.1](v2-contracts.md#41-which-endings-write-a-row) table. R2 later adds `ratingSkipReason` to the module without moving it. |

### 3.4 Writer — `@shaxda/db/match`

`packages/db/src/match/index.ts` is a new subpath export with raw
`D1Database` statements only. It imports neither Drizzle, Better Auth, nor
the package index, so none of them reaches the game Worker bundle.
`saveMatch(db, payload, payloadHash)` returns `saved` (with `matchId` and
`existed`), `conflict`, or `failed` (with `error`):

1. One `db.batch` of three plain `INSERT`s (`match`, seat A, seat B), every
   value bound, the replay included; D1 assigns `seq` and `saved_at`. A
   batch is one transaction.
2. Success → `saved`, `existed: false`.
3. Any error → one `SELECT id, payload_hash` on the unique room-instance
   key. Equal hash → `saved`, `existed: true` (an earlier attempt committed
   and its response was lost); another hash → `conflict`; no row, or a
   failed read → `failed`.

### 3.5 Room state — `worker/src/match-room.ts`

Storage keys: `room`; `log`, the current match's `{ v: 1, matchNumber, s, a }`;
and `outbox:<matchNumber>` with the
[§3.2](v2-contracts.md#32-storage-and-alarms) entry shape. `RoomState` gains:

| Field                     | Meaning                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`                 | `{ mode, ratedRequest }`; `mode` is `invite` until K1.                                                                                                      |
| `consent`                 | Per seat, `{ accept, disclosureV }` or `null`, for the current match; R2 and K1 fill it.                                                                    |
| `rated`, `consentPolicyV` | `null` until play began, then frozen.                                                                                                                       |
| `playBeganAt`             | Time of the first accepted non-`resign` action, else `null`.                                                                                                |
| `unsaved`                 | Per unsaved match number: `status` (`pending` or `stalled`), `attempts`, `nextAttemptAt`. Written with the entry, so alarms and limits never read payloads. |
| `lastSave`                | `{ matchNumber, status, matchId }` of the newest persistable match, or `null`.                                                                              |
| `expiredAt`               | Idle-expiry time while entries remain, else `null`.                                                                                                         |
| `holdSynced`              | Whether the coordinator has the current `holdsUnsaved` value.                                                                                               |
| `normalizeRoom`           | Gives stored rooms `mode: "invite"`, `ratedRequest: false`, empty consent, `null` in the nullable fields, an empty `unsaved`, and `holdSynced: true`.       |
| `matchStatus`             | Sends `mode`, `ratedRequest`, `consent` (each slot's `accept` or `null`), `rated`, and `save` from `lastSave`, with `matchId` only once saved.              |
| `generateMatchId()`       | Beside `generateRoomCode()` in `worker/src/room-code.ts`: the same rejection sampling, 20 characters.                                                       |

### 3.6 Coordinator — `worker/src/room-coordinator.ts`

| Change                                           | Rule                                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reservation                                      | Gains optional `roomCreatedAt` and `holdsUnsaved: true`.                                                                                                                                              |
| `POST /internal/coordinator/hold`                | `{ roomCode, roomCreatedAt, holdsUnsaved }` sets or clears the flag, re-creating a reservation the TTL already pruned.                                                                                |
| Prune, alarm, capacity                           | Held reservations are skipped by the 70-minute prune, by the alarm deadline (their past TTL would re-arm it at once), and by the per-IP and global counts, so a D1 outage never blocks room creation. |
| `release`                                        | Removes a held reservation only with the matching `roomCreatedAt`: the room always sends it; the 409 path in `index.ts` never does.                                                                   |
| `GET /internal/coordinator/unsaved?after=<code>` | Held codes in order, 50 per page.                                                                                                                                                                     |

### 3.7 Operations

The game Worker serves `/ops/*`: on its `workers.dev` host in preview, and
through a new `shaxda.app/ops/*` route in production.

| Route                                             | Body                                         | Effect                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /ops/unsaved?after=<code>` or `?room=<code>` | —                                            | Held rooms, or one room: whether it expired and, per entry, `matchNumber`, `matchId`, `status`, `stalledReason`, `attempts`, `firstAttemptAt`, `nextAttemptAt`, `lastError`, `endedAt`, `actionCount`, `mode`, `rated`, `payloadHash`. Never user ids or the replay. |
| `POST /ops/retry`                                 | `{ roomCode, matchNumber, matchId }`         | One attempt now. A pending entry keeps its schedule; a stalled one is saved or stays stalled with a new `lastError`, without a new 72 h window. `replayMismatch` → `409 notRetryable`.                                                                               |
| `POST /ops/discard`                               | `{ roomCode, matchNumber, matchId, reason }` | Deletes the entry; a retained room left with none runs its deferred cleanup.                                                                                                                                                                                         |

- Checks, in order: an `Origin` header → 403 (browsers send it on every
  cross-origin request and every `POST`, so no page can call the route);
  the rate-limiting binding
  `MATCH_OPS_RATE_LIMIT`, 20 a minute per client IP (absent → 503, exceeded
  → 429); `MATCH_OPS_TOKEN` absent or under 32 bytes → 503; the bearer token,
  compared as SHA-256 digests with `crypto.subtle.timingSafeEqual` → 401; Zod
  bodies (`reason` 1–500 characters) → 400; a `matchId` that is not the
  entry's → `409 entryMismatch`; no entry → `404 noEntry`.
- Responses are `no-store` without CORS headers, and `OPTIONS` is 404. The
  Worker forwards to DO-internal paths (`/internal/ops/outbox`, `/retry`,
  `/discard`) that no public route reaches.

`pnpm match:ops -- <command> --database <local|preview|production>` runs
`scripts/match-ops.mjs`:

| Part                                                                           | Rule                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--database`                                                                   | Required. The command first prints the Worker origin (`http://127.0.0.1:8787`, `https://shaxda-worker-preview.shaxda.workers.dev`, or `https://shaxda.app`) and the D1 database, reached through that environment's web Wrangler config (`--local` for `local`, else `--remote`). |
| Token                                                                          | The operator's `MATCH_OPS_TOKEN` environment variable (the tracked dev value for `local`), never a flag, never printed. Requests use Node's `http`/`https`, which add no `Origin`.                                                                                                |
| `list-unsaved`                                                                 | Prints every page.                                                                                                                                                                                                                                                                |
| `retry <room> <matchNumber>`, `discard <room> <matchNumber> --reason "<text>"` | Read the entry through `?room=`, append a `requested` audit row, call the route, then append `done` or `failed`. A production `discard` also asks the operator to type the room code.                                                                                             |
| SQL safety                                                                     | Free text reaches SQL only as `CAST(X'<utf-8 hex>' AS TEXT)`; codes and ids are validated first; Wrangler runs through `execFile`, never a shell.                                                                                                                                 |

```sql
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
```

The game Worker never touches this table: its D1 access stays the two ledger
tables, plus X1b's P13 counters.

## 4. Behaviour and failure handling

### 4.1 Actions and the log

| Handler            | H1 behaviour                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initializeRoom`   | Starting seat from one `crypto.getRandomValues` byte (even → A), in every room, guests included; stores the `options` that `POST /rooms` passes in the init request; `put({ room, log })` with an empty log.                                                                                                                    |
| `handleGameAction` | `roomMismatch` → `notJoined` → `staleMatch` → `waitingForOpponent` → the action's `player` must be the sender's seat → the acting-player check, **skipped for `resign`** → the engine. An accepted action appends its code; the first accepted non-`resign` action sets `playBeganAt` and freezes `rated` and `consentPolicyV`. |
| `handleClaimWin`   | After `staleMatch`, appends `R:<absent or idle seat>` and records `onlineEndReason`.                                                                                                                                                                                                                                            |
| `handleRematch`    | After `staleMatch`, an `accept` vote while three entries are unsaved gets `savingEarlierGames` and is not recorded.                                                                                                                                                                                                             |
| `startRematch`     | Starting seat = the other seat of the finished game; a new log; consent, `rated`, and `playBeganAt` reset; `put({ room, log })`.                                                                                                                                                                                                |
| `rated` freeze     | `true` only when `ratedRequest` is set, both seats are accounts, and both consent slots accept the current disclosure version (R2's `RATED_DISCLOSURE_V`), which becomes `consentPolicyV`. Before R2 nothing fills the slots, so it freezes `false`.                                                                            |
| Earlier entries    | Untouched by rematches: their saves finish during later games, and `save` reports the newest persistable match. The three-entry limit stops the fourth game, never play in other rooms.                                                                                                                                         |
| Other writes       | Refreshes, connection changes, nudges, and votes still write `room` alone.                                                                                                                                                                                                                                                      |

### 4.2 Game over

In the handler whose action or claim produced `gameOver`:

| Step         | Action                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Decide    | Persistable when `writesLedgerRow` is true and `log.matchNumber` equals `room.matchNumber`. Otherwise there is no entry: step 4 writes `{ room, log }`, steps 5–6 are the broadcast alone, and `unsaved` and `lastSave` stay as they were.                                     |
| 2. Validate  | Build the canonical replay text; check it with `parseStoredReplay`, `summarizeReplay`, and `serialize` equality with the final state; build the payload (§4.3) and its hash.                                                                                                   |
| 3. Entry     | Valid → `pending`, `attempts: 0`, `nextAttemptAt: endedAt + 5 s`, so the alarm covers an inline attempt that never runs. Invalid → `stalled: replayMismatch` with `firstAdvantageBy: null`, and error log `matchReplayMismatch { roomCode, matchNumber, actionIndex, error }`. |
| 4. Write     | `ctx.storage.put({ room, log, "outbox:<n>": entry })` and `setAlarm`, with no await between them, so they commit together.                                                                                                                                                     |
| 5. Broadcast | `state`, `matchStatus` with `save`, and `matchEnded` for claims.                                                                                                                                                                                                               |
| 6. Save      | The first attempt runs inline (§4.4).                                                                                                                                                                                                                                          |

### 4.3 Payload sources

| Field                                                    | Source                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                     | `generateMatchId()`, once, here                                                                                                                                                                                                         |
| `roomCode`, `roomCreatedAt`, `matchNumber`, `mode`       | Room state                                                                                                                                                                                                                              |
| `rated`, `consentPolicyV`                                | The values frozen at play began                                                                                                                                                                                                         |
| `rulesV`, `replayV`, `replay`                            | `RULES_VERSION`, `1`, and the canonical text of `{ v: 1, s: log.s, a: log.a }`                                                                                                                                                          |
| `startingSeat`, `firstAdvantageSeat`, `firstAdvantageBy` | `log.s`, the final `firstAdvantage`, and the summary                                                                                                                                                                                    |
| `winnerSeat`, `endReason`                                | Final state                                                                                                                                                                                                                             |
| `onlineEndReason`                                        | `opponentAbandoned` → `abandoned`, `opponentIdleTimeout` → `idle`, else `null`                                                                                                                                                          |
| `actionCount`                                            | `log.a.length`                                                                                                                                                                                                                          |
| `statsV`, `statsStatus`, `statsJson`                     | `null`, `none`, `null` until H4; a failing derivation gives its version, `error`, and `null`. Outside the hash.                                                                                                                         |
| `startedAt`, `endedAt`                                   | `playBeganAt` and the handler's `now`                                                                                                                                                                                                   |
| `players`                                                | A then B: the verified `userId`; `win`/`loss` from `winnerSeat`, else `draw`; `piecesLeft` = that seat's pieces on the final board, never pieces in hand (a placement-phase ending counts placed pieces only); `players[seat].captured` |

### 4.4 Attempts and the alarm

One routine serves the inline attempt, the alarm, and `ops retry`. It sets
`firstAttemptAt` on the first attempt, counts `attempts`, and treats a
missing `DB` binding as an ordinary failure. After awaiting `saveMatch` it
re-reads `room` and the entry, as `handleJoin` does after ticket
verification, and applies the outcome only if the entry still exists:

| Case            | Effect                                                                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `saved`         | One `ctx.storage.transaction` deletes the key and updates `room`; `lastSave` becomes `saved` with the id; `matchStatus` is broadcast.                                                                                                                                                                              |
| `conflict`      | `stalled: integrity` with no deadline; error log `matchSaveIntegrity { roomCode, matchNumber, matchId }`.                                                                                                                                                                                                          |
| `failed`        | `lastError` keeps 200 characters. The delay after the k-th attempt is 5 s, 30 s, 2 min, 10 min, 30 min, then 60 min. If `now + delay` passes `firstAttemptAt + 72 h` the entry becomes `stalled: retriesExhausted` (error log `matchSaveStalled`), else it waits (warn log `matchSaveRetry`). At most 77 attempts. |
| Afterwards      | The hold is synced (§4.5), and a retained room left without entries runs its deferred cleanup.                                                                                                                                                                                                                     |
| `alarm()`       | Runs each due pending entry, oldest match first, then the idle logic. It catches every attempt error, so the platform never retries an alarm because of D1.                                                                                                                                                        |
| `scheduleAlarm` | The earliest of the idle and claim deadlines (live rooms only), each pending `nextAttemptAt`, and `now + 60 s` while `holdSynced` is false; with none, the alarm is deleted. Stalled entries add no deadline, and a past-due `nextAttemptAt` causes one attempt, never a catch-up loop.                            |

### 4.5 Idle expiry and retention

| Case             | Behaviour                                                                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unsaved` empty  | Unchanged: close sockets, release, `deleteAll()`.                                                                                                                                                                                                                                                   |
| Entries remain   | Close sockets (`1001`), set `expiredAt`, keep every key. WebSocket upgrades get the existing 404 `Room not found`, and `initializeRoom` still answers 409, so the code is not reused. After the last entry is saved or discarded: `release` with `roomCreatedAt`, then `deleteAll()`.               |
| Coordinator hold | `holdsUnsaved: true` while the room is retained or any entry is stalled or has failed an attempt; cleared when none remains. The call is idempotent; until it is acknowledged, `holdSynced` stays false and re-arms the alarm every 60 s. A save that succeeds at once never calls the coordinator. |

### 4.6 Old rooms and cached clients

| Case                          | Behaviour                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room stored before the deploy | It has no `log`. If its match has not begun (the state equals `createInitialState(state.startingPlayer)`), the first accepted action creates the log. Otherwise that match is never saved: game over creates no entry and logs `matchLogMissing` at info level. The next rematch starts a normal log. |
| Cached client                 | Sends no `matchNumber` (accepted) and no options (friendly), strips the new `matchStatus` keys, and shows its generic `invalid.actionRejected` text for `savingEarlierGames`. Deploys follow [§6.5](v2-contracts.md#65-deploy-order).                                                                 |

## 5. Privacy and access

| Data           | Rule                                                                                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visibility     | H1 serves no page or loader. `rated` is the only visibility input (P2), so every wave-1 row falls under the friendly `/match/<id>` row of [§5](v2-contracts.md#5-access-matrix), and a match's participants are exactly its two `match_player.user_id` values. |
| User ids       | Only from verified seat identities, never from a client message; kept in the outbox payload and D1; never broadcast, logged, or returned by the ops route.                                                                                                     |
| `save.matchId` | Sent only to the room's two joined seats.                                                                                                                                                                                                                      |
| Names          | No username, avatar, or display text in the ledger (P5); the game Worker never reads `user`, `account`, `session`, or `verification`.                                                                                                                          |
| Logs and audit | Logs carry `roomCode`, `matchNumber`, `matchId`, and error text, never a replay or user id; the audit table holds no player identifier.                                                                                                                        |

## 6. Resource budget

| Resource                  | Normal game                                                                                                    | Failure path                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D1 writes per saved match | One batch, 3 rows; about 12 billed row writes counting index entries                                           | A failed batch writes nothing                                                                 |
| D1 reads                  | Foreign-key and uniqueness probes only                                                                         | One indexed `SELECT` per failed attempt                                                       |
| D1 requests               | 1                                                                                                              | At most 77 per entry over 72 h                                                                |
| DO storage writes         | `room` + `log` per accepted action (today `room` only); the terminal write adds the entry; the save removes it | One write per attempt                                                                         |
| DO wake-ups               | None added: the save runs in the terminal handler, one D1 round trip                                           | At most 76 alarms per entry; none once stalled; hold resends only while the coordinator fails |
| DO storage per room       | `log` ≤ 13.9 KB; up to three entries of ≤ 15 KB                                                                | Kept until saved or discarded                                                                 |
| Coordinator calls         | None                                                                                                           | One hold and one clear per room with a failed save                                            |
| Ledger size per match     | Replay ≈ 1.4 KB p50, 2.8 KB p95, 13.9 KB max, plus under 1 KB of columns and index entries                     | —                                                                                             |

For scale only: 1,000 saved games a day is about 12,000 row writes (the D1
free plan allows 100,000 a day) and about 2 MB of ledger.

## 7. Somali copy

Both strings go under `onlineGame.errors` in `packages/i18n`, behind
`TODO(translation-review)`:

| Key                                    | Draft                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `onlineGame.errors.savingEarlierGames` | Ciyaarihii hore weli waa la kaydinayaa; dib-u-ciyaarka mar kale isku day wax yar kadib. |
| `onlineGame.errors.staleMatch`         | Tallaabadaas waxay ku socotay ciyaar dhammaatay.                                        |

Nothing else visible changes: no string names the starting seat, a retained
room shows the existing `roomNotFound`, and save status stays invisible
until H2.

## 8. Implementation slices

1. `docs: apply V2 §6.1, §6.5, and §6.6 to AGENTS.md and the PRD`: in
   AGENTS.md §Locked stack and §Accounts / Identity, and PRD §4, §15.2,
   §16.3, §17.4, and the V1.1-A2 constraints (marked historical), the game
   Worker may write the match ledger through its own D1 binding, still
   without Better Auth, session cookies, or reads of auth tables; the
   starting seat is random for a room's first game and alternates on
   rematch, in every room, and the client never assumes a seat starts; an
   invite game is friendly, private to its two players, unless both accept
   rated play before play begins (R2 builds the handshake), rated games are
   public, and after play begins a resignation or valid claim is a loss in
   every phase while an earlier ending saves nothing. X1b's first commit
   adds P13.
2. `test(engine): cover compact replay, first-advantage origin, and the E4 bound`
3. `feat(engine): add RULES_VERSION and the compact replay codec`
4. `feat(shared): add stored replay, match payload, and protocol schemas`
5. `feat(shared): add writesLedgerRow in @shaxda/shared/rated-play`
6. `feat(db): add the match ledger and ops audit migration`
7. `feat(db): add the @shaxda/db/match ledger writer`
8. `chore: guard worker sources against auth tables and bare @shaxda/db`
9. `fix(web): read the starting seat from authoritative state in the client and e2e`
10. `test(online): pin seat A in room test helpers`
11. `feat(online): randomise the first starting seat and alternate on rematch`
12. `fix(online): accept a player's own off-turn resignation`
13. `feat(online): reject stale match numbers`
14. `feat(online): store rated requests, consent slots, and play start`
15. `feat(online): record the compact action log with the room`
16. `build(online): bind D1 in the game Worker and share the e2e database`
17. `feat(online): save persistable matches through the per-match outbox`
18. `feat(online): retain rooms with unsaved matches and hold their codes`
19. `feat(online): add the match ops route and pnpm match:ops`
20. `feat(web): send match numbers, expose save status, and add error copy`
21. `test(e2e): save a real account game into the shared ledger`
22. `docs(ops): add the H1 rollout, alerts, and ops command`

Every commit keeps `pnpm check` green; engine, db, and room slices are
test-first.

## 9. Acceptance tests

### Unit (engine, shared)

| Case             | Expectation                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codes            | Every action type round-trips; `early-resignation` (B resigns on A's turn) encodes as `R:B` and decodes to its expected state.                                                                                                                                                                                                                             |
| Full replays     | `serialize` equality for every `fullGameActionScripts` entry, 1,000 seeded fuzz playouts, and the E4 game below. The `a2ConformanceActionScripts` start mid-game, cannot be compact replays, and stay reducer tests.                                                                                                                                       |
| Refusals         | The right `actionIndex` for an unknown prefix, `P:X9`, `M:O1>O1`, `v: 2`, `R:C`, a reducer refusal, and 1,404 codes (refused before replaying).                                                                                                                                                                                                            |
| First advantage  | Starter forms first; opponent forms first; the 24th placement forms the first jare; no jare (`noJareFallback`); `null` after a placement-phase resignation.                                                                                                                                                                                                |
| E4 bound         | The proof's scratch fixture is not in the repository, so the test regenerates a maximal game by the E4 method from a fixed seed: 24 placements, 2 removals, then 17 cycles of 79 quiet moves, a jare move, and a capture. It is legal, has 1,403 actions, encodes to 13,922 bytes, and validates. `parseStoredReplay` refuses 16,385 bytes before parsing. |
| Ledger predicate | `writesLedgerRow` gives the §4.1 answer for a guest seat, an ending before play, a room cleaned up without `gameOver`, and an action or claim after play.                                                                                                                                                                                                  |
| Payload and hash | The schema refuses each §2.1 cross-field violation; `matchPayloadHash` matches a fixed vector, is equal for payloads that differ only in the three stats fields, and differs when any other field does.                                                                                                                                                    |
| Protocol         | Options default to `false` and refuse `mode`; a frozen copy of the pre-H1 `serverMessageSchema` parses the new `matchStatus` with its keys stripped; the three frames accept an optional `matchNumber`.                                                                                                                                                    |

### Workers and D1 (`packages/db`, `worker/`)

| Case                                | Expectation                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration                           | Applies after `0000`; `PRAGMA` shows the §2.1 columns and indexes; each `CHECK`, one account in both seats, and a third seat are refused; the conflict `SELECT` uses the unique index (`EXPLAIN QUERY PLAN`).                                                                |
| Writer                              | First save: one match, two seats, `existed: false`; the same payload again: `existed: true`, one row; another payload under the same key: `conflict`; a failing seat insert rolls back the match row; `seq` follows insert order.                                            |
| Starting seat                       | `crypto.getRandomValues` mocked to each outcome gives that `startingPlayer`; 20 unmocked inits give both; rematches alternate twice; guest rooms too. The room test helper pins seat A, so the existing suite is unchanged.                                                  |
| Transport                           | Own off-turn resignation accepted in placement, removal, movement, and capture; an off-turn move, or resigning for the other seat, gets `notYourTurn`; a stale `matchNumber` on each frame gets `staleMatch` and changes nothing; frames without it are accepted.            |
| Options                             | `ratedRequest` defaults to `false` and is stored and broadcast; `rated` is `null` before play and `false` after the first placement, even with `ratedRequest: true`.                                                                                                         |
| Log                                 | One `put({ room, log })` per accepted action; an activity refresh writes `room` only; the replay equals `encodeCompactReplay` of the driven script and decodes to the broadcast state; claims end with `R:<seat>`.                                                           |
| Sample matches                      | The table below, through the real room; also a resignation before play, on and off turn, and a claim before play: no entry.                                                                                                                                                  |
| Crash before broadcast              | A test seam throws right after the terminal `put`: a reconnecting client gets `gameOver` and `save: pending`; the alarm saves; `saved` with the id follows.                                                                                                                  |
| Lost commit response                | Attempts fail while `match_player` is dropped; the test restores it and writes the stored payload with the writer; the next alarm reports `saved`, same id, one row.                                                                                                         |
| Conflicting duplicate               | A stored row with the same key and another hash: `stalled: integrity`, error log, no alarm, listed.                                                                                                                                                                          |
| Backoff                             | On a fake clock, attempts at 0, 5 s, 35 s, 2 min 35 s, 12 min 35 s, 42 min 35 s, then hourly; `stalled` after the 77th. An unbound `DB` follows the same schedule and saves once bound.                                                                                      |
| Two pending; rematch during a retry | Both entries save in match order when D1 returns; the running game is unaffected; `save` follows the newest persistable match.                                                                                                                                               |
| Limit                               | With three unsaved entries an `accept` vote gets `savingEarlierGames` and is not recorded; after one save it is accepted.                                                                                                                                                    |
| Idle expiry while unsaved           | Sockets closed, keys kept, reservation held; a WebSocket upgrade gets 404; a forced reuse of the code gets 409, and the creator gets another code; after the save, cleanup deletes storage and releases the reservation.                                                     |
| No past-due alarm loop              | A retained room whose entries are all stalled has no alarm; with a pending entry the alarm equals its `nextAttemptAt`; a coordinator with only held reservations has no alarm, and they do not count toward capacity.                                                        |
| Replay mismatch                     | A corrupted `log` (through `runInDurableObject`): `stalled: replayMismatch`, `matchReplayMismatch` logged without user ids, no D1 call, `retry` → 409.                                                                                                                       |
| Old rooms                           | Stored mid-match without `log` or the new fields: normalises, plays on, and ends with no entry and an info log. Stored before its first action: creates its log and saves.                                                                                                   |
| Statistics error (P21)              | A throwing statistics stub gives `stats_status = 'error'`, `stats_json` null, and a saved row; H4 repeats this with its derivation.                                                                                                                                          |
| Ops route                           | No token secret or rate-limit binding → 503; a wrong or missing bearer → 401; `Origin` → 403; `OPTIONS` → 404 without CORS headers; over the limit → 429; list, retry, and discard, with `entryMismatch`, `noEntry`, `notRetryable`, and the cleanup after the last discard. |
| Command and guard                   | Audit rows keep reasons with quotes, newlines, and non-ASCII intact; `discard` without `--reason` exits nonzero before any request; `pnpm check:hibernation` fails on fixtures with a bare `@shaxda/db` import or `FROM user`.                                               |

### Web and end to end

| Test                         | Expectation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web client                   | Parses `matchStatus` with and without the new fields and exposes `save`; frames carry the last known `matchNumber`; no turn indicator before the first authoritative `state`, at join or after a rematch; `online-board` carries `data-current-player` (the acting seat) and `data-save-status`; both new codes show their copy.                                                                                                                                                                                     |
| Existing online specs        | `online-game.spec.ts` and `online-identity.spec.ts` read `data-current-player` instead of assuming seat A.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `online-ledger.spec.ts` (E2) | Two seeded accounts place three pieces, then the seat not on turn resigns; both pages reach `data-save-status="saved"`. A read-only `wrangler d1 execute --json` through `web/wrangler.e2e.jsonc` (the web Worker's binding) finds one `match` row (`rated = 0`, `action_count = 4`, `end_reason = 'resignation'`) and two `match_player` rows with the seeded ids, and the replay decodes to the final state. A rematch adds `match_number = 2` with the other starting seat; a guest-vs-account game adds nothing. |
| Harness                      | `e2e-infra.spec.ts` finds the shared D1 under `test-results/wrangler-e2e`; `pnpm check:e2e-isolation` probes `worker/wrangler.e2e.toml`.                                                                                                                                                                                                                                                                                                                                                                             |

### Sample matches

As H1 writes them in wave 1
([§4.3](v2-contracts.md#43-canonical-sample-matches)):

| ID  | Setup (wave 1)                     | Ending                                                           | H1 writes                                                                                                               | Once R2 is live                                |
| --- | ---------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| M1  | Two accounts                       | A wins by pieces                                                 | Row: `rated = 0`, `consent_policy_v` null, `opponentBelowThree`, A `win`, B `loss`                                      | Unchanged                                      |
| M2  | Two accounts, `ratedRequest: true` | B resigns in placement after 3 actions (off turn when B started) | Row: `rated = 0`, `resignation`, winner A, `action_count = 4`, no first advantage, `pieces_left` counting placed pieces | `rated = 1`, public                            |
| M3  | Two accounts, `ratedRequest: true` | Idle claim while A owes a capture                                | Row: `rated = 0`, `resignation`, `online_end_reason = idle`, last code `R:A`, A `loss`                                  | `rated = 1`, public                            |
| M5  | Two accounts, `ratedRequest: true` | 80 movement turns without a capture                              | Row: `rated = 0`, `drawTermination`, no winner, both `draw`                                                             | `rated = 1`, public                            |
| M6  | Guest vs account                   | Any                                                              | No entry, no row                                                                                                        | Same                                           |
| M7  | Two accounts, `ratedRequest: true` | Creator resigns before any action, on or off turn                | No entry, no row                                                                                                        | Same                                           |
| M9  | Two accounts, a rematch            | Rematch played                                                   | Second row: `match_number = 2`, the other `starting_seat`, `rated = 0`                                                  | Stays `rated = 0` when either vote is friendly |

Every wave-1 row has `rated = 0`, so only A and B can open it (H2). M4, M8,
and M10 add nothing here: M4's and M8's rows are written like M2's
(`rated = 1`, public once R2 is live), and the pair cap and invalidation
are rating decisions (R1, R6) that never change the row; deletion never
touches the ledger (no foreign key to `user`, no snapshot).

## 10. Rollout and rollback

| Item                   | dev                                                                                                                         | e2e                                                                                                                                                                                                                                                                                                                                                                                                                                    | preview                                | production                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------ |
| `DB`                   | `worker/wrangler.toml` → `shaxda-db` with `web/wrangler.jsonc`'s id; `pnpm dev:worker` persists to `../web/.wrangler/state` | New `worker/wrangler.e2e.toml` → `shaxda-db-e2e` (`local-e2e-database`)                                                                                                                                                                                                                                                                                                                                                                | `shaxda-db-preview`                    | `shaxda-db`                    |
| Migrations             | `wrangler d1 migrations apply --local` from `web/`, once for both Workers                                                   | Game launcher, before `wrangler dev`                                                                                                                                                                                                                                                                                                                                                                                                   | Operator, `web/wrangler.preview.jsonc` | Operator, `web/wrangler.jsonc` |
| `MATCH_OPS_TOKEN`      | Dev value in `[vars]`, pinned in `worker/vitest.config.ts`                                                                  | `worker/.env.e2e`                                                                                                                                                                                                                                                                                                                                                                                                                      | Wrangler secret                        | Wrangler secret                |
| `MATCH_OPS_RATE_LIMIT` | Binding                                                                                                                     | Binding                                                                                                                                                                                                                                                                                                                                                                                                                                | Binding                                | Binding                        |
| Ops route              | `127.0.0.1:8787`                                                                                                            | `127.0.0.1:8787`                                                                                                                                                                                                                                                                                                                                                                                                                       | `workers.dev` host                     | New route `shaxda.app/ops/*`   |
| Harness                | —                                                                                                                           | Per [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e): `scripts/start-worker-e2e.mjs` cleans `test-results/wrangler-e2e`, applies the migrations, and starts `wrangler dev` with `wrangler.e2e.toml` and `--env-file .env.e2e`; `scripts/start-web-e2e.mjs` and the seeding fixture use that directory without cleaning or migrating it (`test-results/wrangler-web-e2e` is retired); ledger reads wait for `save.status = "saved"`. | —                                      | —                              |

| Step       | Action                                                                                                                                                                                              | Check                                                                                                                                                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order      | Migration → game Worker → web Worker ([§6.5](v2-contracts.md#65-deploy-order)); no kill switch, since saving is not optional ([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)) | —                                                                                                                                                                                                                                                                                                                       |
| Preview    | Apply the migration, set `MATCH_OPS_TOKEN`, deploy the game Worker, then the web Worker                                                                                                             | Two real accounts finish a game (a placement resignation is quickest) and a rematch; `match:ops -- verify` shows one row per match, replays that decode to the final state, recomputed hashes, and the other starting seat; `list-unsaved` is empty; a guest-vs-account game and a resignation before play leave no row |
| Production | The same, once H2's `/legal` disclosure is live, so disclosure precedes collection                                                                                                                  | For one week, Workers logs for `matchReplayMismatch`, `matchSaveIntegrity`, and `matchSaveStalled`, and `list-unsaved` for held rooms; results go to the ops record, and this spec claims nothing about production                                                                                                      |
| Rollback   | Only while `list-unsaved` is empty: an older game Worker would `deleteAll()` unsaved entries at idle expiry                                                                                         | The migration stays                                                                                                                                                                                                                                                                                                     |

**Done when** `pnpm check` and `pnpm test:e2e` pass with the tests above;
the preview checks pass with two real accounts;
`docs/ops/launch-runbook.md` and `docs/ops/billing-alerts.md` list the
binding, the secret, and the three log events; and the README marks H1
`shipped@<date>` only in its shipping commit, after the production watch.
