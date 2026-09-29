# Shaxda V2 — Spec Revision Plan

| Field      | Value                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Date       | 2026-09-29                                                                                                             |
| Baseline   | `e7ea9fb` — `docs: add V2 roadmap and milestone specs`                                                                 |
| Supersedes | The 2026-09-26 draft of this file (its findings are kept and traced in §11)                                            |
| Status     | Ready to execute                                                                                                       |
| Output     | 17 revised specs, `docs/specs/README.md`, `docs/specs/v2-contracts.md`, `docs/shaxda_brd.md`, updated brief/PRD/AGENTS |
| Branch     | Local `main`, no worktree. One commit per step in §9. Nothing is pushed unless the founder asks.                       |

This is an execution checklist, not an essay. It **decides** the shared
contracts (§4) and the design simplifications (§5) so that rewriting each spec
is mechanical. Founder decisions already made are final (§3.1). Everything
else has a default (§3.2) that applies until the founder overrides it; an
override changes one row of the register, and the affected specs are edited in
the same commit.

Scope of the revision: documents plus disposable local proofs. No V2 feature
code, no migrations, no remote Cloudflare access. The only code-adjacent
change is the independent `/legal` truth fix in step 1, because production
copy is wrong today.

---

## 1. Why this plan replaces the previous draft

| Previous draft                                                                      | This plan                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listed what the revision must define ("freeze one schema", "define the lifecycle"). | Proposes the canonical schema, vocabulary, lifecycle, access matrix, and policy table (§4). Specs copy or link them.                                                    |
| Founder questions spread across 17 specs and the plan.                              | One register (§3): confirmed, defaulted, and truly open, each with the milestone it blocks.                                                                             |
| Added machinery for problems the product can avoid at its scale.                    | Removes the problems instead (§5): ingestion-order ratings, no ledger name snapshots, time-based deletion cutover, bounded outbox. Each has a scale trigger to revisit. |
| Six prose "iterations" with no file- or commit-level order.                         | Twelve steps (§9), each with deliverables, one commit, and an exit check.                                                                                               |
| Consistency review was a prose checklist.                                           | Grep and link gates that must return nothing (§10), plus ten canonical sample matches every spec must agree on (§4.4).                                                  |
| Did not notice that live `/legal` copy says Shaxda has no accounts and no D1.       | Fixes that first (step 1); it is false in production now, independent of V2.                                                                                            |

Kept from the previous draft: every audit finding (traced in §11), founder
decisions D1–D4, the release-wave idea, the metric honesty rules, and the
sponsor-pilot-with-measurement stance.

---

## 2. Ground truth checked in code (2026-09-29)

These facts drive the decisions below. Re-check them at step 5 if the code
has moved.

| Fact                                                                                                                                                                                                                                | Where                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Every game and every rematch starts with seat A.                                                                                                                                                                                    | `worker/src/match-room.ts:272`, `:638`                                                    |
| The transport rejects an off-turn action, including the player's own resignation, although the engine allows off-turn resign.                                                                                                       | `worker/src/match-room.ts:485-496`                                                        |
| Claim-win applies a synthetic `resign` for the opponent; the online reason lives only in room state.                                                                                                                                | `worker/src/match-room.ts:548`, `:563`                                                    |
| Idle expiry (60 min since last activity) closes sockets, releases the code, and `deleteAll()`s storage. No maximum room age.                                                                                                        | `worker/src/match-room.ts:31`, `:226-234`                                                 |
| Room DOs are addressed by room code, and `initializeRoom` refuses a code whose storage still exists (409), so retained storage blocks code reuse.                                                                                   | `worker/src/index.ts:150`, `worker/src/match-room.ts:255-261`                             |
| Coordinator reservations expire 70 min after creation regardless of activity.                                                                                                                                                       | `worker/src/room-coordinator.ts:7`, `:159-164`                                            |
| The client parses server frames with a Zod discriminated union and `.parse`: an unknown message **type** throws, an unknown **key** is stripped. Additive fields are safe for cached PWA clients; new server message types are not. | `packages/shared/src/schemas.ts:344`, `web/src/lib/online/onlineGameClient.ts:99`, `:142` |
| MatchRoom and RoomCoordinator are SQLite-backed Durable Objects. The game Worker has no D1 binding.                                                                                                                                 | `worker/wrangler.toml`                                                                    |
| E2E runs persist the game Worker to `test-results/wrangler-e2e` and the web Worker to `test-results/wrangler-web-e2e`: no shared local D1 today.                                                                                    | `scripts/start-worker-e2e.mjs:51`, `scripts/start-web-e2e.mjs:107`                        |
| The web Worker's `main` is the adapter output (`fetch` only); no cron exists.                                                                                                                                                       | `web/wrangler.jsonc:6`, `web/svelte.config.js`                                            |
| Only migration `0000_accounts.sql` exists. `username_claim.claimed_at` records when each username was claimed.                                                                                                                      | `packages/db/migrations/`, `packages/db/src/schema.ts:33-41`                              |
| `/legal` says Shaxda has no accounts, no Google sign-in, and no D1 storage. All three are false since V1.1-A shipped.                                                                                                               | `packages/i18n/src/content/legal.so.ts:83-84`, `:207`, `:217`                             |
| PRD §27 says the PRD wins for roadmap and proposal files are not source of truth; `shaxda-v2.md` §1 claims V2 scope authority.                                                                                                      | `docs/shaxda_prd.md:1467`, `docs/shaxda-v2.md:14-21`                                      |
| Pinned: `better-auth` 1.6.25, `@sveltejs/adapter-cloudflare` ^7.2.9, `wrangler` ^4.107.                                                                                                                                             | `web/package.json`                                                                        |
| `pnpm format:check` runs Prettier over Markdown, so every revised doc must be Prettier-clean.                                                                                                                                       | `package.json:25`, `:31`                                                                  |

---

## 3. Decision register

This section becomes the decision table in `docs/specs/README.md` (step 2).
Specs cite register IDs instead of carrying their own "decisions to confirm"
tables.

### 3.1 Founder-confirmed — do not reopen

| ID  | Decision                                                                                                                                                                  | Source                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| F1  | Invite games are friendly by default. Rated play needs both players' acceptance. Quick match is always rated.                                                             | Founder, previous review |
| F2  | Rated results and replays are public. Friendly matches are private to their two players. Visibility is explained before play.                                             | Founder, previous review |
| F3  | Retention first; sponsorship runs as a measured pilot.                                                                                                                    | Founder, previous review |
| F4  | Once both players accepted and play began, resignation or a valid disconnect/idle claim is a loss in every phase, including placement. A pre-play no-show is unrated.     | Founder, previous review |
| F5  | A3 deletion: seven-day cancelable grace; all of the account's usernames claimable 30 days after finalization.                                                             | Founder, 2026-09-25      |
| F6  | Quick match may pair new/provisional accounts broadly after a short wait.                                                                                                 | Founder, K1-D1           |
| F7  | H4 match panel shows captures, jare, repeated jare, movement turns, and a comeback badge; comeback = winner trailed by at least two captures after movement began.        | Founder, H4-D1/D2        |
| F8  | Only account-vs-account games are persisted; guest games write nothing. No seasons, tiers, achievements, chat, spectating, tournaments, async play, AI, or English in V2. | V2 brief D4, D12, §5     |

