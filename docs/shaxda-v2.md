# Shaxda V2 — Roadmap and Milestone Brief

## 1. Purpose

This document defines **V2 of Shaxda**: everything the product builds after
V1.0, V1.1-A, and V1.1-A2. Together with the frozen specs in `docs/specs/`, it
governs V2 scope and milestone order.

It is a **brief per milestone, not an implementation spec**. Each milestone has
its own spec in `docs/specs/`; the index and decision register are in
`docs/specs/README.md`. A spec may refine this brief; it may not widen a
milestone's scope without updating this file first.

Precedence, as `docs/shaxda_prd.md` §27 sets it:

1. `docs/shaxda_game.md` wins for game rules.
2. `docs/shaxda_prd.md` wins for V1 product scope, tech stack,
   architecture, infrastructure, and the V1 roadmap.
3. This file and the frozen specs in `docs/specs/` govern V2 scope and order.
   The PRD governs stack and infrastructure for V2 as well, except where §6
   amends a rule explicitly; each amendment is applied to the PRD and
   `AGENTS.md` in the first commit of the milestone that needs it.
4. `docs/shaxda_brd.md` governs business strategy, sponsor policy, and
   pricing. It cannot add scope that the PRD or this file excludes.

No V2 milestone is active until its spec is `frozen` in `docs/specs/README.md`
**and** the milestone is activated. Read this fully before starting any V2
milestone.

---

## 2. Where V1 Left Off

Live on `shaxda.app` at the start of V2:

- Somali-only site: `/`, `/learn`, `/legal`, PWA install, offline local mode.
- Local hot-seat play at `/local` with localStorage save/resume.
- Guest online invite play at `/online`: room code/link, Turnstile, reconnect,
  disconnect grace, idle nudge, claim-win, alarm cleanup, rematch negotiation.
- Google-only accounts (V1.1-A): `/login`, `/register`, `/account`, public
  profile at `/u/<username>` with alias redirects, avatar modes, sharing.
- Account-owned online seats through 90-second HMAC tickets (V1.1-A2).

V1.1-A and V1.1-A2 are **deployed**; their remaining production browser
checks are open in `docs/ops/v11a-a2-release-verification.md`. V2 does not
treat them as production-verified until that record says so.

What the codebase already gives V2:

- A pure, fuzzed rules engine with replay, `serialize`/`deserialize`, five
  action types, six `GameEndReason` values, and per-player capture counts.
- Zod schemas and a versioned (`v: 1`) WebSocket protocol in
  `packages/shared`. The client parses server frames with a discriminated
  union: an unknown message **type** throws, an unknown **key** is stripped,
  so V2 adds fields, not server message types.
- Drizzle + D1 in `packages/db` with hand-written migrations and Workers tests.
- A `matchNumber` per room that already separates rematches.
- Seat identity that already carries the private `userId` for account seats.

Gaps V2 closes, each owned by the milestone in brackets:

- **[H1]** The Match Durable Object stores only the current game state; there
  is no action log for replay, statistics, or audit.
- **[H1]** Every game and rematch starts with seat A.
- **[H1]** Claim-win's online reason lives only in room state.
- **[H1]** The transport rejects a player's own off-turn resignation, although
  the engine allows it.
- **[H1]** The game Worker has no D1 binding, and idle expiry deletes room
  storage, so an unsaved result would be lost.
- **[X1]** Only Cloudflare Web Analytics page views exist.
- Done during the spec revision: `/legal` now describes the live accounts and
  D1 storage, and `docs/shaxda_brd.md` exists.

---

## 3. V2 Goals

V2 has two goals, in this order (F3):

1. **Retention.** Give players a reason to come back: a record of their games,
   a rating that means something, a leaderboard, and a way to find an opponent
   without a friend online at the same moment.
2. **Revenue.** Test direct sponsorship as a measured pilot sold by the
   founder to vetted Somali businesses. The long-term goal of **$1,000/month**
   is a target, not a forecast; the business arithmetic is in
   `docs/shaxda_brd.md` §7 and summarised in §15.

