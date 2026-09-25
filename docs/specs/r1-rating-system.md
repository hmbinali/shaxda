# R1 — Rating System (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; implementation blocked on the H1 ledger. R1 activation is coordinated with R2. |
| Brief | `docs/shaxda-v2.md` §6.2, §7.2, §10 (R1), §14 |
| Depends on | H1 match and match_player ledger, including an additive saved-match id on room status for the result overlay |
| Workspace | `r1-rating-system` (the V2 brief recommends implementing R2 in the same workspace) |
| Unblocks | R2 eligibility enforcement, R3 leaderboard, R4/R5 rating displays, K1 skill pairing, R6 rebuild and correction tools |
| Freeze point | R1 event order, rating policy version, status, and before/after/delta semantics freeze on merge |

This is an implementation spec for **R1 only**. R2 owns friendly-room controls,
the full eligibility and claim policy, pair caps, and rated-play explanation.
The two specs must be reconciled before ratings are enabled for production.
The H1 spec is a proposed contract in this checkout; implementation must compare
this document with the merged H1 migration and room messages before coding.

---

## 1. Outcome and scope

An account gets a Glicko-2 rating after each eligible completed online match.
Every published rating can be reproduced by replaying the immutable match
ledger in a deterministic order. A delayed write, duplicate trigger, or failed
processor run must not silently change that order or count a match twice.

### Must

1. Add pure, dependency-free `packages/rating` with the March 2022 Glicko-2
   equations, a one-match wrapper, inactivity adjustment, and fixture/property
   tests. It imports neither Svelte nor Cloudflare nor D1 nor the game engine.
2. Add additive rating columns to H1 `match` and `match_player`, and a
   `player_rating` current-state table. Keep H1 game result, identities, and
   replay immutable; rating columns are rebuildable projections.
3. Run one bounded processor in the **web Worker**. Drain pending matches in
   `(ended_at, match.id)` order, commit both player updates and the match event
   atomically, and make concurrent service-binding/cron calls idempotent.
4. Trigger immediately after H1 has confirmed the ledger write; sweep once a
   minute as recovery. The game Worker never computes or reads ratings.
5. Show the rating and a `?` when effective RD is **greater than 110**. This
   provisional state is the R1 exclusion signal for the later leaderboard.
6. Track each player's peak post-match rating and their last rated match time.
7. Provide a read-only full rebuild/diff command and deterministic fixtures in
   CI. A separate guarded apply mode is needed for recovery and future R6
   invalidation, but R1 must not silently rewrite live history.
8. Show rating movement on the online result overlay once confirmed. A
   short-lived estimate may be shown while the event is pending, clearly
   labelled as an estimate and replaced with the confirmed event.

### Should

- Show a pre-match rating and provisional marker on online player cards only
  when the room is marked rated. It is a snapshot for display, never authority
  for the processor.

### Out of scope

- Leaderboard page, ranks, public profile stats, rating trend, seasons, tiers.
- Choosing which invite or quick matches count, friendly UI, resign/claim
  eligibility, pair/daily caps, and player-facing rated rules (R2).
- Suspicious-pattern flags, invalidation UI, or account exclusion workflow
  (R6). R1 only defines fields and a safe rebuild primitive.
- Guest rating or persistence; local games remain unrated.

---

## 2. Inputs and rating semantics

The **source** is an H1 `match` row and exactly two `match_player` rows. The
input fields are `id`, `ended_at`, `rated`, `winner_seat`, the two distinct
`user_id` values and seat results. `rated` is the room's recorded intent. R2
will define the final eligibility decision from these immutable fields plus
its own policy inputs. A missing player, duplicate user id, contradictory
results, unsupported replay version, or invalid result stops processing and
raises an operator error; it never becomes a rated event by default.

For R1's arithmetic, scores are 1 for win, 0.5 for draw, 0 for loss. Both
players are updated **simultaneously** from their own and the opponent's
pre-match rating/RD/volatility. Processing A first and giving B A's new rating
would change the result and is forbidden. Glicko-2 changes need not sum to
zero when player uncertainties differ.

Defaults, frozen as `algorithm_v = 1`:

