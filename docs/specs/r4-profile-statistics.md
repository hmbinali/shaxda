# R4 — Profile Statistics (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; specification only. R4 is not active or shipped. |
| Brief | `docs/shaxda-v2.md` §10 (R4), §5, §7.2, §16 D8 |
| Depends on | H2 public match/history reads; H4 versioned match stats and backfill; R1 confirmed rating events; R3 shared public-rank query; R2 competition status |
| Workspace | `r4-profile-statistics` (may share a review flow with R3) |
| Unblocks | R5 head-to-head and rating-history presentation |
| Touches when implemented | `packages/db` read queries, `web/src/routes/u/[username]`, `packages/i18n`, profile components, tests |

This document refines the R4 brief without activating the milestone. The V2
brief wins on scope and order, the PRD on the stack, and `docs/shaxda_game.md`
on game rules. H1/H2/H4/R1/R2/R3 are still draft contracts in this checkout;
their proposed tables and helpers below must be reconciled with merged code
before implementation. In particular, the H2 draft predates R2's aborted-match
classification and names some H1 columns differently. Do not silently adapt
those conflicts in a profile query.

---

## 1. Outcome and boundaries

The existing public `/u/<username>` page becomes a shareable record of a
player's account games, current skill standing, and Shaxda-specific play. A
visitor can see the record without signing in. The owner can reach their full,
private `/history` from the same page.

### Must

1. Keep the V1.1-A profile URL, alias redirect, current username/avatar,
   canonical metadata, and share action. Add mobile-first **overview**, **last
   10 matches**, and **Shaxda stats** sections.
2. Show current rating with its R1 provisional marker, peak rating, R3 global
   rank or a truthful unranked state, competitive games, W/L/D, win rate,
   current and best streak, and five-result recent form.
3. Show each recent opponent's current public profile when available, result,
   date, confirmed rating delta or honest pending/unrated state, and a link to
   the public match and replay. Show `/history` only when the viewer owns the
   profile; the route remains owner-only.
4. Aggregate H4 stats into total captures, captures per game, jare events,
   repeated jare events, average duration, fastest win, wins as starter and
   non-starter, wins with and without first advantage, comeback wins, and draw
   counts by type. Never turn missing or unsupported stats into zero.
5. Reuse R3's exact rank query and R1's rating display rules. Do not infer rank
   from rounded rating or position in the first leaderboard page.
6. Keep every public loader result free of permanent user ids, email, provider
   identity, session data, private tickets, room codes, and raw replay/stats JSON.

### Should

- A challenge action may use the existing invite-room flow and copy its link.
  It must require the same Turnstile/room creation path as normal online play.
  The button is omitted if that flow cannot be reused without a new protocol.

### Out of scope

Style labels, private profiles, followers, head-to-head comparisons, rating
history charts, tiers, seasons, achievements, guest/local match records,
matchmaking, changes to rating arithmetic or rating eligibility, and new game
rules. R4 adds no match-ledger writer and no per-move rows.

---

## 2. Record definitions

R4 uses **competitive account matches** for its general record. These are
persisted, terminal account-versus-account matches with R2
`competition_status = competitive`, whether their rating event was processed,
pending, or skipped as friendly/pair-capped/daily-capped. R2 `aborted` rows may
remain visible in the recent match list with a neutral label, but they do not
become a win, loss, draw, streak result, fastest win, or Shaxda aggregate.
Guest-involved and local games have no ledger row. This is the draft choice in
R4-D1; confirm it with the founder before implementation.