### 3.2 Defaults adopted by this plan

The founder may override any row. "Blocks" says what cannot freeze or ship
without it.

| ID  | Default                                                                                                                                                                                                                                                                                                                                                                                         | Why                                                                                                                                           | Blocks                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| P1  | **Play begins at the first accepted non-terminal action** (`place`, `removeInitial`, `move`, `capture`). Any ending before it (resign, claim, cleanup) writes no row. Every persisted match is therefore a played result.                                                                                                                                                                       | Applies F4 with one rule; removes R2's `competition_status`/`aborted` class and H1's special cases.                                           | Freeze (H1, R2)       |
| P2  | **Visibility is derived from the agreed `rated` flag**: rated → public, friendly → participants only. No separate visibility column. A cap-skipped or invalidated rated match stays public with "rating not counted".                                                                                                                                                                           | Applies F2 with no second source of truth; visibility can never disagree with consent.                                                        | Freeze                |
| P3  | **Consent handshake**: the creator may request rated at creation; the joiner accepts or declines before the first action (decline → friendly). A rematch inherits the request, and each player's rematch vote on a clearly labelled rated rematch is that player's re-consent. Entering the quick-match queue is consent. Old cached clients cannot send consent, so their games stay friendly. | Applies F1 without a new negotiation screen; safe for cached PWA clients.                                                                     | Freeze (H1, R2, K1)   |
| P4  | **Ratings are processed in ledger ingestion order** (`match.seq`, assigned by D1 at insert), not `ended_at`. Inactivity uses `ended_at` gaps clamped at zero.                                                                                                                                                                                                                                   | A late save lands at the tail by construction, so R1's late-event pause/rebuild path and generation machinery for normal operation disappear. | Freeze (R1)           |
| P5  | **No username snapshots in the ledger.** Readers resolve the current username/avatar from the account row; pending/deleted accounts render one neutral Somali label.                                                                                                                                                                                                                            | Rename and deletion need no scrub, no trigger, and no late-write guard.                                                                       | Freeze (H1, H2, A3)   |
| P6  | Inbound `gameAction`, `claimWin`, and `rematch` frames carry an optional `matchNumber`; a mismatch is rejected with a typed error.                                                                                                                                                                                                                                                              | Cheap guard against a stale command hitting a rematch, instead of revision/request-id machinery.                                              | Freeze (protocol)     |
| P7  | Pair cap: at most **3** processed rated games per unordered account pair in a rolling 24 h (by `ended_at`). No per-account daily cap at launch.                                                                                                                                                                                                                                                 | V2 brief default; the daily cap solves no observed problem yet.                                                                               | R2 activation         |
| P8  | **One public number population**: public W/L/D, streaks, form, rating, rank, Shaxda aggregates, and charts use processed rated events only. Public match lists also show cap-skipped/invalidated rated matches, labelled, excluded from numbers. `/history` (owner) shows all saved games, labelled. The head-to-head card (participant only) counts all saved games between the two.           | Resolves R3-D1, R4-D1, R5-D1 together; one honest rule instead of three labelled populations.                                                 | R3 implementation     |
| P9  | Fastest win = shortest normal board win (`opponentBelowThree`/`opponentCapturedAll`). Best streak = longest win run. Peak = highest post-match rating (no 1500 floor; unrated has no peak).                                                                                                                                                                                                     | R4-D2/D3 defaults; removes R1's artificial floor.                                                                                             | R4 implementation     |
| P10 | **No cross-room "one active rated match per account" registry** in V2. Pair caps, Glicko dampening, and R6 flags cover the abuse; the queue already allows one entry per account.                                                                                                                                                                                                               | A per-user registry across rooms is a new distributed-state problem with little benefit at this scale.                                        | Freeze                |
| P11 | **A3 cutover is time-based**: at request the web Worker stops minting identity tickets for the account; an already-open game may finish. No web→game control path. Rooms expire after 60 idle minutes, far inside the 7-day grace.                                                                                                                                                              | No new control channel, active-seat index, or DO revocation protocol.                                                                         | A3 (needs Q1)         |
| P12 | Pseudonymous analytics rows kept **90 days**; daily aggregates kept indefinitely.                                                                                                                                                                                                                                                                                                               | Year comparisons use aggregates; detailed identifiers are not needed longer.                                                                  | X1                    |
| P13 | The game Worker may **increment** a fixed allowlist of online counters (`online_*`, `queue_*`) in `event_daily`, after H1 gives it D1. It still never reads anything but its own ledger insert result and never touches auth tables.                                                                                                                                                            | Exact server-side online funnel with ~4 writes per game, instead of client "reporter" rules or a batch pipeline.                              | X1b (brief §6.1 edit) |
| P14 | Sponsor pilot inventory: `lobby` and `result` (local result included when the device is online). Periods 7, 14, **30 days** (not calendar month). An empty slot renders nothing. Public sponsor response edge-cached ≤ **60 s**, so takedown needs no cache purge.                                                                                                                              | Smaller delivery/report surface; one period unit across S1–S3 and the BRD.                                                                    | S1 (needs Q2)         |
| P15 | One pairing policy (K1 = K2): max rating gap 100/200/300/400/unbounded at 0/30/60/90/120 s of wait; **both** players' windows must admit the pair. No-show grace 45 s.                                                                                                                                                                                                                          | Replaces K1's 100/300/any and K2's "larger window wins"; a new arrival is never forced into a surprise mismatch.                              | K1 freeze             |
| P16 | K2 cooldown after verified pre-play abandonment: 5 min on the 2nd incident in 24 h, 30 min on the 3rd and later.                                                                                                                                                                                                                                                                                | Conservative; invite/local play remain available.                                                                                             | K2 cooldown           |
| P17 | Unsaved matches: backoff retries for **72 h**, then `stalled` — retained indefinitely, listed by an ops command, never silently deleted. Discard is an explicit, audited operator action.                                                                                                                                                                                                       | Replaces H1's "delete after 7 days". The only copy is never destroyed by a timer.                                                             | Freeze (H1)           |
| P18 | Glicko-2 defaults stay (1500/350/0.06, τ 0.5, 24 h empty periods, provisional when effective RD > 110). No rating estimate at launch: pending, then confirmed. Proof E5 must not contradict them before R1 activation.                                                                                                                                                                          | R1-D2 kept; R1-D3 estimate dropped to avoid corrections that look like bugs.                                                                  | R1 activation         |
| P19 | Leaderboard eligibility stays: effective RD ≤ 110, ≥ 10 processed rated games, one within 90 days, not excluded, current username. Proof E5 reports how many simulated players qualify; a truthful empty state ships either way.                                                                                                                                                                | V2 brief values; the risk is an empty board, handled by copy, not by lowering the bar blindly.                                                | R3                    |
| P20 | Leaderboard tie-break uses a non-identifying surrogate integer on `player_rating`, so keyset cursors need no encryption.                                                                                                                                                                                                                                                                        | Removes R3's encrypted-cursor requirement.                                                                                                    | R3                    |
| P21 | Match statistics never block a save: a derivation error stores the match with `stats_json = NULL` and `stats_status = 'error'`; the backfill retries.                                                                                                                                                                                                                                           | Fixes H4 §5, which currently drops the ledger write on a stats error.                                                                         | Freeze (H1, H4)       |

