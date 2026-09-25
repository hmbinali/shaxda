# Shaxda V2 — Roadmap and Milestone Brief

## 1. Purpose

This document defines **V2 of Shaxda**: everything the product builds after
V1.0, V1.1-A, and V1.1-A2 shipped. It is the source of truth for V2 scope,
milestone order, and the constraints each milestone must respect.

It is deliberately a **brief per milestone, not an implementation spec**. Each
milestone below has enough detail to write its own detailed spec plan when it
becomes active. That spec is written later, one milestone at a time, and must
not widen the milestone's scope without updating this file first.

Precedence stays as the PRD defines it:

1. `docs/shaxda_game.md` wins for game rules.
2. `docs/shaxda_prd.md` wins for tech stack, infrastructure, and V1 architecture.
3. `docs/shaxda-v2.md` (this file) wins for V2 scope, order, and V2-specific
   architecture changes. Where it changes a V1 rule, it says so explicitly in
   §6 and the change is applied to `AGENTS.md` and the PRD in the first commit
   of the milestone that needs it.

Read this fully before starting any V2 milestone.

---

## 2. Where V1 Left Off

What is live on `shaxda.app` at the start of V2:

- Somali-only site: `/`, `/learn`, `/legal`, PWA install, offline local mode.
- Local hot-seat play at `/local` with localStorage save/resume.
- Guest online invite play at `/online`: room code/link, Turnstile, reconnect,
  disconnect grace, idle nudge, claim-win, alarm cleanup, rematch negotiation.
- Google-only accounts: `/login`, `/register`, `/account`, public profile at
  `/u/<username>` with alias redirects, avatar modes, profile sharing.
- Account-owned online seats through 90-second HMAC tickets; usernames and
  avatars shown on the online player cards.

What the codebase already gives V2 for free:

- A pure, fuzzed rules engine with `replayActions(startingPlayer, actions)`,
  `serialize`/`deserialize`, five action types, six `GameEndReason` values, and
  per-player `captured` counts.
- Zod schemas and a versioned (`v: 1`) WebSocket protocol in `packages/shared`.
- Drizzle + D1 in `packages/db` with hand-written migrations and Workers tests.
- A `matchNumber` per room that already separates rematches.
- Seat identity that already carries the private `userId` and a
  username/avatar snapshot for account seats.

Gaps V2 closes early. None is a separate step; each is owned by the
milestone in brackets, and X1 and H1 together cover all but the last:

- **[H1]** The Match Durable Object stores only the current serialized
  `gameState`. **There is no action log.** Replay, statistics, and audit all
  need one.
- **[H1]** Every game and every rematch starts with seat A
  (`createInitialState("A")`). Acceptable for casual play, unfair for rated
  play.
- **[H1]** Claim-win is applied as an opponent `resign` inside the engine; the
  online reason (`opponentAbandoned` / `opponentIdleTimeout`) lives only in
  room state and must be captured at persist time.
- **[H1]** The game Worker has no D1 binding. Some Worker has to write the
  match row.
- **[X1]** There is no DAU/WAU/MAU measurement, only Cloudflare Web Analytics
  page views. Sponsors will ask for numbers.
- **[before S1]** `docs/shaxda_brd.md` does not exist, although the PRD
  delegates monetization to it.

---

## 3. V2 Goals

V2 has two goals, in this order:

1. **Retention.** Give players a reason to come back: a record of their games,
   a rating that means something, a leaderboard, and a way to find an opponent
   without needing a friend online at the same moment.
2. **Revenue.** Reach **$1,000/month** from direct sponsored placements inside
   the game, sold by the founder to vetted Somali businesses in 1-week, 2-week,
   or full-month bookings, paid off-platform.

Retention comes first because sponsorship revenue is a function of traffic, and
the traffic model in §15 shows the audience V2 needs to build.

### Success metrics

Measured by the X1 milestone; targets are set once X1 has a baseline.

| Area        | Metric                                                             |
| ----------- | ------------------------------------------------------------------ |
| Growth      | MAU, WAU, DAU; guest → account conversion rate                     |
| Retention   | D7 and D30 retention of new accounts; rated games per account/week |
| Quick match | median wait time; share of queue joins that end in a started game  |
| Revenue     | booked slot-weeks per month; monthly sponsor revenue; fill rate    |
| Integrity   | rated games flagged or invalidated; full rating rebuild drift = 0  |
| Cost        | Cloudflare bill per 1,000 completed online games                   |

---

## 4. V2 Scope at a Glance

V2 is organised into **tracks** with lettered milestones. Milestone IDs are
chosen not to collide with any V1 PRD ID (F, A, B, C, D, E, L, O, Q, BETA, P).

| Track | Name                         | Milestones             | Replaces PRD label |
| ----- | ---------------------------- | ---------------------- | ------------------ |
| X     | Measurement                  | X1                     | new                |
| H     | History: persistence, replay | H1, H2, H3, H4         | V1.1-B             |
| R     | Ratings and competition      | R1, R2, R3, R4, R5, R6 | V1.1-C             |
| K     | Quick match (kulan)          | K1, K2                 | new                |
| S     | Sponsorship                  | S1, S2, S3             | new; BRD scope     |
| A     | Identity follow-ups          | A3                     | V1.1-A follow-up   |

Mapping from the ideation inventory (`shaxda-build.md`) to this document:

| Ideation | V2  | Ideation | V2  |
| -------- | --- | -------- | --- |
| B1       | H1  | C1       | R1  |
| B2       | H2  | C2       | R2  |
| B3       | H3  | C3       | R3  |
| B4       | H4  | C4       | R4  |
|          |     | C5       | R5  |
|          |     | C6       | R6  |

### Milestone summary