| Value | Source and exact rule |
| --- | --- |
| Games and W/L/D | Count competitive `match_player.result` rows for this account, including friendly and rating-skipped games. `games = wins + losses + draws`. Never count an R2 aborted row as a loss/win despite the engine's terminal state. |
| Win rate | `wins / games × 100`, displayed to a whole percent; for zero games show an unavailable mark, not `0%`. Draws remain in the denominator. |
| Current streak | Consecutive newest competitive results of the **same** kind (`win`, `loss`, or `draw`), ordered by `(ended_at DESC, match.id DESC)`. A friendly or cap-skipped result participates; an aborted row is ignored. Show result kind and length. Zero games has no streak. |
| Best streak | Longest consecutive **win** run across the same ordered competitive results; `0` before any win. Draws/losses break it. The current streak can therefore be a draw/loss while best streak remains a win run. |
| Recent form | Up to five newest competitive results in time order, oldest to newest. Use H2's form component/copy so the marks and accessibility labels agree. |
| Rating | R1 `player_rating.rating` rounded only for display; R1 effective RD at one captured `asOf` decides the `?` marker. No row after zero rated games means “not rated yet”, not a fabricated 1500 current rating. |
| Peak | R1 `peak_rating` rounded for display, only when a `player_rating` row exists. The R1 initial 1500 floor applies even if later ratings fall below it. |
| Rank | `readPublicRankForUser(db, userId, asOf)` from R3. Show a number only when R3's effective-RD, rated-game-count, recent-activity, exclusion, and current-profile tests all pass. Otherwise show “not ranked yet”; do not publish operator exclusion details. |

R3's leaderboard W/L/D and streak are **confirmed rated events only** in its
current draft. R4's broader record is explicitly labelled as all competitive
account games. The page places rating/rank next to a short explanation that
only confirmed rated games affect those values. If R3-D1 changes, update the
copy and shared helpers before R4 ships; do not silently relabel either count.

### Recent-match card

Read the newest **10 persisted matches**, including R2-aborted rows if any,
using H2's indexed `(user_id, ended_at, match_id)` order and its current-user
opponent projection. A renamed opponent links to their current username;
a deleted opponent uses H2's neutral label with no link and no historical
username leak. Each card has a link to `/match/<opaque id>`; the replay action
links to H3's viewer on that page, never to a second replay implementation.
Use H2's stored end reason for any aborted label.

For `rating_status = processed`, display
`round(rating_after) - round(rating_before)` with an explicit plus/minus/zero
sign. For `pending`, show “rating being calculated”; for `skipped` or unrated
friendly, show “no rating change” without a numeric zero delta. If a processed
row has missing before/after values, report a data error and omit the delta;
never invent zero. Match dates use H2's date formatter and machine-readable
`<time datetime>`.

The owner link uses a server-side comparison of the resolved profile's private
id with `locals.user?.id`. Only `isOwner: boolean` reaches page data. Signed-out
and other-account viewers never receive the `/history` owner action. `/history`
itself still enforces its own session check.

---

## 3. Shaxda aggregate contract

The source is H4's validated `MatchStatsV1`, stored as `match.stats_json`, plus
H1 `match`/`match_player` fields. R4 does **not** replay the action log on a
profile request. Select the seat's H4 values by `match_player.seat`, not by a
username or historical avatar. All general Shaxda aggregates use the same
competitive-match set as §2; rating status does not filter them.

| Display | Calculation |
| --- | --- |
| Total captures | Sum H4 `capturesMade` over included matches. Reconcile against H1 `match_player.captured` during verification. |
| Average captures per game | Total captures divided by included competitive games, including zero-capture games; show one decimal. |
| Jare / repeated jare | Sum H4 `jareEvents` and `repeatedJareEvents`; repeated is a subset, never an extra capture count. |
| Average duration | Mean of `ended_at - started_at` for included games; use H2's duration formatter. Wall time includes connection delays, so label it as game duration. |
| Fastest win | Minimum nonnegative duration among included **normal board wins** (`opponentBelowThree` or `opponentCapturedAll`), excluding resignations and online abandoned/idle claims. Show unavailable if none. This is R4-D2, pending founder confirmation. |
| Wins as starter / non-starter | Count included wins where `match_player.seat` equals / differs from H1 `match.starting_seat`. These two counts sum to total wins. |
| Wins with / without first advantage | Count included wins where `first_advantage_seat` equals / differs from the player's seat. If advantage was never decided (`NULL`), show a separate “undecided” count so no win disappears from the total. |
| Comeback wins | Count included wins whose own H4 `comeback` is true, using H4's two-capture-deficit definition. Do not infer a comeback from final score. |
| Draws by type | Group included draws by the authoritative engine `end_reason`: `bothBlocked`, `forcedJareSpaceMaking`, and `drawTermination`. The last engine reason covers repetition and the 80-turn clock in H1; do not claim that these are separately known unless H1 later stores an explicit subtype. The grouped sum equals draw count. |

