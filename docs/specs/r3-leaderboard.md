# R3 — Leaderboard (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; specification only. R3 implementation waits for merged and activated R1/R2. |
| Brief | `docs/shaxda-v2.md` §10 (R3), §7.1–7.2, §14 |
| Depends on | R1 rating processor and `player_rating`; R2 confirmed rated-play policy; existing public profile and session contracts |
| Workspace | `r3-leaderboard` (may share a review flow with R4) |
| Unblocks | R4 public profile rank, R5 leaderboard form reuse, R6 exclusion tools |
| Touches when implemented | `packages/db` migration and queries, web Worker routes, `packages/i18n`, navigation, tests |

This spec refines the V2 R3 brief. It does not mark R3 active or shipped. The
H1/R1/R2 specs in this checkout are drafts; names and columns below are
proposed interfaces to reconcile with the merged schema before implementation.
`docs/shaxda-v2.md` wins on V2 scope, the PRD on the stack, and the game rules
document on play. R3 does not change a match outcome or rating calculation.

---

## 1. Outcome and scope

A visitor can browse a public, skill-ordered leaderboard, including players
beyond the first 100. A signed-in player can find their own standing and nearby
players without paging through the whole list. A provisional, inactive, or
excluded player sees why they have no public rank.

### Must

1. Add `/leaderboard` as a Somali, mobile-first SSR page with public rows for
   rank, current avatar, current username, whole-number rating, confirmed rated
   games, rated W/L/D, and current rated-game streak.
2. List only players with effective RD **≤ 110**, at least **10 confirmed rated
   games**, a confirmed rated match in the preceding **90 days**, and
   `player_rating.excluded = false`. Only complete accounts with a current
   username appear. Use the R1 effective-RD function, not stored RD alone.
3. Show the top 100 and provide forward pagination for eligible players beyond
   rank 100. Ranking and pagination use one deterministic order.
4. For a complete signed-in account, show a sticky “your rank” card and an
   “around you” strip containing up to three eligible players above, the
   viewer, and up to three below, even far beyond the top 100. For an
   ineligible viewer, show a specific reason and no invented rank or neighbor
   strip.
5. Expose one shared `readPublicRankForUser` query for R4. The profile rank and
   the leaderboard must use the same eligibility and ordering rules.
6. Keep public leaderboard HTML/data edge-cacheable for about 60 seconds while
   the signed-in context remains private and uncached. A newly eligible player
   appears on a normal immediate-processing path within one minute of the
   qualifying match; delayed R1 processing is shown as pending elsewhere, not
   as a fake rank.
7. Add the indexes and query-plan checks needed to avoid full table scans on
   leaderboard requests. If measured live reads cannot meet the latency gate,
   use the V2-approved materialized snapshot fallback in §5.

### Should

- A separately labelled “most active this week/month” list, based on confirmed
  rated games in the chosen period. It is not a second rating leaderboard and
  does not change rank or eligibility. Ship it only after the Must path is
  measured and complete.

### Out of scope

- Seasons, tiers, friends filters, weekly rating boards, achievements, and
  alternate skill scores.
- Rating arithmetic, result policy, pair caps, matchmaking, suspicious-pattern
  detection, exclusion administration, and invalidation tools (R1/R2/K1/R6).
- R4 profile statistics, rating history, head-to-head, and guest rankings.
- A public list of private email, provider identity, permanent user ids, or
  deleted-account username snapshots.

---

## 2. Ranking contract

The source of truth for rating is R1 `player_rating`, which has at most one
current row per account. A rating event counts only when its match has
`rating_status = processed`; `match.rated = true` by itself is an intent, not a
confirmed rated result. A skipped friendly, aborted, pair-cap, or daily-cap
match does not increase rated-game count or change a rated streak. A later
confirmed rated event continues or breaks the streak according to its result.

| Rule | Exact treatment |
| --- | --- |
| Rating order | Sort by **full-precision** `player_rating.rating DESC`, then stable opaque `user_id ASC`. Do not sort by rounded display values, username, game volume, or RD. |
| Rank | One-based ordinal position in that order among eligible accounts. Every eligible account has a unique position; equal full-precision ratings use the user-id tie break. The UI may show the same rounded number on adjacent rows. |
| RD boundary | R1 effective RD at one server-captured `asOf` time must be `≤ 110`. Exactly 110 qualifies. Inactivity can make a previously ranked account provisional without a new match. |
| Game-count boundary | `player_rating.rated_games ≥ 10`; exactly 10 qualifies. The count equals processed W/L/D events. |
| Activity boundary | `last_rated_at ≥ asOf − 90 × 86,400,000 ms`; exactly 90 days qualifies. Use UTC instants, not calendar dates or the last friendly game. |
| Exclusion | `excluded = true` removes a player from public rows, rank counts, neighbor rows, and profile rank. R6 will own who changes this flag. |
| Profile | Join the current `user` row for username/avatar. Missing user or null username is ineligible, regardless of a historical snapshot. A rename changes the link/label, not the rating order. |