| ID  | Milestone                       | One line                                                               |
| --- | ------------------------------- | ---------------------------------------------------------------------- |
| X1  | Product analytics               | Exact DAU/WAU/MAU, game funnel, internal stats page.                   |
| H1  | Match persistence foundation    | Action log in the room, `match` tables, idempotent server-side writes. |
| H2  | Match history and match detail  | `/history`, `/match/<id>`, filters, pagination, share metadata.        |
| H3  | Replay viewer                   | Engine-driven replay with controls and event highlights.               |
| H4  | Match statistics foundation     | Derived Shaxda stats stored per match and reusable by R-track.         |
| R1  | Rating system                   | Glicko-2 ledger, provisional handling, rating processor.               |
| R2  | Ranked play rules               | Which games count, friendly rooms, resign/claim policy, anti-farming.  |
| R3  | Leaderboard                     | `/leaderboard`, eligibility, my-rank context, pagination.              |
| R4  | Profile statistics              | Rating, rank, W/L/D, recent matches, Shaxda stats on `/u/<username>`.  |
| R5  | Head-to-head and rating history | Opponent comparison, rating trend, recent form.                        |
| R6  | Ranking integrity and tools     | Suspicious-pattern flags, invalidate/recompute, admin CLI.             |
| K1  | Quick match queue               | Account-only hibernating queue DO, skill pairing, auto room creation.  |
| K2  | Queue quality                   | Widening windows, waiting presence, re-queue, abuse cooldowns.         |
| S1  | Sponsor placements              | Slots, bookings, admin, rendering with disclosure, unbooked fallback.  |
| S2  | Sponsor measurement and reports | Viewable impressions, clicks, per-booking report.                      |
| S3  | Sponsor page and rate card      | Public `/sponsor` page, contact flow, published pricing.               |
| A3  | Account deletion                | Self-service deletion with match-ledger anonymisation. Optional.       |

---

## 5. Not in V2

Deliberately excluded. Adding any of these requires editing this file first.

- English content, `/en` routes, a language toggle, Paraglide/Inlang (remains
  V1.1-D, reconsidered after V2).
- AI opponent.
- Seasons, seasonal resets, seasonal leaderboards.
- Achievements and badges.
- Rank tiers (bronze/silver/…); may be revisited as polish after R4.
- Chat, friends, followers, direct messages, clans.
- Spectating.
- Tournaments.
- Async/correspondence play.
- Real 3D board.
- App-store wrapper.
- Programmatic ads, ad networks, affiliate links, in-app payments, paid
  accounts, sponsor self-serve checkout.
- A sponsor dashboard that sponsors log into (reports are delivered by the
  founder in V2).
- Public history hiding / private profiles (see D8 in §16).
- Guest match persistence of any kind.

---

## 6. Principles and Rule Changes

All V1 principles in `AGENTS.md` and the PRD still apply: engine first, functional
before beautiful, small honest commits, local-first `$0` development, Zod on
every boundary, server authority online, hibernating Durable Objects, no
per-move D1 rows, Somali-only UI.

V2 changes or adds the following rules. Each change is applied to `AGENTS.md`
and the PRD in the first commit of the milestone named.

### 6.1 The game Worker may bind D1 for match persistence only (H1)

Supersedes the V1.1-A2 line "the game Worker gains no D1 dependency".

- The game Worker gets a D1 binding to the same database per environment.
- It may **write** the match ledger tables (`match`, `match_player`) from the
  Match Durable Object, and nothing else.
- It still has **no** Better Auth, no session validation, no cookies, and never
  reads `user`, `account`, `session`, or `verification`. Anything it needs about
  a player arrives inside a signed identity ticket.
- Local development and tests use Miniflare D1 only.

Rationale: the Durable Object is the only place that holds authoritative state,
the seat's private `userId`, and the action log at the moment the game ends. A
direct, idempotent write from there is simpler and more reliable than a
cross-Worker callback, and the volume is one write per completed match.

### 6.2 Ratings are a derived view of the match ledger (R1)

- The `match` and `match_player` rows are the immutable ledger.
- Rating state is computed by one idempotent processor, in the web Worker, in
  `ended_at` order. A full rebuild from the ledger must reproduce the live
  ratings exactly. Invalidating a match and rebuilding is the correction tool.
- The game Worker never computes ratings.

### 6.3 Sponsorship is now allowed, under fixed rules (S1)

Supersedes "no monetization" for V2. `docs/shaxda_brd.md` is created from §15
of this document before S1 starts.

- Direct-sold placements only. No ad networks, no programmatic, no tracking
  pixels from third parties, no third-party scripts.
- Every placement is visibly labelled as sponsored in Somali.
- Placements never sit inside the board hit area, never cover game controls,
  never delay a move, and never appear during a pending capture or blocked
  prompt.
- Unbooked slots render either nothing or a house "become a sponsor" card.
- Sponsor creatives are hosted by Shaxda (R2), never hot-linked.
- No sponsor targeting by identity. Every viewer of a surface sees the same
  booked sponsor for that period.
- Payment is off-platform. The app stores booking status, not money.

### 6.4 New Durable Objects follow the same cost rules (K1)

The matchmaking queue is a Durable Object and must use
`ctx.acceptWebSocket(...)`, no `setInterval`, no lifecycle `setTimeout`, and
alarms only while the queue is non-empty. `pnpm check:hibernation` must cover
it.

### 6.5 Starting player is fair for persisted games (H1)

The starting seat for any account-vs-account game is randomised for the first
game of a room and alternates on rematch. The engine already accepts
`createInitialState(startingPlayer)`; the room and client must stop assuming A.

---

## 7. Architecture Overview

### 7.1 Services after V2

```txt
Browser (SvelteKit, PWA)
  ├── /local, /online              prerendered, client-only (unchanged)
  ├── /history, /match/<id>, /u/…  SSR, session-aware, reads D1
  ├── /leaderboard                 SSR, cached reads
  ├── /sponsor, /admin/*           SSR; admin gated by allowlisted user ids
  └── beacons → /api/analytics, /api/sponsor/event

Web Worker (shaxda-web)            Better Auth, D1 reads/writes, rating
                                   processor, cron sweep, admin, R2 access
        │ identity tickets (HMAC)              ▲ service binding: "process ratings"
        ▼                                      │
Game Worker (shaxda-worker)        ticket verification only
  ├── RoomCoordinator DO           unchanged
  ├── MatchRoom DO                 + action log, + match persistence (D1 write)
  └── MatchmakingQueue DO (K1)     hibernating queue, pairs, creates rooms

D1 (shaxda-db)                     auth tables + match ledger + ratings +
                                   sponsor tables + analytics rollups
R2 (S1)                            sponsor creatives only
```

