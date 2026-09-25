# R6 — Ranking Integrity and Tools (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; specification only. R6 is not active or shipped. |
| Brief | `docs/shaxda-v2.md` §6.2, §7.2, §10 (R6), §14 |
| Depends on | Merged H1 ledger, R1 rebuild/processor, R2 rating policy, R3 leaderboard and its derived projections |
| Workspace | `r6-ranking-integrity` |
| Touches when implemented | `packages/db`, web Worker scheduled handler, repo admin scripts, rating rebuild, public read projections, tests; optionally `/admin/flags` |

This refines the V2 R6 brief without activating it. The V2 brief controls scope,
the PRD controls the stack, and `docs/shaxda_game.md` controls game rules. The
H1 and R1–R5 specs in this checkout are drafts, while the current codebase has
not yet added the H1 match ledger. Reconcile table names, rating policy
versions, projections, and operator access with the merged implementation
before writing a migration or running a remote command. R6 must not change a
game result or silently rewrite a rating.

---

## 1. Outcome and scope

An operator can find plausible ranking abuse, inspect the underlying games,
remove a reviewed match from rating calculations, or remove an account from
the public leaderboard. Every correction is attributable, reversible only by
an explicit subsequent operation where supported, and verifiable by a full
ledger rebuild. A detection result is a **lead for review**, not proof of
misconduct.

### Must

1. Run four bounded, deterministic detection jobs in the web Worker: pair win
   trading, repeated instant resignations, one-way feeding, and abnormal
   rated-game rate. They create or update flags only. They never invalidate a
   match, exclude a player, ban an account, or change a rating.
2. Persist `rating_flag` records with a reason code, rule version, subject,
   window, evidence match ids, and review state. A flag must be inspectable
   without storing email, provider identity, IP, or the room's private ticket.
3. Supply a repo admin CLI for `inspect-match`, `verify-replay`,
   `inspect-rating`, `flags`, `invalidate-match`, `exclude-account`,
   `include-account`, `rebuild-ratings`, and `check-consistency`. It runs
   against an explicitly selected local, preview, or production D1 database
   through Wrangler. Mutating commands use plan/apply and audit every attempt.
4. Record every manual correction in an append-only D1 audit table. The
   immutable H1 result, seats, replay, and timestamps are never edited.
5. Make invalidation an explicit ledger exclusion. Recompute all affected
   rating statuses, events, current ratings, R3 form/count/rank projection,
   and any R5 derived form projection through R1's guarded rebuild path. A
   stored rating must match a fresh rebuild after publication resumes.
6. Keep R3's `player_rating.excluded` flag independent of rating arithmetic.
   Store the operator's exclusion decision separately so a rebuild cannot
   erase it when an account has zero remaining rated games. Exclusion removes
   only public rank/leaderboard placement; inclusion restores eligibility
   subject to R3's normal RD, game-count, activity, and profile rules. Neither
   action hides a profile nor changes a game result.

### Should

- `/admin/flags` can show a bounded, admin-only review list linked to the CLI
  inspection output. It performs no correction in this milestone.

### Out of scope

- Automated punishment, account suspension, bans, appeals, player reports,
  public accusation labels, new identity/device tracking, and matchmaking
  penalties.
- Changing R1 Glicko-2 arithmetic, R2's normal eligibility or pair/daily cap
  policy, game rules, or the game Worker's write boundary.
- Deleting match rows, replay data, account records, or history. No per-move
  database rows and no new Durable Object lifecycle behavior.

---

## 2. Source of truth and correction semantics

The authoritative input is the H1 `match` row and its two `match_player`
rows. A match's recorded result and replay are immutable historical facts.
R1 `rating_status`, skip reason, before/after/delta, `player_rating`, and R3/R5
rating-related projections are derived and may be replaced only by the
guarded rebuild. An R6 invalidation is a separate operator decision keyed to
the opaque `match.id`; it does not pretend that the game never happened.

