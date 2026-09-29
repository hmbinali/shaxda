# Shaxda V2 Specs — Index and Decision Register

This folder holds one implementation spec per V2 milestone, the shared
contracts every spec links to, and this index. Read in this order:

1. [`docs/shaxda-v2.md`](../shaxda-v2.md) — V2 scope, goals, and waves.
2. [`v2-contracts.md`](v2-contracts.md) — the canonical schema, lifecycle,
   policy, access matrix, protocol, jobs, and proof evidence. Specs link to
   it and never restate competing SQL, enums, or message shapes.
3. The milestone spec you are implementing.

`docs/shaxda_game.md` still wins for game rules. Document precedence is set
in `docs/shaxda_prd.md` §27.

## Status vocabulary

| Status            | Meaning                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `draft`           | Written, not yet aligned with the contracts.                                                             |
| `revised`         | Aligned with `v2-contracts.md` and this register; may still change before the freeze.                    |
| `frozen@<commit>` | Promises fixed at that commit. Changes only through an explicit contract-change commit (below).          |
| `deferred`        | Frozen scope is not scheduled; the reason is stated in the index.                                        |
| `shipped@<date>`  | Implemented, merged, and verified in production for its milestone gate. Set only by the shipping commit. |

A spec being `frozen` does **not** activate its milestone. Implementation
starts only when the spec is frozen **and** its milestone is activated
(`AGENTS.md`).

## Spec index

Register IDs are defined in the tables below. "Wave" is the build wave in
`docs/specs-revision-plan.md` §12.

