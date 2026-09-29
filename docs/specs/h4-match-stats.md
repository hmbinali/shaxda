# H4 — Match Statistics (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status     | `frozen@5c6d76a` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                          |
| Wave       | 4; may start any time after wave 1                                                                                                                                                                                                                                                                                                                                             |
| Depends on | H1, H2; X1a for the nightly backfill (§4.2)                                                                                                                                                                                                                                                                                                                                    |
| Register   | F7, P21                                                                                                                                                                                                                                                                                                                                                                        |
| Contracts  | Owns §3 below. Consumes [§2.1](v2-contracts.md#21-h1-tables), [§2.2](v2-contracts.md#22-writer-invariants-and-the-payload), [§2.4](v2-contracts.md#24-compact-replay), [§3.4](v2-contracts.md#34-game-rules-inside-the-room), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§10.1](v2-contracts.md#101-one-cron-one-dispatcher) |
| Brief      | [`docs/shaxda-v2.md`](../shaxda-v2.md) §9 (H4), §7.2                                                                                                                                                                                                                                                                                                                           |
| Touches    | `packages/shared` (stats module, fixtures), `worker/` (game over), `packages/db` (backfill core), H1's `match:ops` CLI, `packages/i18n`, `web/` (match loader and panel), `docs/ops/`                                                                                                                                                                                          |

H4 derives Shaxda statistics from a saved match's replay with one pure
function, stores them on the `match` row, fills older or failed rows with a
resumable backfill, and shows five of them on `/match/<id>` to exactly the
viewers who may open that match. It leaves replay format and validation to
H1, page access and layout to H2, replay viewing to H3, and player-level
totals to R4. [`docs/shaxda_game.md`](../shaxda_game.md) is authoritative
for the rules the counters describe.

## 1. Outcome and non-goals

**Outcome.** Every saved match carries a versioned `MatchStatsV1` derived
only from its replay, or a `none` or `error` status that the backfill later
clears. The match page compares both seats and never shows zeros for
statistics it does not have.

### Must

1. A pure module, `@shaxda/shared/stats`, that turns a decoded replay into
   `MatchStatsV1` under the counting contract (§3.2), with no I/O.
2. Derivation at game over in the Match DO, after H1's replay validation; a
   failure stores `error` and the save goes ahead (P21).
3. A bounded, resumable, compare-and-set backfill of `none` and `error`
   rows that never rewrites `ok` rows and reports what it cannot fill.
4. The F7 panel on `/match/<id>`, visible exactly where the match is (§5),
   with "statistics unavailable" instead of false zeros.
5. A typed read helper, for the panel and R4, that never exposes raw JSON
   or user ids.

### Should

None: player-level totals belong to R4.

### Not in H4

Player-level totals, averages, or an aggregate table (R4 aggregates stored
per-match statistics; public numbers use processed rated events only, P8);
style labels; analytics dashboards; rating, leaderboard, or rule changes;
guest or local statistics; replay controls; per-move D1 rows; changes to
the compact replay or ledger schema; a migration; statistics in OG images or
sitemaps.

## 2. Decisions and dependencies

| ID     | How H4 applies it                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F7     | The panel shows exactly captures, jare, repeated jare, movement turns, and the comeback badge. `comeback` is F7's rule: the winner trailed by at least two captures after movement began. |
| P21    | Statistics never block a save. A derivation error stores the match with `stats_status = 'error'`, `stats_json = NULL`, and `stats_v` = the version attempted; the backfill retries.       |
| F2, P2 | The panel has the match's visibility: rated → public; friendly → its two players only, with the same 404 as an unknown id.                                                                |
| P8     | Public Shaxda aggregates use processed rated events only. H4 stores per-match values and publishes no totals; R4 aggregates them.                                                         |

| Dependency    | What it provides                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1            | The compact replay, decoder, and schema ([§2.4](v2-contracts.md#24-compact-replay)); replay validation before the outbox entry ([§3.4](v2-contracts.md#34-game-rules-inside-the-room)); the payload's `statsV`, `statsStatus`, `statsJson`, and `payload_hash` ([§2.2](v2-contracts.md#22-writer-invariants-and-the-payload)); the stats columns ([§2.1](v2-contracts.md#21-h1-tables)); `stats_status = 'none'` on every save until H4 ships; the `match:ops` CLI ([§3.3](v2-contracts.md#33-cleanup-codes-and-limits)). |
| H2            | The `/match/<id>` loader and its access decision ([§5](v2-contracts.md#5-access-matrix)), the reserved slot, player labels (current name or the neutral label, P5), and the ledger's capture counts.                                                                                                                                                                                                                                                                                                                      |
| H3 (optional) | The position model `0..N`: `afterAction` is an H3 position. Without H3 the panel takes H2's slot alone, and H3 later mounts above it.                                                                                                                                                                                                                                                                                                                                                                                     |
| Engine        | `applyAction`, `formsNewJare`, `hasLegalMoves`, `DRAW_TURN_LIMIT`, and `GameState` through the public `@shaxda/game-engine` API.                                                                                                                                                                                                                                                                                                                                                                                          |
| R4 (consumer) | Reads stored statistics through `readMatchStats`; owns aggregates, averages, and their presentation.                                                                                                                                                                                                                                                                                                                                                                                                                      |

## 3. Contracts

### 3.1 Module

The module lives in `packages/shared/src/stats/` behind the `./stats`
export, so the game Worker never loads the broad shared entry. It imports
only the public `@shaxda/game-engine` API and Zod (never Svelte, D1,
Cloudflare, web, or auth code); the engine never imports shared. The replay
is the only input, with no user id, name, clock, mode, rated flag, or online
end reason; claim-win's synthetic `R:<seat>` is an ordinary resignation.

| Export                                                 | Contract                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STATS_V`                                              | `1`: the `v` of every `MatchStatsV1` and the `stats_v` H4 writes.                                                                                                                                                                         |
| `deriveMatchStats({ replayV, startingSeat, actions })` | H1-decoded actions, replayed from `createInitialState(startingSeat)` and re-checked. Returns `{ ok: true, stats }` or `{ ok: false, code, actionIndex? }`; `code` is `unsupportedReplay`, `illegalAction`, `notFinished`, or `invariant`. |
| `matchStatsV1Schema`, `serializeMatchStats(stats)`     | The strict Zod schema and the stable text of §3.3.                                                                                                                                                                                        |
| `readMatchStats({ statsStatus, statsV, statsJson })`   | `{ ok: true, stats }` or `{ ok: false, reason }`; `reason` is `notDerived` (`none`), `derivationFailed` (`error`), `unsupportedVersion`, or `invalid` (bad JSON, schema failure, or `v ≠ stats_v`). Never a zero-filled value.            |

### 3.2 Counting contract

`s[k]` is the state after accepted action `k` (`s[0]` is the initial state,
`1 ≤ k ≤ N`), which is H3 position `k`. X is a seat and Y its opponent.

- **Jare event**: a `place` or `move` for which
  `formsNewJare(s[k-1].board, s[k].board, destination, seat)` holds, the
  same test as H3's jare cue. One event per action, however many lines
  complete. Only a `place` can complete two lines: every neighbour of a
  point lies on one of that point's two lines, so a move vacates one.
- **Movement boundary**: the state after the second initial removal
  (`movement`, or `gameOver` for an immediate blocked draw).
- **Blocked boundary for X**: a state from the movement boundary on, in
  `movement`, where X is `currentPlayer` and `hasLegalMoves` is false; also
  the final state of a `bothBlocked` or `forcedJareSpaceMaking` draw whose
  `currentPlayer` is X.

`SeatStatsV1` is these eleven fields, in this order; every count is a
non-negative integer.

| Field (per seat X)        | Type            | Definition                                                                                                                                                                                                          |
| ------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capturesMade`            | count           | Accepted `capture` actions by X. Initial removals never count.                                                                                                                                                      |
| `capturesSuffered`        | count           | `capturesMade` of Y.                                                                                                                                                                                                |
| `jareEvents`              | count           | X's jare events, in placement and movement.                                                                                                                                                                         |
| `repeatedJareEvents`      | count           | X's movement jare events whose line was complete for X at any earlier state of this replay (a placement jare included), so it was broken and re-formed. Not irmaan, whose protection condition the log cannot show. |
| `firstPlacementJare`      | boolean         | True only for the seat of the first `place` that is a jare event (it won first advantage). Both false if placement ends without one or the game ends first.                                                         |
| `movementTurns`           | count           | Accepted `move` actions by X, space-making included. A move and the capture it earns are one turn.                                                                                                                  |
| `turnsBeforeFirstCapture` | count or `null` | X's `move` actions before the move that earned X's first capture; `null` if X never captured.                                                                                                                       |
| `maxPieceAdvantage`       | count           | Largest of 0 and (X's pieces on the board − Y's) over the states from the movement boundary to the end; 0 if the boundary is never reached.                                                                         |
| `blockedPlayerEvents`     | count           | Maximal runs of consecutive blocked boundaries for X: an episode counts once, when entered, including one that ends the game.                                                                                       |
| `spaceMakingTurns`        | count           | X's `move` actions whose before-state is a blocked boundary for Y (the engine's space-making move); never a jare event.                                                                                             |
| `comeback`                | boolean         | True only if X won (on the board, by resignation, or by claim) and at some state after movement began Y had made at least two more captures than X (F7). False for the loser and for both seats in a draw.          |

| Field (per match)     | Definition                                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phaseTransitions`    | `{ afterAction: k, from: s[k-1].phase, to: s[k].phase }` for every `k` where the phase changes, in order, including changes into `capture` and `gameOver` and a capture's return to `movement`. |
| `longestNoCaptureRun` | Largest `draw.turnsSinceCapture` over all states: completed movement turns without a capture, space-making included, reset by a capture, at most `DRAW_TURN_LIMIT` (80); 0 without movement.    |

Derivation fails with `invariant`, and nothing is stored as `ok`, unless:
the last state is `gameOver` (else `notFinished`); `capturesMade[X]` equals
`s[N].players[X].captured` and `capturesSuffered[Y]`; repeated jare events
never exceed jare events, nor space-making turns movement turns;
`turnsBeforeFirstCapture` is `null` exactly when X made no capture and is
otherwise below `movementTurns`; at most one seat has `firstPlacementJare`,
and it is `s[N].firstAdvantage`; only the winner has `comeback`;
`afterAction` strictly increases and the last transition enters `gameOver`
at `N`; and `longestNoCaptureRun` is at most 80.

| Example                                                                                  | Counted                                                                                                               |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A's `place` completes O1–O2–O3 and O2–M2–I2 at once, the first placement jare            | A: `jareEvents` +1 (one event), `firstPlacementJare` true; a later placement jare by B leaves B's false               |
| A moves a piece out of a line A completed in placement, and later back                   | A: `jareEvents` +1, `repeatedJareEvents` +1                                                                           |
| A completes a line that only B had completed before                                      | A: `jareEvents` +1, not repeated                                                                                      |
| A's sixth move earns A's first capture                                                   | A: `turnsBeforeFirstCapture` = 5                                                                                      |
| B is due to move with no legal move and A makes the space-making move, twice in a game   | B: `blockedPlayerEvents` = 2; A: +2 on both `movementTurns` and `spaceMakingTurns`                                    |
| The game ends `forcedJareSpaceMaking`                                                    | The seat due to move: `blockedPlayerEvents` +1                                                                        |
| From 11–11, captures by A, A, then B                                                     | `maxPieceAdvantage`: A 2, B 0                                                                                         |
| B leads 2–0 in captures and A later wins by any means; A trails by one at worst and wins | A: `comeback` true; false                                                                                             |
| A's move forms a jare, then A is claimed against before capturing (M3)                   | A: `jareEvents` +1, `movementTurns` +1, no capture                                                                    |
| Placements 1–24, removals 25–26, a jare-forming move at 30, its capture at 31            | Transitions `24 placement→initialRemoval`, `26 initialRemoval→movement`, `30 movement→capture`, `31 capture→movement` |

### 3.3 `MatchStatsV1`

```ts
type MatchStatsV1 = {
  v: 1; // statistics semantics; equals match.stats_v
  replayV: 1; // source replay format
  players: { A: SeatStatsV1; B: SeatStatsV1 }; // §3.2, fields in table order
  match: {
    phaseTransitions: Array<{
      afterAction: number; // H3 position, 1..N
      from: "placement" | "initialRemoval" | "movement" | "capture";
      to: "initialRemoval" | "movement" | "capture" | "gameOver";
    }>;
    longestNoCaptureRun: number;
  };
};
```

- The strict Zod schema (no unknown keys, non-negative integers,
  `afterAction ≥ 1`) runs before serialization and after every D1 read.
- `serializeMatchStats` writes keys in the order above and in §3.2, A before
  B, with no whitespace: the same replay always gives byte-identical text,
  and parse, validate, serialize returns the stored text. The text holds no
  user id, name, room code, or timestamp.
- Changing any definition creates `v: 2` with a written backfill plan,
  edited here and in R4 in one commit; stored `v: 1` rows are never
  reinterpreted. A later replay format may still yield `v: 1` if no meaning
  changes. Readers accept only versions they know; anything else is
  unavailable, never zero.

### 3.4 Ledger columns

The columns and their `CHECK`s are H1's
([§2.1](v2-contracts.md#21-h1-tables)); the checks already reject `ok`
without JSON and `error` without `stats_v`. H4 writes them as follows.

| Writer                                                               | When                    | `stats_v`     | `stats_status` | `stats_json` |
| -------------------------------------------------------------------- | ----------------------- | ------------- | -------------- | ------------ |
| H1 before H4 ships, and any outbox entry frozen before the H4 deploy | Game over               | NULL          | `none`         | NULL         |
| Match DO with H4                                                     | Derivation succeeds     | 1             | `ok`           | Serialized   |
| Match DO with H4                                                     | Derivation fails (P21)  | 1 (attempted) | `error`        | NULL         |
| Backfill                                                             | Fills `none` or `error` | 1             | `ok`           | Serialized   |

`payload_hash` excludes the stats fields
([§2.2](v2-contracts.md#22-writer-invariants-and-the-payload)), so neither
H1's retry comparison nor the backfill touches it, and it stays a checksum of
the immutable ledger facts. These three columns are the only ledger columns
that change after insert ([§2.1](v2-contracts.md#21-h1-tables)). H4 adds no
migration, index, or table ([§11](v2-contracts.md#11-migration-ownership)).

## 4. Behaviour and failure handling

### 4.1 At game over

For a persistable match ([§1](v2-contracts.md#1-vocabulary)), after H1's
replay validation and before the single storage `put`
([§3.2](v2-contracts.md#32-storage-and-alarms)):

1. Derive from the validated actions (reusing the validation pass's states
   is allowed) inside a guard that turns an exception into a failure.
2. Cross-check with the payload: `capturesMade` equals each seat's
   `captured`, and `firstPlacementJare` agrees with `firstAdvantageBy` and
   `firstAdvantageSeat`. A disagreement is a failure.
3. Success: `statsV = 1`, `statsStatus = "ok"`, and the `statsJson` text.
4. Failure: `statsV = 1`, `statsStatus = "error"`, `statsJson = null`, and a
   `matchStatsError { matchId, statsV, code, actionIndex }` log line with no
   user id, name, or replay text. The save goes ahead (P21).

Retries write the same frozen bytes and never update statistics.
Derivation adds no alarm, timer, storage key, message, or D1 statement. A
replay mismatch takes H1's `stalled: replayMismatch` path and derives
nothing; guest-seat and pre-play endings have no outbox entry (F8, P1).

### 4.2 Backfill

One core, a function over `D1Database` in `packages/db` tested on Miniflare
D1, runs in two places:

- **Nightly**, in the web Worker's cron dispatcher at 00:15 UTC
  ([§10.1](v2-contracts.md#101-one-cron-one-dispatcher)): the `h4.statsBackfill` lease in X1's `job_state` with the `job_fence`
  guard on every write batch, a
  resumable `seq` cursor, and a bounded number of windows per run, so every
  `error` row is retried without an operator (P21). The game Worker
  never runs it: it reads nothing but its own insert result (P13).
- **On demand**, through
  `pnpm match:ops -- stats-backfill --database <env> [--apply] [--from-seq <n>]`,
  which extends H1's operator CLI
  ([§3.3](v2-contracts.md#33-cleanup-codes-and-limits)) and reaches D1
  through Wrangler for the first backfill after a deploy and for reviews.

1. It is a dry run unless `--apply`, and records `max(seq)` at start; rows
   saved later belong to the next run.
2. It walks windows of 100 `seq` values from `--from-seq` (default 0),
   reading rows with `stats_status IN ('none','error')` and each
   candidate's two `match_player` rows by primary key.
3. Per candidate: supported `replay_v` and `rules_v`, H1's schema and
   decoder, `deriveMatchStats`, and a final state that matches
   `action_count`, `starting_seat`, `winner_seat`, `end_reason`, the
   first-advantage columns, and each seat's `pieces_left` and `captured`.
4. One compare-and-set per row, batched per window, with `?4` the status it
   read (`changes = 1` is filled, `0` is skipped):

   ```sql
   UPDATE match SET stats_v = ?1, stats_status = 'ok', stats_json = ?2
    WHERE seq = ?3 AND stats_status = ?4 AND replay_v = ?5 AND replay = ?6;
   ```

5. A row that fails a check keeps its status and is reported by `seq`, `id`,
   and code; the run carries on and exits nonzero at the end.
6. Every run prints filled, skipped, and failed counts and the last
   completed window, where `--from-seq` resumes. A rerun from 0 is safe:
   `ok` rows never match.

It writes only the three stats columns of `none` and `error` rows, and
never zeros for a bad replay; rating state lives in R1's own tables, so it
can run beside R1's processor. It runs from the commit deployed to that
environment, and preview and production runs are explicit operator steps,
never a test or deploy side effect.

### 4.3 Reading and the panel

- H2's match query also selects the three stats columns. After H2's access
  decision, H4 calls `readMatchStats` and adds `stats` to the page data:
  `{ kind: "unavailable" }` or `{ kind: "ok", seats }`, each seat being
  `{ captures, jare, repeatedJare, movementTurns, comeback }` from
  `capturesMade`, `jareEvents`, `repeatedJareEvents`, `movementTurns`, and
  `comeback`.
- `none` and `error` read as unavailable without a diagnostic (the backfill
  report covers them); `unsupportedVersion` and `invalid` also log a server
  diagnostic with the match id and reason.
- The panel sits in H2's slot, after H3's viewer when present: a table with
  the players as columns (seat colours, H2's labels) and captures, jare,
  repeated jare, and movement turns as rows. The comeback badge appears only
  in the winner's column, with the Somali help line under the table.
  Unavailable shows one Somali line and no numbers. Captures appear once:
  in the panel, or from the ledger's `captured` in H2's details.

## 5. Privacy and access

H4 implements the two `/match/<id>` rows of
[§5](v2-contracts.md#5-access-matrix) for its statistics:

| Match                                                      | Signed out or unrelated account                                | Participant |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ----------- |
| Rated (`rated = 1`), including pair-capped and invalidated | Panel shown                                                    | Panel shown |
| Friendly (`rated = 0`)                                     | The same 404 as an unknown id; the response holds no statistic | Panel shown |

- Statistics travel only in H2's loader response for `/match/<id>` (its
  `__data.json` included), after H2's access decision. H4 adds no route,
  API, cache rule, OG content, or sitemap entry; friendly responses keep
  H2's `no-store` and `noindex`.
- Panel data is the five values per seat: no user id, email, room code,
  replay, or raw stats JSON. Statistics hold no identity (P5), so a rename
  or deletion (M10) changes nothing. Logs and backfill reports carry match
  ids, `seq`, and error codes only.
- R4's public Shaxda aggregates use processed rated events only (P8), read
  through `readMatchStats`; H4 exposes no aggregate.

## 6. Resource budget

| Path       | D1                                                                                                                                                                                                         | Durable Object                                   | Storage                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Game over  | No extra statement: statistics ride in H1's insert batch                                                                                                                                                   | No extra wake-up, alarm, storage key, or message | ≈ 0.6 KB (M2), ≈ 1.6 KB (9 captures), under 3 KB worst case (at most 37 transitions); in the outbox entry, then the row |
| Match page | No extra query: three more columns on H2's read by id                                                                                                                                                      | —                                                | —                                                                                                                       |
| Backfill   | `max(seq)` once; each `match` row read once by primary key; two `match_player` reads and one `UPDATE` per candidate; 3 D1 calls per window of 100; the nightly run stops after a bounded number of windows | —                                                | —                                                                                                                       |

- Backfilling 10,000 `none` rows reads about 40,000 rows and writes 10,000.
- Derivation is one pass over at most 1,403 actions (proof E4,
  [§12](v2-contracts.md#12-evidence)). A disposable local run on 2026-09-29
  (Node 24.20, 1,000 seeded random legal playouts) cost about 5.5 µs per
  action, so about 8 ms for the longest legal game. That is not a Workers
  figure; the Worker test records the time for the longest golden.

## 7. Somali copy

Strings live in `packages/i18n` under `matchStats`, behind
`TODO(translation-review)` until the Q4 native review
([glossary](README.md#somali-glossary-drafts-q4)). `jare` stays unchanged.

| Key                        | Draft                                                                                       | Note                             |
| -------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| `matchStats.heading`       | Tirakoobka ciyaarta                                                                         | Table caption                    |
| `matchStats.captures`      | Qabashooyin                                                                                 | Same word as H2's captures label |
| `matchStats.jare`          | Jare                                                                                        |                                  |
| `matchStats.repeatedJare`  | Jare soo noqnoqda                                                                           | Existing board-gallery term      |
| `matchStats.movementTurns` | Dhaqaaqyo                                                                                   |                                  |
| `matchStats.comebackBadge` | Soo kabasho                                                                                 | Winner's column only             |
| `matchStats.comebackHelp`  | Guuleystuhu wuxuu ka dambeeyay ugu yaraan laba qabasho kadib markii dhaqdhaqaaqu bilaabmay. | F7 rule                          |
| `matchStats.unavailable`   | Tirakoobka ciyaartan lama heli karo hadda.                                                  | Replaces the numbers; no zeros   |

## 8. Implementation slices

1. `test(shared): add complete replays and golden match statistics`
2. `feat(shared): derive versioned match statistics` (§3)
3. `feat(worker): store match statistics with each saved match` (§4.1)
4. `feat(db): backfill missing match statistics` (§4.2)
5. `feat(i18n): add Somali match statistics copy`
6. `feat(web): show match statistics on the match page`
7. `test(e2e): cover the match statistics panel`
8. `docs(ops): add the H4 release and backfill steps`

## 9. Acceptance tests

| Layer                                  | Must pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Goldens (`packages/shared`, Vitest)    | A `MatchStatsV1` golden for every `fullGameActionScripts` entry that ends in `gameOver` (`placement-through-initial-removal` stops at movement and returns `notFinished`), and for new complete replays from the empty board whose goldens change only in reviewed diffs: a placement jare by the starter and one by the other seat; a two-line placement; a movement capture; a repeated exact-line jare; a blocked episode with space-making; `forcedJareSpaceMaking`, 80-turn, and repetition draws; a two-capture comeback; a one-capture-deficit win; a resignation with a capture pending. `bothBlocked` cannot occur in legal play (E4), so it is tested on the conformance state. |
| Properties                             | Every golden also passes mirrored (A and B swapped, starting seat included). The §3.2 invariants hold on every golden and on the engine fuzz harness's seeded playouts; every serialized value is under 3 KB. Initial removals never add captures; `longestNoCaptureRun` follows the engine clock, reset included; each `afterAction` is the position where the phase changes; a board test pins "a move completes at most one line".                                                                                                                                                                                                                                                     |
| Determinism and rejection              | The same replay gives byte-identical text, as does encode, decode, derive; parse, validate, serialize returns the stored text. Truncated, illegal, unsupported, and unfinished replays fail with the right code and index. `readMatchStats` returns the right reason for `none`, `error`, an unknown version, bad JSON, an extra key, and `v ≠ stats_v`.                                                                                                                                                                                                                                                                                                                                  |
| Worker (Workers Vitest pool)           | A finished account match saves `ok` statistics in H1's single batch, equal to `deriveMatchStats` on the stored replay. With the deriver forced to throw, the match saves with `stats_status = 'error'`, `stats_v = 1`, `stats_json = NULL`, the log line has no user id, and `matchStatus.save` reaches `saved`. A retry after a lost D1 response keeps one row and identical statistics; a rematch gets its own; a guest-seat game writes nothing; M3 adds no capture; an outbox entry frozen with `none` saves as `none`. `pnpm check:hibernation` passes with no new alarm or storage key.                                                                                             |
| Backfill (`packages/db`, Miniflare D1) | With seeded `none`, `error`, and `ok` rows, a bad replay, and a stored-field mismatch, `--apply` fills each `none` and `error` row once, keeps `ok` rows byte-identical, reports the bad rows unchanged, and exits nonzero. A second run and a dry run change nothing. A concurrent fill (status changed between read and write) is skipped. Every non-stats column, `payload_hash` included, is unchanged. A run stopped after one window and resumed with `--from-seq` ends in the same state. `EXPLAIN QUERY PLAN` shows primary-key access for windows and player reads.                                                                                                              |
| Loader (Vitest)                        | `ok` gives panel data and every other reason `unavailable`, with a diagnostic only for `unsupportedVersion` and `invalid`. No user id, email, room code, replay, or raw-only key (`phaseTransitions`, `capturesSuffered`) appears, checked structurally and by scanning for seeded ids.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Access (Vitest, Playwright)            | On the page and on its `__data.json`: a rated match shows the panel signed out; a friendly match returns the unknown-id 404, with no statistic in the body, to a signed-out viewer and to an unrelated account; its two players see the panel.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Panel (Playwright)                     | Five values per seat; the badge only for a winner with `comeback`, with the help line; unavailable shows no digits; captures appear once; table semantics hold at 320 px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| E2E (shared local D1, contracts §10.4) | Once a real account game's `matchStatus.save.status` is `saved`, a participant sees the stored values; a seeded rated row shows the panel signed out; a seeded `none` row shows the unavailable line until the local backfill runs.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Sample matches ([contracts §4.3](v2-contracts.md#43-canonical-sample-matches))

| ID  | Ledger                                       | H4 statistics                                                                                                                                  | Panel                                       |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| M1  | Friendly row; A wins by pieces               | `ok` at game over                                                                                                                              | A and B only; others get the unknown-id 404 |
| M2  | Rated row; B resigns after three placements  | `ok`: every counter 0 or false, `turnsBeforeFirstCapture` `null`, `phaseTransitions` `[{ afterAction: 4, from: "placement", to: "gameOver" }]` | Public                                      |
| M3  | Rated row; idle claim while A owes a capture | `ok`: A's jare-forming move counts in `jareEvents` and `movementTurns`; captures equal the engine's, none added                                | Public                                      |
| M4  | Rated row; pair-capped                       | `ok`; "not counted" changes no statistic                                                                                                       | Public                                      |
| M5  | Rated row; 80-turn draw                      | `ok`: `longestNoCaptureRun` = 80; no comeback                                                                                                  | Public                                      |
| M6  | Guest vs account                             | No row: nothing derived or backfilled                                                                                                          | —                                           |
| M7  | Resign before any action                     | No row                                                                                                                                         | —                                           |
| M8  | Rated row; later invalidated                 | Unchanged                                                                                                                                      | Public                                      |
| M9  | Friendly rematch                             | Its own row and statistics                                                                                                                     | A and B only                                |
| M10 | B deletes the account after M2               | Unchanged; B shows as the neutral label (H2)                                                                                                   | Public                                      |

## 10. Rollout and rollback

| Environment | Steps                                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev         | Miniflare D1: `pnpm match:ops -- stats-backfill --database local`, then with `--apply`.                                                                                                                                                                                               |
| e2e         | Shared local D1 ([§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)); tests seed rows and call the backfill core.                                                                                                                                                                    |
| preview     | Game Worker, then web Worker ([§6.5](v2-contracts.md#65-deploy-order); no migration). Play friendly and rated account games; check `ok` rows and the panel signed out, as a participant, and as an unrelated account. Backfill dry run, `--apply`, then a rerun that changes nothing. |
| production  | The same order after preview passes. The operator runs the first backfill (dry run, then `--apply`) after the deploy; afterwards the nightly job fills new `none` and `error` rows. Status counts before and after, and every reported row, go in the ops record.                     |

- Until R2 activates, every saved match is friendly (wave 1), so the panel
  is participant-only until then.
- Kill switch: none, as in
  [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone);
  statistics cannot block a save (P21), and the panel degrades gracefully.
- Rollback: the previous web version removes the panel and changes no data;
  the previous game version saves `none` again for the next backfill. For a
  wrong `v: 1` counter, roll back the web Worker, then ship `v: 2` with a
  reviewed backfill plan; `v: 1` rows are never rewritten in place.

### Done when

- §9 passes, together with `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:worker`, `pnpm build`, `pnpm check:hibernation`, and the H4
  `pnpm test:e2e` cases.
- In preview, new matches save `ok`; after the backfill no `none` or
  `error` row lacks a reported reason; the panel shows on a rated match
  signed out and on a friendly match only to its two players.
- Production results are recorded in the ops record, which alone states
  what was verified there; the shipping commit then sets the README status.
