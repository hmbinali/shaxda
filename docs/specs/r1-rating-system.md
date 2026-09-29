# R1 — Rating System (Spec)

| Field      | Value                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                      |
| Wave       | 2, activated together with R2                                                                                                                       |
| Depends on | H1, X1a (web entry wrapper and cron), R2 (activated together), R6-core's migration (§2)                                                             |
| Register   | F4, P4, P9, P18, P20 (also cites P8, P19)                                                                                                           |
| Contracts  | Owns [§2.5](v2-contracts.md#25-r1-extension) and [§7](v2-contracts.md#7-rating-processor); consumes §2.1–§2.3, §4.2–§4.3, §5, §6.2, §8, §10, §12    |
| Brief      | `docs/shaxda-v2.md` §6.2, §7.2, §10 (R1), §14                                                                                                       |
| Touches    | `packages/rating` (new), `packages/db`, `packages/shared`, `packages/i18n`, `web/`, `worker/`, root `package.json` and `scripts/`, `AGENTS.md`, PRD |

R1 turns every saved account match into exactly one rating decision, in
ledger order, and keeps each rated account's Glicko-2 rating and public
record current and reproducible from the ledger. It owns the pure rating
package, the rating tables beside the ledger, the web-Worker processor and
its triggers, the rebuild and correction tool, and the rating on the online
result overlay. R2 decides which matches count (R1 calls its pure policy),
H1 writes the ledger, R6-core owns invalidations, exclusions, and the audited
commands that run R1's correction, and R3–R5 own the leaderboard and
profile reads of R1's tables.

## 1. Outcome and non-goals

**Outcome.** Within a minute of a rated match being saved (normally
seconds), both accounts' ratings and public records change in one atomic
write, the result overlay turns "Waa la xisaabinayaa" into the confirmed
rounded change, and a rebuild from the ledger shows zero drift.

**Must**

1. Pure `packages/rating` (§3.2): Glicko-2 per the March 2022 paper, one
   match per period, simultaneous updates, closed-form inactivity, full
   precision, P18 defaults, and `eligible_until`.
2. The [§2.5](v2-contracts.md#25-r1-extension) tables beside the ledger,
   with a Miniflare D1 test of their rules (§3.1).
3. The web-Worker processor (§4): lease, at most 25 decisions per
   invocation, one fenced batch each, the invalidation check then validation
   (so `held` never blocks and an invalidation resolves it), R2's policy, and
   every `player_rating` column in the same batch.
4. Triggers: a best-effort hint over service binding `RATINGS` to
   `RatingsEntrypoint` after each save, and the minute cron. The game
   Worker never reads or computes ratings.
5. `pnpm rating:rebuild` (§3.4): dry run by default; `--apply` is the
   [§7.4](v2-contracts.md#74-corrections) correction R6-core calls; CI runs
   the dry run on fixtures.
6. Result overlay: pending, then the confirmed rounded change, never an
   estimate (P18), from `GET /api/matches/<id>/rating` under the
   [§5](v2-contracts.md#5-access-matrix) rows.

**Should:** pre-match rating and provisional marker on the online player
cards when the room requests rated play, from the public record through
`GET /api/players/<username>/rating`.

**Not in R1:** which matches count, consent, the pair-cap rule, and the
rated/friendly explanations (R2); invalidation, exclusion, audit, and
detectors (R6); leaderboard, rank, profile numbers, rating chart, and
head-to-head (R3–R5); any estimated change (P18); seasons, tiers, and guest
or local ratings (F8).

## 2. Decisions and dependencies

| ID  | How R1 applies it                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4  | A resignation or valid claim after play began scores 1 and 0 like any win (M2, M3). R1 adds no phase exception.                                                           |
| P4  | Decisions follow `match.seq`. A late save is simply the next event, inactivity gaps clamp at zero, and there is no late-event pause or rebuild path.                      |
| P8  | `player_rating` is the public record: processed rated events only. Skipped and held matches change no count, streak, form, or peak.                                       |
| P9  | Peak is the highest post-event rating with no 1500 floor; an account without a row has no peak. Best win streak is the longest run of wins.                               |
| P18 | 1500 / 350 / 0.06, τ 0.5, 24 h periods, provisional when effective RD > 110; pending, then confirmed.                                                                     |
| P19 | R1 writes `eligible_until` so R3 tests eligibility at one `asOf` with no inactivity arithmetic; R1 enforces nothing about the leaderboard.                                |
| P20 | `board_key` is assigned in first-processed order inside the event batch. A rebuild reproduces it; a correction may renumber it, since it is a tie-break, not an identity. |

| Dependency | What it provides                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1         | The ledger and `seq` ([§2.1](v2-contracts.md#21-h1-tables)), `matchStatus.save.matchId` ([§6.2](v2-contracts.md#62-server-to-client)), and the successful save after which the game Worker sends the hint.                                                                                                                        |
| R2         | The pure policy module: `ratingSkipReason` for steps 1, 3, and 4 of [§4.2](v2-contracts.md#42-rating-decision) (R1 owns step 2's validation), the P7 pair-cap rule, `RATING_POLICY_V`, and the rated/friendly and rating-status labels.                                                                                           |
| X1a        | The web entry wrapper and the `* * * * *` cron ([§10.2](v2-contracts.md#102-web-worker-entry-wrapper)); R1 adds one job and `RatingsEntrypoint`.                                                                                                                                                                                  |
| R6-core    | The invalidation record, `rating_account_exclusion` ([§7.5](v2-contracts.md#75-exclusion-projection)), and the audited commands that call R1's correction. Wave-2 order: R6-core's migration merges between R1's slices 4 and 5 (§8), so R1's fold reads those tables from its first decision; R6-core's commands merge after R1. |
| A3         | Pending and deleted account states ([§8](v2-contracts.md#8-deletion)). R1 does nothing on deletion (M10).                                                                                                                                                                                                                         |
| Proofs     | E1 (fence, swap) and E3 (wrapper, `scheduled`, entrypoint) passed locally ([§12](v2-contracts.md#12-evidence)); E5 (pending) must not contradict P18 before activation.                                                                                                                                                           |
| Consumers  | R3–R5 read R1's tables and `packages/rating` functions; H2 shows the rating status on history rows; K1 pairs on ratings (P15) as its spec defines.                                                                                                                                                                                |

## 3. Contracts

R1 owns [§2.5](v2-contracts.md#25-r1-extension), the rating tables beside
a ledger it never alters, and [§7](v2-contracts.md#7-rating-processor), the
processor. This section adds only what those leave to R1.

### 3.1 Table rules proved by the migration test

Run on Miniflare D1 after the migration; every forbidden row is attempted
and must fail.

| Rule                                                                                                                                                                                                      | Enforced by                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `match` and `match_player` definitions in `sqlite_schema` are unchanged                                                                                                                                   | test                                  |
| State row seeded as `(1, 0, NULL, NULL, 0, 1, 1, <now>)`                                                                                                                                                  | migration                             |
| `match_rating` rejects: another status; a skip reason without `skipped` or the reverse; an algorithm version without `processed` or the reverse; no policy version or `decided_at`; an unknown `match_id` | §2.5 `CHECK`, `NOT NULL`, foreign key |
| `rating_fence` rejects `ok = 0` as `rating_fence_guard` and `NULL` as `rating_fence.ok`                                                                                                                   | §2.5                                  |
| `match_player_rating` has every value and one row per seat                                                                                                                                                | §2.5                                  |
| `match_rating.seq` equals the ledger row's `seq`                                                                                                                                                          | writer, test, dry run                 |
| Ledger rows with `seq ≤ cursor_seq` have one `match_rating` row each; rows above have none                                                                                                                | fence, test, dry run                  |
| Both seat rows exist if and only if the decision is `processed`                                                                                                                                           | one batch, test, dry run              |
| `rating_delta` equals `rating_after − rating_before` exactly                                                                                                                                              | writer, test                          |
| `skipped:friendly` if and only if the ledger row has `rated = 0` and passes validation; a `rated = 0` row is never `processed`, `pairCap`, or `invalidated`                                               | R2 policy, test, dry run              |
| One `player_rating` row per account with a processed event, each column equal to the fold of its events (§4.2)                                                                                            | processor, dry run                    |

### 3.2 `packages/rating`

Pure TypeScript with no imports (no Svelte, Cloudflare, D1, Zod, or
engine). `State` is `{ rating, rd, volatility }`; a score is 0, 0.5, or 1.

| Export                                | Contract                                                                                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateMatch(a, b, scoreA)`           | Both seats from the two pre-event states at once, never one seat's new state fed into the other's update; the paper's steps 3–8 once per event; no RD clamp            |
| `updatePeriod(p, games)`              | The paper's multi-opponent period, for its published example                                                                                                           |
| `emptyPeriods(last, at)`              | `max(0, floor((at − last) / 86 400 000))`                                                                                                                              |
| `effectiveRd(s, last, asOf)`          | The stored RD unchanged when `n = 0` (no scale round trip); otherwise the [§7.3](v2-contracts.md#73-arithmetic-and-reads) closed form, whose 350 cap bounds the growth |
| `isProvisional(s, last, asOf)`        | `effectiveRd(…) > 110`                                                                                                                                                 |
| `eligibleUntil(s, last)`              | `effectiveRd` at day boundaries k = 0…89: `last` + k days for the first k above 110, else `last` + 90 days, so it never disagrees with `isProvisional`                 |
| `DEFAULTS`, `RATING_ALGORITHM_V = 1`  | P18 values, scale 173.7178, ε 0.000001                                                                                                                                 |
| `RatingInputError`, `RatingMathError` | Non-finite or nonpositive input, or another score; the solver past 100 iterations, or a non-finite result                                                              |

The volatility solver is the 2022 Illinois iteration with the corrected
`f(C)·f(B) ≤ 0` branch. Nothing is rounded and no failure becomes a zero
change. A first event starts from `DEFAULTS`; time since registration never
counts. One match per period is P18's product choice; the paper prefers
larger periods, so E5 and real outcomes judge it, and any change is a new
`algorithm_v`.

### 3.3 Processor, entrypoint, binding, and reads

| Piece               | Contract                                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@shaxda/db/rating` | A raw-statement subpath like H1's `@shaxda/db/match`: `processPendingRatings(db, { now, budget })`, the pure `foldLedger(rows, sources)` shared by the rebuild and tests, and the two read queries                           |
| `RatingsEntrypoint` | A `WorkerEntrypoint` in the web wrapper with one method, `processNow()`: no arguments; runs the processor under `ctx.waitUntil`; returns `{ accepted: true }` at once. No caller can supply a rating, a user id, or a match. |
| `RATINGS` binding   | Game Worker → `RatingsEntrypoint` on `shaxda-web` (`worker/wrangler.toml`, `wrangler.production.toml`) or `shaxda-web-preview` (`wrangler.preview.toml`); none in e2e                                                        |

Read schemas, as Zod in `packages/shared`. `GET /api/matches/<id>/rating`
returns the first four fields; the card endpoint returns the last row:

| Field         | Rule                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`      | `pending`, `processed`, `skipped`, or `held`                                                                                                                                                                                     |
| `reason`      | `friendly`, `pairCap`, or `invalidated` when skipped, else `null`                                                                                                                                                                |
| `updating`    | `true` while `maintenance = 1`                                                                                                                                                                                                   |
| `seats`       | When processed, per seat A and B: `before` and `after` (`Math.round` of the stored values), `delta = after − before` so it matches the numbers shown, and `provisional` (`rd_after > 110`, the event's own instant); else `null` |
| Card (Should) | `{ rated: false }` or `{ rated: true, rating, provisional }`, with `provisional` at one `asOf`                                                                                                                                   |

### 3.4 Rebuild tool

`pnpm rating:rebuild -- --database <local|preview|production>` plus at most
one flag:

| Mode                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                | Exit                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| dry run               | Reads the state row, every `player_rating` row, the exclusion source, and R6-core's invalidation view in one batch, then the ledger and rating rows up to that `cursor_seq`; folds and diffs every column except `decided_at`. Prints counts by status and reason, pending count and oldest pending age, held match ids, changed rows per table, and the first mismatch (`seq`, match id, table, column, live, rebuilt). | 0 no drift; 1 drift; 2 invalid source, state changed, or error |
| `--apply`             | The §4.3 correction                                                                                                                                                                                                                                                                                                                                                                                                      | 0 swapped; 1 refused; 2 error                                  |
| `--pause`, `--resume` | Set or clear `maintenance` under an operator lease (R1's kill switch); `--resume` also empties the `*_next` tables                                                                                                                                                                                                                                                                                                       | 0; 2 error                                                     |
| Databases             | `local` is the dev D1. `preview` and `production` use Wrangler D1 access to `shaxda-db-preview` and `shaxda-db`; only an operator runs them, never CI, a test, an agent, or a deploy hook. There, the mutating modes (`--apply`, `--pause`, `--resume`) run only through R6-core's audited `rating:admin` commands, which call them; the dry run stays direct.                                                           | —                                                              |

## 4. Behaviour and failure handling

### 4.1 Processing

| Step        | Rule                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Check    | One statement reads the state row and the first ledger row after `cursor_seq`. Exit without writing if `maintenance = 1`, if `policy_v` or `algorithm_v` differs from the deployed versions (log `ratingVersionMismatch`), or if nothing is pending.                                                                                                                                    |
| 2. Lease    | The [§7.1](v2-contracts.md#71-triggers-and-lease) compare-and-set; a loser exits.                                                                                                                                                                                                                                                                                                       |
| 3. Decide   | Up to 25 ledger rows after the cursor, in `seq` order, with their seats. Per row: an invalidation → `skipped:invalidated`; else validate (`held` on failure); else read both `player_rating` rows and the pair window's `ended_at` values and call R2's `ratingSkipReason`; for `processed`, apply each seat's empty periods, then `updateMatch` (a `RatingMathError` makes it `held`). |
| 4. Write    | One [§7.2](v2-contracts.md#72-the-fence) batch per decision: fence (token, `now`, expected cursor), `match_rating`, for `processed` both seat rows and both `player_rating` rows, `cursor_seq = seq`, fence delete.                                                                                                                                                                     |
| 5. Finish   | Stop after 25 decisions, on an empty queue, or with under 15 s of lease left; release the lease if still ours. With fewer than 25 decided, look once more from step 2, so a row saved meanwhile does not wait for the cron.                                                                                                                                                             |
| Pair window | One indexed query: seat A's `match_player_owner_idx` rows in the [§4.2](v2-contracts.md#42-rating-decision) window, joined to seat B by `(match_id, user_id)` and to `match_rating` by `match_id`, returning the `ended_at` of `processed` rows with a lower `seq`.                                                                                                                     |

Each processed event updates both `player_rating` rows, in `seq` order like
the rating, so a late save extends streak and form as the newest event:

| Column                                                     | Rule                                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `rating`, `rd`, `volatility`; `last_seq`                   | The event's after values; this `seq`                                                                                                    |
| `rated_games`, `rated_wins`, `rated_losses`, `rated_draws` | +1 for the event's result                                                                                                               |
| `streak_kind`, `streak_len`, `best_win_streak`             | The same result extends the run, another starts a run of 1; best is the longest run of wins                                             |
| `form`                                                     | Append `W`, `L`, or `D`; keep the last five, oldest first                                                                               |
| `peak_rating`, `peak_seq`                                  | Set by the first event; later only when `rating_after` is strictly greater                                                              |
| `last_rated_at`, `eligible_until`                          | `max(last_rated_at, ended_at)`; then `eligibleUntil(after state, last_rated_at)`                                                        |
| `board_key`, `excluded`                                    | First event only, inside the insert: `MAX + 1` (seat A before seat B), and R6-core's exclusion source; R1 never writes `excluded` again |

### 4.2 Failures and edge cases

| Case                                                      | Behaviour                                                                                                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fence rejects (`rating_fence_guard` or `rating_fence.ok`) | The whole batch rolls back; the processor stops without retrying and logs `ratingFenceRejected`. The next trigger resumes from the committed cursor. Classify by constraint name, never message text. |
| Any other D1 error                                        | The batch rolls back; log `ratingBatchFailed`, release the lease, stop. The next trigger retries the row.                                                                                             |
| Validation fails, or `RatingMathError`                    | The row becomes `held` in a normal fenced batch and `ratingHeld` is logged at error level with the problem code; later rows continue. An R6 correction resolves it.                                   |
| Hint fails, binding missing, web Worker down              | Nothing changes; the cron decides the row within a minute of recovery.                                                                                                                                |
| Duplicate or overlapping triggers; processor dies         | One lease holder decides and the others exit; a decided row is behind the cursor and never revisited. A dead holder's committed decisions stand and its lease lapses within 60 s.                     |
| Equal `ended_at`; late save after a newer processed match | `seq` orders them. A late save is decided next with `n = 0`; `last_rated_at` keeps the later instant; the pair window uses the row's own `ended_at`.                                                  |
| `maintenance = 1` (correction or pause)                   | The processor exits and new saves wait as pending; reads show the last published state with the "updating" note.                                                                                      |
| Version mismatch                                          | The processor exits until the correction that ships the new version swaps it in.                                                                                                                      |
| Any log line                                              | Carries `seq` and the match id at most, never a user id.                                                                                                                                              |

### 4.3 Corrections (`--apply`)

The [§7.4](v2-contracts.md#74-corrections) procedure, with these rules. A
policy or algorithm change is always a new version plus this procedure,
never an in-place reinterpretation.

| Step         | Rule                                                                                                                                                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Stop      | `maintenance = 1` under an operator lease (compare-and-set against a live processor lease); the processor stops at its next fence.                                                                                                                                                       |
| 2. Rebuild   | High-water mark = `cursor_seq`; fold the ledger up to it with R6-core's invalidations and exclusions; write the `*_next` tables in bounded, idempotent chunks.                                                                                                                           |
| 3. Verify    | Counts (one `match_rating` per ledger row up to the mark, two seat rows per processed decision, one player row per account with a processed event), then the printed diff.                                                                                                               |
| 4. Swap      | Only after the operator re-enters the high-water `seq` (R6-core passes its approved plan instead). The live tables' constraints re-check every copied row, so one bad row fails the whole swap; a version change also writes the state row's `policy_v` and `algorithm_v` in that batch. |
| 5. Finish    | Empty the `*_next` tables; the dry run shows zero drift.                                                                                                                                                                                                                                 |
| `decided_at` | Kept when a decision is unchanged, else the swap time.                                                                                                                                                                                                                                   |
| Interrupted  | Live tables untouched and `maintenance` on: rerun `--apply` (it takes over the lapsed operator lease) or `--resume` to abandon.                                                                                                                                                          |

### 4.4 Reads and the overlay

The match endpoint checks the id against the
[§2.3](v2-contracts.md#23-public-match-id) pattern before any query, then
reads the match, both seats, `match_rating`, the seat rows, and
`maintenance`. The overlay and cards show:

| State                                             | Display                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matchStatus.rated` not `true` (friendly, M1, M9) | No rating block and no request                                                                                                                        |
| `save.status` `pending`                           | "Waa la xisaabinayaa"                                                                                                                                 |
| `save.status` `stalled`                           | No rating block; H2's overlay status line explains the save                                                                                           |
| Saved; rating pending                             | "Waa la xisaabinayaa"; requests after 1, 2, 4, 8, 15, and 30 s, stopping on rematch; then the text stays and `/history` (H2) shows the decision later |
| `held`                                            | R2's "Waa la hubinayaa" label; no numbers                                                                                                             |
| `processed`                                       | Both seats' rounded after-ratings and signed changes, `?` when provisional                                                                            |
| `skipped:pairCap`                                 | "Darajo laguma xisaabin" and R2's reason                                                                                                              |
| `skipped:invalidated`                             | "Darajada waa laga saaray"                                                                                                                            |
| `updating: true`                                  | The maintenance note under the last published values                                                                                                  |
| Endpoint error                                    | The pending text stays; play, rematch, and saving are unaffected                                                                                      |
| Player cards (Should)                             | One request per account seat when the room requests rated play: `1532`, `1532?`, or "Weli darajo ma laha"; nothing in friendly rooms or on a 404      |

## 5. Privacy and access

| [§5](v2-contracts.md#5-access-matrix) row | R1 implementation                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/match/<id>` … rating status — rated     | The match endpoint returns the view to anyone.                                                                                                     |
| `/match/<id>` … rating status — friendly  | Participants only; signed-out and unrelated viewers get the same 404 status, body, and headers as an unknown or malformed id.                      |
| `/u/<username>` numbers                   | The card endpoint returns the public record only: rounded rating and provisional flag.                                                             |
| Pending/deleted account                   | The card endpoint returns the profile's 404; the match endpoint returns seat values without names, and the caller renders the neutral label (M10). |

- A participant is the active session's user id matched on the server
  against `match_player.user_id`; a pending-deletion session counts as
  signed out ([§8](v2-contracts.md#8-deletion)).
- Responses hold only the §3.3 fields: no user id, email, room code,
  ticket, `board_key`, raw RD or volatility, or full-precision value. Both
  endpoints send `cache-control: no-store`; the service worker caches
  neither path.
- The hint carries no data. The game Worker holds no rating table, code, or
  credential; a test fails if its bundle imports `packages/rating` or
  `@shaxda/db/rating`.

## 6. Resource budget

D1 rows count as billed, index entries included; the Workers tests check
them against `meta.rows_read` and `meta.rows_written`.

| Item                      | Budget                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Processed decision        | 8 table rows (fence insert and delete, `match_rating`, two seat rows, two `player_rating` rows, state): ≈ 14 billed rows written, 18 when both accounts are new                                        |
| Skipped or held decision  | 4 table rows: ≈ 6 billed rows written                                                                                                                                                                  |
| Reads per decision        | ≈ 12 rows (seats, both `player_rating` rows, invalidation, fence, updated rows) plus ≈ 3 per game seat A saved in the previous 24 h (pair window, owner index)                                         |
| Full invocation           | ≈ 55 D1 calls for 25 decisions (a read and a write batch each, plus lease, release, and queue reads)                                                                                                   |
| Idle cron sweep           | 1,440 per day; one statement reading ≤ 2 rows and writing none (≈ 2,900 rows read per day)                                                                                                             |
| Hints and Durable Objects | One service-binding call per saved match, returning before any processing; no new DO wake-up, alarm, or storage, since the Match DO is already awake for the save                                      |
| Storage                   | ≈ 0.35 KB per processed match and ≈ 0.25 KB per rated account, indexes included (estimates)                                                                                                            |
| Overlay and cards         | ≤ 6 requests per participant per rated game and one per seat per rated room, each reading ≤ 10 rows                                                                                                    |
| Dry run                   | Reads each ledger and rating row once (≈ 6 rows per match); writes nothing                                                                                                                             |
| Correction                | Writes the `*_next` copies, then the one-batch swap that E1 sized ([§12](v2-contracts.md#12-evidence)). D1 serialises queries, so everything waits for the swap; corrections are rare operator events. |

## 7. Somali copy

R1's keys live in `packages/i18n` under `rating`, each behind
`TODO(translation-review)`; status labels are R2's `ratedPlay.status.*` keys
through R2's one mapping (R2 §4.5). Drafts marked "new" are proposed for the
[README glossary](README.md#somali-glossary-drafts-q4) (Q4).

| Key                                   | Draft                                  | Used for                                        |
| ------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `rating.label`                        | Darajo                                 | Overlay and card label (glossary)               |
| R2's `status.pending` / `status.held` | Waa la xisaabinayaa / Waa la hubinayaa | Pending and held (glossary)                     |
| R2's `status.notCounted`              | Darajo laguma xisaabin                 | `pairCap` (glossary)                            |
| R2's `status.removed`                 | Darajada waa laga saaray               | `invalidated`, M8's "rating removed" (glossary) |
| `rating.updating`                     | Darajooyinka waa la cusboonaysiinayaa  | Maintenance note (glossary)                     |
| `rating.provisional`                  | Darajo ku meel gaar ah                 | Tooltip and accessible name of `?` (glossary)   |
| `rating.change`                       | Isbeddelka darajada: {delta}           | Accessible name of the change (new)             |
| `rating.unrated`                      | Weli darajo ma laha                    | Card for an account without a row (glossary)    |

Numbers are whole; a change reads `+14`, `−9` (U+2212), or `0`. R2 owns the
rated/friendly and status labels and the pair-cap reason text.

## 8. Implementation slices

1. `docs: apply the V2 ratings rule to AGENTS.md and the PRD` (brief §6.2)
2. `test(rating): pin the published example and the rating boundaries`
3. `feat(rating): add the pure Glicko-2 package`
4. `feat(db): add rating tables beside the match ledger` (§3.1 test and
   [§11](v2-contracts.md#11-migration-ownership) query-plan evidence)
5. `feat(db): fold the ledger into rating decisions and records` (reads
   R6-core's invalidations and exclusions)
6. `feat(db): decide pending ratings under the lease and fence`
7. `feat(web): run the rating processor from cron and RatingsEntrypoint`
8. `feat(online): hint the rating processor after a save`
9. `feat(db): add the rating rebuild and correction tool` (with CI dry run)
10. `feat(web): serve match rating status for the result overlay`
11. `feat(web): show the confirmed rating change on the result overlay`
12. `feat(web): show pre-match ratings on rated player cards` (Should)

## 9. Acceptance tests

Unit tests for `packages/rating`:

| Case                                                                                | Expected                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published example: 1500/200 against 1400/30 (win), 1550/100 (loss), 1700/300 (loss) | Within 0.01 of the paper's printed ≈ 1464.06 / 151.52 / 0.05999 (it rounds intermediate steps); the full-precision output (≈ 1464.0507 / 151.5165 / 0.059996) pinned as a regression fixture                                                             |
| New players' first game                                                             | Winner ≈ 1662.31 / 290.32, loser ≈ 1337.69 / 290.32 (`+162` / `−162`); a draw keeps 1500                                                                                                                                                                 |
| Simultaneity                                                                        | Updating B against A's new state would give ≈ 1383.36; the package gives 1337.69                                                                                                                                                                         |
| Symmetry and finiteness                                                             | Swapped seats mirror; identical inputs give identical outputs; outputs are finite; changes need not sum to zero when RDs differ                                                                                                                          |
| Solver                                                                              | The `≤ 0` branch runs when `f(C)` is exactly 0 (internal solver, exact root); the iteration cap throws `RatingMathError`; bad inputs throw `RatingInputError`; neither yields a zero change                                                              |
| Inactivity                                                                          | 86,399,999 ms → `n = 0` and the stored RD bit-identical; 86,400,000 ms → `n = 1`; a negative gap → 0; a long gap stops at 350                                                                                                                            |
| Provisional                                                                         | Effective RD exactly 110 is not provisional; the next double above 110 is                                                                                                                                                                                |
| `eligible_until`, RD boundary                                                       | An RD found by bisection so one empty day gives exactly 110.0 (≈ 109.505 at σ 0.06) stays eligible there and gets `last_rated_at` + 2 days; the smallest RD whose one-day value exceeds 110 gets + 1 day; a post-event RD above 110 gets `last_rated_at` |
| `eligible_until`, 90 days                                                           | RD 45 stays ≤ 110 for 92 days, so it gets + 90 days: eligible 1 ms before that instant, not at it                                                                                                                                                        |
| Properties                                                                          | `eligibleUntil` equals a brute-force scan of day boundaries; `effectiveRd` never decreases as `asOf` grows                                                                                                                                               |

Workers and D1 (Miniflare) tests:

| Case                                                                                                                                       | Expected                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration                                                                                                                                  | Every §3.1 rule                                                                                                                                                   |
| Sample matches (below), real processor and R2 policy                                                                                       | Stored values equal the fold bit for bit (`Object.is`)                                                                                                            |
| Fence, the E1 cases ([§12](v2-contracts.md#12-evidence)): another token, expired lease, moved cursor, missing state row, `maintenance = 1` | Rejected by constraint name, zero rows changed, processor stops                                                                                                   |
| Two `processNow` calls and a cron run at once; a repeated hint after an H1 save retry; a call on an empty queue                            | Each row decided exactly once; nothing written                                                                                                                    |
| Lease expires mid-invocation (injected clock)                                                                                              | The old holder's next batch is rejected; the new holder continues from the committed cursor                                                                       |
| Equal `ended_at` in both `seq` orders; a late save after a newer processed match                                                           | Deterministic by `seq`; `n = 0`, `last_rated_at` unchanged, streak and form in `seq` order                                                                        |
| Held row (unsupported `replay_v`), then a valid rated row; an injected `RatingMathError`                                                   | Both decided in one invocation; `held`, and later rows continue                                                                                                   |
| A failing statement inside a batch                                                                                                         | Nothing from that decision; cursor unchanged                                                                                                                      |
| 30 pending rows; a row committed while the holder finishes                                                                                 | 25 then 5; the late row decided without waiting for the cron; rows read and written within §6                                                                     |
| Wrapper `scheduled` and `processNow` (as in E3); game Worker hint                                                                          | Both run the processor; one hint per saved entry; a throwing or missing binding changes neither the save status nor the broadcast; `pnpm check:hibernation` green |

Rebuild, web, and end-to-end tests:

| Case                                                                                                                                                         | Expected                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI fixtures: several rooms, equal `ended_at`, rematches, gaps beyond 90 days, late saves, every skip reason, a held row, two first-time players in one match | Dry run exits 0; changing any one stored value (a seat's last bit, `form`, a streak, `board_key`, `peak_seq`, `eligible_until`, `excluded`) exits 1 and names that first mismatch                                                                         |
| `--apply` on local; interrupted after its chunk writes                                                                                                       | Result equals the fold; an interruption leaves live tables unchanged and `maintenance` on; a rerun completes; `--resume` abandons cleanly                                                                                                                 |
| Reads during `maintenance`                                                                                                                                   | Last published values with `updating: true`; new rows stay pending                                                                                                                                                                                        |
| A3 finalizes B's deletion (M10)                                                                                                                              | Dry run still shows zero drift                                                                                                                                                                                                                            |
| Match endpoint per §5                                                                                                                                        | Rated to anyone; friendly to participants, the unknown-id 404 for everyone else; malformed id → 404 with no query; only §3.3 fields; `no-store`                                                                                                           |
| Overlay and cards, in Somali                                                                                                                                 | Every §4.4 row; six requests at most; polling stops on rematch; cards show `1532`, `1532?`, or "Weli darajo ma laha" and nothing in friendly rooms                                                                                                        |
| E2E on the shared D1 ([§10.4](v2-contracts.md#104-shared-local-d1-in-e2e))                                                                                   | Two seeded accounts finish a rated game; "Waa la xisaabinayaa"; the test runs the real processor once through `getPlatformProxy` (`vite preview` has no cron or entrypoint); both confirmed changes appear; both seat rows exist; a fold shows zero drift |

Sample matches, as R1 decides and displays the
[§4.3](v2-contracts.md#43-canonical-sample-matches) set:

| ID  | R1 decision                                                                                                                | Player records                                   | Overlay and endpoint                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| M2  | `processed`: A scores 1, B 0                                                                                               | Both update; two new players reach 1662 and 1338 | Public; pending, then `+162` and `−162`                      |
| M3  | `processed`: idle A scores 0, B 1                                                                                          | Both update                                      | Public; confirmed changes                                    |
| M4  | `skipped:pairCap`: three processed games already in the window                                                             | Unchanged                                        | Public; "Darajo laguma xisaabin" with R2's reason            |
| M5  | `processed`: 0.5 each                                                                                                      | Draws +1, streak `draw`, form gains `D`          | Public; confirmed changes (0 for equal new players)          |
| M8  | `processed`, then after R6 invalidation and `--apply` `skipped:invalidated`, with no seat rows and later events recomputed | Both records rebuilt                             | Public; "Darajada waa laga saaray"                           |
| M9  | `skipped:friendly`                                                                                                         | Unchanged                                        | No rating block; non-participants get the 404                |
| M10 | M2's rows untouched by deletion                                                                                            | B's row stays; A's is unaffected                 | Public; seat values without names, B under the neutral label |

M1 behaves as M9. M6 and M7 write no ledger row, so R1 never sees them.

## 10. Rollout and rollback

| Environment | Setup                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| dev         | Miniflare D1; `wrangler dev` of the built web wrapper and the game Worker for hint wiring; `--database local` |
| e2e         | Shared local D1; no `RATINGS` binding, cron, or entrypoint; tests run the processor                           |
| preview     | `RATINGS` → `shaxda-web-preview`; X1a's cron; `shaxda-db-preview`                                             |
| production  | `RATINGS` → `shaxda-web`; X1a's cron; `shaxda-db`                                                             |

Deploy order ([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)):
migrations (R1's, then R6-core's; R2 has none) → game Worker (binding and hint,
`RATED_PLAY_ENABLED` off) → web Worker (processor job, entrypoint,
endpoints, overlay). Hints fail harmlessly until the web deploy. Then, in
preview first and production second:

| Topic              | Rule                                                                                                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drain              | The processor decides the H1-era ledger (all friendly) at up to 25 per trigger; wait for zero pending and zero held, then a zero-drift dry run                                                                                                                                               |
| Rehearse (preview) | Two real accounts play an M2-like and an M5-like game: both full-precision seat rows, the overlay, a duplicate `processNow`, catch-up after R6-core's `pause-ratings` and `resume-ratings`, an R6-core invalidate and rescind (M8) with the swap timed on real D1, then a zero-drift dry run |
| Enable             | Once the wave-2 gate passes in preview and E5 does not contradict P18, R2's enabling commit turns `RATED_PLAY_ENABLED` on (R2 §10 adds Q1 and Q4)                                                                                                                                            |
| Monitoring         | The dry-run report (pending, oldest pending age, held, skips by reason, drift) after enablement, after every correction, and weekly for the first month; Workers Logs errors `ratingHeld`, `ratingFenceRejected`, `ratingBatchFailed`, `ratingVersionMismatch`                               |
| Kill switches      | `RATED_PLAY_ENABLED=false` (R2) refuses new consent, rated rematch votes and quick entry included, while recorded consent stands; R6-core's audited `pause-ratings` stops decisions (readers keep the last state with the note) and `resume-ratings` restarts them                           |
| Rollback           | Never drop R1 tables or touch the ledger. Pause first, roll back the web Worker if its code is at fault (saves continue, rows wait as pending), fix forward, and repair published values with an audited rebuild (R6-core)                                                                   |

**Done when** CI is green (`pnpm lint`, `typecheck`, `test`, `test:worker`,
`build`, `test:e2e`, `check:hibernation`, `check:e2e-isolation`,
`format:check`), the preview rehearsal is recorded, and the ops record shows
that in production two eligible accounts finished a rated match, both
ratings moved by the expected values, the overlay showed the confirmed
change, duplicate triggers did nothing, and the dry run showed zero drift. A
spec or local fixture alone never marks R1 shipped.