### 3.3 Open founder questions — only these

| ID  | Question                                                                                                                                      | Recommendation                                                      | Blocks                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Q1  | Ship A3 in V2, and when?                                                                                                                      | Yes; in production no later than rated public play (end of wave 2). | A3 activation; wave-2 production enablement          |
| Q2  | Sponsor pilot surfaces, and may `result` appear after local games?                                                                            | P14: `lobby` + `result`, local included.                            | S1                                                   |
| Q3  | Inputs, not decisions: current weekly players and games, recurring community play times, comfortable monthly Cloudflare budget.               | Provide when known; revision proceeds without them.                 | Quick-match beta targets; cost alerts                |
| Q4  | Somali glossary: sponsored, sponsor, rated, friendly, quick match, leaderboard, history, replay, pending, rating not counted, deleted member. | Drafts collected in `docs/specs/README.md`; native review once.     | Release of each surface (not spec freeze)            |
| Q5  | Commercial: prices, currency, contact channel (email/WhatsApp), content-policy list; also the `[EMAIL XIRIIRKA]` placeholder on `/legal`.     | Treat V2 §15 prices as hypotheses; approve before first booking.    | First paid booking; S3 publication; `/legal` contact |

---

## 4. Canonical contracts

Step 5 turns this section into `docs/specs/v2-contracts.md`. Specs link to it
and must not restate competing SQL, enums, or message shapes.

### 4.1 Vocabulary

| Term                    | Meaning                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Mode                    | How the room was formed: `invite` or `quick`.                                                                                       |
| Rated request           | Creator's (or queue's) request for rated play, stored in room state. Not consent.                                                   |
| Rated (agreed)          | Both seats are complete accounts and both consented before the first action (P3). Stored as `match.rated = 1`. Implies public (P2). |
| Friendly                | A saved account game that is not rated. Private to its two players.                                                                 |
| Play began              | First accepted non-terminal action (P1).                                                                                            |
| Rating status           | `pending` → `processed` or `skipped`, or `held` (integrity problem awaiting an operator).                                           |
| Skip reason             | `friendly`, `pairCap`, `invalidated`. Nothing else in V2.                                                                           |
| Save status (room-side) | `pending` (in the outbox), `saved` (D1 acknowledged), `stalled` (retries exhausted, retained).                                      |
| Public record           | Processed rated events only (P8).                                                                                                   |
| Neutral label           | The one Somali label for a pending-deletion or deleted account. No link, avatar, or old name.                                       |

Retired terms (must not appear in revised specs, see §10): `competition_status`,
`aborted`, `competitive` as a status, `username_snapshot`, `matchSaved`,
`replay_json`, `starting_player`, `first_advantage_how`, `pieces_a`,
`captured_a`, `dailyCap` (except as "not at launch" in the README log),
"rated by default".

### 4.2 Ledger schema (H1 owns; R1 adds rating columns)

```sql
-- H1
CREATE TABLE match (
  seq                  INTEGER PRIMARY KEY AUTOINCREMENT, -- private ingestion order (P4)
  id                   TEXT    NOT NULL UNIQUE,           -- public opaque id, 20 chars / 100 bits
  room_code            TEXT    NOT NULL,
  room_created_at      INTEGER NOT NULL,                  -- identifies the room instance
  match_number         INTEGER NOT NULL,
  mode                 TEXT    NOT NULL CHECK (mode IN ('invite','quick')),
  rated                INTEGER NOT NULL CHECK (rated IN (0,1)),  -- agreed (P3); visibility derives (P2)
  consent_policy_v     INTEGER,                           -- disclosure version accepted; NULL when rated = 0
  rules_v              INTEGER NOT NULL,                  -- engine rules version
  replay_v             INTEGER NOT NULL,
  replay               TEXT    NOT NULL,                  -- {"v":1,"s":"B","a":[...]} with R:<seat>
  starting_seat        TEXT    NOT NULL CHECK (starting_seat IN ('A','B')),
  first_advantage_seat TEXT    CHECK (first_advantage_seat IN ('A','B')),
  first_advantage_by   TEXT    CHECK (first_advantage_by IN ('placementJare','noJareFallback')),
  winner_seat          TEXT    CHECK (winner_seat IN ('A','B')),
  end_reason           TEXT    NOT NULL,                  -- one of the six engine values
  online_end_reason    TEXT    CHECK (online_end_reason IN ('abandoned','idle')),
  action_count         INTEGER NOT NULL CHECK (action_count >= 1),
  stats_v              INTEGER,
  stats_status         TEXT    NOT NULL DEFAULT 'none' CHECK (stats_status IN ('none','ok','error')),
  stats_json           TEXT,
  payload_hash         TEXT    NOT NULL,                  -- SHA-256 of the canonical payload
  started_at           INTEGER NOT NULL,                  -- first non-terminal action
  ended_at             INTEGER NOT NULL CHECK (ended_at >= started_at),
  saved_at             INTEGER NOT NULL,                  -- D1 insert time
  UNIQUE (room_code, room_created_at, match_number)
);
CREATE TABLE match_player (
  match_id    TEXT    NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  seat        TEXT    NOT NULL CHECK (seat IN ('A','B')),
  user_id     TEXT    NOT NULL,                           -- private; no FK to user (deletion-safe)
  result      TEXT    NOT NULL CHECK (result IN ('win','loss','draw')),
  pieces_left INTEGER NOT NULL CHECK (pieces_left BETWEEN 0 AND 12),
  captured    INTEGER NOT NULL CHECK (captured BETWEEN 0 AND 12),
  ended_at    INTEGER NOT NULL,                           -- denormalised for the owner index
  PRIMARY KEY (match_id, seat)
);
CREATE INDEX match_player_owner_idx ON match_player (user_id, ended_at DESC, match_id DESC);
CREATE INDEX match_rated_ended_idx  ON match (rated, ended_at);
```

R1 adds: `match.rating_status` (default `pending`), `rating_skip_reason`,
`rating_policy_v`, `rating_algorithm_v`, `rating_processed_at`, index
`(rating_status, seq)`; `match_player.rating_before/after`, `rd_before/after`,
`volatility_before/after`, `rating_delta` (full-precision REAL, all null
unless processed); `player_rating` (with surrogate `board_key INTEGER` per
P20, `excluded`, `peak_rating` nullable), `rating_processor_state`, and the
fence table in §4.6.

Writer invariants: one D1 batch inserts the match and exactly two distinct
account seats with consistent results; a retry that finds the same
`(room_code, room_created_at, match_number)` compares `payload_hash` — equal
means success, different means an integrity failure (`stalled`, alert), never
silent success.

### 4.3 Room lifecycle (H1 owns; R2 and K1 consume)