### 7.2 Data model overview

Exact columns belong to each milestone's spec. The shape and the rules do not.

| Table                | Written by                          | Purpose                                                                                                                                                                                  |
| -------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `match`              | MatchRoom DO                        | One row per completed account-vs-account game: result, reasons, mode, rated flag, compact replay, replay version, derived stats JSON, timestamps. Unique on `(room_code, match_number)`. |
| `match_player`       | MatchRoom DO, then rating processor | Two rows per match: `user_id`, seat, result, username snapshot; rating before/after/delta filled by R1. Indexed on `(user_id, ended_at)`.                                                |
| `player_rating`      | Rating processor                    | Current rating, RD, volatility, rated games, peak, last rated at, leaderboard exclusion flag.                                                                                            |
| `rating_flag`        | R6 tools                            | Suspicious-pattern flags and manual invalidations with reasons.                                                                                                                          |
| `active_user_day`    | Web Worker (X1)                     | `(day, anon_id)` unique; exact DAU/WAU/MAU with no PII.                                                                                                                                  |
| `event_daily`        | Web Worker (X1)                     | Daily counters: games started/completed by mode, rooms, queue joins.                                                                                                                     |
| `sponsor`            | Admin (S1)                          | Vetted sponsor: name, tagline, CTA URL, creative keys, status.                                                                                                                           |
| `sponsor_booking`    | Admin (S1)                          | Slot, period, price, status (`draft`/`confirmed`/`live`/`ended`/`cancelled`).                                                                                                            |
| `sponsor_stat_daily` | Web Worker (S2)                     | `(booking_id, day)` impressions, unique sessions, clicks.                                                                                                                                |

Rules:

- No table stores one row per move. The replay is one text column.
- Every list query hits an index. Add the index in the same migration.
- Migrations stay hand-written, as `packages/db` already requires.
- The game Worker touches only the first two tables.

### 7.3 Compact replay format (H1, frozen once merged)

The action log is stored as a versioned compact JSON array and expanded through
a pure encoder/decoder in `packages/game-engine`:

```json
{ "v": 1, "s": "B", "a": ["P:O3", "P:M2", "X:I1", "M:O3>O4", "C:I5", "R"] }
```

- `s` is the starting player; `a` is the ordered action list.
- Codes: `P` place, `X` initial removal, `M` move (`from>to`), `C` capture,
  `R` resign. The acting player is derived from state, never stored.
- `replayActions(s, decode(a))` must return the persisted final state; H1 tests
  assert this on every persisted fixture and the DO refuses to persist a log
  that does not replay to its own final state.
- Typical game ≈ 1–2 KB; worst case (80-turn clock reset by every capture) stays
  under ~20 KB.

Contract changes to this format follow the F1 contract-change rule: explicit
commit, version bump, migration plan for old rows.

---

## 8. Track X — Measurement

### X1 — Product Analytics

**Goal.** Know DAU, WAU, MAU, and the game funnel exactly, with no PII, before
retention or revenue claims are made.

**Why first.** Every V2 success metric and the sponsor rate card in §15 depend
on it. It is small and independent of everything else.

**Depends on.** Nothing.

**Includes (Must):**

- A stable anonymous id per device: salted SHA-256 of the existing guest id, or
  of the account id when signed in. The salt is a Worker secret. The raw ids and
  IP addresses are never stored.
- A once-per-day client beacon (`POST /api/analytics/active`) guarded by a
  localStorage "reported for day" marker, writing one `active_user_day` row.
  Works from prerendered routes.
- Daily counters in `event_daily` for: local game started/completed, online
  game started/completed by mode, room created/joined, account registered,
  PWA installed. Counters are incremented server-side where the event already
  passes through a Worker; client-reported events are rate-limited and Zod
  validated.
- Internal `/admin/stats` page (admin allowlist by user id, SSR) showing DAU,
  WAU, MAU, 7/30-day trends, games per day by mode, completion rate, and
  guest→account conversion.
- Retention job: prune `active_user_day` older than 400 days (cron trigger).
- Privacy note added to `/legal` (Somali) describing the anonymous counter.

**Should:**

- D7/D30 retention cohorts for accounts (derived from `match_player` once H1
  exists, or from `active_user_day` by hashed account id).
- CSV export from `/admin/stats` for the founder.

**Not in X1:** Workers Analytics Engine, per-move events, funnels by page,
third-party analytics.

**Architecture notes.** D1 rollups are exact and cheap at V2 scale (one row per
active device per day). Analytics Engine is the escape hatch if event volume
outgrows D1; it is not needed to start.

**Tests.** Beacon dedupe per day; hashing never leaks raw ids; admin route is
403 for non-admins; counters are idempotent under retries.

**Done when** `/admin/stats` shows real numbers from production for 7 days and
the founder can quote MAU.

---

## 9. Track H — History, Persistence, Replay

### H1 — Match Persistence Foundation

**Goal.** Every completed **account-vs-account** online game is stored once, as
a server-authoritative ledger row with a replayable compact action log.

**Depends on.** V1.1-A2 (live). X1 is independent.

**Includes (Must):**

- MatchRoom records the compact action log for the current `matchNumber`,
  reset on rematch, including actions produced by claim-win (the synthetic
  `resign`).
- Room creation options: `mode` (`invite`, later `quick`) and `rated`
  (default `true` when both seats are accounts; R2 adds the friendly toggle
  UI). Options are validated with Zod and stored in room state.
- Fair starting player per §6.5: random on the first game, alternating on
  rematch; the client stops assuming seat A starts.
- Persistence trigger: when `phase` becomes `gameOver` via an action or a
  claim-win, and both seats are `account` kind. Guest-involved games write
  nothing.