The rebuild considers an invalidation **before** applying R2's rating policy.
It records the invalidated match as `rating_status = skipped` with a new,
versioned `rating_skip_reason = invalidated`; both seat rating-event fields
are null. This is an explicit R1/R2 contract change, to be committed with
reader updates and a policy version bump when R6 is implemented. An
invalidated match does not consume a pair or daily rated-game cap slot. Every
later ledger row is reevaluated in `(ended_at, match.id)` order: a formerly
cap-skipped match may become rated, and the rating changes can propagate to
players who never met the invalidated pair. The safe default is a **full**
rebuild, not an isolated edit of the two players' current ratings.

`rated` remains the room's original intent. `competition_status` and the
persisted win/loss/draw remain as recorded. Public history and match detail
must distinguish “played result” from “rating removed”; they never show the
old delta as confirmed. R4/R5 all-game W/L/D, head-to-head, streak, and
Shaxda aggregates continue to include the played result when it otherwise
meets their normal competitive-game rules. This is the draft choice in §10;
all pages must use the same treatment. R3 rated-only W/L/D, form, and rank
always exclude the invalidated event because it has no processed rating
event. A leaderboard-excluded account's already valid rating events remain
in the ledger and continue to affect its opponents' ratings.

R1's normal processor stops accepting new events while a correction is being
planned or applied. A pending or late H1 row discovered during the operation
is included in the planned rebuild, or the plan is rejected as stale and
recomputed. Readers may show the last confirmed state with a neutral
maintenance/pending message; they must not combine new current ratings with
old match events or claim a fresh rank from a partial rebuild.

---

## 3. Detection rules

Run on confirmed `rating_status = processed` events that are not invalidated.
Join the two seats by opaque account id, never by username snapshot. An
R2-aborted, friendly, pending, cap-skipped, or guest-involved game is not
evidence of **rated** abuse. The scheduled job uses an indexed, bounded lookback
and a persisted cursor; it catches up in chunks after missed runs. A nightly
run is sufficient for advisory flags. No scan or replay verification runs on a
normal leaderboard or profile request.

The cursor is only an optimization. If H1 inserts a late historical match or
an R6 rebuild changes which old matches are `processed`, rewind affected
rule windows and rerun them before declaring detection current. Reprocessing
must not create duplicate flags. A deliberate, bounded historical backfill is
available for the initial rollout; it is not part of each nightly job.

Each rule operates on a sliding time window over `(ended_at, match.id)` and
stores the **minimal match ids needed to satisfy it**, plus computed counts
and durations. Initial thresholds are conservative review triggers, not
claims of fraud. Store `rule_v = 1`; threshold or window changes require a
version increment and fixture review before running on historical data.

| Reason code | Version 1 candidate condition | Evidence |
| --- | --- | --- |
| `winTrading` | Same pair has at least four rated games in a rolling 7 days, with winners alternating for four consecutive games, and at least three of those four games last at most 5 minutes. Draws break the run. | Four ordered ids, winner seats mapped to account ids, and durations. |
| `instantResignations` | One account manually resigns in at least three rated games in a rolling 24 hours, each within 60 seconds and no more than two accepted actions. A claim-win's synthetic resign does not count. | Three ids, durations, action counts, and `online_end_reason = NULL`. |
| `oneWayFeeding` | Same pair has at least five rated games in a rolling 7 days; one account loses at least four, and at least three of those losses are manual resignations or end within 5 minutes. | Five ordered ids, loss direction, reasons, and durations. |
| `abnormalRate` | One account completes at least 20 rated games in a rolling 24 hours against at least three distinct opponents. If R2's optional daily cap makes this unreachable, lower the trigger only through a rule-version change grounded in measured data. | First and last qualifying ids, total count, distinct-opponent count, and an indexed way to inspect the full bounded window. |

Duration is `max(0, ended_at - started_at)` from the stored server
timestamps. A negative or missing duration is a ledger consistency error,
not a short game. Use the R2-confirmed result and H1 terminal reason; do not
infer a manual resign from a replay code alone. The rate rule is account
scoped; pair rules use a canonical sorted pair of private ids so seat swaps
and username changes cannot evade or duplicate a flag.

