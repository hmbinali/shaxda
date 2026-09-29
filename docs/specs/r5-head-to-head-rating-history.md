# R5 — Head-to-Head and Rating History (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                           |
| Wave       | 4, after R4                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Depends on | [R4](r4-profile-statistics.md), the profile page (README row). R4 already needs [H2](h2-history-match-detail.md), [R1](r1-rating-system.md), and [R3](r3-leaderboard.md); R5 also reads their contracts, and [A3](a3-account-deletion.md)'s, directly (§2).                                                                                                                                                                              |
| Register   | P8 (README row); §2 also cites P2, P4, P5, P9, P18                                                                                                                                                                                                                                                                                                                                                                                       |
| Contracts  | Consumes [§2.1](v2-contracts.md#21-h1-tables), [§2.3](v2-contracts.md#23-public-match-id), [§2.5](v2-contracts.md#25-r1-extension), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§7.3](v2-contracts.md#73-arithmetic-and-reads), [§7.4](v2-contracts.md#74-corrections), [§8](v2-contracts.md#8-deletion), E6 in [§12](v2-contracts.md#12-evidence). Owns the reads and page data in §3. |
| Brief      | `docs/shaxda-v2.md` §10 (R5)                                                                                                                                                                                                                                                                                                                                                                                                             |
| Touches    | `packages/db` read queries (no migration), `web/src/routes/u/[username]`, the leaderboard row markup, `web/src/lib/profile`, `packages/i18n`, tests. No game-Worker change.                                                                                                                                                                                                                                                              |

R5 adds three read-only views over rows that H1 and R1 already write: a
private head-to-head card, a public rating-history chart, and a leaderboard
form strip. It adds no write, table, index, projection, backfill, binding, or
route. R4 keeps the profile and its public record, R3 the leaderboard rows
and caching, R1 rating arithmetic, peak, and form, and H2 the match pages.

## 1. Outcome and non-goals

### Outcome

A signed-in player sees their private record against the player whose
profile they open; anyone sees how a rated player's rating moved over 7, 30,
or 90 days; leaderboard rows show each player's last five rated results.

### Must

1. **Head-to-head card** (§4.1), private, for an active complete account on
   another account's profile: rated and friendly rows, the last meeting, and
   the current rating difference. `no-store`; no user id reaches the page.
2. **Rating-history chart** (§4.2), public, from processed events only (P8):
   7/30/90-day windows ending at one `asOf`, bounds inclusive; a start point;
   at most 100 points; an honest peak; a text alternative; no JavaScript.
3. **Leaderboard form strip** (§4.3) rendering the `form` R3 returns
   (`player_rating.form`), in words as well as marks. No projection,
   migration, or backfill.
4. Indexed, bounded reads (§3.1, §6) and Somali-only copy (§7).

### Should

- **Play again** on the card, through R4's challenge link to the normal
  invite flow (§4.1).

### Not in R5

- Rating snapshots, projections, writes, migrations, backfills, or
  game-Worker changes.
- Head-to-head for anyone but the two players; Shaxda-statistics comparisons;
  opponent search, friends, follows, notifications, or direct challenges.
- Friendly games in public numbers; estimates for pending games (P18); new
  rating arithmetic, eligibility, or rank; R6 tools; English.

## 2. Decisions and dependencies

### Register

| ID  | How R5 applies it                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P8  | The chart and the strip are public numbers, so they use processed rated events only: `match_player_rating` rows and `player_rating.form`. The card is the participant-only case P8 names: it counts every saved game between the two players.                                          |
| P2  | Applies F2. A friendly game never gets a `match_player_rating` row, so the public chart cannot show one. The card may count friendly games because the viewer played every game it counts; for the same reason its match links open for the viewer.                                    |
| P4  | R1 applies events in `seq` order, and inactivity changes only RD ([§7.3](v2-contracts.md#73-arithmetic-and-reads)), so an event's `rating_before` is the `rating_after` of the player's previous processed event. The start point relies on that chain; §4.2 states the display order. |
| P5  | The ledger holds no names. The card names the target by the profile's current username; the chart and strip name no opponent. Pending and deleted accounts have no profile (A3), so R5 never renders the neutral label; `/match/<id>` does.                                            |
| P9  | The peak is `player_rating.peak_rating`, the highest post-event rating, with no 1500 floor. No `player_rating` row: no chart and no peak.                                                                                                                                              |
| P18 | Provisional means effective RD > 110 at the response's `asOf`. A pending game has no estimate; it appears once processed.                                                                                                                                                              |

### Dependencies

| Milestone | What R5 uses                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1        | `match.rated`, `match_player`, the owner index `match_player_owner_idx`, the public match id.                                                                                                                     |
| R1        | `match_player_rating` (both seats of each processed match), `player_rating` (`rating`, `rd`, `volatility`, `last_rated_at`, `rated_games`, `form`, `peak_rating`, `peak_seq`), `isProvisional`, correction swaps. |
| H2        | `/match/<id>` access (a participant opens a friendly match), `formatMatchDate`, form chips, outcome words.                                                                                                        |
| R3        | Leaderboard rows (public and around-you) that already return `form`, on a session-independent, edge-cached page.                                                                                                  |
| R4        | The `/u/<username>` loader, `resolveProfile`'s server-only `userId`, `asOf`, rating rounding, the page's `ratingsUpdating`, its `private, no-store` header, and its challenge link (Should).                      |
| A3        | Pending and deleted accounts: profile 404, restricted pending session. M10 checks run once A3 is live (Q1).                                                                                                       |
| E6        | Head-to-head and rating-window plans and rows read at 5,000 matches, recorded before implementation.                                                                                                              |

## 3. Contracts

R5 owns the reads and page data below and the rendering of R3's `form`. The
tables they read are in [v2-contracts §2](v2-contracts.md#2-ledger-schema).

### 3.1 Reads

In `packages/db`, called only by the web Worker with ids the server resolved:
the viewer from `locals.user.id`, the target from R4's resolution. Equal ids
are rejected before any query.

```sql
-- readHeadToHead: CROSS JOIN pins the plan to the viewer's owner-index range.
SELECT v.match_id, v.ended_at, v.result, m.rated
FROM match_player AS v
CROSS JOIN match_player AS t
CROSS JOIN match AS m
WHERE v.user_id = ?1                                        -- viewer
  AND t.match_id = v.match_id
  AND t.seat = CASE v.seat WHEN 'A' THEN 'B' ELSE 'A' END
  AND t.user_id = ?2                                        -- target
  AND m.id = v.match_id
ORDER BY v.ended_at DESC, v.match_id DESC;

-- readRatingHistory: the inner join keeps processed events only.
SELECT mp.match_id, mp.ended_at, mp.result, r.rating_before, r.rating_after
FROM match_player AS mp
JOIN match_player_rating AS r ON r.match_id = mp.match_id AND r.seat = mp.seat
WHERE mp.user_id = ?1 AND mp.ended_at >= ?2                 -- no upper bound
ORDER BY mp.ended_at ASC, mp.match_id ASC;
```

Each read is one D1 batch and so sees one state; a correction swap is one
batch too. The batches add only primary-key reads; the maintenance flag comes
from R4's batch (`ratingsUpdating`).

| Statement                                                                                                             | Card              | Chart  |
| --------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ |
| `player_rating` by `user_id`: `rating`, `rd`, `volatility`, `last_rated_at`, `rated_games`, `peak_rating`, `peak_seq` | viewer and target | target |
| `SELECT id, ended_at FROM match WHERE seq = (SELECT peak_seq FROM player_rating WHERE user_id = ?1)`                  | —                 | target |

### 3.2 Page data

The profile's page data gains `headToHead` (`null` means no card) and
`ratingHistory`. A failed read turns either into `{ kind: "unavailable" }`.

| `headToHead` field  | Content                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `rated`, `friendly` | `{ games, viewerWins, targetWins, draws }`; the row is chosen by `match.rated` alone                                                    |
| `lastMeeting`       | `{ matchId, endedAt, result, rated }` from the viewer's side, or `null`                                                                 |
| `rating`            | `{ viewer, target, difference, viewerProvisional, targetProvisional }`, or `unavailable` when either account has no `player_rating` row |

| `ratingHistory` field         | Content                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `kind`                        | `notRated` (no `player_rating` row; no chart section), `unavailable`, or `window`                    |
| `days`, `windowStart`, `asOf` | The window: `days` is 7, 30, or 90                                                                   |
| `games`, `high`, `low`        | Over every processed event in the window, drawn or not; `high` and `low` are `null` when it is empty |
| `start`                       | `{ rating, at, beforeWindow }` (§4.2), or `null` for an empty window                                 |
| `points`                      | At most 99 `{ matchId, endedAt, result, before, after, change, peak }`, in display order             |
| `peak`                        | `{ rating, endedAt, inWindow }`; `endedAt` is `null` after a mismatch (§4.2)                         |

`result` is H2's outcome type; `matchId` is the public id
([§2.3](v2-contracts.md#23-public-match-id)). Numbers are whole, rounded as
R4 rounds ratings; `change` (`after − before`) and `difference` (`viewer −
target`) use the rounded values, so the page adds up.

### 3.3 Leaderboard row

R3's rows (public list and around-you) already return `form`; R5 adds no
field or statement. It maps the letters to outcomes as R4 does (oldest first,
at most five); a value not matching `^[WLD]{0,5}$` renders no strip and logs
a diagnostic without ids.

## 4. Behaviour and failure handling

Profile order: R4 overview, rating history, head-to-head card (when shown), R4
rated matches, R4 Shaxda statistics.

### 4.1 Head-to-head card

| Viewer                                         | Result                             |
| ---------------------------------------------- | ---------------------------------- |
| Signed out, or an incomplete account           | No card and no placeholder         |
| Pending deletion                               | No card (A3 restricts the session) |
| The profile's own account                      | No card                            |
| Another active complete account                | The card                           |
| Anyone, when the profile is pending or deleted | Profile 404 (A3)                   |

- **Counting**: each shared game once, by the viewer's `result`. A pending,
  held, pair-capped, or invalidated rated game stays in the rated row: the
  card counts games played, not rating effects. With none, an empty-state
  sentence replaces the rows; the rating line and play link remain.
- **Last meeting**: the first row of `readHeadToHead`, rated or friendly,
  with its date (H2's formatter), result, label, and `/match/<id>`.
- **Rating line**: both rounded ratings, each with the `?` when R1's
  `isProvisional` holds at the page's `asOf` (P18), and the difference in
  words; otherwise the unavailable sentence, never 1500 or 0. An R6-excluded
  account keeps its card, and no exclusion reason appears.
- **Play again** (Should): when the card shows, R4's challenge link (the
  normal `/online` invite flow, friendly unless both consent to rated, P3)
  sits in the card instead of beside it, so the page has one such link.
  Nothing is sent to the target or prefilled.
- **Caching**: R4 sends `Cache-Control: private, no-store` on every profile
  response (HTML and `__data.json`); a response with a card must keep it. If
  R4 makes the profile shared-cacheable, the card moves to a private request
  like R3's `/api/leaderboard/me`.

### 4.2 Rating-history chart

- **Window**: `[asOf − days × 86,400,000, asOf]`, both bounds inclusive, with
  the one `asOf` R4 captures per response. `days` comes from `?days=7`, `30`,
  or `90`, validated with Zod; anything else gives the default, 30. A row
  with `ended_at > asOf` (it ended during the request) is not drawn.
- **Order**: `(ended_at, match_id)` ascending, the owner-index order of
  `/history` and the profile match list. It equals R1's `seq` order (P4)
  except after a late save (a game saved after one that ended later). R5
  never re-sorts or recomputes: each value comes from its own
  `match_player_rating` row, so a late save can leave a point's `before`
  different from its left neighbour's `after`.
- **Start point**: if `player_rating.rated_games` exceeds the rows the window
  statement returned (same batch), a processed game ended before the window,
  and the line starts at `windowStart` at the first point's `before` (P4):
  the rating after the last earlier game, barring a late save. Otherwise the
  window holds the first rated game; the line starts at it, so labelled.
- **Drawing**: a step line, flat between games (RD growth is not drawn), with
  a step and a dot at each game; it stops at the last game and is never
  extended to `asOf`. An empty window shows a sentence and no line.
- **Reduction**: with more than 99 events, draw the first and last, the peak
  event if in the window, and the lowest and highest `after` in each of 48
  equal-count buckets (the earlier event on a tie), plus the start point:
  never more than 100 points. `games`, `high`, and `low` still cover all.
- **Peak**: the `match` row with `seq = player_rating.peak_seq`. When its id
  is among the window rows, that point has `peak: true`, survives reduction,
  and gets a labelled marker; otherwise a caption gives the lifetime peak and
  its date. If the match is missing, or the marked point's full-precision
  `rating_after` differs from `peak_rating`, R5 logs
  `ratingHistoryPeakMismatch` without ids and shows only the caption. The
  window's high is never called the lifetime peak.
- **Text alternative**: a summary (games, start to end with the signed
  change, window high and low, lifetime peak) labels the SVG (`role="img"`).
  A table lists the drawn events newest first (date, result word, before and
  after, change in words, `/match/<id>`) and says "N of M" when reduced.
- **Selector and layout**: three links with `aria-current`; ordinary
  navigation that keeps the scroll position. Canonical and Open Graph URLs
  omit `days`; the alias redirect keeps it. No animation is required, any
  transition is off under `prefers-reduced-motion: reduce`, and the chart
  fits 320 px; markers and changes carry text, never colour alone.

### 4.3 Leaderboard form strip

Up to five chips per row, oldest to newest in R1's counting (`seq`) order,
with H2's form marks, each chip named by its full outcome word, under a label
saying they are rated games; an empty `form` renders nothing. R3's caching
and session independence are unchanged.

### 4.4 Failures and corrections

| Situation                                                  | Behaviour                                                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 error in the card or chart batch                        | That section shows its unavailable state, never zeros, an empty chart, or "not rated". R4's own reads keep R4's error rule.                    |
| `maintenance = 1` ([§7.4](v2-contracts.md#74-corrections)) | Last published values; R4's `ratingsUpdating` note also covers the card's rating line and the chart.                                           |
| A correction swap lands (M8)                               | The next read shows rebuilt values: the invalidated event leaves the chart; later points, peak, and form may change; the card's counts do not. |
| Pending game (no `match_rating` row yet)                   | In the card's rated row; absent from the chart until processed.                                                                                |

## 5. Privacy and access

R5 implements these rows of [v2-contracts §5](v2-contracts.md#5-access-matrix):

| Row                               | R5 behaviour                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Head-to-head card                 | Hidden when signed out or unrelated. For a participant: viewer vs target over all shared saved games. Private, `no-store`.                                 |
| `/u/<username>` numbers           | The chart and the strip are the public record (P8): processed rated events only.                                                                           |
| `/leaderboard`                    | The strip joins R3's public, edge-cached, session-independent rows; the private around-you rows use the same field.                                        |
| `/match/<id>`, rated and friendly | Chart links point only at processed, public matches. Card links point at games the viewer played; a friendly one opens for the viewer and 404s for others. |
| Pending/deleted account           | Profile 404, so no card and no chart; off the leaderboard (R3).                                                                                            |

- Ids come only from the session and R4's resolution (§3.1); no parameter
  selects another pair. Page data and HTML carry display values only: no
  user id, email, provider id, session, ticket, room code, `seq`, `peak_seq`,
  RD, volatility, or raw row. Logs carry no user id or username.
- Friendly data reaches only the card, and only for a viewer who played every
  game it counts.

## 6. Resource budget

| Item                                                                            | Cost                                                                                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| D1 writes, migrations, backfills; Durable Object wake-ups; game-Worker requests | None                                                                                                                  |
| New bindings, routes, endpoints, cron jobs                                      | None                                                                                                                  |
| Card, per view by a signed-in viewer                                            | One batch: the viewer's owner-index walk (a few rows per viewer game, one per shared game) and 2 `player_rating` rows |
| Chart, per profile view                                                         | One batch: the target's walk from the window start (a few rows per game, friendly included) and 2 primary-key rows    |
| Window switch                                                                   | One `__data.json` request that reruns the profile load (R4's reads, the card, the chart)                              |
| Leaderboard strip                                                               | Nothing extra: R3 already reads and returns `form`                                                                    |

Estimates at up to 4 rows per game walked, until E6 and preview replace
them: the card reads about 800 rows for a 200-game viewer and 20,000 at 5,000
games, plus one per shared game; the chart about 160 rows for 40 games in the
window and 7,200 for 1,800. E6 must show owner-index ranges and key probes
only, never a `SCAN` of `match_player`, `match_player_rating`, or `match`.

Revisit when preview p95 for the card read exceeds 100 ms or window switches
become a visible share of profile D1 reads: serve the chart from its own
read-only request, and weigh a pair index in a separate, measured change.

## 7. Somali copy

Keys under `siteContent.so.pages`, each marked `TODO(translation-review)`,
using the [glossary drafts](README.md#somali-glossary-drafts-q4) (Tartan,
Saaxiibtinimo, Darajo). Reused, not redefined: H2's outcome words and form
marks; R4's `challenge.action`, `overview.ratingsUpdating`, `overview.peak`,
and `matches.rating.up` / `down` / `same` for the table's change words.

| Key                                                                   | Draft                                                                                                                                | Meaning (for reviewers)                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `profile.headToHead.title`                                            | Adiga iyo @{username}                                                                                                                | You and @username                                 |
| `profile.headToHead.privacy`                                          | Adiga keliya ayaa arka. Waxaa ku jira dhammaan ciyaarihii la kaydiyay ee aad wada ciyaarteen, kuwa saaxiibtinimo ah oo ay ku jiraan. | Only you see this; every saved game, friendly too |
| `profile.headToHead.rated` / `friendly` / `games`                     | Tartan / Saaxiibtinimo / {n} ciyaarood                                                                                               | Rated / Friendly / n games                        |
| `profile.headToHead.viewerWins` / `targetWins` / `draws`              | Guulahaaga / Guulaha @{username} / Barbaro                                                                                           | Your wins / Their wins / Draws                    |
| `profile.headToHead.empty`                                            | Weli ma aydaan wada ciyaarin.                                                                                                        | You have not played each other yet                |
| `profile.headToHead.lastMeeting` / `viewMatch`                        | Ciyaartii u dambaysay: {date} / Eeg ciyaarta                                                                                         | Last game: date / View the game                   |
| `profile.headToHead.lastResult.win` / `loss` / `draw`                 | Waad guuleysatay / Waad khasaartay / Barbaro                                                                                         | You won / You lost / Draw                         |
| `profile.headToHead.rating.above` / `below`                           | Darajadaadu waa {n} dhibcood ka sarraysaa / Darajadaadu waa {n} dhibcood ka hoosaysaa                                                | Your rating is n points higher / lower            |
| `profile.headToHead.rating.equal`                                     | Darajadiinnu waa isku mid                                                                                                            | Your ratings are equal                            |
| `profile.headToHead.rating.unavailable`                               | Farqiga darajada wuxuu soo muuqan doonaa marka labadiinnuba darajo yeeshaan.                                                         | Shown once you both have a rating                 |
| `profile.ratingHistory.title` / `windowLabel`                         | Taariikhda darajada / Muddada                                                                                                        | Rating history / Period                           |
| `profile.ratingHistory.window.7` / `30` / `90`                        | 7 maalmood / 30 maalmood / 90 maalmood                                                                                               | 7 / 30 / 90 days                                  |
| `profile.ratingHistory.summary`                                       | {games} ciyaarood oo tartan ah: {from} ilaa {to} ({change})                                                                          | n rated games: from X to Y (change)               |
| `profile.ratingHistory.highLow`                                       | Muddadan: ugu sarreysay {high}, ugu hooseysay {low}                                                                                  | This period: highest, lowest                      |
| `profile.ratingHistory.peakCaption`                                   | Darajada ugu sarreysay abid: {rating} ({date})                                                                                       | Highest rating ever: rating (date)                |
| `profile.ratingHistory.firstGame`                                     | Ciyaartii tartanka ee ugu horraysay                                                                                                  | First rated game                                  |
| `profile.ratingHistory.empty`                                         | Muddadan ma jirto ciyaar tartan ah oo darajo lagu xisaabiyay.                                                                        | No counted rated games in this period             |
| `profile.ratingHistory.listTitle` / `listPartial`                     | Ciyaaraha jaantuska ku jira / {shown} ka mid ah {games} ciyaarood                                                                    | Games in the chart / shown of n                   |
| `profile.ratingHistory.columns.date` / `result` / `rating` / `change` | Taariikh / Natiijo / Darajo / Isbeddel                                                                                               | Date / Result / Rating / Change                   |
| `profile.headToHead.unavailable` / `ratingHistory.unavailable`        | Isbarbardhigga hadda lama heli karo. / Taariikhda darajada hadda lama heli karo.                                                     | Comparison / history unavailable now              |
| `leaderboard.form.label`                                              | Shanta ciyaarood ee tartanka ah ee ugu dambeysay                                                                                     | Last five rated games                             |

## 8. Implementation slices

Prerequisites: R1, R3, and R4 merged; E6 recorded. Tests come first where a
slice has logic.

1. `test(db): add R5 sample-match fixtures and query-plan checks`
2. `feat(db): read head-to-head records from the viewer's owner index`
3. `feat(db): read rating-history windows from match_player_rating`
4. `feat(web): add rating-history window, start, reduction, and peak helpers`
5. `feat(web): show the private head-to-head card on profiles`
6. `feat(web): chart rating history on public profiles`
7. `feat(web): show recent rated form on leaderboard rows`
8. `test(e2e): cover head-to-head and rating history between two accounts`
9. Should: `feat(web): move the challenge link into the head-to-head card`

## 9. Acceptance tests

### Unit (web helpers)

- Window bounds inclusive at `asOf − days × 86,400,000` and at `asOf`; 1 ms
  earlier excluded; a row after `asOf` not drawn but counted for the start
  test. Start at `windowStart` when `rated_games` exceeds the rows, else at
  the first game.
- Reduction: 99 events all drawn; 100 and 5,000 give at most 100 points with
  first, last, peak, and bucket extremes kept, deterministically.
- Rounded `change` and `difference` with signed words; `days` and `form`
  parsing, malformed values included.

### Workers and D1 (`packages/db`, Miniflare, H1 and R1 migrations)

- Symmetry: swapping viewer and target swaps the win counts, keeps games,
  draws, and the last meeting's id and date, inverts its result, negates the
  difference, and swaps provisional flags; rematches and equal `ended_at`
  values (match id breaks the tie) included.
- M1 and M9 in the friendly row, M4 in the rated row, all absent from both
  charts; after R1's rebuild M8 leaves the chart and later points equal the
  rebuilt rows, while the card still counts it.
- Pending and held rated games: rated row, no point. A late save keeps
  `(ended_at, match_id)` order, each point equal to its stored row.
- Peak inside (marker survives reduction), outside (caption with date),
  moved by a rebuild, mismatched (caption, diagnostic); with
  `maintenance = 1` the card and chart keep the last published values.
- `EXPLAIN QUERY PLAN` at 5,000 games: the card starts at
  `match_player_owner_idx` for the viewer, the chart at it for the target;
  other accesses are key searches; no `SCAN` of the three tables.

### Web (loaders, routes, components)

- No card and no card markup for signed-out, incomplete, pending-deletion,
  and self views; a card for another active account, with
  `Cache-Control: private, no-store` on HTML and `__data.json`. A pending or
  deleted target is a 404 (once A3 is live). With a card, the page has
  exactly one challenge link, inside the card.
- Privacy scan of load output, HTML, and `__data.json` for both user ids,
  emails, provider ids, sessions, tickets, room codes, `seq` values, RD, and
  volatility; no friendly match id in a signed-out response.
- The strip appears in public and around-you rows; the public leaderboard
  stays session-independent and keeps R3's cache header.
- The selector works without JavaScript; alias redirects keep `days`. The
  keyboard reaches the selector and table; chips, peak, and changes have text
  names; reduced motion; 320 px without horizontal scrolling.

### E2E (shared local D1, [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e))

- Two accounts play a friendly and a rated game. Each sees the other's card
  with rated 1 and friendly 1, mirrored; signed out, no card; each chart has
  one point; the friendly last-meeting link opens for the player. A seeded
  leaderboard fixture shows the strip.

### Sample matches

| ID     | Head-to-head card (A views B)                                           | Rating charts (A and B)                       | Leaderboard form                    |
| ------ | ----------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------- |
| M1     | Friendly row: A win                                                     | No point                                      | Unchanged                           |
| M2     | Rated row: A win                                                        | A up, B down                                  | A gains W, B gains L                |
| M3     | Rated row: A loss                                                       | A down, B up                                  | A gains L, B gains W                |
| M4     | Rated row: counted                                                      | No point                                      | Unchanged                           |
| M5     | Rated row: draw                                                         | A point, B point                              | Both gain D                         |
| M6, M7 | Nothing (no row)                                                        | Nothing                                       | Nothing                             |
| M8     | Rated row, before and after the rebuild                                 | A point until the swap; absent after it       | Rebuilt without it                  |
| M9     | Friendly row                                                            | No point                                      | Unchanged                           |
| M10    | B's profile 404s: no card for any viewer; B's pending session sees none | A's M2 point unchanged; B's chart unreachable | B off the board; A's form unchanged |

## 10. Rollout and rollback

| Environment | Steps                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev         | Miniflare D1 with the H1 and R1 migrations and the §9 fixtures.                                                                                                                                                                 |
| e2e         | The shared local D1; the §9 end-to-end test.                                                                                                                                                                                    |
| preview     | After R1, R3, and R4 run on preview and E6 is recorded: deploy the web Worker; check signed-out, participant, self, and pending-target views, a dense 90-day chart, headers, and leaderboard caching; record rows read and p95. |
| production  | Web Worker deploy only. The release record lists what was checked; nothing is called verified without it.                                                                                                                       |

- **Deploy order**: web Worker only, the last step of
  [§6.5](v2-contracts.md#65-deploy-order); no migration, game-Worker change,
  or binding ([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)).
- **Kill switch**: none. Rollback redeploys the previous web Worker version;
  R5 writes nothing, so no data changes either way.
- **Done when**: the card is symmetric and seen only by the two players; the
  chart reproduces stored `match_player_rating` values in all three windows
  with an honest peak; strips equal `player_rating.form`; §9 passes; E6 and
  preview figures are recorded.