Capture `asOf` once per public or private read and pass it to every eligibility
calculation in that response. Evaluate the R1 whole-day inactivity adjustment
against that instant. Do not persist a stale `isEligible` flag as authority.
The first eligible rated event can be the tenth game, but it need not make RD
small enough; explain those requirements separately in the UI.

For R3, W/L/D and the current streak are **confirmed rated matches only**.
The streak is the run of the newest `win`, `loss`, or `draw` result in R1's
global `(ended_at, match.id)` event order; draws form their own run. This is a
leaderboard statistic and may differ from H2's all-competitive-match history
summary. A skipped event leaves the rated streak unchanged. The copy labels
the numbers as rated-game results so the distinction is visible.

---

## 3. Derived statistics and database contract

R1 provides `player_rating` with `user_id`, full-precision `rating`, `rd`,
`volatility`, `rated_games`, `last_rated_at`, and `excluded`. R2 supplies the
confirmed `rating_status` and authoritative seat result. R3 adds a small
derived `leaderboard_stats` projection keyed by `user_id`:

| Column | Meaning |
| --- | --- |
| `user_id` | Opaque PK; never sent to public clients. |
| `rated_wins`, `rated_losses`, `rated_draws` | Nonnegative integer counts of processed events for this seat. Their sum must equal R1 `rated_games`. |
| `streak_kind`, `streak_length` | Newest processed result kind and its exact positive run length; null/zero before the first processed event. |
| `last_match_id` | Last processed event in R1 order, for idempotence and rebuild checks. |

Extend R1's **same guarded event batch** to update each player's projection
when a match becomes `processed`. A skipped or still-pending match changes
neither projection. Do not add a second asynchronous consumer that can lag
behind the rating row and publish mixed states. If the implementation can
prove an equally atomic read from existing R1 data within the latency gate,
it may omit this table and record the measured query plan in the R3 review.
No game-Worker write or per-move row is added.

Backfill the projection by replaying processed rating events in R1 order, in
bounded batches. The R1 dry-run rebuild/diff is extended to compare counts,
streak, and last event alongside rating state. A mismatch blocks publication
or triggers the guarded R1 rebuild path; R3 never edits the immutable match
ledger to repair a display count. R6 invalidation later rebuilds this
projection with ratings. Account deletion removes the public row through the
current-user join; any private opaque ledger identity follows A3's policy.

Add a covering index for the public order and filters on `player_rating`, with
`excluded` first and full-precision rating descending plus `user_id` for stable
keyset reads; include the eligibility inputs (`rated_games`, `last_rated_at`,
`rd`, `volatility`) in the index where SQLite's planner benefits. Use the
existing indexed user-id join for profile data. The R1 processor's event order
and `match_player` event indexes support projection backfill. Verify the final
merged schema and `EXPLAIN QUERY PLAN` in Miniflare D1 before naming the
hand-written migration. Indexes and projection migration land together.

---

## 4. Read APIs and page behavior

### Public list

`readLeaderboardPage(db, { cursor?, limit, asOf })` returns public display
rows, one-based ranks, `hasMore`, and an opaque next cursor. The initial page
contains **100** rows; later pages also contain at most 100. A keyset cursor
encodes the last row's full-precision rating and stable tie-break key plus its
ordinal rank, with a version tag. Validate and bound it with Zod; malformed
cursors produce a controlled 400, not an unbounded query. Query one extra row
for `hasMore`. Never use SQL `OFFSET` for deep pages. A live rating update can
move a player between requests; make the page visibly time-stamped and avoid
claiming a cross-page snapshot. Unchanged rows must not repeat or disappear
when following a cursor.

Do not return `user_id` in page data or a decipherable cursor payload. If the
keyset cursor contains `user_id`, encrypt and authenticate it with a web-Worker
secret; a signature alone does not hide its contents. Verify the cursor before
applying it. Current usernames and avatars come from the existing
public-profile projection; profile
links use `/u/<current username>`, with normal alias redirects handled by the
profile route. Never use `username_snapshot` as a live link.