One active flag per `(reason code, rule_v, canonical subject)` is updated with
new qualifying evidence rather than duplicating a flag every cron run.
Evidence is capped to a bounded list in the row; the window/count and indexed
ledger query reproduce the full candidate set. A dismissed flag remains in
the audit history. A later qualifying window creates a new flag only when it
contains a match newer than the dismissal; no cron run silently reopens the
same evidence. An invalidation may make old evidence stale: inspection checks
current statuses and marks the flag `stale` for review, without erasing it.

---

## 4. Data model and indexes

Write a hand-authored migration numbered after the merged R1/R3 migrations,
with matching Drizzle schema. The exact SQL names must be reconciled at
implementation. Keep these logical records and invariants:

| Record | Required fields and constraint |
| --- | --- |
| `rating_flag` | Opaque id; reason code; rule version; subject type and canonical private subject key; first/last evidence times; bounded JSON array of match ids and numeric evidence; `open`/`dismissed`/`stale`/`actioned` review state; created/updated times. A manual invalidation also writes a `manualInvalidation` flag tied to one match and its stated reason, satisfying the V2 `rating_flag` contract. |
| `rating_invalidation` | `match_id` primary key; linked manual flag id; reason text/code; actor id; created time. Its existence is the authoritative exclusion input to the rating rebuild. It is append-only in R6; no implicit un-invalidate command. |
| `rating_account_exclusion` | `user_id` primary key; current excluded boolean, reason, actor id, and change time. This is the administrative source for R3's `player_rating.excluded` projection and survives even if a rebuild removes the player's last rated event. |
| `rating_admin_audit` | Monotonic id; actor id; environment; operation; target id; UTC time; reason; plan/diff digest; prior and resulting state; outcome (`planned`, `applied`, `failed`). Append, never update or delete. No password, token, email, or copied replay. |
| Detection cursor | Rule version and last `(ended_at, match.id)` examined, plus updated time. It is operational state only; rerunning a chunk is safe. |

Add indexes for: rated events in `(ended_at, id)` order; player event windows
through `match_player(user_id, ended_at, match_id)`; pair windows via the two
player rows; flags by `(state, created_at DESC)` and subject; invalidation by
`match_id`; account exclusion by its primary key; audit by
`(target_id, id DESC)`. Reuse an existing index where
`EXPLAIN QUERY PLAN` proves the same bounded path. Neither the detector nor
routine CLI inspection uses a full-table scan; an **explicit full rebuild or
full consistency check** is expected to read the whole ledger. Retention is
indefinite for correction and audit records while the match ledger exists.

Only the web Worker and the admin CLI read or write these R6 tables. The game
Worker still writes only H1 `match` and `match_player`; it receives no auth
table access, R6 D1 query, or detection timer.
The manual flag, invalidation, and applied audit record must be committed as
one guarded correction, never as independent writes.

---

## 5. Admin CLI and access

Provide a repository script such as `pnpm rating:admin -- <command> ...`.
Every invocation requires `--database local|preview|production` and prints
the resolved Wrangler config, D1 binding/database identifier, and mode before
running. There is no environment default and no arbitrary SQL argument.
Local uses Miniflare D1. Preview and production require explicitly selected
Wrangler environment/config and the operator's Cloudflare credentials. Use
Wrangler's D1 access rather than a public mutation HTTP route. Scripts must
avoid shell interpolation of user input; validate opaque ids, reason codes,
limits, and flags before preparing any query.