```txt
init ─► seats filled ─► [rated requested?] ─► consent (joiner accepts/declines) ─►
first non-terminal action = play began ─► playing ─► gameOver
   gameOver ─► outbox:<matchNumber> written with room in one storage put ─► broadcast
   outbox ─► D1 insert ─► saved (outbox key deleted, matchStatus.save = saved + matchId)
                     └─► retry with backoff (≤ 72 h) ─► stalled (retained, listed)
rematch ─► both vote (rated rematch vote = re-consent) ─► new matchNumber, new log,
           alternated starting seat; earlier outbox entries are untouched
```

- Storage keys: `room`, `log` (current match, written with `room` in one
  `put`), `outbox:<matchNumber>` (frozen payload, attempts, next attempt,
  status). The alarm schedule includes the earliest outbox retry.
- Idle expiry with a non-empty outbox closes sockets but **keeps storage and
  the coordinator reservation**; `initializeRoom`'s 409 already blocks code
  reuse. The coordinator gets a `holdsUnsaved` flag so its 70-minute TTL does
  not drop the reservation, and so ops can list those rooms.
- At most **3** unsaved matches per room; a fourth rematch is refused with a
  Somali "saving earlier games" message. Guest/friendly play elsewhere is
  unaffected.
- Starting seat: random for a room's first game, alternating on rematch, for
  every room including guests (H1-D7 kept). `/local` keeps its own rule.
- The transport allows a player's own off-turn `resign` (fixes
  `match-room.ts:485-496`); other actions keep the acting-player check.
- Stats derivation runs after replay validation and never blocks the save
  (P21). Replay mismatch → `stalled` with reason `replayMismatch`; never
  written.

### 4.4 Result and rating policy, with canonical sample matches

| Ending                                       | Before play began | After play began                                     |
| -------------------------------------------- | ----------------- | ---------------------------------------------------- |
| Engine win / draw                            | impossible        | row; engine result                                   |
| Manual resign (any phase, including capture) | no row            | row; resigner loses                                  |
| Abandon/idle claim (any phase)               | no row            | row; absent/idle seat loses; `online_end_reason` set |
| Room cleaned up without `gameOver`           | no row            | no row (never an invented result)                    |
| Any seat is a guest                          | no row            | no row                                               |