- One `match` row + two `match_player` rows written in a single D1 batch,
  idempotent on `(room_code, match_number)`; a retry after a partial failure
  cannot duplicate.
- Persist-pending state in room storage with alarm-driven retry; a room is not
  eligible for cleanup while a persist is pending and retries remain.
- Captured at persist time: starting player, first-advantage player and how it
  was decided, engine `endReason`, online end reason (`abandoned` / `idle` /
  `null`), winner, result, final piece counts, capture counts, action count,
  started/ended timestamps, mode, rated flag, replay `v`, username snapshots.
- Replay validation before write: decode → `replayActions` → equals final
  state; otherwise log and mark the room for manual inspection (never persist a
  broken log).
- D1 binding in the game Worker's dev/preview/production Wrangler configs;
  migration `0001_matches.sql` with all indexes.
- `AGENTS.md`/PRD update for §6.1 and §6.5 in the first commit.

**Should:**

- `match.stats_json` filled by the H4 derivation once H4 exists (H1 leaves it
  null).
- A `matchSaved { matchId }` server message so the result overlay can link to
  the match page (H2).

**Not in H1:** any UI, history reads, ratings, guest persistence, statistics
beyond counts, deletion.

**Decisions to settle in the spec:** action log stored inline in room state vs
its own storage key; exact `match` columns; how `startedAt` is defined (both
seats present vs first action); retry limits and what happens after exhaustion.

**Tests.** Workers tests: persist once per match across reconnects and
retries; rematch produces a second row; guest seat → no row; claim-win rows
carry the online reason; replay round-trip equality on every shared full-game
fixture; hibernation check still passes; cleanup alarm waits for pending
persist.

**Done when** two signed-in accounts finish a game on preview and exactly one
row exists with a log that replays to the final state.

### H2 — Match History and Match Detail

**Goal.** Players can see their games; anyone can open a match page.

**Depends on.** H1.

**Includes (Must):**

- `/history` (owner only, session-aware SSR): reverse-chronological list with
  opponent username + avatar, result badge, end reason, rated/friendly, date,
  duration, final piece counts, links to `/match/<id>` and the opponent
  profile. Cursor pagination. Compact cards on mobile, rows on desktop.
- Filters: all / wins / losses / draws / rated / friendly. Empty state for new
  accounts.
- History summary header: games, W/L/D, win rate, current streak, recent form
  (`W W L D W`).
- `/match/<id>` (public SSR): both players, result, termination reason,
  date/time, duration, starting player, first advantage and how it was
  decided, final pieces, captures, action count, links to both profiles,
  replay entry point (H3), copy-link/share button reusing the profile share
  component.
- Open Graph metadata for match pages; a static OG image in V2 (dynamic
  result images are later).
- Result overlay in `/online` links to the saved match when `matchSaved`
  arrives.
- Somali copy for all of the above in `packages/i18n`.

**Should:**

- Search history by opponent username.
- Date-range filter.

**Not in H2:** replay playback, ratings on rows (R4 adds the delta), private
history.

**Tests.** Loader authorisation (only the owner sees `/history`), pagination
stability, alias-safe opponent links, 404 for unknown match ids, e2e for a
saved match appearing in both players' histories.

**Done when** both players of an H1 match can find it, open it, and share it.

### H3 — Replay Viewer

**Goal.** Watch any saved game move by move using the real board.

**Depends on.** H1, H2. Uses the production board renderer.

**Includes (Must):**

- Client-side reconstruction: decode the log, run `applyActionLog`
  incrementally, keep all intermediate states in memory (≤ a few thousand
  small objects).
- Controls: play/pause, previous, next, jump to start/end, action counter
  (`34 / 87`), speed 0.5×/1×/2×, keyboard arrows.
- Board in read-only mode; current phase and current player shown; last action
  highlighted; moved piece and destination highlighted; capture and jare
  highlights reuse the live game's visuals; initial removals and the
  first-advantage moment are called out.
- Final-result overlay at the end; reduced-motion support; sound off by
  default in replay.
- Deep link to a position: `/match/<id>?a=<index>`.

**Should:**

- Timeline scrubber with event markers (jare, capture, phase change).
- Jump to next/previous capture or jare.

**Not in H3:** annotations, commentary, comparison with alternative moves,
downloading replays.

**Tests.** Every shared full-game fixture replays in the viewer to the stored
final state; keyboard navigation; reduced motion; deep-link index clamping.

**Done when** a full game replays correctly on a low-end Android phone.

### H4 — Match Statistics Foundation

Detailed spec: [`docs/specs/h4-match-stats.md`](specs/h4-match-stats.md).

**Goal.** Derive Shaxda-specific statistics from the action log once, store
them on the match, and make them reusable by profiles and leaderboards.

**Depends on.** H1. Can run in parallel with H2/H3.

**Includes (Must):**

- A pure derivation module (`packages/shared/src/stats`, allowed to import the
  engine) producing per-player: captures made/suffered, jare events, repeated
  jare events, first placement jare, movement turns, turns before first
  capture, maximum piece advantage, blocked-player events, space-making turns,
  comeback flag, and per-match: phase transition indices, longest no-capture
  run.
- Stats JSON schema versioned alongside replay `v`; stored in
  `match.stats_json` at persist time by the DO; always re-derivable.
- Backfill script for matches persisted before H4.
- Match page shows a compact stats panel.

**Should:** player-level aggregates precomputed for R4 (totals and averages).

**Not in H4:** "style" labels (aggressive/defensive), public analytics
dashboards.

**Tests.** Golden stats for every full-game fixture; derivation determinism;
backfill idempotence.

**Done when** every stored match has a stats JSON and the match page renders it.

---

## 10. Track R — Ratings and Competition

### R1 — Rating System

Detailed spec: [`docs/specs/r1-rating-system.md`](specs/r1-rating-system.md).

**Goal.** A skill rating per account that is fair for a small, sporadic player
base and fully rebuildable.

**Depends on.** H1.

**Includes (Must):**