| Command | Output or effect |
| --- | --- |
| `flags` | Paginated open/stale/recent flags with reason, subject, time window, and evidence ids; no private identity export by default. |
| `inspect-match <id>` | Immutable row, both seats, replay version, room mode, stored result/reasons, rating status and both current event rows, invalidation and audit links. Private ids are shown only to the operator. |
| `verify-replay <id>` | Decode/replay through the frozen H1 engine, compare final state/result/starting seat and relevant stored counts; nonzero exit on unsupported or divergent replay. No mutation. |
| `inspect-rating <id>` | Show R1/R2 policy and algorithm versions, ordered prior states, cap decision, computed simultaneous event, stored before/after/delta, and first divergence. Accept a match id; account lookup is an optional bounded filter. |
| `check-consistency` | Bounded or explicit full check of stored result versus replay, seat results, processed/skipped fields, rating events and projections; report first mismatch and exit nonzero. It does not repair. |
| `invalidate-match <id>` | Require a nonempty operator reason. Plan the new invalidation, full rebuild, changed statuses and ratings, then apply only the reviewed plan. Repeating an identical applied request is a no-op; a conflicting reason fails. |
| `exclude-account <id>` / `include-account <id>` | Require a reason and show the before/after public eligibility. Change only R3 exclusion metadata and refresh/invalidate leaderboard cache or snapshot. Repeated same-state requests are no-ops, still audited as attempts. |
| `rebuild-ratings` | Dry-run/diff by default using R1's exact oracle. Explicit apply follows the guarded procedure below; no deploy hook or test invokes remote apply. |

The operator must identify themself through the established admin allowlist
or an equally strong non-user service identity. A Cloudflare API token by
itself is not the human actor id recorded in audit. Remote mutation fails
closed if actor identity, audit append, backup, plan verification, or database
binding cannot be proven. The CLI must not print secrets or private user data
to CI logs. Keep detector flags and correction reasons out of public DTOs,
Open Graph metadata, and shared caches. If `/admin/flags` ships, it uses the
existing web-Worker session allowlist, `no-store`, and bounded indexed reads;
the CLI remains the only mutation surface.

### Guarded apply

1. Acquire R1's singleton processor lock/lease and stop normal event
   publication. Export a recoverable D1 backup before a remote write. Record
   the current ledger high-water mark, policy/algorithm versions, relevant
   row counts, and a digest of the proposed diff.
2. Run a read-only plan against the exact ledger and invalidation set,
   including the requested change. Verify every affected match and both
   player rows, all `player_rating` values, R3/R5 projections, cap decisions,
   and exclusions that must be preserved. The plan reports changed-row
   counts and a small sample without dumping private data.
3. Apply only with an explicit plan digest and target environment. Reject if
   the ledger high-water mark, lock version, policy version, or plan digest
   changed. Write the invalidation/exclusion and audit entry, rebuild into
   shadow state, compare it to the plan, then publish derived state and cursor
   using the R1 guarded swap. A partial write never becomes a published
   rating generation.
4. Run full `check-consistency` and R1 dry-run/diff (zero drift), refresh
   public ranking caches/snapshots, append the applied audit outcome, then
   resume processing. On failure, keep publication gated, append a failed
   audit outcome if D1 is available, and recover from backup or rerun the
   guarded plan before opening reads.

The concrete shadow/swap mechanism must be proven against the merged R1
processor and D1 behavior in local Miniflare before remote apply is enabled.
The CLI must not claim atomic publication merely because several Wrangler
commands ran successfully. Preview is the required rehearsal for the same
operation planned in production.

---

## 6. Public behavior

An invalidation takes effect only after the rebuild is published. R1 result
overlays, H2 match detail/history, R4 profile, and R5 chart show the current
confirmed rating event or a truthful pending/removed state. None may keep a
cached old delta after invalidation. Public copy is Somali and neutral: it
states that a game no longer affects rating, without naming a detector,
reason, actor, or suspected player. A flagged but uncorrected game looks
unchanged to the public.

R3 leaderboard and profile rank use one published rating generation.
`excluded = true` removes the player from ranks and neighbor strips after
cache/snapshot refresh. The account's own unranked state can use R3's neutral
“not currently listed” wording. A public profile and existing match pages
remain accessible; no flag, private id, operator reason, or audit text leaks
through their loaders. Inclusion reapplies normal R3 eligibility and does
not guarantee a rank.

---

## 7. Verification and rollout

### Tests

- Synthetic ledgers for each detector: exact threshold and just-below cases,
  sliding-window boundaries, seat swaps, equal timestamps, rematches, draws,
  manual versus claim-win resignation, R2 caps, invalidated evidence, and
  repeated cron runs. Flags are deduplicated; detectors never mutate ratings
  or exclusion state.
- Replay/result consistency: valid H1 fixtures pass; altered action/result,
  unsupported replay version, missing seat, and contradictory outcome fail
  closed with the offending match id.
