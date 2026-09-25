# R5 — Head-to-Head and Rating History (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; specification only. R5 is not active or shipped. |
| Brief | `docs/shaxda-v2.md` §10 (R5), §5, §7.2, §14, §16 D8 |
| Depends on | R4 public profile record; H2 match links and owner-indexed ledger reads; R1 confirmed rating events; R2 competition status; R3 leaderboard rows and rated-result semantics |
| Workspace | `r5-head-to-head` |
| Touches when implemented | `packages/db` read queries and, if needed, the R3 derived form projection; `web/src/routes/u/[username]`; `/leaderboard`; `packages/i18n`; tests |

This spec refines the R5 brief without activating the milestone. The V2 brief
wins on scope and order, the PRD on stack and infrastructure, and
`docs/shaxda_game.md` on game rules. The H2/R1/R2/R3/R4 specs in this checkout
are drafts; reconcile these proposed interfaces and the founder decisions
below with merged code before implementation. R5 does not change match
outcomes, rating arithmetic, eligibility, or leaderboard rank.

---

## 1. Outcome and scope

A signed-in player viewing another account's public profile can see their
record against that opponent. Every public account profile gains a readable
rating trend. Leaderboard rows gain a compact recent-form strip whose meaning
matches their rated W/L/D counts.

### Must

1. On `/u/<username>`, show a head-to-head card **only** to a signed-in,
   complete account viewing another current account: games between them,
   viewer wins, opponent wins, draws, last meeting, and current rating
   difference. Source the viewer from the server session and the target from
   the resolved public profile, never from browser-supplied user ids.
2. Show each account's confirmed rating history on its public profile as a
   simple chart for rolling 7-, 30-, and 90-day windows. Use R1's stored
   `match_player` rating-before/after events. Mark the lifetime peak when its
   attaining event is visible, and state the peak value when it is outside the
   selected window.
3. Add up to five recent results to each visible leaderboard row. Reuse the
   R4/H2 form visual and accessibility labels, while using the final R3
   leaderboard result set for the **data**. Keep list and signed-in context
   free of private identity fields and N+1 match queries.
4. Handle zero matches, no rated events, pending rating processing, renamed or
   deleted opponents, alias redirects, and R6-style rating rebuilds truthfully.
   Do not turn missing or skipped rating events into zero deltas.
5. Keep reads indexed and bounded to the two players or the selected profile
   and selected time window. Add no rating-snapshot table or game-Worker write.

### Should

- A “play again” action on the head-to-head card may create a normal invite
  room and copy its link. Reuse R4's optional challenge action if it shipped;
  the other player is not automatically invited or placed in the room.

### Out of scope

- Comparisons of Shaxda statistics between arbitrary players, public
  opponent-search/comparison routes, friends, followers, direct challenges,
  matchmaking, seasons, tiers, or new rating calculations.
- Guest/local match records, private profiles, hidden public history, a new
  rating-snapshot table, or a second replay/chart data store.
- R6 invalidation tools. R5 reads the currently published derived rating
  events and updates when R6 rebuilds them.

---

## 2. Head-to-head contract

Use the same **completed competitive account matches** that R4 currently
proposes for its public W/L/D: persisted account-vs-account matches with R2
`competition_status = completed`, including friendly, pending, and rating-
skipped games. Exclude R2 `aborted` rows even though their engine replay is
terminal. This is R5-D1, pending the founder's answer. If R4-D1 resolves
differently, settle both definitions together before coding; do not publish
two incompatible labels for the same public record.

| Field | Exact rule |
| --- | --- |
| Games | Count completed competitive ledger matches containing both distinct permanent account ids. A rematch is another match. Count each `match.id` once. |
| Viewer wins / opponent wins / draws | Read the two authoritative `match_player.result` values from the viewer's perspective. Their sum equals games; a contradictory pair is a data error, not a draw. |
| Last meeting | The newest included match by `(ended_at DESC, match.id DESC)`, with date, viewer-perspective result, and link to H2's public `/match/<id>` page. A later aborted encounter does not replace the last competitive meeting. |
| Rating difference | `viewer.currentRating − opponent.currentRating` from R1 `player_rating`, in full precision before display rounding. Show a signed whole-number difference calculated as `round(viewer) − round(opponent)`; label whose rating is higher. Use R1 effective RD at one `asOf` to mark either rating provisional. If either has no confirmed rated match, show “rating comparison unavailable”, not a fabricated 1500 or zero. |