- **Glicko-2** with per-game updates: initial rating 1500, RD 350, volatility
  0.06, τ 0.5 (spec may tune τ). RD grows with inactivity so returning players
  are treated as uncertain again.
- Pure implementation in a new dependency-free package `packages/rating` with
  property tests (symmetry, bounded updates, convergence on fixtures).
- Rating processor in the web Worker: idempotent, processes
  `match.rating_status = 'pending'` rows in `ended_at` order, writes
  before/after/delta to `match_player` and updates `player_rating` in one D1
  batch with optimistic concurrency.
- Triggers: service-binding call from the game Worker right after persist
  ("process now"), plus a one-minute cron sweep as backstop.
- Provisional state: RD above a threshold (~110) shows the rating with a `?`
  and excludes the player from the leaderboard.
- Peak rating tracking.
- Full rebuild command: recompute all ratings from the ledger and diff against
  live; CI runs it on fixtures.
- Result overlay shows the rating change when the processor has run, or a
  client-side preview computed with the same pure function, labelled as
  provisional until confirmed.

**Should:** rating shown on the online player cards during rated games.

**Not in R1:** leaderboard UI, eligibility rules beyond provisional, seasons.

**Tests.** Property tests; ledger rebuild equality; processor idempotence under
concurrent triggers; ordering under out-of-order persist retries.

**Done when** two accounts play a rated game and both ratings move by the
expected amount, and a rebuild reproduces the same numbers.

### R2 — Ranked Play Rules

**Implementation spec:** [`docs/specs/r2-ranked-play-rules.md`](specs/r2-ranked-play-rules.md).

**Goal.** Decide exactly which games count and make farming unattractive.

**Depends on.** H1, R1. Tightly coupled with R1; may share a workspace.

**Includes (Must):**

- Eligibility: an account on both seats, `rated = true`, mode `invite` or
  `quick`. Guests never affect ratings.
- Friendly rooms: the creator can mark an invite room **friendly** (unrated);
  the lobby shows the mode to both players before the first move; it cannot
  change after the game starts.
- Result policy (default for the spec to confirm):
  - normal wins and draws: rated;
  - resignation: rated as a loss at any phase (the player chose it);
  - claim-win during movement: rated as a loss for the absent/idle player;
  - claim-win during placement or initial removal: persisted, marked
    `aborted`, unrated (removes the abandon-farm incentive);
  - a room cleaned up with no result: nothing persisted.
- Anti-farming caps: only the first N rated games (default 3) between the same
  two accounts in a rolling 24 hours are rated; later ones are persisted as
  `rating_status = 'skipped'` with reason `pairCap`, shown as friendly.
- Rated game requires both players to have started the game (first action by
  each) before a loss can be assigned by claim-win.
- Glicko's own dampening is documented: wins against high-RD (new) accounts
  move an established rating less, so new-account feeding pays poorly.
- Somali explanation of rated vs friendly on `/learn` or a short
  `/leaderboard#rules` section.

**Should:** per-account daily rated-game cap (default 30) as a blunt safety
valve.

**Not in R2:** automated bans, suspicious-pattern detection (R6), matchmaking.

**Tests.** Policy table as a parameterised Workers test; pair cap across day
boundaries; friendly flag immutability after start.

**Done when** the policy table in the spec is enforced by tests and visible in
the lobby.

### R3 — Leaderboard

**Implementation spec:** [`docs/specs/r3-leaderboard.md`](specs/r3-leaderboard.md).

**Goal.** A public ranking that rewards skill over volume and stays useful for
players outside the top.

**Depends on.** R1, R2.

**Includes (Must):**

- `/leaderboard` (SSR, edge-cached ~60 s): rank, avatar, username, rating,
  rated games, W/L/D, current streak.
- Eligibility: not provisional, ≥ 10 rated games, a rated game within the last
  90 days, not excluded by R6.
- Top 100 with pagination beyond it.
- Signed-in context: a sticky "your rank" card, and a "around you" strip (three
  above, you, three below) even when far outside the top.
- Rank shown on public profiles (R4) from the same query.
- Indexes so the query never scans: `(excluded, rd, last_rated_at, rating)`
  or a materialised snapshot refreshed by cron if the live query proves slow.

**Should:** "most active this week/month" as a separate, clearly-labelled list
(not called a leaderboard).

**Not in R3:** seasons, tiers, friends filter, weekly rating boards.

**Tests.** Eligibility boundaries; around-you strip at the top, bottom, and
for ineligible viewers; cache headers.

**Done when** the leaderboard loads under 200 ms from cache and a new eligible
player appears within a minute of their qualifying game.

### R4 — Profile Statistics

**Goal.** Make `/u/<username>` the player's public record.

**Depends on.** H2, H4, R1, R3.

**Includes (Must):**

- Overview: rating (with provisional marker), global rank or "not ranked yet",
  peak rating, games, W/L/D, win rate, current and best streak, recent form.
- Recent matches: last 10 with opponent, result, rating delta, date, replay
  link; link to full `/history` when viewing your own profile.
- Shaxda stats from H4 aggregates: total captures, average captures per game,
  jare and repeated jare counts, average duration, fastest win, wins as
  starter vs non-starter, wins with vs without first advantage, comeback wins,
  draw count by type.
- Layout: overview / matches / stats sections; mobile-first.
- Alias redirects and privacy rules from V1.1-A unchanged.

**Should:** "challenge" button that creates an invite room and copies the link.

**Not in R4:** style labels, private profiles, follower counts.

**Tests.** Profile of an account with zero games; alias redirect still works;
no PII leaks in the loader output; stats equal the sum of the ledger.

**Done when** a player can send their profile link as proof of their record.

### R5 — Head-to-Head and Rating History

**Goal.** Social comparison and progress over time.

**Depends on.** R4.

**Includes (Must):**

- When signed in and viewing another profile: games between you, your wins,
  their wins, draws, last meeting, rating difference.
- Rating history per account: the `match_player` before/after series rendered
  as a simple chart with the peak marked; 7/30/90-day windows.
- Recent-form strip reused on leaderboard rows.