### Success metrics

X1 measures them with the definitions in
[`v2-contracts.md` §9](specs/v2-contracts.md#9-metrics-dictionary). Targets
are set only after baselines exist (two complete weekly cohorts; Q3).

| Area        | Metric                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Retention   | **Weekly returning players** (primary); D7 and D30 return of new accounts, reported once cohorts mature |
| Activity    | Active browsers and active accounts (approximate; not people, not added together); saved account games  |
| Quick match | Estimated median wait; share of queue joins that reach play; no-shows                                   |
| Revenue     | Booked slot-days; monthly sponsor revenue; qualified views per slot (S2 definition)                     |
| Integrity   | Rated games invalidated; rebuild drift = 0                                                              |
| Cost        | Cloudflare bill per 1,000 completed online games (from the dashboard)                                   |

---

## 4. V2 Scope at a Glance

V2 is organised into **tracks** with lettered milestones. IDs do not collide
with V1 PRD IDs. Status lives in [`docs/specs/README.md`](specs/README.md);
waves are defined in §14.

| Track | Name                         | Milestones                  | Replaces PRD label |
| ----- | ---------------------------- | --------------------------- | ------------------ |
| X     | Measurement                  | X1 (X1a, X1b)               | new                |
| H     | History: persistence, replay | H1, H2, H3, H4              | V1.1-B             |
| R     | Ratings and competition      | R1, R2, R3, R4, R5, R6      | V1.1-C             |
| K     | Quick match                  | K1, K2                      | new                |
| S     | Sponsorship pilot            | S1, S2 (S2-min), S3 (S3a/b) | new; BRD scope     |
| A     | Identity follow-ups          | A3                          | V1.1-A follow-up   |

| ID  | Milestone                       | One line                                                                                     | Wave  | Spec                                          |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------- | ----- | --------------------------------------------- |
| X1  | Product analytics               | X1a: daily pseudonymous beacon, ledger metrics, admin page, cron. X1b: game Worker counters. | 1, 2  | [x1](specs/x1-product-analytics.md)           |
| H1  | Match persistence               | Action log, per-match outbox, ledger rows, fair starting seat.                               | 1     | [h1](specs/h1-match-persistence.md)           |
| H2  | History and match detail        | Owner-only `/history`; `/match/<id>` public if rated, private if friendly.                   | 1     | [h2](specs/h2-history-match-detail.md)        |
| R2  | Rated play rules                | Consent handshake, disclosure, which games count, pair cap.                                  | 2     | [r2](specs/r2-ranked-play-rules.md)           |
| R1  | Rating system                   | Glicko-2 in ledger ingestion order; processor, fence, rebuild; public record.                | 2     | [r1](specs/r1-rating-system.md)               |
| R6  | Ranking integrity               | R6-core: operator CLI, invalidate/rescind, exclusions, audit. R6-detect: advisory flags.     | 2, L  | [r6](specs/r6-ranking-integrity.md)           |
| A3  | Account deletion                | Seven-day grace, time-based cutover, neutral label, 30-day username hold.                    | 2     | [a3](specs/a3-account-deletion.md)            |
| K1  | Quick-match queue               | Account-only hibernating queue, P15 pairing, pre-claimed rated rooms, telemetry.             | 3     | [k1](specs/k1-quick-match-queue.md)           |
| H3  | Replay viewer                   | Engine-driven replay on the match page, for whoever may open the match.                      | 4     | [h3](specs/h3-replay-viewer.md)               |
| H4  | Match statistics                | Derived per-match stats that never block a save; F7 panel.                                   | 4     | [h4](specs/h4-match-stats.md)                 |
| R3  | Leaderboard                     | Public ranking from processed rated events; private rank context.                            | 4     | [r3](specs/r3-leaderboard.md)                 |
| R4  | Profile statistics              | Public record on `/u/<username>` from processed rated events.                                | 4     | [r4](specs/r4-profile-statistics.md)          |
| R5  | Head-to-head and rating history | Private head-to-head card; public rating chart.                                              | 4     | [r5](specs/r5-head-to-head-rating-history.md) |
| S1  | Sponsor placements              | Two pilot slots, immutable creative versions, 60 s takedown for new page loads.              | Pilot | [s1](specs/s1-sponsor-placements.md)          |
| S2  | Sponsor measurement             | S2-min: qualified views, `/go` clicks, reports. Later: token links.                          | Pilot | [s2](specs/s2-sponsor-measurement-reports.md) |
| S3  | Sponsor page                    | S3a: pilot contact page. S3b: dated rate card after a delivered report.                      | Pilot | [s3](specs/s3-sponsor-page.md)                |
| K2  | Queue quality                   | Waiting presence, re-queue, P16 cooldowns.                                                   | L     | [k2](specs/k2-queue-quality.md)               |

---

## 5. Not in V2

Deliberately excluded. Adding any of these requires editing this file first.

- English content, `/en` routes, a language toggle, Paraglide/Inlang (V1.1-D,
  reconsidered after V2).
- AI opponent.
- Seasons, seasonal resets, seasonal leaderboards; rank tiers; achievements
  and badges.
- Chat, friends, followers, direct messages, clans; spectating; tournaments;
  async/correspondence play.
- Real 3D board; app-store wrapper.
- Programmatic ads, ad networks, affiliate links, in-app payments, paid
  accounts, sponsor self-serve checkout, sponsor logins.
- A setting to hide rated games or make a profile private. Friendly games are
  already private to their two players (F2); rated games are public.
- Guest match persistence of any kind (F8).
- A cross-room "one active rated match per account" registry (P10).

---

## 6. Principles and Rule Changes

All V1 principles in `AGENTS.md` and the PRD still apply: engine first,
functional before beautiful, small honest commits, local-first `$0`
development, Zod on every boundary, server authority online, hibernating
Durable Objects, no per-move D1 rows, Somali-only UI.

V2 changes or adds the following rules. Each is applied to `AGENTS.md` and
the PRD in the **first commit of the milestone named**, never earlier.

### 6.1 The game Worker may bind D1 for the ledger and fixed counters (H1, X1b)

Supersedes the V1.1-A2 line "the game Worker gains no D1 dependency".

- The game Worker gets a D1 binding to the same database per environment.
- It may **write** the match ledger (`match`, `match_player`) from the Match
  Durable Object (H1), and **increment** the fixed P13 allowlist of online and
  queue counters in `event_daily` (X1b). Nothing else.
- It never reads anything except its own write results, never reads or
  computes ratings, and has no Better Auth, session validation, cookies, or
  access to `user`, `account`, `session`, or `verification`.
- Local development and tests use Miniflare D1 only.

### 6.2 Ratings are a derived view of the ledger, in ingestion order (R1)

- `match` and `match_player` rows are the immutable ledger.
- One web-Worker processor decides each row once, in ledger ingestion order
  (`seq`, P4), behind a lease and an atomic fence. A full rebuild in the same
  order reproduces the published state exactly; corrections are rebuilds
  (R6).
- Public numbers are processed rated events only (P8).

### 6.3 Sponsorship is allowed as a measured pilot (S1)

Supersedes "no monetization" for V2. `docs/shaxda_brd.md` owns policy, prices,
and operations.

- Direct-sold placements only. A placement loads no ad network,
  programmatic ad, tracking pixel, or third-party script, and its creative is
  hosted by Shaxda. The site's existing Cloudflare Web Analytics beacon,
  disclosed on `/legal`, is not part of sponsorship and is unchanged.
- Every placement is visibly labelled as sponsored in Somali.
- Placements never sit inside the board hit area, never cover game controls,
  never delay a move, and never appear during play, a pending capture, or a
  blocked-player prompt.
- The pilot has two slots, `lobby` and `result` (P14, Q2); an unbooked slot renders nothing; a cancelled booking stops appearing on
  new page loads within 60 seconds, and a card already on screen goes at its
  next refresh.
- No targeting: every viewer of a slot sees the same sponsor for the period.
- Payment is off-platform; the app takes no payment and keeps the agreed
  price only as a note on the booking.

### 6.4 New Durable Objects follow the same cost rules (K1)

The matchmaking queue uses `ctx.acceptWebSocket(...)`, no `setInterval`, no
lifecycle `setTimeout`, and alarms only while someone waits or a handoff is
unfinished, plus (once K2 ships) one for the next expiry of a K2 incident
row (24 hours) or cooldown row. `pnpm check:hibernation` covers it.

### 6.5 The starting seat is fair for every room (H1)

The starting seat is random for a room's first game and alternates on every
rematch, guest rooms included. The client never assumes seat A starts.
`/local` keeps its own rule.

### 6.6 Rated play needs consent; visibility follows it (H1, R2)

- Invite games are friendly by default; rated play needs both players'
  acceptance before play begins; quick match is always rated (F1, P3).
- Rated results and replays are public; friendly matches are private to
  their two players; this is explained before play (F2, P2).
- Play begins at the first accepted non-terminal action. After that,
  resignation or a valid claim is a loss in every phase; an ending before it
  writes nothing (F4, P1).

---

## 7. Architecture Overview

The exact schema, lifecycle, protocol, and jobs are in
[`docs/specs/v2-contracts.md`](specs/v2-contracts.md). This section is the
map.

### 7.1 Services after V2

```txt
Browser (SvelteKit, PWA)
  ├── /local, /online              prerendered, client-only (unchanged)
  ├── /history, /match/<id>, /u/…  SSR; friendly matches private, rated public
  ├── /leaderboard                 SSR, public list edge-cached; private rank context
    ├── /sponsor                     prerendered, static; no session or data (S3)
  ├── /admin/*                     SSR; gated by allowlisted user ids
  └── beacons → /api/analytics/*, /api/sponsor/event; clicks → /go/<bookingId>;
      sponsor cards ← /api/sponsor/active; queue presence ← /api/queue/presence (K2)

Web Worker (shaxda-web)            Better Auth, D1 reads/writes, rating processor,
  entry: generated wrapper         cron dispatcher, admin, R2 sponsor logos
  (fetch + scheduled + RatingsEntrypoint)
        │ identity tickets (HMAC)             ▲ RATINGS hint after a save (RPC)
        │ QUEUE_PRESENCE count (K2, RPC)      │
        ▼                                     │
Game Worker (shaxda-worker)        ticket verification; ledger writes; P13 counters;
                                   token-guarded /ops/* for unsaved matches (H1)
  ├── RoomCoordinator DO           + holdsUnsaved reservations
  ├── MatchRoom DO                 + action log, per-match outbox, ledger write
  └── MatchmakingQueue DO (K1)     hibernating queue, pairs, creates quick rooms

D1 (shaxda-db)                     auth + ledger + ratings + analytics + R6 + sponsor
R2                                 sponsor logos only
```

### 7.2 Data ownership

| Data                                                                    | Owner (migration) | Written by                                     |
| ----------------------------------------------------------------------- | ----------------- | ---------------------------------------------- |
| `match`, `match_player` (ledger)                                        | H1                | Match Durable Object                           |
| `match` statistics fields                                               | H1 (columns)      | Match Durable Object at game over; H4 backfill |
| `match_ops_audit`                                                       | H1                | Operator command (`pnpm match:ops`)            |
| `match_rating`, `match_player_rating`, `player_rating`, processor state | R1                | Web Worker processor and rebuild               |
| Invalidations, exclusions, audit, rebuild log                           | R6                | Operator CLI                                   |
| Pseudonymous activity rows, `event_daily`, `job_state`, `job_fence`     | X1                | Web Worker; P13 counters by the game Worker    |
| `user` deletion columns                                                 | A3                | Web Worker                                     |
| Sponsors, creative versions, bookings                                   | S1                | Admin (web Worker)                             |
| Sponsor viewer rows, daily stats, gap log                               | S2                | Web Worker                                     |

Rules: no table stores one row per move; every list query hits an index added
in the same migration; migrations stay hand-written; the ledger carries no
username or display snapshot (P5).

### 7.3 Compact replay

`{"v":1,"s":"B","a":["P:O3","X:I1","M:O3>O4","C:I5","R:A"]}` — `R:<seat>`
names the resigning seat. A legal game has at most 1,403 actions and 13,922
bytes of canonical JSON (proof E4); typical games are 1–3 KB. The format
freezes when H1 merges ([contracts §2.4](specs/v2-contracts.md#24-compact-replay)).

---

## 8. Track X — Measurement

### X1 — Product Analytics

Spec: [`docs/specs/x1-product-analytics.md`](specs/x1-product-analytics.md).

**Goal.** Measure the V2 success metrics honestly before retention or revenue
claims are made.

- **X1a (wave 1, web only):** a daily beacon that records every browser and,
  when signed in, the account, as unlinked keyed hashes kept 90 days (P12); registrations from
  `username_claim`; ledger metrics (saved games, weekly returning players, D7
  and D30 return) from `match`/`match_player`; `/admin/stats` with raw counts
  beside percentages, start date, freshness, and cohort maturity; the web
  Worker entry wrapper and the one-minute cron dispatcher; `/legal` text that
  says "pseudonymous".
- **X1b (wave 2, after H1):** the game Worker increments the P13 allowlist of
  online counters (§6.1).
- **Not in X1:** Workers Analytics Engine, per-move events, funnels by page,
  third-party analytics, a guest-to-account conversion ratio.
- **Done when** `/admin/stats` shows production numbers with their
  definitions for seven consecutive days.

---

## 9. Track H — History, Persistence, Replay

### H1 — Match Persistence

Spec: [`docs/specs/h1-match-persistence.md`](specs/h1-match-persistence.md).

**Goal.** Every played account-vs-account online game is stored once, as a
server-authoritative ledger row with a replayable compact log, and no result
is lost to a D1 outage or room cleanup.

- Compact action log per match; random-then-alternating starting seat for
  every room; own off-turn resignation accepted.
- Persistable = both seats accounts, play began, game over (P1, F8). Guest
  games and pre-play endings write nothing.
- Terminal state and a per-match outbox entry written in one storage put;
  alarm-driven retries for 72 h, then `stalled` and retained (P17); idle
  expiry keeps unsaved rooms and their codes; at most 3 unsaved per room.
- One D1 batch per match, idempotent on the room instance and match number,
  with a payload hash that turns a conflicting duplicate into a stall.
- Room fields for the rated request and consent (R2 adds the handshake), and
  `matchStatus.save` for the result overlay.
- Operator command to list, retry, or discard (audited) unsaved matches.
- **Done when** two signed-in accounts finish a game on preview, exactly one
  row exists whose replay decodes to the final state, and a rematch saves a
  second row with the other starting seat.

### H2 — Match History and Match Detail

Spec: [`docs/specs/h2-history-match-detail.md`](specs/h2-history-match-detail.md).

**Goal.** Players can find, open, and share their games; privacy follows the
rated flag.

- Owner-only `/history` of all saved games, labelled rated or friendly, with
  filters, cursor pagination, and a private summary.
- `/match/<id>`: rated matches public with names in Open Graph; friendly
  matches visible only to their two players (unknown-id 404 for everyone
  else, `no-store`, generic metadata).
- Current usernames from the account row; pending or deleted accounts show
  the neutral label (P5).
- Result overlay links to the saved match when `matchStatus.save` says so.
- **Done when** both players of an H1 match can find it and open it, and a
  non-participant cannot open a friendly one.

### H3 — Replay Viewer

Spec: [`docs/specs/h3-replay-viewer.md`](specs/h3-replay-viewer.md).

**Goal.** Watch a saved game move by move on the real board, for whoever may
open the match. All frames stay in memory (≈ 1.1 MB for the longest legal
game, proof E4). Controls, deep links with clamping, opt-in sound, reduced
motion. **Done when** a full game replays correctly on a real entry-level
Android phone.

### H4 — Match Statistics

Spec: [`docs/specs/h4-match-stats.md`](specs/h4-match-stats.md).

**Goal.** Derive Shaxda statistics from the log once, store them per match,
and show the F7 panel. A derivation error never blocks a save (P21); a nightly, resumable backfill
fills missing or failed rows. **Done when** every stored match has
valid stats or a reported reason, and the panel renders where the match may
be opened.

---

## 10. Track R — Ratings and Competition

### R2 — Rated Play Rules

Spec: [`docs/specs/r2-ranked-play-rules.md`](specs/r2-ranked-play-rules.md).

**Goal.** Players choose rated play knowingly, and farming stays unattractive.
Consent handshake with a versioned Somali disclosure (P3); old cached clients
stay friendly; rematches are rated only when both votes are rated votes. Pair cap: a game counts only if fewer than 3 of the pair's earlier processed
rated games ended in the 24 hours before it (P7); cap-skipped games stay
public, labelled "rating not counted", and invalidated ones "rating
removed". `RATED_PLAY_ENABLED` off refuses new consent. Explanation on
`/learn`. R2 and R1 activate together.

### R1 — Rating System

Spec: [`docs/specs/r1-rating-system.md`](specs/r1-rating-system.md).

**Goal.** A Glicko-2 rating per account that a full rebuild reproduces
exactly. Pure `packages/rating` with the P18 defaults; processor in ingestion
order with a lease and an atomic fence; the public record (count, W/L/D,
streaks, form, peak) maintained in the same event batch; corrections by
maintenance rebuild and one-batch swap; confirmed rating change on the result
overlay, with no estimate. **Done when** two accounts play a rated game on
preview, both ratings move by the expected amounts, and a rebuild shows zero
drift.

### R6 — Ranking Integrity

Spec: [`docs/specs/r6-ranking-integrity.md`](specs/r6-ranking-integrity.md).

- **R6-core (wave 2, before rated public play):** operator CLI to inspect,
  verify, invalidate, rescind, exclude, include, rebuild, and check
  consistency; plan/apply with a digest; append-only audit with
  single-operator attribution.
- **R6-detect (later):** advisory, versioned detectors and `/admin/flags`;
  never automatic punishment.

### R3 — Leaderboard

Spec: [`docs/specs/r3-leaderboard.md`](specs/r3-leaderboard.md).

**Goal.** A public ranking that rewards skill over volume. Eligibility P19,
order by rating then `board_key` (P20), top 100 then keyset pages, a private
"your rank" context, a truthful empty state, and session-independent public
HTML before any shared cache.

### R4 — Profile Statistics

Spec: [`docs/specs/r4-profile-statistics.md`](specs/r4-profile-statistics.md).

**Goal.** Make `/u/<username>` a shareable public record: rating, rank,
W/L/D, streaks, form, peak, Shaxda aggregates, and the list of rated matches —
all from processed rated events (P8, P9). Friendly games never appear
publicly.

### R5 — Head-to-Head and Rating History

Spec: [`docs/specs/r5-head-to-head-rating-history.md`](specs/r5-head-to-head-rating-history.md).

**Goal.** A private head-to-head card for a signed-in viewer (all saved games
between the two, rated and friendly shown apart), a public rating chart from
processed events with an honest peak marker, and a form strip on
leaderboard rows.

---

## 11. Track K — Quick Match

### K1 — Quick-Match Queue

Spec: [`docs/specs/k1-quick-match-queue.md`](specs/k1-quick-match-queue.md).

**Goal.** A signed-in player finds an opponent without sharing a link. One
global hibernating queue; queue tickets with a rating snapshot; pairing P15
(both windows must admit the pair; after two minutes an account's own
window, new and provisional accounts included, admits any gap, F6); entering states and records rated, public consent (P3);
pre-claimed rated rooms; 45 s no-show grace; minimum telemetry through P13
counters. **Done when** two accounts on separate preview devices queue, start, and
finish a rated game without sharing anything, and the no-show and cancel
paths recover; the community beta at scheduled play windows follows as an
operational step.

### K2 — Queue Quality

Spec: [`docs/specs/k2-queue-quality.md`](specs/k2-queue-quality.md).

**Goal (later, with evidence).** Waiting presence, explicit re-queue from a
quick result, and P16 cooldowns after verified pre-play abandonment. It does
not change K1's pairing.

---

## 12. Track S — Sponsorship Pilot

The BRD governs policy, prices, fulfilment, and claims. Specs:
[S1](specs/s1-sponsor-placements.md), [S2](specs/s2-sponsor-measurement-reports.md),
[S3](specs/s3-sponsor-page.md).

- **S1:** the two pilot slots (§6.3), 7/14/30-day bookings with overlap
  rejected in the database, immutable creative versions, first-party logos,
  admin with preview, a 60 s takedown for new page loads; a booking cannot be
  confirmed unless all four S2-min health checks pass.
- **S2-min (with S1):** qualified views (≥ 50 % visible for 1 s, at most one
  per browser per 30 minutes), first-party `/go` clicks, daily rollup, report
  and CSV with definitions and a gap log. Token links later.
- **S3a:** a Somali contact page with no numbers or prices. **S3b:** a dated
  rate card after a first delivered report.
- **Done when** real bookings for both slots are sold, each shown for its
  period, removed on time, and reported with published definitions.

---

## 13. Track A — Identity Follow-ups

### A3 — Account Deletion

Spec: [`docs/specs/a3-account-deletion.md`](specs/a3-account-deletion.md).
Activation is Q1.

**Goal.** Self-service deletion that keeps opponents' histories intact:
seven-day cancelable grace, then a scrubbed tombstone, with every username
held 30 days (F5). At request the web Worker stops minting tickets (P11).
Ledger rows and rating rows stay; the account renders as the neutral
label; profile 404; excluded from the leaderboard.

---

## 14. Build Waves

A wave's gate must pass in preview before its production enablement.

| Wave  | Scope                                                                                                        | Gate                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `/legal` fix; this revision; proofs E1–E4.                                                                   | Contracts frozen; proofs recorded.                                                                                                                                                                                         |
| 1     | H1, H2, X1a.                                                                                                 | Account games save durably, including across rematch and D1 outage; both players see private history; stalled saves listable; real-game e2e green. All saved games are friendly (no consent UI yet), so nothing is public. |
| 2     | R2 consent + policy, R1, R6-core, X1b; A3 before production enablement if Q1 = yes.                          | Consent works on new clients and fails safe on old ones; M1–M10 pass; rebuild zero drift; invalidate/rescind rehearsed on preview.                                                                                         |
| 3     | K1 (with minimum telemetry), then a community beta at scheduled play windows.                                | Two real devices find, start, and finish a game; no-show recovery; waits measured; an empty queue has no alarm.                                                                                                            |
| 4     | H3, H4, R3, R4, R5 (H3 and H4 may start any time after wave 1).                                              | Replays and stats verified; public records and ranks agree; E5/E6 recorded; private data absent from every public path.                                                                                                    |
| Pilot | BRD approved (Q5) → S1 (P14) + S2-min → S3a; needs ≥ 30 days of X1 data. S3b after a first delivered report. | No paid placement without a working report, approved creative, owner, and a 60 s takedown.                                                                                                                                 |
| Later | R6-detect, K2, S2 token links, S3 PDF, more sponsor surfaces.                                                | Evidence that the enhancement is needed; frozen contracts unchanged.                                                                                                                                                       |

Evidence gates for product decisions (owner: founder): judge early return
play only after two complete weekly cohorts, with raw counts beside
percentages; set quick-match wait and completion targets from Q3 before the
beta; expand sponsor inventory only after delivery, player feedback, and
renewal interest.

After the freeze, a contract changes only through an explicit
contract-change commit that updates `v2-contracts.md`, the register, and
every consuming spec together.

---

## 15. Revenue Model

`docs/shaxda_brd.md` owns the model; this is the summary.

- **Inventory:** two pilot slots, `lobby` and `result` (P14); `home` and
  `learn` only after the BRD's evidence gates.
- **Periods and prices:** 7, 14, and 30 days at $80, $140, and $250 per slot
  — **hypotheses** until the founder approves prices (Q5).
- **Arithmetic:** `monthly revenue = Σ(slot monthly-equivalent price × sold
fraction) − make-goods`.

| Scenario                       | Slots | Price / 30 days | Sold  | Monthly revenue |
| ------------------------------ | ----- | --------------- | ----- | --------------- |
| Pilot, typical fill            | 2     | $250            | 75 %  | $375            |
| Pilot, fully sold              | 2     | $250            | 100 % | $500            |
| Four slots, typical fill       | 4     | $250            | 75 %  | $750            |
| Four slots, fully sold         | 4     | $250            | 100 % | $1,000          |
| Four slots at the needed price | 4     | ≈ $333          | 75 %  | ≈ $1,000        |

So the pilot alone cannot reach $1,000 a month at these prices; reaching it
needs more inventory after the evidence gates, or prices justified by
measured delivery. Exposure differs by slot. No market CPM figure and no
modelled audience number is used in V2 copy or sales; public claims follow
the BRD's truthful-claims rule.

---

## 16. Decisions

Decisions live in the register in
[`docs/specs/README.md`](specs/README.md#decision-register): F1–F8 are
founder-confirmed, P1–P21 are defaults that stand until the founder
overrides them, and Q1–Q5 are the only open questions. The earlier decision
log maps as follows:

| Earlier ID | Earlier decision                                                      | Now                                                                    |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1         | V2 = X, H, R, K, S tracks (+ A3); no English or AI                    | Unchanged scope; F8                                                    |
| D2         | Invite rooms start as rated, with a friendly option                   | Superseded: friendly by default, rated by mutual consent (F1, P3)      |
| D3         | Several slots, 7/14/30-day periods, founder-vetted, off-platform      | Pilot of two slots, 7/14/30 days (P14); BRD                            |
| D4         | Only account-vs-account games persisted                               | F8                                                                     |
| D5         | Game Worker D1 for ledger writes only                                 | §6.1, plus the P13 counters                                            |
| D6         | Glicko-2, ledger-derived, web-Worker processor                        | §6.2; ingestion order P4; defaults P18                                 |
| D7         | Milestone IDs replace V1.1-B/C labels                                 | Unchanged                                                              |
| D8         | Match pages public; no history hiding                                 | Superseded: rated public, friendly private (F2, P2)                    |
| D9         | Random first starting seat, alternating on rematch                    | §6.5, every room                                                       |
| D10        | Exact D1 daily rollups with salted hashes                             | Pseudonymous, approximate activity plus exact ledger metrics (X1, P12) |
| D11        | First-party sponsor creatives, no scripts, no targeting               | §6.3                                                                   |
| D12        | No seasons, tiers, achievements, chat, spectating, tournaments, async | F8, §5                                                                 |

---

## 17. Open Questions

Only the register's Q1–Q5 remain open, each tied to what it blocks: Q1 (ship
A3 in V2, and when), Q2 (pilot surfaces and local `result`), Q3 (current
players, play times, budget), Q4 (Somali glossary review), Q5 (prices,
currency, contact, content policy, `/legal` contact).

---

## 18. Document Maintenance

- Spec status lives in `docs/specs/README.md`; a milestone is marked
  `shipped@<date>` there by the commit that verifies it.
- A spec may refine this brief; it may not widen it without editing this file
  first.
- Rule changes in §6 land in `AGENTS.md` and the PRD in the first commit of
  the milestone that needs them.
- `docs/shaxda_brd.md` owns pricing, sponsor policy, and sponsor operations.
- `docs/specs-revision-plan.md` is a working record of the 2026 spec
  revision, not a source of truth.