The card labels game results as **all completed account games** and rating
difference as **confirmed rated-game rating**. A friendly or pair-capped game
still changes the head-to-head record but not the rating difference. If an R1
event is pending, the card may show the last confirmed rating with an explicit
pending note; it must not claim the pending game's rating effect is included.
An R6 excluded player may still have a public profile and head-to-head record;
do not expose the exclusion reason or invent a public rank.

Resolve the target through R4's existing username/alias flow. A missing or
deleted target follows that route's 404/tombstone policy. A renamed account
uses the current canonical username; the comparison key remains the permanent
server-only id. A signed-out or incomplete-account visitor sees the normal
public profile and rating chart, with no head-to-head card or empty “you vs
them” placeholder. An owner viewing their own profile also sees no card.
For zero meetings, show a short Somali empty state and no fake last meeting.

### Query and DTO

`readHeadToHead(db, { viewerUserId, targetUserId, asOf })` is a web-Worker,
server-only read. Validate that the two ids differ. Start with H1's
`match_player(user_id, ended_at, match_id)` owner index, join the paired seat
by `(match_id, seat)`, and filter its `user_id = targetUserId` and the joined
match's R2 competition status. Aggregate counts and select the last meeting
using the same predicate and total order. Do not rely on username snapshots,
room codes, a browser query parameter, or `match.rated` to define the pair.
Check the actual merged index and `EXPLAIN QUERY PLAN`; add a hand-written
index only if this owner-bounded plan proves insufficient. There is no
default pair table or full-ledger scan.

The loader may hold ids while it computes the read. It returns a display DTO
with counts, a public match URL/date/result, rounded public rating values,
provisional/pending flags, and `isViewer`, but **no** permanent user id,
email, provider id, session, ticket, room code, or raw ledger row. The server
determines `isViewer`; the client cannot request a comparison for a different
account.

---

## 3. Rating-history contract

The chart is public on `/u/<username>` for the resolved account, including
when the visitor is signed out. This follows the V2 public-profile/history
decision D8. It is a view of **confirmed rated events only**:
`match.rating_status = processed`, valid numeric
`match_player.rating_before` and `rating_after`, and the event's rating
algorithm/policy version. Pending, friendly, aborted, pair-cap, and daily-cap
events create no chart point. If a row claims `processed` but lacks valid
values, report a server data error and show an unavailable chart state; do
not draw a misleading gap or zero.

Capture one UTC `asOf` per profile load. Windows are rolling durations ending
at that instant: `[asOf − N × 86,400,000 ms, asOf]` for `N = 7, 30, 90`.
An event exactly on either boundary is included. Order events by
`(ended_at ASC, match.id ASC)`, matching R1's processor and tie-break. Use
the before/after values from **the same match_player event**; never derive a
change from two rounded neighboring points or recompute Glicko-2 in a web
request. Show dates in the site's established Somali date format, with UTC
instants in machine-readable data.

The visual line starts at the rating after the most recent processed event
*before* the window, if one exists, as a context point at the window start.
When there is no earlier event, the first in-window event starts with its
stored `rating_before` at that event time. Plot its `rating_after` at the same
time so a player can see the first change; order same-time before/after
points explicitly. Never extend the line to `asOf` as if another game
occurred. A window with no processed event has a “no rated games in this
period” state and may show the separately labelled current rating; do not
draw a fabricated flat history.

R1 `peak_rating` is the lifetime value. Mark the **first processed event in
the selected window whose `rating_after` equals that value** at stored
precision, if any. If the peak came earlier, or the initial 1500 floor remains
the peak without an attaining event, show the peak as a textual caption
without placing a false marker in the window. If R1's peak and event series
disagree, log a data diagnostic; never silently substitute a window maximum
for the lifetime peak. Peak, current rating, and chart point values are
rounded only at display time. The chart label distinguishes a historical
post-match rating from the current R1 rating, whose RD/provisional status can
change through inactivity while the rating number stays fixed.