**Should:** "play again" from head-to-head that creates an invite room.

**Not in R5:** rating snapshots table (derive from the ledger), comparisons of
Shaxda stats between two arbitrary players.

**Tests.** Head-to-head symmetry; chart data derived from the ledger only.

### R6 — Ranking Integrity and Tools

**Implementation spec:** [`docs/specs/r6-ranking-integrity.md`](specs/r6-ranking-integrity.md).

**Goal.** Keep the leaderboard honest without building a moderation product.

**Depends on.** R1–R3.

**Includes (Must):**

- Detection jobs (cron, web Worker) that **flag, never auto-punish**: win
  trading between a pair (alternating short games), repeated instant
  resignations, one account feeding another, abnormal rated-game rate.
- `rating_flag` rows with reason and evidence (match ids).
- Admin CLI (scripts in the repo, run with Wrangler against an environment):
  inspect match, verify replay, inspect rating calculation, invalidate match,
  exclude/include account from leaderboard, rebuild ratings, consistency
  check (stored result vs replayed result vs rating events).
- Audit log table or append-only file of every manual correction.
- Rebuild after invalidation is the only correction path (§6.2).

**Should:** `/admin/flags` list view.

**Not in R6:** account suspension, appeals, automated bans, reports from
players.

**Tests.** Each detector against synthetic ledgers; invalidate → rebuild →
diff.

---

## 11. Track K — Quick Match

### K1 — Quick Match Queue

**Implementation spec:** [`docs/specs/k1-quick-match-queue.md`](specs/k1-quick-match-queue.md).

**Goal.** A signed-in player can find an opponent without sharing a link.

**Depends on.** H1, R1, R2 (quick games are always rated). Independent of H2/H3.

**Includes (Must):**

- New `MatchmakingQueue` Durable Object (single global instance in V2) using
  WebSocket hibernation. State: waiting players keyed by `userId` with rating,
  RD, joined-at. Alarms only while someone is waiting.
- Account-only: a new identity ticket action `queue` minted by the web Worker,
  carrying the rating and RD snapshot so the game Worker reads nothing from D1.
  One queue seat per account; a second tab replaces the first.
- Pairing: on join and on each alarm, match the two players whose rating gap is
  within the current window; the window widens with wait time (K2 tunes it).
  Never pair an account with itself.
- On pair: create a room through the existing coordinator with `mode: 'quick'`,
  `rated: true`, both seats **pre-claimed** for the two user ids so nobody else
  can join, then send both a `matched { roomCode }` message; both connect with
  a normal `join` ticket.
- `/online` entry: a "quick match" action visible only to complete accounts;
  waiting screen with cancel; Somali copy; guests see the sign-in path and keep
  the invite flow.
- If one side never connects to the created room within a grace period, the
  other is returned to the queue and the room is cleaned up.
- Rate limits on queue joins; Zod on every message; protocol stays `v: 1` with
  additive messages.
- `pnpm check:hibernation` extended to the new DO.

**Should:** sound and a visible banner when matched while the tab is
backgrounded.

**Not in K1:** regional queues, unrated quick match, guest queue, push
notifications, async play.

**Risk.** With a small community the queue is often empty. K2 mitigates; the
real fix at low concurrency is async play, which is out of V2.

**Tests.** Workers tests: pairing, self-pair prevention, replacement of a second
socket, alarm scheduling only when non-empty, room pre-claim, no-show recovery,
hibernation check; e2e: two accounts queue and land in the same game.

**Done when** two accounts on preview queue from different devices and start a
rated game without sharing anything.

### K2 — Queue Quality

**Goal.** Make waiting tolerable and the queue abuse-resistant.

**Depends on.** K1.

**Includes (Must):**

- Window widening schedule (e.g. ±100 → ±400 over two minutes), then pair
  anyone.
- "N players waiting" presence on the `/online` page for signed-in users, from
  the queue DO with a cached read.
- Re-queue from the result overlay after a quick game.
- Cooldown for accounts that repeatedly abandon matched games before the first
  action.
- Queue metrics into X1: joins, matches, median wait, abandon rate.

**Should:** "share an invite link while you wait" on the waiting screen.

**Not in K2:** rating-based rooms, party queue, bots to fill the queue.

---

## 12. Track S — Sponsorship

### S1 — Sponsor Placements

**Goal.** Sell and show vetted sponsors in fixed slots for booked periods, with
no self-serve and no third-party code.

**Depends on.** X1 (for numbers to sell against). Independent of H/R/K, so it
can run early. BRD created first (§6.3, §15).

**Slots (Must, four in V2):**

| Slot     | Surface                                                | Why it sells                                                         |
| -------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| `home`   | Card below the hero on `/`                             | First impression, all visitors                                       |
| `lobby`  | Card on the online waiting screen and quick-match wait | High dwell time, undistracted                                        |
| `result` | Panel in the game-over overlay, local and online       | One viewable impression per completed game; highest attention moment |
| `learn`  | Inline card on `/learn` between sections               | Learners and diaspora readers                                        |

**Includes (Must):**

- Booking periods: 7 days, 14 days, calendar month (or 30 days; spec decides).
  One `confirmed` booking per slot per instant; overlaps are rejected at write
  time.
- Creative: sponsor name, one-line tagline (Somali or sponsor's own language,
  vetted), CTA URL, optional logo in R2 (uploaded through admin, served through
  the web Worker with cache headers). Text-only creative is valid.
- Rendering: one `SponsorSlot` component per surface; reads the active booking
  from `GET /api/sponsor/active` (edge-cached ~5 minutes) so prerendered routes
  work; shows the Somali "sponsored" label; obeys §6.3 placement rules;
  unbooked → house "become a sponsor" card linking to `/sponsor` (S3), or
  nothing on `result` if the founder prefers.
- Admin: `/admin/sponsors` (allowlisted user ids): CRUD sponsors and bookings,
  status transitions, logo upload, preview of each slot with a booking.
- Off-platform payment: booking becomes `confirmed` only when the founder marks
  it paid. No money handling in the app.
