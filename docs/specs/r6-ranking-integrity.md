# R6 — Ranking Integrity (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Wave       | R6-core: 2, with R1/R2; required before rated public play. R6-detect: L (later in V2, only with evidence that it is needed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Depends on | R1, R2; R6-core's migration merges between R1's slices 4 and 5 (§3.1); R6-detect also needs X1a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Register   | P4, P7, P8, P10; also cites P2 and P17 ([register](README.md#decision-register))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Contracts  | Owns the R6 tables and the plan/apply contract (§3), including `rating_account_exclusion` ([§7.5](v2-contracts.md#75-exclusion-projection)). Consumes [§2.1](v2-contracts.md#21-h1-tables), [§2.4](v2-contracts.md#24-compact-replay), [§2.5](v2-contracts.md#25-r1-extension), [§4.2](v2-contracts.md#42-rating-decision), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§7.2](v2-contracts.md#72-the-fence), [§7.4](v2-contracts.md#74-corrections), [§8](v2-contracts.md#8-deletion), [§10.1](v2-contracts.md#101-one-cron-one-dispatcher), [§11](v2-contracts.md#11-migration-ownership), [§12 E1](v2-contracts.md#12-evidence) |
| Brief      | [`docs/shaxda-v2.md`](../shaxda-v2.md) §6.2, §7.2, §10 (R6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Touches    | `packages/db` (migrations, `@shaxda/db/rating-admin` statements), `packages/rating` (correction diff and digest; R6-detect rules), `scripts/rating-admin/` and the root `rating:admin` script, `web/` (the "rating corrected" label; R6-detect job and `/admin/flags`), `packages/i18n`                                                                                                                                                                                                                                                                                                                                                                                            |

R6 keeps public ratings honest without a moderation product. **R6-core** is
the founder's toolset: inspect and verify any saved match, prove that stored
ratings equal a fresh rebuild, take a reviewed match out of the ratings or an
account off the public ranking, and undo either. Every change is planned,
applied in one atomic batch, and audited. **R6-detect** adds advisory flags
later, only with evidence that they are needed. R6 never changes a game
result or a ledger row. It leaves the arithmetic and the correction procedure
to R1, the decision policy and rated labels to R2, their rendering to H2 and
R4, stalled saves to H1's `match:ops`, and leaderboard eligibility to R3.

## 1. Outcome and non-goals

### 1.1 R6-core (wave 2)

**Outcome.** Before rated play is public, every correction the ratings may
need exists as a rehearsed, reviewable, reversible operator command.

**Must**

1. `pnpm rating:admin -- <command> --database <local|preview|production>`
   with the commands of §4.1; no environment default, no arbitrary SQL,
   every input validated before a query.
2. Plan/apply for every mutation (§3.2): the plan records a digest and the
   ledger high-water `seq`; apply rejects if either changed.
3. The §3.1 tables, migrated after R1's.
4. Invalidate, rescind, and rebuild publish through R1's correction procedure
   ([§7.4](v2-contracts.md#74-corrections)): a full rebuild in `seq` order
   under the recorded versions, swapped in one batch with R6's rows (§4.2).
5. "Rating corrected" on each match whose decision or displayed values a
   correction changed; nothing public names a reason, actor, or detector.
6. Exclusion changes only public ranking and survives every rebuild (§4.3).
7. Remote mutations: a restore point first and a preview rehearsal before a
   command's first production use; only the founder runs them, never tests,
   CI, or deploy hooks.

**Should:** `inspect-match` lists either seat's rated games that overlap it
in time (the P10 signal); one neutral sentence each on `/learn#tartan` and
`/legal` (§7).

### 1.2 R6-detect (wave L)

**Outcome.** A nightly job raises advisory flags for four patterns; the
founder reviews them on `/admin/flags` and acts, if at all, through R6-core.
A flag is a lead for review, not proof of misconduct.

**Must**

1. Four pure `rule_v = 1` detectors (§4.4) with threshold, just-below,
   window, and small-community false-positive fixtures.
2. `rating_flag` (§3.3): one open flag per rule, version, and subject.
3. A nightly dispatcher job
   ([§10.1](v2-contracts.md#101-one-cron-one-dispatcher)) with a `job_state`
   lease and cursor, behind the kill switch `RATING_FLAGS_ENABLED`.
4. Read-only `/admin/flags` (admin allowlist, `no-store`, `noindex`); CLI
   `flags`, `review-flag` (plan/apply), and `detect` (read-only).
5. Detectors never write ratings, invalidations, or exclusions.

### 1.3 Not in R6

Automated punishment, bans, suspensions, appeals, player reports, public
accusation labels, device or IP tracking, matchmaking penalties; editing or
deleting ledger rows, replays, or accounts; any public mutation route; rating
arithmetic, policy, or version changes (R1, R2); a cross-room active-game
registry (P10); stalled-save recovery (H1, P17); leaderboard eligibility (R3).

## 2. Decisions and dependencies

| ID  | How R6 applies it                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P4  | Corrections rebuild in `seq` order. A late save is simply the next event, never a correction. Detectors judge behaviour in `ended_at` windows and never reorder ratings.             |
| P7  | A rebuild re-applies the pair cap under the recorded policy version: an invalidated event frees its slot, so a later cap-skipped event can become processed; rescinding reverses it. |
| P8  | Invalidated events are not processed, so public numbers drop them with no special case; public match lists keep them, labelled.                                                      |
| P10 | R6 does not prevent concurrent rated games; `inspect-match` and flags are the evidence that would reopen P10.                                                                        |
| P2  | An invalidated rated match stays public (M8). A friendly match cannot be invalidated: it has no rating effect.                                                                       |
| P17 | Stalled saves belong to H1's `match:ops`. R6 keeps the same rule for its own changes: nothing on a timer, every corrective step explicit and audited.                                |

| Dependency | What it provides                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1         | Ledger rows ([§2.1](v2-contracts.md#21-h1-tables)), the compact replay and decoder ([§2.4](v2-contracts.md#24-compact-replay)), `rules_v`, `replay_v`.                                                                                                                                                                                                                                                                                       |
| R1         | `packages/rating` and `pnpm rating:rebuild` (dry run, `--apply`, `--pause`, `--resume`), whose rebuild takes the invalidation set as an input so R6 can pass a proposed change before its log row exists; `match_rating`, `match_player_rating`, `player_rating`, `rating_processor_state`, the fence, the `*_next` tables and swap ([§2.5](v2-contracts.md#25-r1-extension), [§7.4](v2-contracts.md#74-corrections)); whole-number display. |
| R2         | `ratingSkipReason` and `writesLedgerRow` (`@shaxda/shared/rated-play`), `RATING_POLICY_V`, and the rated label mapping, including the removal label.                                                                                                                                                                                                                                                                                         |
| H2, R4     | The match page, `/history`, and the public profile list, where the labels render.                                                                                                                                                                                                                                                                                                                                                            |
| X1a        | R6-detect only: the dispatcher, `job_state` and `job_fence`, `requireAdmin` with `ADMIN_USER_IDS`.                                                                                                                                                                                                                                                                                                                                           |
| A3         | Pending and deleted states; the neutral label everywhere outside the operator's terminal ([§8](v2-contracts.md#8-deletion)).                                                                                                                                                                                                                                                                                                                 |
| Consumers  | R1's processor and rebuild read the invalidation set (decision step 1) and the exclusion source; R3 reads `player_rating.excluded` for P19.                                                                                                                                                                                                                                                                                                  |

## 3. Contracts

### 3.1 R6-core tables

One hand-written migration, numbered at merge after R1's
([§11](v2-contracts.md#11-migration-ownership)). R1's fold reads the view and
the exclusion source from its first decision (R1 slice 5), so this migration
merges between R1's slices 4 and 5 and ships in the same wave-2 migration
window.

```sql
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
```

| Rule                 | Detail                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Append-only          | `BEFORE UPDATE` and `BEFORE DELETE` triggers `RAISE(ABORT, 'append-only')`. Time columns hold D1's clock in milliseconds, set by the writing statement.                                                                                                                                                                                                                         |
| Invalidation set     | `invalidate` is appended only for a `rated = 1` match whose latest action is not `invalidate`; `rescind` only when it is. The processor checks a match with one indexed lookup on the view; a rebuild reads the view once.                                                                                                                                                      |
| Exclusion projection | `player_rating.excluded` always equals `COALESCE(excluded, 0)` from the source. R1 writes it only when creating a `player_rating` or `player_rating_next` row, reading the source then; R6's exclusion batch updates the source and the projection together.                                                                                                                    |
| Correction mark      | Exists when a published rebuild changed the match's `match_rating` status or skip reason, or either seat's `rating_before` or `rating_after` as displayed (R1's whole numbers). `rebuild_id` is the latest such rebuild; marks are never deleted. `changed_events` counts matches whose rating rows differ in any compared column (§3.2); `marked_events` counts marks written. |
| Exposure, retention  | Only a mark's existence reaches a public loader; everything else here is operator-only (§5). Retention is indefinite, like the ledger.                                                                                                                                                                                                                                          |

### 3.2 Plan and apply

Every mutating command runs twice with the same arguments: as a plan, then
with `--apply <digest>`.

| Term              | Rule                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High-water mark   | `H = cursor_seq` at plan time: the last decided ledger row, as R1's correction uses it. Rows above `H` are pending; after the swap the processor decides them on the corrected state with the log in force, so invalidating a pending match takes effect when it is decided.                                                    |
| Plan              | Read-only apart from one `planned` audit row; prints environment, database, `H`, counts, up to 20 sample changes, and the digest. No change → `noop`, nothing to apply. `rebuild-ratings` without `--reason` is a dry run that writes nothing.                                                                                  |
| Verification diff | Published rows against the rebuilt `*_next` rows: `match_rating` status, skip reason, and versions in `seq` order; both `match_player_rating` rows per match at full precision; `player_rating` rows by user id; for an exclusion, the source row and the projection. Wall-clock columns such as `decided_at` are not compared. |
| Digest            | Lowercase hex SHA-256 of canonical JSON (fixed key order, no whitespace, shortest round-trip numbers) of `{ command, target, reason, environment, databaseId, highWaterSeq, policyV, algorithmV, invalidationLogHead, diff }`.                                                                                                  |
| Apply             | Finds the `planned` row for this digest, environment, command, and target; recomputes; rejects with an audited cause (§4.2). An applied digest is `noop`. Success writes `applied` inside the publishing batch.                                                                                                                 |
| Why `H` is fixed  | A row decided after the plan was decided on the uncorrected state, so it must be part of the reviewed rebuild. Exclusions do not depend on `H`; the rule is uniform, and a rejection costs a re-plan.                                                                                                                           |
| Actor             | The identity `wrangler whoami` reports (login email, or token type and account id) plus `git config user.name` and `user.email`. Single-operator attribution, not strong identity: anyone with the founder's Wrangler login and a checkout can assert it. A remote command without a `whoami` identity exits before any read.   |
| Production        | Applies also need `--confirm-database shaxda-db`.                                                                                                                                                                                                                                                                               |

### 3.3 R6-detect table

R6-detect's own migration, later; `rating_admin_audit` needs no change.

```sql
CREATE TABLE rating_flag (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule   TEXT NOT NULL CHECK (rule IN ('winTrading','instantResignations','oneWayFeeding','abnormalRate')),
  rule_v INTEGER NOT NULL,
  subject_key TEXT NOT NULL,                       -- user id, or "<lower id>|<higher id>" for a pair; private
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  window_start INTEGER NOT NULL, window_end INTEGER NOT NULL,   -- ended_at of first and last evidence
  evidence TEXT NOT NULL,                          -- JSON, ≤ 20 matches: id, duration, actions, reasons, results
  evidence_max_seq INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  review_audit_id INTEGER REFERENCES rating_admin_audit(id),
  CHECK ((status = 'open') = (review_audit_id IS NULL))
);
CREATE UNIQUE INDEX rating_flag_open_idx ON rating_flag (rule, rule_v, subject_key) WHERE status = 'open';
CREATE INDEX rating_flag_list_idx ON rating_flag (status, updated_at DESC, id DESC);
CREATE INDEX rating_flag_subject_idx ON rating_flag (rule, rule_v, subject_key, id DESC);
```

## 4. Behaviour and failure handling

### 4.1 R6-core — the CLI

| Rule        | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code        | `scripts/rating-admin/` holds the entry; D1 statements live in `@shaxda/db/rating-admin` and pure logic in `packages/rating`, so Vitest and the Workers pool test them without the CLI.                                                                                                                                                                                                                                                                                         |
| Environment | `--database` is required; a missing or unknown value exits 2 before any I/O. The CLI first prints the environment, config path, database name and id, and mode (read, plan, or apply).                                                                                                                                                                                                                                                                                          |
| Access path | Only Wrangler: `getPlatformProxy` over tracked, D1-only configs in `scripts/rating-admin/` (`local`: the web Worker's Miniflare database; `preview`, `production`: the remote database through Wrangler's remote bindings and the founder's `wrangler login`), with an empty env-file list, so `.dev.vars`, `.env`, and `.env.production` are never read. Every mutation is one `db.batch()`; separate Wrangler commands are never one atomic step. Times come from D1's clock. |
| Inputs      | Zod before any query: match ids by the [§2.3](v2-contracts.md#23-public-match-id) pattern, `--username` or `--user-id`, `--reason` of 3–500 printable characters, known flags only. Bound parameters only; child processes (`wrangler whoami`, `wrangler d1 time-travel info`, `git config`) get argument arrays, never a shell string.                                                                                                                                         |
| Output      | English operator text on the terminal. Private ids and current usernames appear only there; emails, provider ids, sessions, and tickets never. Exit 0 clean, 1 on a finding or rejection, 2 on usage or environment errors. Read-only commands write nothing.                                                                                                                                                                                                                   |

| Command                                                 | Output or effect                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inspect-match <matchId>`                               | Every ledger column except the raw replay (size and versions instead); both seats with private ids and current username or deletion state; the `match_rating` row (or "pending") and both `match_player_rating` rows at full precision; invalidation history, mark, audit trail; overlapping rated games (Should).                                                             |
| `verify-replay <matchId>`                               | Decodes and replays with the engine for its `rules_v`; compares starting seat, action count, first advantage, winner, end reason, online end reason (only with a final `R:` of the losing seat), and each seat's result, pieces left, and captures. Exit 1 on a difference or unsupported version.                                                                             |
| `inspect-rating <matchId>`                              | The decision trace in §4.2 order: the invalidation, the step 2 validation checks, then the other `ratingSkipReason` inputs (rated, the counted earlier-`seq` pair games). When processed, the event recomputed from the stored pre-event values and from each seat's previous processed event, against the stored values; first divergence. `--full` rebuilds up to its `seq`. |
| `check-consistency [--no-replays]`                      | Full read: `writesLedgerRow` holds for every row; replays verify; a fresh rebuild up to `cursor_seq` equals the stored rating rows (zero drift); the view and `skipped:invalidated` rows agree up to `cursor_seq`; `excluded` equals the source; maintenance is off and `*_next` empty. First offending id per check.                                                          |
| `rebuild-ratings [--reason <text>] [--apply <digest>]`  | The audited form of R1's `pnpm rating:rebuild`. Dry run by default: counts, first differences, and digest. With a reason it is a plan; `--apply` hands the approved plan to R1's swap (§4.2) under the current versions. For a version change, R1 names the new versions and this command publishes that rebuild the same way.                                                 |
| `invalidate-match <matchId> --reason <text>`            | Plan or apply (§4.2). Refused for a friendly match; `noop` when already invalidated.                                                                                                                                                                                                                                                                                           |
| `rescind-invalidation <matchId> --reason <text>`        | Plan or apply (§4.2); `noop` unless the latest action is `invalidate`.                                                                                                                                                                                                                                                                                                         |
| `exclude-account`, `include-account` (user, `--reason`) | Plan or apply (§4.3); `noop` when already in that state.                                                                                                                                                                                                                                                                                                                       |
| `pause-ratings --reason <text>`                         | Plan or apply: the audited form of R1's `rating:rebuild --pause`, R1's kill switch; decisions stop and readers keep the last state with R1's note.                                                                                                                                                                                                                             |
| `resume-ratings --reason <text>`                        | Plan or apply: the audited form of R1's `rating:rebuild --resume`, ending a pause or abandoning a correction left open by a failed apply (§4.2).                                                                                                                                                                                                                               |

### 4.2 R6-core — corrections

Invalidate, rescind, and rebuild apply run R1's correction (R1 §4.3,
[§7.4](v2-contracts.md#74-corrections)) and add R6's checks and rows. The
rebuild is a pure function of the ledger up to `H`, the invalidation set (with
the proposed log row), the exclusion source, and the recorded `policy_v` and
`algorithm_v`. Invalidate and rescind never change a version, so every cap
decision is re-evaluated deterministically under the original policy.

| Step | Apply does                                                                                                                                                                                                                                                                                                                               | Else                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1    | Finds the `planned` row for the digest.                                                                                                                                                                                                                                                                                                  | `unknownPlan`; `noop` if applied |
| 2    | Preview and production: records a D1 Time Travel restore point (`wrangler d1 time-travel info`) in the audit detail.                                                                                                                                                                                                                     | `restorePointUnavailable`        |
| 3    | R1's stop: the operator lease and `maintenance = 1`, retried for two minutes while the processor holds the lease.                                                                                                                                                                                                                        | `maintenanceBusy`                |
| 4    | Checks `cursor_seq = H`.                                                                                                                                                                                                                                                                                                                 | `staleHighWater`                 |
| 5    | R1's rebuild up to `H` into `*_next`, in bounded, resumable chunks.                                                                                                                                                                                                                                                                      | `failed`                         |
| 6    | R1's verify, then the verification diff (§3.2), whose digest must equal the plan's; the marked set comes from the same diff.                                                                                                                                                                                                             | `digestMismatch`                 |
| 7    | R1's one-batch swap, given the approved plan; after its fence, R6's log row, `rating_rebuild` row, marks (upserted from JSON lists of match ids, at most 1 MB each), and `applied` audit row. D1 serialises queries, so every request waits for it (about 0.16 s at 25,000 matches locally, E1): production applies run at a quiet hour. | `failed`; nothing changes        |
| 8    | R1's finish (empty `*_next`), then `check-consistency --no-replays`, which must show zero drift.                                                                                                                                                                                                                                         | exit 1; stop and inspect         |

Consequences, all visible in the plan: the invalidated match's `match_rating`
becomes `skipped:invalidated` and its `match_player_rating` rows disappear; a
later cap-skipped game of the pair can become processed; every later event of
both players, and of anyone they later played, is recomputed. `match` and
`match_player` never change. A rescission returns every rating row to the
state it would have had without the invalidation.

**Failures.** Nothing published changes before step 7, and a failed fence
(`rating_fence_guard`) or statement rolls the whole swap back. The CLI then
releases maintenance and empties `*_next` with its token and appends
`rejected` or `failed`. If it cannot (crash, lost network), maintenance stays
on: ratings pause behind R1's "updating" note while saves continue, until the
operator re-runs the same apply (it takes over the lapsed operator lease, as
in R1) or runs `resume-ratings`. Restoring the Time Travel point is a last
resort: it rewinds every table, including matches and accounts written
since. The ledger is never touched, so a correct re-run is the normal repair.

### 4.3 R6-core — exclusion, held rows, public behaviour

| Topic              | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exclusion batch    | A fence row requiring `maintenance = 0`, the source upsert, `UPDATE player_rating SET excluded = ?` for the account (if it has a row), and the `applied` audit row. During a correction it fails with `maintenanceBusy`, so `player_rating_next` cannot go stale.                                                                                                                                                                                                       |
| Exclusion effect   | Ratings, rating events, ledger rows, profiles, and opponents' ratings never change. R3 applies P19 (`excluded = 0`) at its next uncached read; inclusion restores eligibility, not a rank. A3's pending and deleted states hide accounts independently.                                                                                                                                                                                                                 |
| Exclusion survives | Every new `player_rating` row and every rebuild read the source, so an exclusion survives a rebuild that removes the account's last processed event and applies again when the account next plays rated.                                                                                                                                                                                                                                                                |
| Held rows          | `inspect-rating` names the failed step 2 check. Missing support for a `rules_v` or `replay_v`: deploy it, then `rebuild-ratings` apply decides the row in `seq` order and marks the later events it changes. A self-contradictory row stays `held`: no rating effect, listed by `check-consistency`, never edited; invalidating a rated one resolves it as `skipped:invalidated`, since the invalidation check runs first ([§4.2](v2-contracts.md#42-rating-decision)). |
| Removal label      | Invalidated matches show R2's `skipped:invalidated` label (M8's "rating removed") on every rated surface; P8 keeps them out of public numbers.                                                                                                                                                                                                                                                                                                                          |
| "Rating corrected" | Shown beside a marked match's other labels, except when invalidated, where the removal label already says so. R6-core adds it to R2's label mapping; H2's and R4's readers add one primary-key lookup on `rating_correction_mark`.                                                                                                                                                                                                                                      |
| During an apply    | Readers show the last published state with R1's note.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Never public       | Flags, and whether an account is excluded: the profile shows no rank, like any ineligible account, and only the account's own rank context uses R3's neutral wording.                                                                                                                                                                                                                                                                                                   |

### 4.4 R6-detect — rules (`rule_v = 1`)

Input is processed rated matches only (`match_rating.rating_status =
'processed'`). Duration `d = ended_at − started_at`; short means `d ≤ 5 min`.
A manual resignation by X is `end_reason = 'resignation'`, `online_end_reason
IS NULL`, and X lost; claim-win losses never count. Every window is
half-open, `(last.ended_at − W, last.ended_at]`, as in the pair cap. Matches
order by `ended_at`, then `seq`. A pair's key is its two sorted account ids,
so seat swaps and renames change nothing.

| Rule                  | Subject | Qualifies                                                                                                                              |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `winTrading`          | pair    | 4 consecutive processed games of the pair within 7 days, winners alternating, no draw among them, at least 3 of the 4 short            |
| `instantResignations` | account | ≥ 3 manual resignations by the account within 24 h, each with `d ≤ 60 s` and `action_count ≤ 3` (at most two actions before resigning) |
| `oneWayFeeding`       | pair    | ≥ 5 processed games of the pair within 7 days, one account lost ≥ 4 of them, and ≥ 3 of those losses were manual resignations or short |
| `abnormalRate`        | account | ≥ 20 processed rated games within 24 h (under P7, normally at least 7 opponents)                                                       |

Repeat opponents and short games are normal in a small community, so each
rule pairs a pattern (alternation, one-sidedness, resignation speed, volume)
with a threshold the §9.2 false-positive fixtures stay below. A threshold or
window change is a new `rule_v`, with fixture review and a `detect` dry run
before it runs.

### 4.5 R6-detect — nightly job and review

| Topic          | Rule                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule       | The dispatcher starts a run once a day from 00:30 UTC while `RATING_FLAGS_ENABLED = true`, under the `r6.flags` lease in `job_state` with the `job_fence` pattern.                                                                                                                                                                                                                            |
| Range          | Processed rated matches with `ended_at` in `[max(cursor, start − 30 d) − 7 d, start)` via `match_rated_ended_idx` in keyset pages; evaluated in memory; then `cursor = start` (first run: `start − 1 d`). A missed night falls in the next range; a duplicate run rewrites the same flags.                                                                                                    |
| Scale trigger  | A range above 20,000 matches stops with `ratingFlagsRangeTooLarge`; the job then moves to per-subject chunks.                                                                                                                                                                                                                                                                                 |
| Upsert         | An open flag for the rule, version, and subject takes the latest qualifying window. After review, a new flag opens only for a window holding a match with `seq > evidence_max_seq` of the reviewed one.                                                                                                                                                                                       |
| Not rescanned  | Saves retried later than the range and matches promoted by a correction outside it; `detect` covers any range on demand. The job writes only `rating_flag` and its `job_state` row.                                                                                                                                                                                                           |
| `/admin/flags` | SSR, `requireAdmin`, `no-store`, `noindex`, never in a sitemap or the PWA cache, read-only. Open flags first, then newest `updated_at`, 25 a page (keyset). Rows show rule, version, subject as current usernames (the neutral label for pending or deleted), window, review state, and evidence links with each match's current rating status; Should: the `inspect-match` commands to copy. |
| CLI            | `flags [--status <state>]` lists; `review-flag <flagId> --outcome dismissed\|actioned --reason <text>` is plan/apply and sets `review_audit_id`; `detect --from <YYYY-MM-DD> --to <YYYY-MM-DD>` prints what `rule_v = 1` would flag and writes nothing.                                                                                                                                       |

## 5. Privacy and access

Rows of the [access matrix](v2-contracts.md#5-access-matrix) that R6 touches:

| §5 row                                   | R6 behaviour                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/match/<id>` … rating status — rated    | Public removal label (R2) and "rating corrected"; nothing else from R6.                                         |
| `/match/<id>` … rating status — friendly | No R6 state can exist; access is unchanged.                                                                     |
| `/history`                               | The owner sees the same labels on their rated games.                                                            |
| `/u/<username>` numbers and match list   | Numbers are processed events only (P8); invalidated rated matches are listed, labelled; exclusion is not shown. |
| `/leaderboard`                           | R3 omits excluded accounts with no reason given.                                                                |
| Pending/deleted account                  | `/admin/flags` shows the neutral label; R6 rows keep only the opaque id after finalization, like the ledger.    |

Operator-only: the log, audit, exclusion rows, reasons, actors, flags, rules,
and evidence. None reaches a public loader, Open Graph metadata, a shared
cache, analytics, or logs. Reasons are operator notes and must not contain
emails, tickets, or personal data beyond the ids these tables hold. CLI output
stays on the operator's terminal; tests use fixture ids only.

## 6. Resource budget

`N` = saved matches up to `H`; `P` = rated players; E1's 1× projection is
25,000 matches and 5,000 players.

| Operation                          | D1 rows read                                                                        | D1 rows written                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Match page, history, profile list  | + 1 primary-key lookup on `rating_correction_mark` per match shown                  | —                                                                            |
| Processor, per decided row         | + 1 indexed view lookup; + 1 key read of the source per new `player_rating` row     | — (inside R1's and R2's budgets)                                             |
| `inspect-*`, `verify-replay`       | A few rows per match; `inspect-rating` also reads each seat's history (owner index) | 0; replay CPU in Node, ≤ 1,403 actions (E4)                                  |
| Dry run, plan, `check-consistency` | The ledger and rating tables: about 6N + P (≈ 155,000 at 1×)                        | 1 audit row for a plan                                                       |
| Correction apply                   | As a plan                                                                           | `*_next` ≈ 3N + P in chunks, the swap (≈ 125,000 at 1×, §7.4), marks, 3 rows |
| Exclusion apply                    | ≈ 3                                                                                 | ≈ 3                                                                          |
| R6-detect nightly run              | ≈ 3 × rated matches in the range (normally 8 days)                                  | Flags raised or updated; `job_state`                                         |
| `/admin/flags` page                | ≤ 25 flags + ≤ 20 evidence status reads each                                        | 0                                                                            |

No Durable Object wakes for R6 and no row is written per move. A full
correction at 1× writes about 200,000 rows
([§7.4](v2-contracts.md#74-corrections)), above D1's Free-plan allowance of 100,000
rows written a day, so production corrections at that size need the Workers
Paid plan (Q3's budget input). Storage: a few audit rows per operation and
one mark per corrected match.

## 7. Somali copy

Drafts behind `TODO(translation-review)`, reusing the README glossary. The
removal label belongs to R2's rated label mapping; R6 does not redefine it.

| Key                          | Draft                                                                                                                                                                            | Where                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `ratingStatus.corrected`     | Darajada waa la saxay                                                                                                                                                            | Match page, `/history`, profile list |
| `ratingStatus.correctedHelp` | Tirooyinka darajada ee ciyaartan waa la beddelay markii darajooyinka dib loo xisaabiyey.                                                                                         | Match page                           |
| `/learn#tartan` (Should)     | Shaxda waxay dib u eegi kartaa ciyaaraha Tartanka. Ciyaar darajadeeda waa laga saari karaa, ciyaaryahanna waa laga reebi karaa Miiska darajada; natiijada ciyaarta lama beddelo. | R2's section                         |
| `/legal` (Should)            | Maamulka Shaxda wuxuu kaydin karaa qoraallo gudaha ah oo ku saabsan dib-u-eegista ciyaaraha Tartanka iyo akoonnada; qoraalladaas lama soo bandhigo.                              | Section `xogta`                      |

R6-detect admin copy (`adminFlags.*`): `title` "Calaamadaha dib-u-eegista
darajada"; `advisory` "Calaamaddu waa tilmaan dib-u-eegis, ma aha caddayn.";
`empty` "Ma jirto calaamad furan."; `status.open` / `dismissed` / `actioned`
"Furan" / "Waa la iska dhaafay" / "Tallaabo ayaa la qaaday"; rules
`winTrading` / `instantResignations` / `oneWayFeeding` / `abnormalRate`
"Guulo la is-dhaafsaday" / "Is dhiib degdeg ah" / "Guulo hal dhinac ah" /
"Ciyaaro aad u badan". The CLI prints English operator text.

## 8. Implementation slices

### 8.1 R6-core (wave 2)

1. `test(db): cover R6-core tables, triggers, and the invalidation view`
2. `feat(db): add R6-core correction and audit tables` — merges between R1's slices 4 and 5 (§3.1); query plans recorded
3. `feat(ops): add read-only rating:admin commands` — also proves on local
   that a failed fence through the access path changes zero rows
4. `feat(rating): add the correction diff, marks, and plan digest`
5. `feat(ops): add plan/apply, restore points, and the audit trail`
6. `feat(ops): add invalidate-match and rescind-invalidation`
7. `feat(ops): add exclude-account and include-account`
8. `feat(web): show "rating corrected" on rated match surfaces`
9. `feat(i18n): mention rating reviews on /learn and /legal` (Should)
10. `docs(ops): record the R6-core preview rehearsal`

### 8.2 R6-detect (wave L)

11. `test(rating): add detector fixtures with small-community false positives`
12. `feat(rating): add rule_v 1 rating detectors`
13. `feat(db): add rating_flag`
14. `feat(web): run the rating detectors in the nightly dispatcher`
15. `feat(ops): add flags, review-flag, and detect commands`
16. `feat(web): add /admin/flags`

## 9. Acceptance tests

### 9.1 R6-core

Workers and D1 cases run on Miniflare in `packages/db` (`test:worker`).

| Level | Case                  | Expected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit  | Digest                | Equal inputs, equal digest; a changed reason, `H`, log head, or last bit of one value changes it; `decided_at` does not.                                                                                                                                                                                                                                                                                                                                                                                          |
| Unit  | Mark rule             | A decision change marks; 1512.4 → 1512.3 counts in `changed_events` without a mark; 1512.4 → 1512.6 marks.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Unit  | Guards                | Missing or unknown `--database`, malformed ids, reasons outside 3–500 characters, and a production apply without `--confirm-database` exit 2 with no I/O; a remote command without a `whoami` identity exits before reading; with hostile `.dev.vars` and `.env` present, nothing from them is read.                                                                                                                                                                                                              |
| D1    | Migration             | View, indexes, and foreign keys exist; `UPDATE` and `DELETE` on the audit, log, and rebuild tables fail with `append-only`.                                                                                                                                                                                                                                                                                                                                                                                       |
| D1    | Invalidate the middle | Fixture in `seq` order: A–B ×4 within 24 h (the fourth `skipped:pairCap`, M4), then B–C, then C–D. Invalidating the second A–B (M8) gives `skipped:invalidated` with no `match_player_rating` rows; the fourth is promoted; the third, B–C, and C–D events change, so D, who never met A or B, moves; `player_rating` equals a fresh rebuild; zero drift; marks follow the rule; `rating_rebuild` counts and `planned`/`applied` audit rows are right; every `match` and `match_player` column is byte-identical. |
| D1    | Rescind               | Every `match_rating`, `match_player_rating`, and `player_rating` row (`board_key` included) equals the pre-invalidation snapshot at full precision; marks point at the second rebuild; the log has two rows.                                                                                                                                                                                                                                                                                                      |
| D1    | Mixed runtimes        | After an apply the processor (workerd) decides two new matches; the Node dry run still shows zero drift.                                                                                                                                                                                                                                                                                                                                                                                                          |
| D1    | Stale plans           | A match decided after the plan → `staleHighWater`; another correction in between → `digestMismatch`; an unrecorded digest → `unknownPlan`; a second apply → `noop`. Each publishes nothing, releases maintenance, and appends one audit row. A match still pending at the plan is invalidated when the processor decides it after the swap.                                                                                                                                                                       |
| D1    | Concurrency, crashes  | A processor holding the lease → `maintenanceBusy`; a swap whose fence or any statement fails changes zero rows; an apply stopped after step 5 leaves maintenance on and the published state unchanged, and a re-run finishes it or `resume-ratings` restores processing; after `pause-ratings`, new saves stay pending until `resume-ratings`.                                                                                                                                                                    |
| D1    | Exclusion             | Excluding E changes only the source and `excluded`; invalidating E's only processed match removes E's `player_rating` row but not the source; E's next processed match recreates it with `excluded = 1`; include → 0; repeats → `noop`; exclusion during maintenance fails; an event batch for E at the same time keeps E excluded.                                                                                                                                                                               |
| D1    | Consistency, replay   | `check-consistency` exits 1 with the id for an altered replay, value drift, projection drift, a processed row in the view, and maintenance left on; the clean fixture exits 0. `verify-replay` passes M2, M3 (final `R:A`, `idle`), and M5, and fails an altered action, an altered result, and an unsupported `replay_v` or `rules_v`.                                                                                                                                                                           |
| D1    | Held rows             | A row with an unsupported `rules_v` stays held while later rows process; with support added, `rebuild-ratings` apply decides it and marks the later events it changes. Invalidating a self-contradictory rated row makes it `skipped:invalidated`.                                                                                                                                                                                                                                                                |
| D1    | Query plans           | The view lookup, the mark lookup, and audit by target use their indexes (`EXPLAIN QUERY PLAN`).                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Web   | Labels                | A marked rated match shows "rating corrected" on the match page and `/history`; M8 shows the removal label only; M1 and M9 never show either; no reason, actor, rule, or log text in HTML, route data, Open Graph metadata, or cache headers.                                                                                                                                                                                                                                                                     |
| E2E   | Real game             | After a real rated game on the shared e2e D1 ([§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)), an invalidation applied through the CLI's modules shows the removal label, and the players' public numbers drop the game.                                                                                                                                                                                                                                                                                     |

### 9.2 R6-detect

| Case            | Expected                                                                                                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thresholds      | Each rule at its threshold raises one flag; just below raises none (3 alternating games, 2 quick resignations, 3 of 5 lost, 19 games); a last match exactly `W` after the first raises none.                                                                                                                                                 |
| Small community | No flag for: two even friends playing three rated games every evening for a week in 12–25 minute games; a strong regular beating a newer friend five times in a week in full games; two quick resignations in one evening; three idle-claim losses in 24 h; a 19-game marathon against eight opponents; many short games with mixed winners. |
| Identity, order | Seat swaps and renames keep one pair key; equal `ended_at` values order by `seq`; a draw breaks a trading run; friendly, cap-skipped, invalidated, held, and pending matches are ignored.                                                                                                                                                    |
| Job             | A duplicate run leaves the same flags; a missed night is covered; a reviewed flag is not reopened by its own evidence, but a newer match opens a new one; every table except `rating_flag` and `job_state` is byte-identical after a run; `RATING_FLAGS_ENABLED = false` skips it.                                                           |
| Surfaces        | `/admin/flags`: signed out → login redirect; non-admin → 403; admin → 200 with `no-store` and `noindex`; a deleted subject shows the neutral label. `review-flag` is plan/apply and audited; `detect` writes nothing.                                                                                                                        |

### 9.3 Sample matches

| ID     | What R6 tools show                                                     | R6 actions                                                         | Public after R6                                    |
| ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| M1, M9 | `rated = 0`, `skipped:friendly`                                        | `invalidate-match` refused: no rating effect                       | Unchanged; private to A and B                      |
| M2     | Processed; both events; the decision trace                             | Invalidate: later events of both players rebuilt                   | Removal label; out of P8 numbers                   |
| M3     | Processed; `verify-replay` confirms the final `R:A` and `idle`         | As M2; never a manual resignation for `instantResignations`        | As M2 when invalidated                             |
| M4     | `skipped:pairCap` with the three counted earlier-`seq` ids             | Promoted when a counted game is invalidated; demoted on rescission | "Rating corrected" when promoted                   |
| M5     | Processed draw                                                         | As M2; a draw breaks a `winTrading` run                            | As M2 when invalidated                             |
| M6, M7 | No row: unknown match id                                               | None                                                               | —                                                  |
| M8     | `skipped:invalidated` with log and audit history; ledger row unchanged | Rescind restores the pre-invalidation state                        | Public (P2), "rating removed", out of numbers (P8) |
| M10    | B's private id and deletion state; A's and B's M2 events unchanged     | Exclusion and flags keep only the opaque id                        | B shows the neutral label                          |

## 10. Rollout and rollback

### 10.1 R6-core

| Environment | Steps                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev         | Local migrations apply R1's, then R6-core's; the CLI runs with `--database local`.                                                                                                                                                                                                                                                                                                                                         |
| e2e         | The game launcher applies every migration to the shared D1 (§10.4); tests call the CLI's modules against it.                                                                                                                                                                                                                                                                                                               |
| preview     | The founder applies both migrations before the wave-2 web deploy, then rehearses with real rated games between test accounts, a capped fourth game included: invalidate a middle game and check downstream changes, the promoted game, and both labels on preview pages; rescind; exclude and include; force a stale plan; stop an apply midway and recover; record the swap time in the wave-2 ops record in `docs/ops/`. |
| production  | Same migration window; then `check-consistency` and a zero-drift dry run. The first apply of each command follows its preview rehearsal.                                                                                                                                                                                                                                                                                   |

Founder-run steps (operational; never in tests, CI, or deploy hooks):

```sh
pnpm --filter @shaxda/web exec wrangler d1 migrations apply shaxda-db-preview --config wrangler.preview.jsonc --remote
pnpm rating:admin -- invalidate-match <id> --reason "<text>" --database preview                 # plan
pnpm rating:admin -- invalidate-match <id> --reason "<text>" --database preview --apply <digest>
```

Deploy order ([§6.5](v2-contracts.md#65-deploy-order)): R1's migration →
R6-core's migration → game Worker → web Worker, which carries the "rating
corrected" label. The CLI needs no deploy. R6-core has no kill switch
([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone));
nothing runs unless the founder runs it. R2's `RATED_PLAY_ENABLED` stays off
in production until the preview rehearsal is recorded.

**Rollback.** An applied correction is undone by its inverse (rescind or
include), planned and applied the same way; the restore point is a last
resort (§4.2). The migration is additive, and a web rollback removes only the
label; the tables stay while R1's processor reads them.

**Done when:** on preview, a middle invalidation rebuilds with downstream
changes and a promoted cap-skipped game, the labels show, a rescission
restores the original values, exclusion changes only ranking, stale plans are
rejected, every attempt is audited, and `check-consistency` shows zero drift;
production has the migration and a clean dry run. This is the wave-2 gate
"invalidate/rescind rehearsed on preview".

### 10.2 R6-detect

Activation needs recorded evidence that manual inspection no longer suffices,
such as a confirmed farming case or a leaderboard complaint. Order: migration
→ web deploy with `RATING_FLAGS_ENABLED = false` → `detect` over production
history to measure false positives and cost → enable on preview, then
production. Turning the switch off stops the job; flags remain, and nothing
depends on them.

**Done when:** the fixtures pass, a `detect` run over production history
shows a false-positive volume the founder accepts, the nightly job stays
within the §6 budget, `/admin/flags` lists and links flags, and no detector
run has changed a rating, invalidation, or exclusion.