`readRatingHistory(db, { userId, days, asOf })` uses the owner's
`match_player(user_id, ended_at, match_id)` range plus keyed `match` joins.
Read only the selected 7/30/90-day range and at most one preceding processed
event for the context point. Do not load a lifetime array and filter it in
the browser. The server produces a narrow public DTO of time, before/after
rounded display values, signed displayed delta, and peak-marker flag. No
match ids are required by the chart; the series never exposes permanent user
ids or raw rating-state fields. Recompute from the currently published R1
projection after a guarded rebuild; never cache a separate historical
snapshot as truth.

The default selected window is 30 days; changing the selector updates only
the profile chart. A server-rendered 30-day initial view remains useful without
JavaScript. The other windows may load through same-origin, validated,
read-only requests or normal navigation; use R4's session-sensitive cache
rules. Validate `days` as exactly 7, 30, or 90. A D1 failure is an unavailable
state or error, not an empty series.

---

## 4. Leaderboard recent form

R3 rows currently define W/L/D and streak from **confirmed rated events**.
R5's leaderboard strip uses the same result set: the newest five processed
`match_player.result` values in `(ended_at, match.id)` order, displayed oldest
to newest. A skipped or pending game does not occupy a slot or change the
strip. Zero processed events gives a labelled empty state. If R3-D1 changes
before implementation, update the strip, its label, and all projection tests
to the final R3 definition. R4's form component can be reused visually, but
R4's all-competitive-game data must not be passed into a row labelled as
rated form.

Extend R3's rebuildable `leaderboard_stats` projection with a compact,
validated five-result `recent_form` value. Append each newly **processed**
result for each seat and keep only five, in the **same guarded R1 event batch**
that updates rating and R3 counts/streak. A skipped event does nothing. An
R1/R6 rebuild recreates it in global event order and compares it in dry-run
drift checks. Backfill existing processed events in bounded pages before
publishing the strip. This adds one additive, hand-written migration and no
game-Worker write. If the merged R3 implementation omitted the projection,
use a measured batched indexed read for at most the visible 100 rows instead;
do not create an N+1 query or an independent asynchronous form writer.

Pass the five display outcomes as part of R3's public row DTO. Keep its
existing 60-second public cache and private signed-in context separation.
Check root-layout/session leakage and direct/client navigation again after
adding the strip. The form has text and accessible result names; color or a
single-letter glyph alone is insufficient. On narrow screens it may wrap
below rank, player, and rating without horizontal scrolling.

---

## 5. UI, privacy, and performance

Place the head-to-head card on another player's profile after R4's overview
and before recent matches. Place rating history on every public profile near
the rating summary; keep R4's recent matches and Shaxda stats in their
existing order. The chart uses a simple SVG line and points with visible
axes, labelled dates and ratings, a peak marker/caption, and a text summary
of first-to-last change for the selected window. Provide a keyboard-readable
event list or equivalent accessible description; honor reduced motion and
do not add a charting service or third-party tracking. All visible copy lives
in `packages/i18n` and remains Somali-only. Reuse confirmed R1/R2/R3/R4
terms once founder wording is settled; do not introduce an English toggle.

R4's profile loader is session-aware, so do not set shared edge-cache headers
on a response that contains the viewer's head-to-head data, `isViewer`, or
parent-layout session state. A private on-demand comparison response, if used,
requires the current server session and `Cache-Control: private, no-store`.
The public chart can be cached only behind a response proven independent of
session data; the simplest initial path is the profile's existing no-shared-
cache behavior. No route accepts a viewer id from the client. Rate-limit any
new read endpoint and use Zod at its input boundary.

Run `EXPLAIN QUERY PLAN` and record D1 rows read and p95 latency for a new
account, an account with hundreds of matches, and a prolific account with
thousands, including a pair with many rematches and a dense 90-day chart.
Every request uses the owner index and keyed joins; no full `match_player`
scan. If the 90-day chart is too large for the page, reduce **rendered** SVG
points deterministically while retaining first, last, local extrema, and
the visible peak, and provide the full event values through a paged accessible
list. Do not omit ledger events from the underlying calculation or create a
rating-snapshot table. Record the measured threshold and reduction rule in
the implementation review before enabling it.

---