- Content policy checklist in the BRD applied at vetting (suggested defaults:
  no gambling, no political campaigns, no adult content, no financial schemes,
  no khat/tobacco, no misleading claims; Somali-community businesses first).
- `AGENTS.md`/PRD update for §6.3 in the first commit.

**Should:** scheduled go-live/end handled purely by time comparison, so no cron
is needed; a "next available dates" view in admin.

**Not in S1:** measurement (S2), public page (S3), self-serve, payments,
targeting, rotation of multiple sponsors within one slot.

**Tests.** Overlap rejection; active-booking selection at period boundaries;
admin 403; slot never renders during pending capture or blocked prompt; CSP or
allowlist keeps creatives first-party; e2e for a booked slot appearing and
disappearing on time.

**Done when** a real booking renders on all four slots in production for its
period and disappears afterwards without a deploy.

### S2 — Sponsor Measurement and Reports

**Implementation spec:** [`docs/specs/s2-sponsor-measurement-reports.md`](specs/s2-sponsor-measurement-reports.md).

**Goal.** Give each sponsor an honest number.

**Depends on.** S1, X1.

**Includes (Must):**

- Viewable impression = slot at least 50% visible for ≥ 1 s
  (IntersectionObserver), deduplicated per anonymous id per slot per 30
  minutes so a hovering overlay does not inflate counts.
- Click tracking via a same-origin redirect (`/go/<bookingId>`) so counts do
  not depend on JavaScript and no sponsor script is ever loaded.
- `POST /api/sponsor/event` with Zod validation and rate limits, rolled into
  `sponsor_stat_daily`.
- Per-booking report in admin: impressions, unique devices, clicks, CTR, by
  day and by slot; printable/CSV export the founder sends to the sponsor.
- Fraud floor: ignore events from bookings not live at the time, and from
  clients sending more than a sane number of events per minute.

**Should:** report link with an unguessable token so the sponsor can view their
own numbers without an account.

**Not in S2:** sponsor login, real-time dashboards, third-party verification.

**Tests.** Dedupe windows; redirect never opens non-HTTPS or non-allowlisted
URLs; daily rollup idempotence.

### S3 — Sponsor Page and Rate Card

Detailed spec: [`docs/specs/s3-sponsor-page.md`](specs/s3-sponsor-page.md).

**Goal.** Let a Somali business find, understand, and request a placement.

**Depends on.** S1. S2 numbers make the page credible.

**Includes (Must):**

- `/sponsor` (Somali, SSR or prerendered): what Shaxda is, audience numbers
  from X1 (rounded, updated monthly by the founder), the four slots with
  mockups, the three booking periods and prices, the content policy, and a
  contact path (email/WhatsApp link; no form submission storage in V2).
- Rate card values live in one config file so they can change without touching
  components.
- Footer/nav link to `/sponsor`, visibly separate from gameplay navigation.
- Open Graph metadata for sharing the page with prospects.

**Should:** a one-page PDF rate card generated from the same config.

**Not in S3:** online booking, availability calendar, payment.

---

## 13. Track A — Identity Follow-ups

### A3 — Account Deletion (optional, recommended once H1 is live)

Detailed draft: [A3 account deletion spec](specs/a3-account-deletion.md).

**Goal.** A self-service deletion path that keeps opponents' histories intact.

**Depends on.** H1. R1 if ratings exist.

**Includes (Must):**

- `/account` deletion flow with confirmation and a short grace period.
- Better Auth session/account/verification rows removed; the `user` row kept
  as a tombstone (`deleted_at`, scrubbed email placeholder, no image, username
  released to the alias table as unclaimable for 30 days).
- Match ledger rows are **not** deleted: the deleted player renders as a
  neutral "deleted member" label; ratings stay in the ledger for opponents'
  history and rating integrity, but the account is excluded from the
  leaderboard and profile 404s.
- Somali copy replacing the current "deletion comes later" notice.

**Tests.** Deletion leaves opponents' history and ratings unchanged; tombstone
never leaks the old email or name; alias cannot be claimed during the hold.

---

## 14. Build Order and Dependency Map

```txt
X1 ──────────────────────────────┐
                                 ├──► S1 ──► S2 ──► S3
H1 ──► H2 ──► H3                 │
  │      └──► H4 ─────┐          │
  ├──► R1 ══ R2 ──► R3 ──► R4 ──► R5
  │            │           └───► R6
  │            └──► K1 ──► K2
  └──► A3 (optional)
```

`══` means one workspace. `H4` feeds `R4`. `S` depends only on `X1`.

Recommended sequence for a solo founder with 2–3 active workspaces:

1. **X1** and **H1** in parallel. H1 is the base of everything else.
2. **H2** and **S1** in parallel. Sponsor infrastructure is cheap and can start
   earning as soon as X1 numbers justify a first booking.
3. **R1+R2** (one workspace) and **H3** in parallel.
4. **R3+R4** and **K1** in parallel. Quick match is the largest retention lever
   in V2.
5. **S2**, **H4**, **R5**, **K2**.
6. **R6**, **S3**, **A3**.

Conductor workspace names:

```txt
x1-product-analytics
h1-match-persistence
h2-history-match-detail
h3-replay-viewer
h4-match-stats
r1-rating-system         (includes R2)
r3-leaderboard
r4-profile-stats
r5-head-to-head
r6-ranking-integrity
k1-quick-match-queue
k2-queue-quality
s1-sponsor-placements
s2-sponsor-reports
s3-sponsor-page
a3-account-deletion
```

Contract-freeze points in V2:

1. H1 compact replay format and `match`/`match_player` shape.
2. R1 rating event semantics (`rating_status`, before/after/delta).
3. K1 queue protocol messages.

Changes after each freeze follow the F1 contract-change rule.

---

## 15. Revenue Model and Traffic Targets

This section is the seed of `docs/shaxda_brd.md`. Numbers are targets, not
measurements, until X1 reports them.

### Model