- Correction: invalidate a middle event, rebuild in global order, reassign
  pair/daily cap slots, verify both players and downstream opponents, R3
  W/L/D/streak/rank, R5 form, and zero final diff. Repeated apply is
  idempotent; stale plan or changed ledger rejects without partial publication.
- Exclude/include: rating and history are unchanged; public rank disappears
  and returns only when R3 eligibility passes; no private moderation reason
  appears in HTML, route data, cache, or metadata.
- Operations: wrong environment, missing operator id/reason, failed backup,
  expired lock, concurrent processor, failed shadow validation, and failed
  audit append prevent mutation or publication. Audit is append-only and
  records every attempted manual correction.

When implemented, run `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:worker`, `pnpm build`, and relevant `pnpm test:e2e` cases.
`pnpm check:hibernation` and `pnpm check:e2e-isolation` must remain green.
The spec-only change needs document/link and formatting checks; it does not
claim application verification. Local tests use Miniflare D1, with separate
preview rehearsal before any production mutation.

### Release gate

1. Reconcile the merged H1/R1/R2/R3/R5 schema and settle the founder choice
   in §10. Add the invalidated skip reason as an explicit contract change
   with all readers and fixtures updated.
2. Apply the additive migration in preview. Seed clean and suspicious
   ledgers; run detectors, CLI inspection, dry-run rebuild, an invalidation,
   exclusion/inclusion, audit inspection, and a zero-drift consistency check.
3. Verify preview public pages before and after cache expiry, including a
   downstream player's changed rating and a cap-skipped event promoted to
   rated. Exercise a failed apply and recovery without publishing mixed
   generations.
4. Migrate production without making a correction. Run read-only detection,
   replay spot checks, and a dry-run rebuild first. Enable scheduled flags
   only after job cost and false-positive volume are measured. Keep manual
   correction commands gated until the preview rehearsal is documented.

R6 is done when each pattern produces an explainable review flag, an operator
can verify a match and rating calculation, a reviewed invalidation rebuilds
the published state with zero drift, exclusion/inclusion changes only public
ranking, and every mutation is auditable. A draft spec or synthetic test
alone does not mark R6 shipped.

---

## 8. Implementation slices

1. Add migration, indexed flag/audit queries, and bounded detector fixtures.
2. Add read-only CLI inspection and consistency commands; prove environment
   selection and replay/rating verification against local D1.
3. Integrate invalidation with R1's guarded rebuild, projection swap, and
   audit; test failure recovery and public readers.
4. Add exclusion/inclusion and cache refresh; optionally add the flags page.
5. Rehearse preview, review costs and false positives, then enable in
   production. Use one logical Conventional Commit per slice.

---

## 9. Decisions recorded by this draft

| ID | Draft decision | Reason |
| --- | --- | --- |
| R6-D1 | Fixed, conservative, versioned detection thresholds; flags are review-only. | Avoid automatic penalties and keep false positives inspectable. |
| R6-D2 | `rating_invalidation` is the rebuild input; the H1 match result/replay stays immutable. | A correction must remain traceable and reproducible. |
| R6-D3 | Full rebuild after invalidation; preserve separate leaderboard exclusion metadata. | Pair caps and later opponents can change beyond the two seats. |
| R6-D4 | Remote writes require explicit environment, actor, plan digest, backup, audit, and preview rehearsal. | Prevent applying a stale correction or publishing mixed state. |

## 10. Founder choices to confirm

The draft uses these defaults while founder answers are pending:

1. Keep an invalidated match's public match/replay page visible with a
   neutral “rating removed” label. Hiding it would change V2's public-history
   decision (§16 D8) and needs an explicit brief update.
2. Keep its played result in R4/R5 **all-game** records when it otherwise
   qualifies under their competitive-game rules. R3 **rated-only** records
   exclude it. A different choice needs one consistent H2/R4/R5 rule and
   updated tests before implementation.
3. Use the conservative, fixed version 1 detection thresholds in §3 and
   manual review before every correction. Any later threshold change gets a
   new rule version and fixture review.