| ID  | Spec                                                                           | Status  | Wave  | Depends on                                                            | Register IDs                       |
| --- | ------------------------------------------------------------------------------ | ------- | ----- | --------------------------------------------------------------------- | ---------------------------------- |
| H1  | [Match persistence](h1-match-persistence.md)                                   | revised | 1     | V1.1-A2                                                               | F1 F4 F8 P1 P2 P3 P4 P5 P6 P17 P21 |
| H2  | [History and match detail](h2-history-match-detail.md)                         | revised | 1     | H1                                                                    | F2 F8 P2 P5 P8                     |
| X1  | [Product analytics](x1-product-analytics.md) (X1a wave 1, X1b wave 2)          | revised | 1, 2  | X1a: none (its ledger step needs H1's migration). X1b: H1             | P12 P13                            |
| R2  | [Rated play rules](r2-ranked-play-rules.md)                                    | revised | 2     | H1, R1 (activated together)                                           | F1 F2 F4 P1 P2 P3 P7 P10           |
| R1  | [Rating system](r1-rating-system.md)                                           | revised | 2     | H1, X1a, R2 (activated together), R6-core's migration                 | F4 P4 P9 P18 P20                   |
| R6  | [Ranking integrity](r6-ranking-integrity.md) (R6-core wave 2, R6-detect later) | revised | 2, L  | R1, R2 (R6-core's migration lands inside R1's slices); R6-detect: X1a | P4 P7 P8 P10                       |
| A3  | [Account deletion](a3-account-deletion.md)                                     | revised | 2     | H1, X1a; R1 if shipped; Q1                                            | F5 P5 P11 Q1                       |
| K1  | [Quick-match queue](k1-quick-match-queue.md)                                   | draft   | 3     | H1, R1, R2, X1b                                                       | F1 F6 P1 P3 P13 P15                |
| H3  | [Replay viewer](h3-replay-viewer.md)                                           | revised | 4     | H1, H2                                                                | F2 P2                              |
| H4  | [Match statistics](h4-match-stats.md)                                          | revised | 4     | H1, H2; X1a for the nightly backfill                                  | F7 P21                             |
| R3  | [Leaderboard](r3-leaderboard.md)                                               | revised | 4     | R1, R2, R6-core; A3 if shipped                                        | P8 P18 P19 P20                     |
| R4  | [Profile statistics](r4-profile-statistics.md)                                 | revised | 4     | H2, H4, R1, R3; A3 if shipped                                         | P8 P9                              |
| R5  | [Head-to-head and rating history](r5-head-to-head-rating-history.md)           | draft   | 4     | R4 (with H2, R1, R3); A3 if shipped                                   | P8                                 |
| S1  | [Sponsor placements](s1-sponsor-placements.md)                                 | draft   | Pilot | X1 (≥ 30 days of data), BRD, S2-min                                   | F3 P14 Q2 Q5                       |
| S2  | [Sponsor measurement](s2-sponsor-measurement-reports.md) (S2-min with S1)      | draft   | Pilot | S1, X1                                                                | F3 P12 P14                         |
| S3  | [Sponsor page](s3-sponsor-page.md) (S3a pilot page, S3b rate card)             | draft   | Pilot | S1, S2-min; S3b after a delivered report                              | F3 P14 Q3 Q5                       |
| K2  | [Queue quality](k2-queue-quality.md)                                           | draft   | L     | K1                                                                    | P13 P15 P16                        |

Wave `L` is "later in V2": it ships only with evidence that it is needed.

## Decision register

Specs cite these IDs instead of carrying their own decision tables. An
override changes one row here, and every affected spec is edited in the same
commit.

### Founder-confirmed — do not reopen

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

### Defaults — apply until the founder overrides them

"Why" is the reason the default was chosen; "Blocks" names what cannot
freeze or ship without the row.

| ID  | Default                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Why                                                                                                                                           | Blocks                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| P1  | **Play begins at the first accepted non-terminal action** (`place`, `removeInitial`, `move`, `capture`). Any ending before it (resign, claim, cleanup) writes no row. Every persisted match is therefore a played result.                                                                                                                                                                                                                                                          | Applies F4 with one rule; removes R2's `competition_status`/`aborted` class and H1's special cases.                                           | Freeze (H1, R2)       |
| P2  | **Visibility is derived from the agreed `rated` flag**: rated → public, friendly → participants only. No separate visibility column. A cap-skipped or invalidated rated match stays public, labelled "rating not counted" (pair cap) or "rating removed" (invalidation).                                                                                                                                                                                                           | Applies F2 with no second source of truth; visibility can never disagree with consent.                                                        | Freeze                |
| P3  | **Consent handshake**: the creator may request rated at creation; the joiner accepts or declines before the first action (decline → friendly). A rematch inherits the request, and each player's rematch vote on a clearly labelled rated rematch is that player's re-consent. Entering the quick-match queue is consent. Old cached clients cannot send consent, so their games stay friendly. Consequently a rematch is rated only when both rematch votes are rated votes (M9). | Applies F1 without a new negotiation screen; safe for cached PWA clients.                                                                     | Freeze (H1, R2, K1)   |
| P4  | **Ratings are processed in ledger ingestion order** (`match.seq`, assigned by D1 at insert), not `ended_at`. Inactivity uses `ended_at` gaps clamped at zero.                                                                                                                                                                                                                                                                                                                      | A late save lands at the tail by construction, so R1's late-event pause/rebuild path and generation machinery for normal operation disappear. | Freeze (R1)           |
| P5  | **No username snapshots in the ledger.** Readers resolve the current username/avatar from the account row; pending/deleted accounts render one neutral Somali label.                                                                                                                                                                                                                                                                                                               | Rename and deletion need no scrub, no trigger, and no late-write guard.                                                                       | Freeze (H1, H2, A3)   |
| P6  | Inbound `gameAction`, `claimWin`, and `rematch` frames carry an optional `matchNumber`; a mismatch is rejected with a typed error.                                                                                                                                                                                                                                                                                                                                                 | Cheap guard against a stale command hitting a rematch, instead of revision/request-id machinery.                                              | Freeze (protocol)     |
| P7  | Pair cap: at most **3** processed rated games per unordered account pair in a rolling 24 h (by `ended_at`). No per-account daily cap at launch.                                                                                                                                                                                                                                                                                                                                    | V2 brief default; the daily cap solves no observed problem yet.                                                                               | R2 activation         |
| P8  | **One public number population**: public W/L/D, streaks, form, rating, rank, Shaxda aggregates, and charts use processed rated events only. Public match lists also show cap-skipped/invalidated rated matches, labelled, excluded from numbers. `/history` (owner) shows all saved games, labelled. The head-to-head card (participant only) counts all saved games between the two.                                                                                              | Resolves R3-D1, R4-D1, R5-D1 together; one honest rule instead of three labelled populations.                                                 | R3 implementation     |
| P9  | Fastest win = shortest normal board win (`opponentBelowThree`/`opponentCapturedAll`). Best streak = longest win run. Peak = highest post-match rating (no 1500 floor; unrated has no peak).                                                                                                                                                                                                                                                                                        | R4-D2/D3 defaults; removes R1's artificial floor.                                                                                             | R4 implementation     |
| P10 | **No cross-room "one active rated match per account" registry** in V2. Pair caps, Glicko dampening, and R6 flags cover the abuse; the queue already allows one entry per account.                                                                                                                                                                                                                                                                                                  | A per-user registry across rooms is a new distributed-state problem with little benefit at this scale.                                        | Freeze                |
| P11 | **A3 cutover is time-based**: at request the web Worker stops minting identity tickets for the account; an already-open game may finish. No web→game control path. Rooms expire after 60 idle minutes, far inside the 7-day grace.                                                                                                                                                                                                                                                 | No new control channel, active-seat index, or DO revocation protocol.                                                                         | A3 (needs Q1)         |
| P12 | Pseudonymous analytics rows kept **90 days**; daily aggregates kept indefinitely.                                                                                                                                                                                                                                                                                                                                                                                                  | Year comparisons use aggregates; detailed identifiers are not needed longer.                                                                  | X1                    |
| P13 | The game Worker may **increment** a fixed allowlist of online counters (`online_*`, `queue_*`) in `event_daily`, after H1 gives it D1. It still never reads anything but its own ledger insert result and never touches auth tables.                                                                                                                                                                                                                                               | Exact server-side online funnel with ~4 writes per game, instead of client "reporter" rules or a batch pipeline.                              | X1b (brief §6.1 edit) |
| P14 | Sponsor pilot inventory: `lobby` and `result` (local result included when the device is online). Periods 7, 14, **30 days** (not calendar month). An empty slot renders nothing. Public sponsor response edge-cached ≤ **60 s**, so takedown needs no cache purge.                                                                                                                                                                                                                 | Smaller delivery/report surface; one period unit across S1–S3 and the BRD.                                                                    | S1 (needs Q2)         |
| P15 | One pairing policy (K1 = K2): max rating gap 100/200/300/400/unbounded at 0/30/60/90/120 s of wait; **both** players' windows must admit the pair. No-show grace 45 s.                                                                                                                                                                                                                                                                                                             | Replaces K1's 100/300/any and K2's "larger window wins"; a new arrival is never forced into a surprise mismatch.                              | K1 freeze             |
| P16 | K2 cooldown after verified pre-play abandonment: 5 min on the 2nd incident in 24 h, 30 min on the 3rd and later.                                                                                                                                                                                                                                                                                                                                                                   | Conservative; invite/local play remain available.                                                                                             | K2 cooldown           |
| P17 | Unsaved matches: backoff retries for **72 h**, then `stalled` — retained indefinitely, listed by an ops command, never silently deleted. Discard is an explicit, audited operator action.                                                                                                                                                                                                                                                                                          | Replaces H1's "delete after 7 days". The only copy is never destroyed by a timer.                                                             | Freeze (H1)           |
| P18 | Glicko-2 defaults stay (1500/350/0.06, τ 0.5, 24 h empty periods, provisional when effective RD > 110). No rating estimate at launch: pending, then confirmed. Proof E5 must not contradict them before R1 activation.                                                                                                                                                                                                                                                             | R1-D2 kept; R1-D3 estimate dropped to avoid corrections that look like bugs.                                                                  | R1 activation         |
| P19 | Leaderboard eligibility stays: effective RD ≤ 110, ≥ 10 processed rated games, one within 90 days, not excluded, current username. Proof E5 reports how many simulated players qualify; a truthful empty state ships either way.                                                                                                                                                                                                                                                   | V2 brief values; the risk is an empty board, handled by copy, not by lowering the bar blindly.                                                | R3                    |
| P20 | Leaderboard tie-break uses a non-identifying surrogate integer on `player_rating`, so keyset cursors need no encryption.                                                                                                                                                                                                                                                                                                                                                           | Removes R3's encrypted-cursor requirement.                                                                                                    | R3                    |
| P21 | Match statistics never block a save: a derivation error stores the match with `stats_json = NULL` and `stats_status = 'error'`; the backfill retries.                                                                                                                                                                                                                                                                                                                              | Fixes H4 §5, which currently drops the ledger write on a stats error.                                                                         | Freeze (H1, H4)       |

### Open founder questions — only these

| ID  | Question                                                                                                                                      | Recommendation                                                      | Blocks                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| Q1  | Ship A3 in V2, and when?                                                                                                                      | Yes; in production no later than rated public play (end of wave 2). | A3 activation; wave-2 production enablement          |
| Q2  | Sponsor pilot surfaces, and may `result` appear after local games?                                                                            | P14: `lobby` + `result`, local included.                            | S1                                                   |
| Q3  | Inputs, not decisions: current weekly players and games, recurring community play times, comfortable monthly Cloudflare budget.               | Provide when known; the revision proceeds without them.             | Quick-match beta targets; cost alerts                |
| Q4  | Somali glossary: sponsored, sponsor, rated, friendly, quick match, leaderboard, history, replay, pending, rating not counted, deleted member. | Drafts below; one native review.                                    | Release of each surface (not spec freeze)            |
| Q5  | Commercial: prices, currency, contact channel (email/WhatsApp), content-policy list; also the `[EMAIL XIRIIRKA]` placeholder on `/legal`.     | Treat V2 §15 prices as hypotheses; approve before first booking.    | First paid booking; S3 publication; `/legal` contact |

## Somali glossary drafts (Q4)

Drafts collected from the specs for one native review. Every string that uses
them stays behind the repository's `TODO(translation-review)` marker until
that review. Keep `shaxda`, `jare`, and `irmaan` unchanged.

| Term                 | Draft Somali                                             | Where it appears                              |
| -------------------- | -------------------------------------------------------- | --------------------------------------------- |
| rated (game)         | Tartan                                                   | Lobby, result, history, match page            |
| friendly (game)      | Saaxiibtinimo                                            | Lobby, result, history, match page            |
| quick match          | Kulan degdeg ah                                          | `/online`, queue, history mode label          |
| leaderboard          | Miiska darajada                                          | `/leaderboard`, navigation                    |
| rating               | Darajo                                                   | Result, profile, leaderboard                  |
| rank                 | Kaalin                                                   | Leaderboard, profile                          |
| history              | Ciyaarahayga                                             | Navigation, `/history`                        |
| replay               | Dib u daawo                                              | Match page viewer                             |
| pending              | Waa la xisaabinayaa                                      | Result, history, match page                   |
| rating not counted   | Darajo laguma xisaabin                                   | Match page, history, result                   |
| rating removed       | Darajada waa laga saaray                                 | Match page, history, result (R6 invalidation) |
| being checked (held) | Waa la hubinayaa                                         | Result, history, match page, profile          |
| rating corrected     | Darajada waa la saxay                                    | Rated match surfaces (R6)                     |
| ratings updating     | Darajooyinka waa la cusboonaysiinayaa                    | Leaderboard, profile, result (maintenance)    |
| provisional rating   | Darajo ku meel gaar ah                                   | Profile, leaderboard, player cards            |
| no rating yet        | Weli darajo ma laha                                      | Profile, player cards                         |
| win / loss / draw    | Guul / Guuldarro / Barbaro; verbs Guuleystay / Khasaaray | History, leaderboard, head-to-head            |
| match statistics     | Tirakoobka ciyaarta                                      | Match page (H4)                               |
| comeback             | Soo kabasho                                              | Match statistics (H4)                         |
| qualified views      | Muuqaallo la tiriyay                                     | Sponsor report (S2)                           |
| deleted member       | Xubin la tirtiray                                        | Every place a deleted player appears          |
| sponsored (label)    | Waxaa kafaala qaaday                                     | Every sponsor placement                       |
| sponsor (noun)       | Kafaala-qaade                                            | Admin copy, `/sponsor`                        |

## Retired terms

These names and phrases left the specs in the 2026-09-29 revision. The
consistency gates fail if any spec, the V2 brief, or the BRD uses them.

| Retired                                                    | Use instead                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `competition_status`, `aborted`, `competitive` as a status | P1: a match either began (it has a row) or did not (no row)                    |
| `username_snapshot`                                        | P5: the current account row, or the neutral label                              |
| `matchSaved` message                                       | `matchStatus.save` (contracts §6.2)                                            |
| `replay_json`, `starting_player`, `first_advantage_how`    | `replay`, `starting_seat`, `first_advantage_by` (contracts §2.1)               |
| `pieces_a`, `captured_a` and their seat-B twins on `match` | `match_player.pieces_left` and `captured`                                      |
| `dailyCap`                                                 | no per-account daily cap at launch (P7)                                        |
| `lateLedgerEvent`                                          | nothing: ratings follow ingestion order, so a late save is the next event (P4) |
| "rated by default"                                         | friendly by default; rated by mutual consent (F1, P3)                          |
| "128 KiB" as the Durable Object value limit                | 2 MB for SQLite-backed objects (proof E4)                                      |
| "guest → account conversion", "exact DAU", "exact MAU"     | the metrics dictionary (contracts §9)                                          |
| "calendar month" as a sponsor period                       | 30 days (P14)                                                                  |

## Contract changes after the freeze

A frozen promise changes only through an explicit contract-change commit that
edits `v2-contracts.md`, this register, and **every** consuming spec in the
same commit, and records the change in the log below. Wire changes stay
additive for cached PWA clients (`v2-contracts.md` §6).

## Change log

| Date       | Commit    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | `e7ea9fb` | V2 brief and 17 milestone spec drafts added.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-29 | `33df8b9` | Spec revision plan rewritten (`docs/specs-revision-plan.md`).                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-29 | `c701d7b` | Spec drafts formatted with Prettier.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-29 | `caf614e` | `/legal` describes the live accounts and D1 storage (revision step 1).                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-29 | `92b4179` | This index and register created (step 2). P3 states the rematch rule it implies (M9).                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-09-29 | `cd85b1c` | `v2-contracts.md` added (step 5) with proofs E1–E4. Refinements (contracts §13): `rateConsent.disclosureV`; rated rematch votes; hardened fence; narrow `match_rating`/`match_player_rating` tables; validation first with non-blocking `held`; the public record and `eligible_until` on `player_rating`; game→web hint; generated web entry wrapper; one owner for the shared e2e D1; stricter ledger checks.                                             |
| 2026-09-29 | —         | Contracts tightened after the spec revisions: invalidation first in the decision order; `payload_hash` excludes the stats fields; H4's nightly stats backfill; `eligible_until` excludes exactly 90 days; kill-switch semantics; active browsers count every browser; K2's cooldown code, counter, and presence binding reserved; H1's ops token, limiter, route, and audit table. Retired terms, glossary drafts, and dependencies moved into this README. |