- Four slots (S1), each sold separately for 7 days, 14 days, or a month.
- Sponsors are vetted Somali or Somali-serving businesses; payment is
  off-platform; price is flat per period.
- A sponsor's implicit value check is impressions and reach, so the rate card
  should sit near a **$10 effective CPM** (cost per 1,000 viewable
  impressions), which is a fair direct-sold rate for a targeted community
  audience. Community goodwill can push it toward $20; weak numbers push it
  toward programmatic-like $5.

### Assumptions to validate with X1

| Assumption                                   | Value used |
| -------------------------------------------- | ---------- |
| Viewable sponsor impressions per DAU per day | 3          |
| DAU / MAU (casual board game with friends)   | 15%        |
| WAU / MAU                                    | 45%        |
| Average slot fill rate                       | 75%        |

### Audience needed for $1,000/month

| Effective CPM you can charge      | Impressions/month at 100% fill | DAU        | WAU        | MAU        |
| --------------------------------- | ------------------------------ | ---------- | ---------- | ---------- |
| $20 (premium, community goodwill) | 50,000                         | ~560       | ~1,700     | ~3,700     |
| **$10 (fair direct niche rate)**  | **100,000**                    | **~1,100** | **~3,300** | **~7,400** |
| $5 (programmatic-like)            | 200,000                        | ~2,200     | ~6,700     | ~14,800    |

At a realistic 75% fill rate the $10 row becomes **~1,500 DAU / ~4,400 WAU /
~9,900 MAU**.

### Illustrative rate card at ~7,000 MAU (each slot ≈ 25,000 impressions/month)

| Period  | Price per slot | Notes                                |
| ------- | -------------- | ------------------------------------ |
| 7 days  | $80            | highest per-day price                |
| 14 days | $140           |                                      |
| 1 month | $250           | 4 slots × $250 = $1,000 at full fill |

Re-price when measured impressions per slot change by more than ~30%.

### What this implies for V2 priorities

- The `result` slot is the workhorse: one impression per completed game, in
  local and online play, without needing an account. Games per DAU matter more
  than page views.
- ~7,000 MAU for a diaspora-niche game will not come from invite links alone.
  K1 (quick match), shareable match pages (H2), and the leaderboard (R3) are the
  V2 growth surfaces; distribution through Somali WhatsApp groups, TikTok, and
  creators is outside this document but is the real constraint.
- Start selling with **two** slots (`result`, `lobby`) as soon as X1 shows
  ~2,000 MAU; a single $80 week sells the story better than a rate card.

---

## 16. Decisions Log

| ID  | Decision                                                                                                                                                                                                                                                   | Source                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| D1  | V2 = X, H, R, K, S tracks (+ optional A3). English/i18n and AI opponent are not in V2.                                                                                                                                                                     | Founder, 2026-09-19                      |
| D2  | An account on both seats is required for a game to be rated. Both invite and quick-match games are ratable. Invite rooms are rated by default with a friendly (unrated) option; quick match is always rated. Guests keep unrated, unpersisted invite play. | Founder + assumption on default; confirm |
| D3  | Sponsorship = several slots sold separately, 7/14/30-day periods, founder-vetted, paid off-platform.                                                                                                                                                       | Founder, 2026-09-19                      |
| D4  | Only account-vs-account completed games are persisted. Guest-involved games write nothing.                                                                                                                                                                 | Founder, 2026-09-19                      |
| D5  | The game Worker gets a D1 binding for match-ledger writes only (§6.1).                                                                                                                                                                                     | Proposed here                            |
| D6  | Glicko-2, per-game updates, ledger-derived, processor in the web Worker (§6.2).                                                                                                                                                                            | Proposed here                            |
| D7  | Milestone IDs X/H/R/K/S/A replace V1.1-B/C labels; ideation B1–B4/C1–C6 map as in §4.                                                                                                                                                                      | Proposed here                            |
| D8  | Match pages and profile recent-match lists are public; `/history` is owner-only; no history hiding in V2.                                                                                                                                                  | Proposed here                            |
| D9  | Starting seat is random for the first persisted game in a room and alternates on rematch (§6.5).                                                                                                                                                           | Proposed here                            |
| D10 | Analytics uses exact D1 daily rollups with salted hashes, not Analytics Engine, until volume demands otherwise.                                                                                                                                            | Proposed here                            |
| D11 | Sponsor creatives are first-party (R2), text-first, no third-party scripts, no targeting.                                                                                                                                                                  | Proposed here                            |
| D12 | No seasons, tiers, achievements, chat, spectating, tournaments, or async play in V2 (§5).                                                                                                                                                                  | Proposed here                            |

---

## 17. Open Questions for the Founder

Answers change spec details, not the milestone list.

1. D2 default: should invite rooms between two accounts be **rated by default**
   (friendly is the opt-out) or **friendly by default** (rated is the opt-in)?
2. Should the `result` slot appear in **local** games too? It is the largest
   impression source, but it is also the most intimate moment of the game.
3. Content policy: confirm or edit the suggested vetting defaults in S1.
4. Somali terms for "sponsored", "sponsor", "rated", "friendly", "quick match",
   "leaderboard", "history", "replay". This document uses English placeholders
   on purpose.
5. Should A3 (account deletion) be in V2 at all, or wait for a real request?
6. Rate card: keep the illustrative $80 / $140 / $250 as the starting point, or
   set different anchors?
7. `home` slot: card below the hero, or a slimmer strip near the footer?

---

## 18. Document Maintenance

- When a milestone becomes active, write its spec in `docs/specs/<id>-<name>.md`
  and link it from the milestone heading here. The spec may refine; it may not
  widen.
- When a milestone ships, mark it **shipped** in §4 with the merge date.
- `docs/shaxda_prd.md` §4, §25, and §26 and `AGENTS.md` receive a short pointer
  to this file in the X1/H1 kick-off commit; detailed rule changes (§6) land in
  the milestone that needs them.
- `docs/shaxda_brd.md` is created from §15 before S1 starts and then owns
  pricing, policy, and sponsor operations.
- The ideation inventory in `shaxda-build.md` is superseded by this document.