## 6. Verification and rollout

### Tests

- Head-to-head symmetry: swapping viewer and target swaps wins/losses and
  reverses rating difference, while games/draws/last match agree. Include
  rematches, same `ended_at` values, friendly, cap-skipped, pending, and
  aborted rows. The three result counts must always sum to games.
- Signed-out, incomplete-account, self-profile, and missing/deleted target
  cases expose no comparison. Alias and renamed profiles keep the same record
  and canonical link. A deleted opponent elsewhere still follows H2's neutral
  public label; no old username snapshot leaks.
- Rating-history fixtures cover 7/30/90-day boundaries, same-time event
  ordering, a preceding context event, first-ever rated match, no event in a
  window, pending/skipped rows, peak inside/outside the window, an initial-
  floor peak, malformed processed values, and an R1/R6 rebuild. Chart points
  equal the ledger's before/after values after display rounding.
- Leaderboard form covers five-plus processed events, draws, a skipped latest
  game, zero events, backfill, duplicate processor trigger, late event/rebuild,
  and projection drift. R3 counts, streak, and form use the same final
  eligibility/result definition and update atomically.
- Loader/HTML privacy tests search for permanent ids, emails, provider ids,
  identity tickets, sessions, room codes, raw ledger rows, and public-cache
  headers on viewer-specific output. Test owner, other signed-in, and anonymous
  requests, plus client navigation from a cached leaderboard page.
- Mobile and keyboard checks cover all three chart windows, chart text/event
  access, peak indication, recent-form result labels, reduced motion, and a
  no-meetings/no-rated-games state. Query-plan tests prove indexed pair and
  time-range reads; preview records p95 and D1 rows read.

For implementation run `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:worker`, `pnpm build`, and relevant `pnpm test:e2e` cases. Keep
`pnpm check:e2e-isolation` passing. These use local fixtures/Miniflare D1;
remote migrations and backfills are explicit release operations. A spec-only
edit needs document/link/consistency checks, not an application build.

### Implementation and release order

1. Reconcile merged H2/R1/R2/R3/R4 schema and the founder decisions below.
   Resolve R3-D1/R4-D1 before writing shared form or head-to-head copy.
2. Add failing ledger/query fixtures, indexed head-to-head and rating-history
   reads, and public DTO/privacy tests. Measure dense accounts before adding
   any index beyond the merged H1 owner index.
3. Add the R3 form projection extension, bounded backfill, atomic update, and
   rebuild/diff coverage; or document the measured no-projection read path.
4. Add Somali copy, the profile card/chart, and leaderboard strip. Reuse
   existing invite flow for the optional play-again action only after the Must
   path works.
5. Apply any additive migration/backfill explicitly in preview. Check real
   completed, friendly, skipped and pending matches; an alias; a no-game
   account; a dense chart; and profile/leaderboard cache privacy. Repeat in
   production after counts and drift checks. A rollback hides the R5 views
   without deleting match or rating rows.

R5 is done when two account players can see a symmetric, truthful record on
each other's profile; public 7/30/90-day charts reproduce confirmed ledger
events and mark peak honestly; visible leaderboard rows show the correct
five-result form; privacy, performance, migration/backfill, local checks, and
preview verification pass. Saving this spec alone does not ship R5.

---

## 7. Decisions to confirm

| ID | Decision | Draft treatment |
| --- | --- | --- |
| R5-D1 | Which games count in head-to-head? | All persisted **completed competitive account matches**, including friendly and rating-skipped; exclude R2-aborted. Pending founder answer and tied to R4-D1. |
| R5-D2 | Is rating history public on an account profile? | Yes, following V2 D8's public profile/match decision. Only confirmed rating event values are exposed. |
| R5-D3 | What does “rating difference” mean? | Current confirmed R1 rating of viewer minus target, displayed as the difference of rounded ratings. Unavailable until both have a rating. |
| R5-D4 | What does the leaderboard form mean? | Match final R3 W/L/D semantics; its current draft uses confirmed rated games. Reuse R4's visual, not its broader form data. |

The V2 brief already fixes the three windows, ledger-derived chart, peak,
signed-in opponent comparison, and no rating-snapshot table. These decisions
refine display and counting without expanding R5's scope.