Rating decision for a row, in `seq` order: `rated = 0` → `skipped:friendly`;
operator invalidation → `skipped:invalidated`; pair cap reached (P7, counting
earlier-`seq` processed events whose `ended_at` is within 24 h before the
candidate's) → `skipped:pairCap`; malformed → `held`; else `processed`.

Every spec that shows, counts, rates, or replays a match must produce these
outcomes. Step 11 walks them through all specs.

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

### 4.5 Access matrix (every loader and data path, not just pages)

| Surface                                 | Signed out / unrelated     | Participant                              | Notes                                                                             |
| --------------------------------------- | -------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| `/match/<id>`, replay, stats — rated    | full                       | full                                     | Public OG with names and result.                                                  |
| `/match/<id>`, replay, stats — friendly | same 404 as an unknown id  | full                                     | `no-store`, `noindex`, generic non-identifying OG, never in sitemap or PWA cache. |
| `/history`                              | redirect to login          | own saved games, all labelled            | `no-store`, `noindex`. Owner key from the session only.                           |
| `/u/<username>` numbers                 | public record (P8)         | same                                     | Owner additionally sees a `/history` link.                                        |
| Head-to-head card                       | hidden                     | viewer vs target, all shared saved games | Private, `no-store`.                                                              |
| `/leaderboard`                          | public list, edge-cached   | + private rank context                   | Page HTML must be session-independent before shared caching.                      |
| Pending/deleted account                 | neutral label; profile 404 | neutral label                            | Excluded from leaderboard and public profile reads.                               |

Unauthorized access to a private match is indistinguishable from an unknown
id. Tests request each underlying data path with a guessed id.

### 4.6 Protocol additions (all additive to `v: 1`)

- `POST /rooms` options: `{ ratedRequest?: boolean }` (default false, F1).
  `mode: quick` is accepted only from the internal queue path.
- `matchStatus` gains optional `mode`, `ratedRequest`, `consent: { A, B }`,
  `rated`, and `save: { matchNumber, status, matchId? }`. `save` is required
  behaviour in H1 (was a Should); it replaces the proposed `matchSaved`
  message, which would crash cached clients (§2).
- New client message `rateConsent { roomCode, matchNumber, accept }`. Only
  new clients send it; the server needs both acceptances before the first
  action, else the match is friendly.
- Optional `matchNumber` on `gameAction`, `claimWin`, `rematch` (P6).
- The quick-match queue uses its own socket and schema family
  (`joinQueue { identityTicket }` as the first frame, `cancelQueue`,
  `queueStatus`, `matched`, `queueError`); tickets never appear in URLs.
- Deploy order for any change: migration → game Worker → web Worker. A
  cached client never gains rated play by accident.

### 4.7 Rating processor (R1 owns)

- Single web-Worker processor, triggered by a best-effort service-binding
  hint after each save and a one-minute cron sweep.
- Takes a lease in `rating_processor_state`, then processes `pending` rows in
  `seq` order in chunks of 25. Both seats update simultaneously from their
  pre-match states.
- **Atomic fence**: each event batch starts with
  `INSERT INTO rating_fence (ok) SELECT (lease_token = ?1 AND lease_expires_at > ?2 AND cursor_seq = ?3) FROM rating_processor_state`
  against a table whose `CHECK (ok = 1)` fails when the guard is false, and
  ends by deleting the fence row. A failed guard aborts the whole batch. Proof
  E1 must confirm this in Miniflare before R1 freezes; zero-row conditional
  updates alone are not a guard.
- **Corrections** (R6 invalidate/rescind, policy or algorithm version change):
  maintenance flag stops the processor; a full rebuild in `seq` order writes
  `*_next` shadow tables in bounded chunks; a verification diff runs; one
  batch swaps them in (`DELETE`/`INSERT … SELECT`, `UPDATE … FROM`); the flag
  clears. Readers during maintenance show the last state with a "ratings
  updating" note. Proof E1 sizes this swap. **Scale trigger**: if the swap
  exceeds D1 batch limits at 10× projected data, move to generation-keyed
  tables and an active-generation pointer.
- The game Worker never reads or computes ratings.

### 4.8 Deletion (A3 owns; every reader obeys)

- States on `user`: active → pending (`deletion_requested_at`,
  `deletion_due_at`) → final (`deleted_at`, scrubbed tombstone).
- Pending: ticket minting stops (P11), profile 404, neutral label everywhere,
  excluded from leaderboard and public reads; only cancel/status/logout
  routes work for the owner.
- Final: sessions, provider accounts, and attributable verification rows
  removed; username claims held 30 days (F5) then released. Ledger rows and
  rating events are untouched (M10). Because of P5 there is nothing in the
  ledger to scrub.
- Analytics: the account's pseudonymous rows age out under P12; aggregates
  remain.

### 4.9 Metrics dictionary (X1 owns)

| Name                                          | Definition                                                                                                                                   | Source                     | Exactness                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------- |
| Active browsers (day / 7 d / 30 d)            | Distinct keyed hashes of the guest id that sent the daily beacon                                                                             | Client beacon              | Approximate; not people                 |
| Active accounts (day / 7 d / 30 d)            | Distinct keyed hashes of the account id that sent the beacon while signed in                                                                 | Client beacon              | Approximate; not additive with browsers |
| Registrations                                 | Accounts whose first `username_claim.claimed_at` falls on the day                                                                            | D1, nightly rollup         | Exact                                   |
| Online games created/joined/started/completed | By mode and guest/account                                                                                                                    | Game Worker counters (P13) | Near-exact (best-effort write)          |
| Local games started/completed                 | First action / game over on `/local`                                                                                                         | Client beacon              | Approximate; offline lost               |
| Saved account games                           | Ledger rows by `ended_at` day, rated/friendly                                                                                                | D1                         | Exact                                   |
| **Weekly returning players** (primary)        | Accounts with ≥1 saved game in ISO week w that also have ≥1 in week w+1, over accounts with ≥1 in week w                                     | Ledger                     | Exact                                   |
| D7 / D30 return                               | Of accounts whose first saved game is on day d, share with a saved game on day d+7 (d+30) exactly; separate "within 7 days" metric if wanted | Ledger                     | Exact; immature until d+7/d+30          |
| Quick-match funnel                            | Joins, pairs, starts, completions, no-shows, wait histogram                                                                                  | Queue DO counters (P13)    | Near-exact                              |

Removed claims: "guest → account conversion", "exact DAU/MAU of people",
"no PII because hashed". Every admin view shows raw counts beside
percentages, instrumentation start date, freshness, and cohort maturity.

### 4.10 Scheduled work and environments

- One web-Worker cron trigger (`* * * * *`) with a dispatcher: rating sweep
  every minute; at 00:15 UTC the X1 rollup and prune, A3 finalization, and
  S2 rollup; later, R6 detectors nightly. Each job takes a named lease using
  the §4.6 fence pattern and resumes from a cursor, so a missed or duplicate
  run is harmless. Proof E3 decides how the adapter output gets a
  `scheduled` handler.
- Bindings by milestone: game Worker D1 (H1), web cron (X1/R1), web→web
  service-binding hint (R1), queue DO + route (K1), web R2 (S1), rate-limit
  bindings (X1, S2). Each milestone spec lists its bindings per environment
  (dev, e2e, preview, production).
- Kill switches, each independent: new rated starts, quick-match entry,
  analytics writes, sponsor rendering. Local and guest play survive all of
  them.

### 4.11 Migration ownership

Numbers are assigned at merge, never reserved in a spec. Owners: H1 ledger;
X1 analytics; R1 rating columns and tables; R6 corrections and audit; A3 user
deletion columns; S1 sponsor; S2 sponsor stats. Each milestone adds the
indexes its reads need in the same migration and records `EXPLAIN QUERY PLAN`
evidence.

---

## 5. Simplifications and when to revisit them

| Problem                                | Previous plan / draft specs                                                                                    | This plan                                                       | Revisit when                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| Late saves corrupt rating order        | Ingestion fence + automatic coalesced rebuilds + generation publication (plan); pause and guarded rebuild (R1) | Rate in ingestion order (P4); late saves cannot exist           | Never, unless ordering by play time becomes a product need |
| Readers see mixed rating states        | Active-generation pointer pinned by every reader                                                               | Single-batch swap after shadow rebuild (§4.7)                   | Swap exceeds D1 limits at 10× data (E1)                    |
| Deleted names reappear via late writes | Scrub triggers, late-insert guard, control outbox (A3, plan)                                                   | No names in the ledger (P5)                                     | —                                                          |
| Pending-deletion player keeps a seat   | Web→game control path, active-seat index, acknowledgements (A3)                                                | Stop minting tickets; rooms expire in 60 idle minutes (P11)     | Rooms gain multi-day lifetimes                             |
| Same player in two rated games         | Cross-room active-rated registry (plan)                                                                        | Not prevented (P10); caps + R6 flags                            | R6 flags show real concurrent-game abuse                   |
| Unsaved-save capacity                  | Reserved-capacity admission accounting (plan)                                                                  | ≤ 3 unsaved per room; retained storage blocks code reuse (§4.3) | Stalled saves appear in production                         |
| Online funnel accuracy                 | Reporter-client rules (X1) or room→web batch delivery (plan)                                                   | Game Worker increments allowlisted counters (P13)               | Counter writes measurably slow game-over handling          |
| Leaderboard cursor leaks user ids      | Encrypted, authenticated cursors (R3)                                                                          | Surrogate integer tie-break (P20)                               | —                                                          |
| Three public W/L/D populations         | Labelled populations per page (R3/R4/R5)                                                                       | One public population (P8)                                      | Players ask for all-game public records                    |
| Sponsor takedown                       | 5-min edge cache + manual purge (S1)                                                                           | ≤ 60 s edge cache (P14)                                         | Sponsor endpoint read cost matters                         |
| Stale command hits a rematch           | Revision/request-id machinery (plan)                                                                           | Optional `matchNumber` guard (P6)                               | Duplicate-command bugs observed                            |

---

## 6. Proofs to run during the revision (disposable, local only)

Code lives in the session scratchpad and is not committed. Results (commands,
versions, numbers, pass/fail) are recorded in `v2-contracts.md` §Evidence.

| ID  | Question                                                                                                                                                                                                                                   | Pass condition                                                                                                                           | Blocks                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| E1  | Does a `CHECK`-constraint fence abort a whole D1 batch in Miniflare? Does a `DELETE`/`INSERT … SELECT`/`UPDATE … FROM` swap of 50k `match_player` rows fit in one batch?                                                                   | False guard leaves zero rows changed; swap completes atomically; record timings and limits hit.                                          | R1 freeze               |
| E2  | Can the game and web Workers share one local D1 in E2E (same `--persist-to` or equivalent) while `pnpm check:e2e-isolation` still passes?                                                                                                  | A row written by the game Worker process is read by the web Worker process; isolation check green; `.dev.vars` untouched.                | H1/H2 freeze            |
| E3  | Can the web Worker export `scheduled` alongside the adapter's `fetch` with the pinned adapter and Wrangler?                                                                                                                                | Local build + `wrangler dev --test-scheduled` fires the handler; `pnpm check:bundle` and account routes still work.                      | X1/R1/A3 freeze         |
| E4  | Longest legal game: action count and replay bytes from an adversarial generator (capture-reset draw clock, repetition limits); DO value limit for SQLite-backed objects per current Cloudflare docs; browser memory for all replay frames. | Numbers recorded; H1's size claim and H3's frame strategy are set from them, not guessed. The "128 KiB" key-value figure is removed.     | H1 size assertion; H3   |
| E5  | Small-community simulation (20–300 players, sporadic play, one strong player, a farming pair): Glicko per-game updates, RD > 110 cutoff, 10 games / 90 days eligibility, pair cap.                                                         | Report: time to leave provisional, share of players eligible, farming gain with/without cap. Defaults P18/P19 stand unless contradicted. | R1/R3 activation        |
| E6  | Query plans at 5,000 matches for one account: history page, summary, head-to-head, rating window, public record.                                                                                                                           | Every plan uses the owner index or a primary key; rows read recorded.                                                                    | H2/R4/R5 implementation |

---

## 7. Per-spec revision briefs

Every revised spec uses the same skeleton: outcome and non-goals; register
IDs it relies on; dependencies; contracts it owns (or links); state and
failure behaviour; privacy; resource budget; Somali copy keys; implementation
slices; acceptance tests; rollout and rollback. Drop every "reconcile with the
merged H1 later" sentence: the contracts are settled now. Replace each spec's
own decision table with register IDs.

### H1 — Match persistence

- **Keep**: compact replay with `R:<seat>` (§4), `log` key written with
  `room` (H1-D1), `@shaxda/db/match` raw-statement subpath (H1-D8), random +
  alternating seat for all rooms (H1-D7), derived `first_advantage_by`
  (H1-D10), no FK to `user` (H1-D11), replay validation before write.
- **Change**: `PersistState` → per-match outbox (§4.3, P17); schema → §4.2
  (`seq`, `payload_hash`, `rules_v`, `consent_policy_v`, `stats_status`,
  `saved_at`; no snapshot); room options → `ratedRequest` default false and
  the consent fields (P3); `matchStatus.save` becomes Must; P1 replaces the
  `noActions` special case; allow own off-turn resign; add P6 guard; idle
  expiry keeps storage and reservation while unsaved; coordinator
  `holdsUnsaved`; replace the "20 KB / 128 KiB" claim with E4 numbers.
- **Remove**: seven-day failed retention; `rated: true` default; the three
  open questions (answered by P1, P17, H1-D7).
- **Add evidence**: crash between terminal `put` and broadcast; D1 commit
  with lost response; rematch while an earlier save retries; two pending
  saves; conflicting duplicate payload; idle expiry with an unsaved match;
  no past-due alarm loop; stats error still saves; E2 shared-D1 E2E.
- **Ops add**: `pnpm match:ops -- list-unsaved|retry|discard --database <env>`
  (audited discard).

### R2 — Rated play rules (rewrite around F1, F4, P1–P3, P7)

- **Remove**: `competition_status`, `aborted`, the movement-only claim rule,
  the both-seats-started rule, the daily cap from v1, creator-only rated
  choice, "rated by default".
- **Change**: consent handshake and disclosure (P3); policy table = §4.4;
  pair cap evaluated in `seq` order (P7); cap-skipped matches stay public and
  explain why (P2); skip enum = `friendly|pairCap|invalidated`.
- **Keep**: pure classifier shared by room and processor; policy versioning;
  Somali explanation on `/learn`, linked from lobby and result.
- **Add evidence**: one-sided consent → friendly; old cached joiner →
  friendly; changed request resets consent; rated rematch needs both votes;
  resign/claim in each phase including capture and blocked space-making;
  pre-play resign writes nothing; cap boundary at exactly 24 h; M1–M9.

### R1 — Rating system

- **Change**: order by `seq` (P4); fence (§4.7) replaces "inspect affected-row
  counts"; corrections via maintenance rebuild and swap; peak per P9; no
  estimate (P18); provisional/eligibility read effective RD at one `asOf`.
- **Remove**: the late-event halt and `lateLedgerEvent` path (§4 of R1); the
  "reconcile with H1 draft" preamble; R1-D1/D3 as open items.
- **Keep**: pure `packages/rating`, simultaneous updates, closed-form
  inactivity, full precision, dry-run rebuild in CI, service-binding + cron.
- **Add evidence**: author's published example; fence abort under a stale
  lease (E1); duplicate triggers; equal `ended_at` values; late save after a
  newer processed match (now just the next event); rebuild zero drift;
  maintenance read behaviour.

### R6 — Ranking integrity (split)

- **R6-core (wave 2, with R1/R2)**: `inspect-match`, `verify-replay`,
  `inspect-rating`, `check-consistency`, `rebuild-ratings` (dry run by
  default), `invalidate-match`, **`rescind-invalidation`**,
  `exclude-account`/`include-account`, append-only audit. Actor recorded as
  the `wrangler whoami` identity plus the git user; single-operator
  attribution, stated as such. Plan/apply with a plan digest and ledger
  high-water `seq`.
- **R6-detect (later in V2)**: the four detectors, flags, `/admin/flags`.
  Keep them advisory and versioned; add false-positive fixtures for small
  communities (repeat opponents and short games are normal).
- **Change**: cap reevaluation on rebuild is deterministic under the original
  policy version and visible as "rating corrected".

### A3 — Account deletion

- **Change**: apply P5 (delete the snapshot scrub, late-insert trigger, and
  H2-D3 exception) and P11 (delete the web→game control path and active-seat
  index); keep the grace/hold (F5), reauthentication within 15 minutes,
  bounded finalization, verification-row attribution audit against pinned
  Better Auth 1.6.25.
- **Add**: exact state predicates from §4.8; restored-backup rule (reapply
  deletion records before serving); username reuse never inherits old match
  links (links resolve by stable id).
- **Gate**: Q1.

### X1 — Product analytics

- **Split**: X1a (web only: beacon, registrations from `username_claim`,
  admin page, cron rollup/prune, `/legal` text) and X1b (P13 game-Worker
  counters, after H1).
- **Change**: metric names and definitions → §4.9; retention → P12; dedupe by
  `(day, anon_id)` works for two accounts on one browser (the beacon is keyed
  per identity, not one flag per browser); remove reporter rules and the
  conversion ratio; privacy text says "pseudonymous", not "anonymous".
- **Keep**: HMAC keying, UTC server days, gauges in `event_daily`, admin
  allowlist helper reused by S1, rate limiting (fail closed in production
  when the binding is missing, open only in dev/test).

### H2 — History and match detail

- **Change**: all queries against §4.2; `matchStatus.save` instead of
  `matchSaved`; access per §4.5 (friendly private, rated public); names from
  the account row with the neutral label for pending/deleted (P5); rating
  status labels once R1 exists; `/legal` copy says saved games are private
  to both players and rated games are public.
- **Remove**: `test.skip` permission for the real-game E2E (E2 makes it
  runnable); §3's assumed H1 contract (link §4.2 instead); H2-D3 snapshot
  fallback.
- **Add evidence**: guessed private id from signed-out and unrelated viewers;
  OG of a private match reveals nothing; PWA does not precache match pages;
  pagination across equal `ended_at`; E6 plan for a prolific owner.

### H3 — Replay viewer

- **Change**: replay data is served only after the §4.5 access check; select
  engine adapters by `rules_v` and `replay_v`; frame storage strategy from E4.
- **Keep**: position model `0..N` shared with H4, cues independent of live
  transient feedback, opt-in audio, deep-link clamping, physical Android gate.

### H4 — Match statistics

- **Change**: derivation failure stores the match with `stats_status =
'error'` (P21) instead of blocking the ledger write; backfill fills `none`
  and `error` rows; public panel only where §4.5 allows.
- **Keep**: counting contract and examples, F7 panel, versioned schema,
  compare-and-set backfill.

### R3 — Leaderboard

- **Change**: population per P8 (closes R3-D1); tie-break per P20 (drop
  cursor encryption); exclude pending/deleted accounts; one `asOf` per read;
  projection updated inside R1's event batch and rebuilt by the §4.7 swap.
- **Keep**: session-independent HTML before any shared cache; private
  `/api/leaderboard/me`; snapshot fallback only on measured failure.

### R4 — Profile statistics

- **Change**: remove `competition_status = competitive`; population per P8;
  fastest win, best streak, peak per P9; dependency list H2, H4, R1, R3.
- **Keep**: server-only ids, no replay scan per request, incomplete-stats
  state instead of partial totals, measured budgets.

### R5 — Head-to-head and rating history

- **Change**: card counts all saved games between the viewer and target
  (both are participants, so friendly is allowed), rated and friendly shown
  separately; chart and leaderboard form use processed events only (P8);
  pair query starts from the viewer's owner index.
- **Keep**: no snapshot table, rolling windows with inclusive bounds, honest
  peak caption, bounded rendered points.

### K1 — Quick-match queue

- **Change**: pairing per P15 (shared with K2); queue entry copy states
  rated and public (P3/P2); bring minimum K2 telemetry into K1 (joins, pairs,
  starts, completions, no-shows, wait histogram via P13); no-show grace 45 s
  confirmed as default; start marker read from the room (P1).
- **Keep**: one global hibernating DO, first-frame ticket authentication,
  single-use JTIs, epoch takeover, idempotent `pairId` handoff, pre-claimed
  seats, alarms only while waiting or handing off.

### K2 — Queue quality

- **Change**: delete its own widening table (use P15); metrics section moves
  to K1; cooldown per P16; presence count and re-queue stay.
- **Keep**: attribution rules for incidents, bounded storage and pruning,
  "no fabricated counts or ETA".

### S1 — Sponsor placements

- **Change**: inventory per P14 and Q2; periods 7/14/30 days; bookings
  reference an **immutable creative version** row, so a future creative can
  change without cancel-and-rebook while history stays stable; ≤ 60 s edge
  cache; a booking cannot become paid/live unless S2-min reporting works.
- **Keep**: DB-enforced overlap triggers, first-party R2 logos, admin
  allowlist, placement safety rules, no targeting, empty slot renders
  nothing.

### S2 — Sponsor measurement

- **Split**: S2-min ships with S1 (qualified-view definition, rolling
  30-minute gate, `/go` redirect, daily rollup, admin report + CSV); token
  links later.
- **Change**: label views "qualified views (≥ 50 % visible for 1 s, at most
  one per browser per 30 min)", not attention; show raw clicks and CTR with
  that definition; `/go` with a failed lookup shows an unavailable page (no
  authority to redirect), with a failed counter still redirects and records
  an outage.