The **current root `+layout.server.ts` serializes account data into SSR
output**. Before caching `/leaderboard` HTML, make the full route output
session-independent: the root layout must omit account data for this route,
and the top bar must hydrate its account display from the private session
request. Navigation away must restore normal account-aware layout data; test
both direct loads and client navigation. Do not set a shared-cache header on
an HTML response while any parent layout still embeds session state. The
public SSR response and its SvelteKit data response must contain no cookie-
derived account value or `Set-Cookie` header.

Then set a public edge `s-maxage` of about 60 seconds, with a bounded stale
window only if it still meets the freshness gate. Cache by path and validated
public cursor; do not vary or cache on a user's cookie. A response with an
upstream D1 error must not be cached as an empty leaderboard. Give an empty
but healthy list a Somali empty state, not a fabricated seed rank.

### Signed-in context

The browser requests `GET /api/leaderboard/me` after loading the public page.
This route derives the account from the **server session**. It accepts no
user-id or username selector, returns `Cache-Control: private, no-store`, and
has a same-origin, Zod-validated response. Anonymous users get a small
signed-out state; incomplete accounts get a route to finish registration. A
complete account gets one of:

- `ranked`: exact rank, own public row, and at most three eligible rows above
  and three below, ordered by the same full-precision key;
- `unranked`: current rounded rating if one exists, confirmed rated-game
  count, and the applicable reasons (`provisional`, `tooFewGames`,
  `inactive`, `excluded`) with no rank or neighbors.

When several reasons apply, show the player-actionable ones first, then the
rest. Do not reveal an operator's exclusion reason or private flag metadata.
An excluded user may see a neutral “not currently listed” message rather
than a moderation diagnosis; the API still distinguishes the state for
correct tests and support. The signed-in card stays visible while browsing
later pages, without covering page controls on a narrow viewport. Loading,
empty, and retry states do not briefly display rank zero or another user's
cached context.