| Parameter | Value | Interpretation |
| --- | --- | --- |
| Initial rating | 1500 | Internal full-precision value |
| Initial RD | 350 | Maximum effective RD |
| Initial volatility | 0.06 | Glicko-2 scale |
| τ | 0.5 | Volatility constraint |
| Scale | 173.7178 | `(rating - 1500) / scale`, `RD / scale` |
| Solver tolerance | 0.000001 | Corrected Illinois iteration from the 2022 paper |
| Inactivity period | 24 elapsed hours | A completed period with no match increases RD |
| Provisional cutoff | effective RD > 110 | Exactly 110 is not provisional |

The pure package exposes `updatePeriod(player, opponents[])` to test the
published multi-opponent example and `updateMatch(preA, preB, result)` to
update a single game. **One match is one rating period** in Shaxda. This is a
product choice from the V2 brief: the [author's paper](https://www.glicko.net/glicko/glicko2.pdf)
describes grouped periods and observes that larger groups work best. The
per-game choice should be evaluated against real outcomes before changing
`algorithm_v`; it is not interchangeable with daily batching.

For an existing player, require `match.ended_at >= last_rated_at` and let
`n = floor((match.ended_at - last_rated_at) / 86_400_000)`. Apply `n`
empty-period RD steps before the match-period update: on the Glicko-2 scale,
`φ_next = min(350 / 173.7178, sqrt(φ² + nσ²))`. Use this closed form so a
long absence does not create an unbounded loop. Rating and volatility do not
change in empty periods. For a first rated match, start from 1500/350/0.06;
do not count time since account registration. This convention makes a match
after 24 hours exactly one empty period and does not penalize multiple matches
within 24 hours. The match update itself performs the paper's normal Step 6.

Store full finite double values; do not round between matches. UI displays
whole ratings and `round(after) - round(before)` as the integer movement.
For a read at time `t`, derive **effective RD** from the stored post-match
state with the same empty-period function, without a D1 write. R3 must use
that effective value (or a daily projection of it) for provisional checks.
Peak is `max(1500, every post-match rating)` in full precision; inactivity
does not change it. A player with no rated match has no `player_rating` row;
the result overlay and profile can describe the initial 1500 as unrated.

The package rejects NaN/infinity, nonpositive RD/volatility, malformed
results, and solver non-convergence with a bounded iteration error. It never
turns a failed calculation into a zero delta. Test the corrected `<=` branch
and the published 1500/200 example ending near 1464.06/151.52.

---

## 3. Ledger extension and indexes

Use an additive, hand-written migration numbered after merged H1. Names here
are a contract to reconcile with R2 before migration is committed.

| Table | Added fields | Rules |
| --- | --- | --- |
| `match` | `rating_status` (`pending`, `processed`, `skipped`), `rating_skip_reason` nullable, `rating_policy_v` integer nullable, `rating_algorithm_v` integer nullable, `rated_processed_at` integer nullable | `rating_status` is NOT NULL DEFAULT `pending` so future H1 inserts enter the queue. `processed` and `skipped` are terminal projections. `rated` stays the immutable room intent. |
| `match_player` | `rating_before`, `rd_before`, `volatility_before`, `rating_after`, `rd_after`, `volatility_after`, `rating_delta` (nullable REALs) | Both seats populated together for `processed`; all null for `pending`/`skipped`. `rating_delta = rating_after - rating_before` at full precision. `rd_before` is after inactivity adjustment. |
| `player_rating` | `user_id` PK, `rating`, `rd`, `volatility`, `rated_games`, `peak_rating`, `last_rated_at`, `last_match_id`, `version`, `excluded` | One row after the first rated game. `excluded` defaults false and is administrative metadata, preserved across rebuild. No foreign key to `user`, matching H1's deletion-safe ledger. |
| `rating_processor_state` | singleton key, `last_ended_at`, `last_match_id`, `version`, `lease_token`, `lease_expires_at` | Global processed cursor and short lease for serialized processing. Cursor starts before the first event. |

Add an index on `match(rating_status, ended_at, id)` for the bounded pending
scan; H1 already proposes `match(rated, ended_at)`. Add indexes on
`match_player(user_id, ended_at, match_id)` if the merged H1 index does not
support deterministic per-player history. Keep `player_rating` independent of
auth table reads in the game Worker.

H1 cannot know R1's `rating_status`. During migration, initialize existing
rows as `pending` only when `rated = 1`; initialize `rated = 0` as `skipped`
with reason `friendly`. Before production activation, run the R2 policy over
the entire H1 backfill cohort and record the policy version and skip reason.
R1 never infers that every historical `rated = 1` row qualifies under the
later R2 rules. Do this backfill in bounded, resumable chunks; verify counts
and sample outcomes before enabling the cron.

Match result, seats, timestamps and replay remain immutable. Rating status
and the before/after fields are **derived columns**, so a controlled rebuild
can replace them. Distinguish that from editing a completed game's outcome.
`rating_policy_v` records which R2 decision function was applied. R2 defines
the concrete skip-reason enum, including `pairCap` and `aborted` if adopted.

---

## 4. Processor and ordering

`processPendingRatings(db, { maxMatches, deadline })` is shared by a private
web-Worker service-binding entrypoint and the scheduled handler. Each
invocation handles at most a small fixed number of matches (start with 25)
and leaves the remainder for another invocation. Neither a browser nor a
game-room request can supply calculated ratings or a user id to it.

1. After H1 commits a match, the game Worker sends a best-effort "process
   now" hint through a service binding to the web Worker. Failure does not
   change H1 persistence success. The one-minute cron sweeps the same queue.
   Use a named private Worker entrypoint if the SvelteKit adapter needs a
   wrapper; no public HTTP route is required. Test this wiring locally.
2. Acquire a short lease on the singleton `rating_processor_state` row with
   a compare-and-set of `version` and expired lease. A loser exits. The
   processor may run from either trigger, but only one lease owner mutates
   rating rows. Keep each event commit short; release on normal exit.
3. Select the globally earliest `pending` match by `(ended_at, id)` and
   validate it and both player rows. Read both current player states and
   compute both outputs from the same pre-match snapshot.
4. In one D1 `batch`, condition every insert/update on the lease token,
   unexpired lease and expected state version, write both `player_rating`
   rows, both `match_player` events, mark the match `processed`, and advance
   the cursor/version. Inspect affected-row counts. A lost lease or stale
   version means **no event is accepted**; retry from fresh state. A SQL
   failure rolls back the whole batch.
5. If R2 says the match is skipped, mark it `skipped` with a reason and policy
   version and advance the cursor in the same guarded batch. A skipped match
   never changes either player state or peak.

An event key is `match.id`; after `processed` or `skipped`, duplicate calls
return the recorded result without applying it again. There is a total order
even when two matches share `ended_at`: `id` breaks ties. Never use arrival
order, D1 rowid, room code, or username. A later match may involve either of
the same players, so the processor must preserve the **global** order.

If a newly persisted match sorts **before** the committed cursor, stop the
normal queue, report `lateLedgerEvent`, and run the guarded rebuild/apply
path from the full ledger before resuming. Likewise, if a previously skipped
event's R2 policy decision changes, rebuild from the earliest affected event.
Processing it at the tail would give a plausible but incorrect rating. The
one-minute sweep checks for these late rows; an older pending row is never
silently ignored. The result overlay stays pending until recovery completes.

The singleton lease is operational coordination, not the source of truth.
Tests must force two triggers to overlap and expire a lease mid-computation.
The event batch must be atomic and guarded against stale writers after a
new owner takes the lease. If D1's batch/conditional-statement behavior
cannot guarantee that invariant in Miniflare, use a single transactional
SQL statement or equivalent D1-supported primitive before shipping.

---

## 5. Rebuild and correction

`pnpm rating:rebuild -- --database <local|preview|production> --dry-run`
reads the ledger in `(ended_at, id)` order, applies the versioned R2 policy,
and runs the same pure rating package from 1500/350/0.06 for each user. It
diffs every current `player_rating` field and every processed
`match_player` event, including full-precision values, status, and skip
reason. It reports row counts, first mismatch and event id, and nonzero exit
status on drift or invalid source rows. Compare doubles at a documented tight
tolerance only for driver serialization; all arithmetic and ordering remain
deterministic. CI runs the dry run against fixed local fixtures.

Apply mode is explicit and operational: pause normal processing with the
same singleton lock, take a D1 backup/export, recompute in a shadow local
dataset or temporary D1 tables, verify counts and sample history, then swap
derived rows in bounded transactions while readers are gated from claiming
freshness. Resume at the rebuilt cursor and run dry-run again. Do not run
remote apply from unit tests or on a deploy hook. R6 later adds invalidation
and the operator interface; its rebuild uses this engine.

Algorithm or policy changes require a new version and a full rebuild or a
separately defined migration; never reinterpret `algorithm_v = 1` in place.

---

## 6. Result overlay and privacy

H1's optional `matchStatus.savedMatchId` becomes a required R1 integration
point. The result overlay uses it to request a read-only rating event from
the web Worker. The response includes status, seat A/B rounded before and
after, displayed delta, and provisional markers, but no permanent user ids,
email, identity ticket, or raw account session. Validate the match id and
rate-limit/poll-bound the endpoint. A game still ends normally if D1 or the
rating processor is delayed.

While pending, show a Somali "rating being calculated" state. If an immediate
preview is enabled, compute it with `packages/rating` from **both** pre-match
snapshots and label it as an estimate; it cannot account for an earlier match
that has not processed or a later R2 eligibility decision. Replace the
estimate with the stored event; after a short bounded poll, leave the pending
state and let a later page load retrieve it. Never show an estimate as a
confirmed delta. Friendly/skipped games show no rating change. A provisional
`?` describes rating uncertainty, distinct from an unconfirmed estimate.

The online player-card Should feature may read an initial snapshot from the
web Worker when the two account seats are known. Do not send the D1 rating
table or rating processor credentials to the game Worker; the client treats
these values as display-only.

---

## 7. Verification and rollout

### Tests

- Pure package: official multi-opponent example; win/loss/draw, identical
  opponents, swapped-seat symmetry, finite outputs, RD cap, inactivity and
  exact 24-hour boundary, `RD = 110` boundary, solver failure behavior,
  repeated fixtures and reasonable convergence. Check that updates use
  simultaneous pre-match snapshots.
- D1/Workers: one committed match changes both ratings and fills both event
  rows; a duplicate trigger is a no-op; overlapping cron/RPC invocations;
  stale lease owner; a batch failure rolls back; out-of-order persist forces
  rebuild before publication; skipped/friendly and malformed matches never
  update ratings; H1 retry does not duplicate an event.
- Rebuild: fixtures from multiple rooms with equal timestamps, rematches,
  inactivity and skip decisions produce zero drift; mutate one event and
  prove the first mismatch is reported. Verify real H1 schema and indexes.
- Web: result overlay confirmed/pending/estimated/skipped paths in Somali;
  no private identity in the read response; online gameplay remains usable
  when the rating service is unavailable.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:worker`, `pnpm build`,
and relevant `pnpm test:e2e` cases. `pnpm check:hibernation` must remain green.
The spec-only change itself needs document/link validation, not an application
build. Local tests use Miniflare D1; migration and cron on preview/production
are explicit operational steps.

### Release gate

1. Reconcile the merged H1 schema and `savedMatchId`; write R2's eligibility
   policy and decide the production activation boundary. Freeze rating event
   semantics with a contract-change commit if H1/H2 readers need adapting.
2. Apply the additive migration to preview, backfill H1 rows under the R2
   policy, and run a dry-run rebuild before enabling service binding/cron.
3. Play two real account seats in preview: check the ledger, both full-precision
   event rows, rating displays, duplicate invocation, and delayed cron catch-up.
4. Apply the same migration/backfill/verification in production. Monitor
   pending count, oldest pending age, skipped reasons, solver/ledger errors,
   late-event rebuilds and dry-run drift. Keep a rollback path that disables
   processing/display without deleting ledger or derived rows.

R1 is done when two eligible accounts finish a match, both ratings move by
the expected values, the result overlay shows the confirmed change, duplicate
triggers do nothing, and a full ledger rebuild has zero drift. Do not mark R1
shipped from a spec or local fixture alone.

---

## 8. Decisions to confirm with the founder

| ID | Proposed decision | Why it matters |
| --- | --- | --- |
| R1-D1 | Ship R1 and R2 together and activate live ratings only after R2 policy is enforced. | H1's `rated = true` is intent, not the complete anti-farming/claim policy. |
| R1-D2 | Use per-game Glicko-2 with τ 0.5, 24-hour empty periods, RD > 110 provisional. | Rebuild needs one stable arithmetic contract; τ can change only with a versioned rebuild. |
| R1-D3 | Show an optional immediate estimate, then confirmed movement. | Gives timely feedback while retaining the ledger as authority. |
| R1-D4 | Late historical matches pause normal publication until a guarded rebuild. | Tail processing would make all affected subsequent ratings wrong. |

R1-D1 and R1-D3 are pending founder preference. All other choices are
implementation defaults within the V2 brief and can be refined before the
rating event contract freezes.