For zero competitive games, display zero counts and dashes for averages and
fastest win; no empty denominator is formatted as `NaN` or `0.0`. If any
included match has `stats_json = NULL`, malformed JSON, or an unsupported
version, show the independent overview/rating/recent matches but mark the
Shaxda section as incomplete, with the number of matches lacking stats. Do not
publish partial totals/averages as a lifetime record. H4 backfill is a release
prerequisite for the complete R4 page. A server diagnostic may include an
opaque match id but no PII or replay body. Rating data can likewise be pending
without blocking the general record.

H4's future version must have an explicit adapter or a migration/backfill
before R4 totals include it. Never reinterpret a version-1 jare or comeback
counter under changed rules.

---

## 4. Read path, privacy, and cost

Extend the existing `/u/[username]` SSR loader. Resolve the username with
`resolveProfile` first, preserving its 404 and `302` alias redirect to the
current canonical path. The DB layer may return the resolved user id in a
**server-only** result alongside `PublicProfile`; the loader passes it to
`readProfileRecord`, `readRecentProfileMatches`, and R3's
`readPublicRankForUser`, then strips it before returning page data. The
current avatar and username always come from the live account row, not an H1
snapshot. Capture `asOf` once and pass it to both rating and rank reads.

Suggested API shapes, to reconcile with merged contracts:

```ts
readProfileRecord(db, { userId, asOf }): Promise<{
  overview: PublicOverview;
  shaxda: ShaxdaAggregate | { kind: "incomplete"; missingMatches: number };
}>;
readRecentProfileMatches(db, { userId, limit: 10 }): Promise<PublicMatchCard[]>;
readPublicRankForUser(db, userId, asOf): Promise<number | null>; // R3 owns
```

The public DTO contains rounded/display-safe rating values, counts,
durations, result/status enums, current public opponent profiles, opaque match
ids, and `isOwner`. Do not spread raw D1 rows or `locals.user` into it. Unit
tests stringify both `load` output and rendered HTML, and search for email,
provider ids, permanent user ids, identity tickets, room codes, private
session fields, replay payloads, and raw `stats_json`.

Reuse H1's owner index for the 10-row recent query. Overview/stats reads may
walk that **one player's** indexed match range, joining `match` and
`match_player` by their keys; no request may scan the full ledger. Compute
exact best win streak in ledger order rather than reusing H2's 20-row-capped
summary. Add an index in an R4 hand-written migration only if the merged
schema/query plan proves one is missing. Run `EXPLAIN QUERY PLAN` for a new
account, an account with hundreds of matches, and an account with thousands;
record D1 rows read and p95 response time in preview. If indexed on-demand
aggregation is too costly, introduce a rebuildable per-player projection in
the **web Worker** with an idempotent cursor over H1/R1 events and a bounded
backfill. Verify it against the ledger before publication. The game Worker
still writes only `match` and `match_player` and never reads auth tables.

Do not add public edge caching to the profile just because it is public: the
root layout and `isOwner` are session-dependent. Use H2's no-shared-cache
approach until the complete route output is proven session-independent as R3
requires for its leaderboard. A D1 error is an error, never a zero-games
profile. Alias redirects remain `no-store`; canonical URL and Open Graph tags
use the current username only.

---

## 5. Page behavior and Somali copy

Keep the existing profile header, avatar, canonical metadata, and share
button. Put overview first, recent matches next, and Shaxda stats last. The
10 cards fit a narrow phone without horizontal scrolling. Use semantic
headings and a compact definition list or small grid for counts. Dates and
durations have text labels; rating changes do not rely on color alone.
Every result chip has a screen-reader word, not only a letter. A zero-game
profile has a clear Somali empty state and still offers profile sharing.

Use `packages/i18n` for all visible copy. Reuse H2/H4/R1/R3 terms once the
founder confirms the pending Somali terminology in `shaxda-v2.md` §17. Write
copy that distinguishes **all competitive account games** from **confirmed
rated games**. The current rating and rank retain R1/R3 provisional and
eligibility explanations, but the public page reveals no R6 moderation reason.
Do not show a fake rank, a fake 1500 current rating, or a numeric rating delta
for a pending/skipped result.

The optional challenge action must preserve the invite room's existing
privacy, identity, and Turnstile behavior. It must not automatically send an
invite to the profile owner, claim the owner is online, or bypass room consent.

---

## 6. Verification and rollout