### S3 — Sponsor page

- **Split**: S3a pilot contact page (what, where, how to enquire, policy; no
  numbers or prices until approved) and S3b rate card (dated, measured
  claims, S2-backed exposure).
- **Remove**: "$10 CPM fair niche rate" as a market claim; any modelled
  audience figure in public copy.

---

## 8. Supporting documents

| File                                       | Change                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/README.md` (new)               | Spec index with status (`draft` / `revised` / `frozen@<commit>` / `shipped@<date>`), dependencies, wave, register (§3), Somali glossary drafts (Q4), change log.                                                                                                                                   |
| `docs/specs/v2-contracts.md` (new)         | §4 of this plan plus §Evidence (E1–E6 results) and the operations matrix (bindings, crons, flags, rollout order per milestone).                                                                                                                                                                    |
| `docs/shaxda-v2.md`                        | §1 precedence matches PRD §27; §4 statuses and spec links; §6 adds consent/visibility (F1/F2/P2/P3), ingestion-order ratings (P4), P13 counters; §7 points to contracts; §9–§13 aligned; §14 replaced by §12 waves; §15 revenue arithmetic corrected (below); §16 cites the register; §17 → Q1–Q5. |
| `docs/shaxda_prd.md` §27                   | "`docs/shaxda-v2.md` and frozen specs in `docs/specs/` govern V2 scope and order; the PRD governs stack and infrastructure except where V2 §6 amends it explicitly." Mark completed V1 restrictions as historical.                                                                                 |
| `AGENTS.md`                                | One V2 pointer: V2 specs under revision; no V2 implementation before a spec is `frozen` in the README **and** its milestone is activated. Do not pre-apply V2 §6 rule changes; they land in each milestone's first commit.                                                                         |
| `docs/shaxda_brd.md` (new)                 | Audience hypothesis; retention-first stance; pilot inventory; vetting checklist; fulfilment workflow; pricing hypotheses; revenue formula and scenarios; cost model; truthful-claims rule; owner of each task.                                                                                     |
| `docs/ops/v11a-a2-release-verification.md` | Separate "deployed" from "production-verified"; list the remaining production browser checks as open. Do not mark them done from source reading.                                                                                                                                                   |

Revenue arithmetic for the brief and BRD:
`monthly revenue = Σ(slot monthly-equivalent price × sold fraction) − make-goods`.
Two pilot slots at $250 and 75 % sold = $375; four slots at $250 and 75 % =
$750; $1,000 needs four slots fully sold at $250, or about $333 per slot at
75 %. Prices are hypotheses until Q5; exposure differs by slot.

`docs/shaxda_game.md` is untouched. Nothing here changes jare, irmaan,
blocked-player handling, or draw rules.

---

## 9. Execution steps

Each step ends with `pnpm exec prettier --check` on the touched docs and one
commit. Commit messages use the repo's Conventional Commits.

| #   | Step                                                                                                                                                                                                   | Deliverable                                                                | Commit                                                            | Exit check                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 0   | Commit this plan.                                                                                                                                                                                      | This file                                                                  | `docs: rewrite the V2 spec revision plan`                         | Prettier clean                                                                                            |
| 1   | Fix `/legal` so it describes Google accounts, usernames, profiles, and D1 as they exist now (no V2 promises). Mark new Somali lines `TODO(translation-review)`; keep the contact placeholder until Q5. | `packages/i18n/src/content/legal.so.ts` and its tests                      | `fix(i18n): describe live accounts and storage on the legal page` | `pnpm lint typecheck test` for i18n/web; no sentence claims "no accounts" or "no D1"                      |
| 2   | Create the spec index and decision register.                                                                                                                                                           | `docs/specs/README.md`                                                     | `docs(specs): add V2 spec index and decision register`            | All 17 specs listed once; every F/P/Q row present                                                         |
| 3   | Reconcile authority.                                                                                                                                                                                   | PRD §27, `shaxda-v2.md` §1, `AGENTS.md` pointer                            | `docs: reconcile V2 document authority`                           | The three texts state the same precedence; AGENTS authorizes no implementation                            |
| 4   | Run proofs E1–E4 locally (E5/E6 may run later, before activation).                                                                                                                                     | Results recorded for step 5                                                | none (scratchpad)                                                 | Each proof has pass/fail and numbers                                                                      |
| 5   | Write the contracts document.                                                                                                                                                                          | `docs/specs/v2-contracts.md`                                               | `docs(specs): add canonical V2 contracts`                         | Schema, lifecycle, policy, access, protocol, processor, deletion, metrics, jobs present; Evidence filled  |
| 6   | Revise foundation specs in order: H1, R2, R1, R6 (core/detect split), A3, X1.                                                                                                                          | Six specs                                                                  | one `docs(specs): revise <ID> …` commit each                      | §10 gates pass for each file; M1–M10 hold                                                                 |
| 7   | Revise read, replay, stats, and queue specs: H2, H3, H4, R3, R4, R5, K1, K2.                                                                                                                           | Eight specs                                                                | one commit each                                                   | Same                                                                                                      |
| 8   | Create the BRD; revise S1, S2, S3.                                                                                                                                                                     | `docs/shaxda_brd.md`, three specs                                          | `docs: add the business requirements document`, then one per spec | Pilot booking can be sold, delivered, taken down, reported, and corrected without a new business decision |
| 9   | Rewrite the V2 brief.                                                                                                                                                                                  | `docs/shaxda-v2.md`                                                        | `docs: align the V2 brief with revised specs`                     | No section contradicts the contracts; waves replace §14                                                   |
| 10  | Reconcile the release record.                                                                                                                                                                          | `docs/ops/v11a-a2-release-verification.md`                                 | `docs(ops): separate deployed from verified for V1.1-A/A2`        | Open checks listed as open                                                                                |
| 11  | Consistency pass: run §10 gates; walk M1–M10 through every spec that shows, counts, rates, replays, or deletes a match; fix drift.                                                                     | Fix-up edits                                                               | `docs(specs): resolve cross-spec drift`                           | All gates empty; walkthrough table in README shows agreement                                              |
| 12  | Freeze manifest.                                                                                                                                                                                       | README statuses `frozen@<commit>`; remaining release-only decisions listed | `docs(specs): freeze V2 contracts and specs`                      | Every spec frozen or explicitly deferred with a reason                                                    |

Parallelism: steps 1 and 2–3 are independent. Within steps 6–8, a spec may
start once the contracts (step 5) exist; the listed order only reduces
rework. After step 12, a frozen promise changes only through an explicit
contract-change commit that updates every consumer in the same commit.

---

## 10. Consistency gates

Run from the repository root. Each command must print nothing.

```bash
rg -n "competition_status|\baborted\b|username_snapshot|matchSaved|replay_json|starting_player\b|first_advantage_how|pieces_a|captured_a|rated by default|lateLedgerEvent" docs/specs docs/shaxda-v2.md docs/shaxda_brd.md --glob '!README.md'
```

```bash
rg -n "dailyCap|128 KiB|guest.?→.?account conversion|exact (DAU|MAU)|calendar month" docs/specs docs/shaxda-v2.md --glob '!README.md'
```

```bash
for f in docs/specs/*.md docs/shaxda-v2.md docs/specs-revision-plan.md; do grep -o '](\([^)#]*\.md\)' "$f" | sed 's/^](//' | while read -r l; do [ -f "$(dirname "$f")/$l" ] || echo "$f -> $l"; done; done
```

```bash
pnpm exec prettier --check docs AGENTS.md
```

Manual gates: every spec header lists register IDs and matches the README
dependency row; every spec that touches a match states its behaviour for
M1–M10; every public surface cites the §4.5 row it implements; no document
claims production acceptance, exact people counts, or verified sponsor
attention beyond its evidence.

---

## 11. Traceability of the previous draft's findings

| Finding (previous draft §3)                                              | Resolved by                            |
| ------------------------------------------------------------------------ | -------------------------------------- |
| H1/H2 schema and message names disagree                                  | §4.2, §4.6; H2 brief; gate 1           |
| Single persist state lost across rematch; stale completions              | §4.3 outbox keyed by match number; P6  |
| Scheduler keeps expired deadline; failed data deleted after 7 days       | §4.3 idle expiry with unsaved; P17     |
| Late ledger rows force manual rebuild; incomplete generation schema      | P4; §4.7 corrections                   |
| Zero-row conditional updates are not a transaction guard                 | §4.7 fence; E1                         |
| Friendly games treated as public; undefined `competitive` status         | F2, P2, P8; §4.5; R4/R5 briefs; gate 1 |
| Movement-only claim policy; capture phase unhandled                      | F4, P1; §4.4; R2 brief                 |
| K1/K2 widening schedules disagree; pre-claimed seats vs room assumptions | P15; K1/K2 briefs                      |
| Roadmap order wrong (R4 before H4; integrity after ranking; A3 optional) | §12 waves; R6 split; Q1                |
| X1 overclaims exactness and anonymity; wrong D7/D30 and conversion       | §4.9; X1 brief; gate 2                 |
| S1 can go live before S2; revenue arithmetic mixes assumptions           | S1/S2 briefs; §8 revenue formula       |
| PRD vs V2 authority; BRD missing; stale legal copy                       | Steps 1, 3, 8                          |
| E2E Workers do not share local D1                                        | E2; H1/H2 briefs                       |
| DO 128 KiB limit copied from the key-value backend                       | E4; gate 2                             |
| Transport blocks own off-turn resignation                                | §4.3; H1 brief                         |

---

## 12. Build waves after the freeze

Implementation order for the revised roadmap (`shaxda-v2.md` §14). A wave's
gate must pass in preview before its production enablement.

| Wave  | Scope                                                                                                        | Gate                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Step 1 legal fix; this revision; E1–E4.                                                                      | Contracts frozen; proofs recorded.                                                                                                                                                                                         |
| 1     | H1, H2, X1a.                                                                                                 | Account games save durably, including across rematch and D1 outage; both players see private history; stalled saves listable; real-game E2E green. All saved games are friendly (no consent UI yet), so nothing is public. |
| 2     | R2 consent + policy, R1, R6-core, X1b; A3 before production enablement if Q1 = yes.                          | Consent works on new clients and fails safe on old ones; M1–M10 pass; rebuild zero drift; invalidate/rescind rehearsed on preview.                                                                                         |
| 3     | K1 (with minimum telemetry), then community beta at scheduled play windows.                                  | Two real devices find, start, and finish a game; no-show recovery; waits measured; empty queue has no alarm.                                                                                                               |
| 4     | H3, H4, R3, R4, R5 (H3/H4 may start any time after wave 1).                                                  | Replays and stats verified; public records and ranks agree; E5/E6 recorded; private data absent from every public path.                                                                                                    |
| Pilot | BRD approved (Q5) → S1 (P14) + S2-min → S3a; needs ≥ 30 days of X1 data. S3b after a first delivered report. | No paid placement without a working report, approved creative, owner, and ≤ 60 s takedown.                                                                                                                                 |
| Later | R6-detect, K2 (presence, re-queue, cooldown), S2 token links, S3 PDF, more sponsor surfaces.                 | Evidence that the enhancement is needed; frozen contracts unchanged.                                                                                                                                                       |

Evidence gates for product decisions (owner: founder): judge early return
play only after two complete weekly cohorts, with raw counts beside
percentages; set quick-match wait/completion targets from Q3 before the beta;
expand sponsor inventory only after delivery, player feedback, and renewal
interest.

---

## 13. Done

The revision is done when all 17 specs, the contracts, the brief, the PRD
pointer, AGENTS.md, and the BRD agree; §10 gates are empty; M1–M10 give one
answer everywhere; E1–E4 are recorded; and the README shows every spec
frozen or explicitly deferred. Only Q1–Q5 may remain open, each tied to the
release it blocks. More features are not part of done.