The public profile's future R4 rank uses `readPublicRankForUser(db, userId,
asOf)`. It returns a rank only if the same R3 predicate passes. It must not
copy a cached rank into a profile without its `asOf` or use the H2 history
summary as leaderboard W/L/D.

---

## 5. Query performance and freshness

The default is indexed live reads over `player_rating` plus the one-row
`leaderboard_stats` and current public-profile joins. The main page must not
read the full match ledger or compute streaks per rendered row. Rank lookup
counts only eligible rows ahead of the requested full-precision key; neighbor
queries seek in both directions from that key and limit to three. Use the
same predicate for all three paths. `EXPLAIN QUERY PLAN` must show indexed
candidate walks and indexed joins, not a full `player_rating` or `user` table
scan on each request. Record query time and D1 rows read for the initial page,
a deep page, and an around-you read with a seeded data set larger than 100.

If cached page loads miss **200 ms at p95**, or live D1 reads exceed a
documented latency/row-read budget in preview load tests, switch to a
materialized public ranking snapshot refreshed by the web Worker at most once
per minute. The snapshot is rebuildable from R1 state, includes an `asOf` and
ordered rank,
and is swapped atomically so no page mixes generations. Refresh after a
processed event when possible; cron recovers missed refreshes and time-based
RD/90-day exits. The private context resolves against a single generation.
Do not make a page request trigger a full scan or keep a Durable Object awake.
Measure the snapshot's write/read cost before enabling it; it is a fallback,
not an unmeasured mandatory table. A fallback release must prove the same
one-minute appearance gate; coordinate event-triggered refresh with public
cache expiry so a minute of snapshot delay cannot add to a minute of stale
HTML.

At the activity and RD boundaries, cached public data can be up to its TTL
old. A scheduled or read-time freshness check must also remove accounts that
become ineligible **without** a new game. Normal R1 immediate processing plus
the public cache TTL targets the V2 one-minute appearance gate; R1's one-minute
cron is a recovery path and cannot guarantee that bound during processor
failure. Measure completion-to-publication separately from cached page load.

---

## 6. UI, copy, and privacy

The page uses the site's existing Somali-only copy and public avatar
components. Add a discoverable navigation link; list headings explain that
the rating orders players and that provisional/inactive players are omitted.
Show the update time and a short link to R2's rated-play explanation. Rounded
rating has a `?` only in the private unranked context, per R1; public rows are
never provisional. A streak label includes its result kind, so a draw run is
not mistaken for a win streak. On mobile, keep rank, player, and rating
visible first, with W/L/D and streak readable without horizontal scrolling.

The signed-in strip should be useful even if the viewer is rank 10,000;
no client-side loop through pages is allowed. At the top or bottom it simply
has fewer than three neighbors. On a page that already contains the viewer,
the sticky card may link/scroll to that row but must not duplicate the viewer
inside the public list. An incomplete account can still browse the public
page. Guest and local games never appear.

All list and context outputs contain only current public profile fields,
rounded rating, derived rated counts, streak, rank, and timestamp. No email,
provider id, private permanent user id, identity ticket, or raw session is
serialized. The private endpoint must use the same auth handling as existing
SvelteKit session routes; the game Worker remains uninvolved. Do not add
third-party scripts or tracking to the page.

---

## 7. Verification

### Data and Workers tests

| Case | Expected |
| --- | --- |
| RD exactly 110, games exactly 10, last rated exactly 90 days ago | Eligible if not excluded and current profile exists |
| RD just above 110, 9 games, or last rated just older than 90 days | Unranked with the correct reason |
| Stored RD below 110 but effective RD above it after inactivity | Unranked without a write |
| `excluded = true`, deleted account, or null current username | No public row, rank, or neighbor placement |
| Pending, friendly, aborted, pair-cap, or daily-cap event | No rated W/L/D or streak change |
| Processed win, loss, draw, then skipped event | Counts sum to rated games; newest rated-result streak is exact |
| Same full-precision rating or same rounded rating | Stable ordering by full-precision rating then user id; pagination and rank agree |
| More than 100 eligible players | Page one has 100, later pages reach the rest with no duplicates in an unchanged data set |
| Viewer at rank 1, middle, last, and beyond rank 100 | Correct rank and at most three neighbors per side |
| Ineligible or signed-out viewer | No invented rank, neighbors, or private data |
| Username change and avatar change | Current public details appear without moving the rank |
| Processor duplicate trigger, late ledger rebuild, or R6-style invalidation fixture | Projection and rating state rebuild to the same public order/counts |

Test the public loader and private endpoint separately: malformed cursor,
anonymous/incomplete sessions, cookie isolation, root-layout/top-bar state on
direct loads and client navigation, cache headers, D1 error, server-derived
owner id, and no permanent ids/PII in serialized data. Run
query-plan checks and measure cached load under 200 ms with at least several
hundred eligible and ineligible fixture accounts. Verify expiry from the
90-day window and inactivity RD without a new match. E2E should cover a
qualifying game, first-page visibility, an off-page signed-in rank, mobile
layout, and a profile link; use only local fixtures and Miniflare D1.

For implementation, run `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:worker`, `pnpm build`, and relevant `pnpm test:e2e` cases. Keep
`pnpm check:e2e-isolation` passing. A spec-only edit needs link and
consistency checks, not an application build. Never run remote migrations as
a side effect of tests.

---

## 8. Rollout and definition of done

1. Reconcile this draft with the **merged** H1/R1/R2 schema, the final R2
   policy, the session/public-profile helpers, and the founder wording. Record
   any rating-contract change explicitly before coding.
2. Land the additive projection/index migration and bounded backfill locally;
   extend R1's event batch and dry-run rebuild. Compare counts, streaks, and
   rating state before enabling the page.
3. In preview, apply the migration explicitly, test a real qualifying game,
   an ineligible player, a player beyond rank 100, cache privacy, time-window
   expiry, and an account rename. Record `EXPLAIN`, latency, rows read, and
   completion-to-visibility. Use the snapshot fallback only if the live path
   fails the measured gate.
4. Deploy with a rollback that hides R3 routes/navigation without deleting
   the ledger or R1 rating state. Monitor projection drift, slow reads,
   cache hit rate, and eligibility transitions.

R3 is done when the public list and deep pagination work, a signed-in player
can see their exact rank and neighbors or a truthful unranked state, R4 can
reuse the rank query, no private context is publicly cached, cached public
loads are under 200 ms, and a newly eligible player appears within a minute
on the healthy immediate-processing path. A saved spec alone is not shipment.

---

## 9. Decision to confirm

| ID | Decision | Current specification |
| --- | --- | --- |
| R3-D1 | Do leaderboard W/L/D and streak include only confirmed rated games, or all completed competitive account games? | **Pending founder answer.** This draft uses confirmed rated games, because they explain the rating and match R1's `rated_games`. If the founder chooses all competitive games, change the projection, copy, rebuild fixture, and verification cases before implementation. |

The V2 brief already fixes rating-based ordering, the provisional and 10-game
and 90-day gates, exclusion, and the public top-100-plus-pagination shape;
this spec does not reopen those decisions.