### Data and Workers tests

- Zero games: empty recent list, no current rating/peak/rank, zero count fields,
  unavailable averages and fastest win. A friendly-only account has a W/L/D
  record but no rating/rank.
- Rated, friendly, cap-skipped, pending, and aborted fixtures: R4 general
  counts and Shaxda stats follow §2; R3 rating/rank still use confirmed rated
  events. Processed deltas equal rounded-after minus rounded-before.
- A long result sequence (> 20) proves exact best win streak; newest draw/loss
  streak and five-result form agree with the ledger. Equal `ended_at` values
  use `match.id` as the tie-break.
- H4 golden matches prove each aggregate equals the sum of seat-keyed stats;
  starter and first-advantage win partitions add up; draw-type counts add to
  all draws; missing/unsupported stats produce an incomplete state, not
  partial numbers.
- R3 eligible, provisional, inactive, and excluded players have exactly the
  same rank or unranked state as `/leaderboard` at the same `asOf`.
- A changed username/alias resolves and links to the current profile. A
  deleted opponent has no link or old username. A deleted profile itself
  follows V1.1-A/A3 resolution rules and never leaks an account row.

### Web and privacy tests

- Loader tests cover signed-out viewer, owner, another signed-in viewer,
  missing account, alias redirect, D1 failure, and recent list of more than
  10 matches. Only the owner sees the `/history` action; `/history` separately
  rejects a non-owner.
- Render at mobile and desktop widths; keyboard and screen-reader checks cover
  result, rating movement, empty/incomplete states, share, match/replay links,
  and reduced motion. Existing profile metadata/sharing tests keep passing.
- Inspect serialized page data and HTML for PII/private ids, including an
  owner request. Confirm a public response is not shared-cacheable while it
  contains `isOwner` or parent-layout session data.
- Query-plan tests show an indexed owner range and keyed joins, never a full
  `match_player` scan. Preview measurements cover new and prolific accounts.
  One end-to-end account game should appear in both profiles with consistent
  opposing results, stats, match links, and confirmed or pending rating.

Implementation runs `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:worker`, `pnpm build`, and relevant `pnpm test:e2e` cases;
`pnpm check:e2e-isolation` stays green. These commands use local fixtures and
Miniflare D1. A spec-only edit needs formatting, link, and consistency checks,
not an application build.

### Implementation order

1. Reconcile merged H2/H4/R1/R2/R3 interfaces, competition semantics, H4
   backfill completeness, and founder decisions below. Record any changes.
2. Add public profile record queries and tests against the ledger; measure
   indexed on-demand aggregation. Add a projection only if measurements require
   it, with rebuild/diff and explicit migration/backfill.
3. Extend the profile loader with server-only identity and privacy tests.
4. Add Somali copy and overview, recent-match, and stats UI with mobile and
   accessibility coverage; reuse H2/H4/R3 display primitives.
5. Verify preview with real persisted account games, zero-game and prolific
   accounts, alias/deleted-opponent cases, delayed ratings, stats gaps, and
   owner/non-owner session responses. Apply any migration/backfill explicitly.
6. Roll out behind the normal web deployment path. Recheck profile share
   metadata, D1 read cost, incomplete-stats count, and rank consistency. A
   rollback hides the new sections without deleting ledger or rating state.

R4 is done when a player can share a canonical public profile showing their
truthful record, the last 10 account matches, and complete H4 statistics;
owner-only history remains private; rank agrees with R3; and local checks plus
preview privacy/cost verification pass. A saved draft is not shipment.

---

## 7. Decisions to confirm

| ID | Decision | Draft treatment |
| --- | --- | --- |
| R4-D1 | Which games enter the public W/L/D and Shaxda totals? | All persisted competitive account matches, rated and friendly; exclude R2-aborted rows from competitive totals but show them neutrally in recent matches. Pending founder answer. |
| R4-D2 | What counts as the fastest win? | Shortest elapsed normal board win, excluding resignation and abandoned/idle claims. Pending founder answer. |
| R4-D3 | Does best streak mean best win streak? | Yes; current streak can be a win, loss, or draw run, while best is a win run. Confirm during copy review. |

These decisions affect labels and aggregate tests. They do not reopen the V2
R4 scope, R3 rank eligibility, R1 arithmetic, or H4 event definitions.
