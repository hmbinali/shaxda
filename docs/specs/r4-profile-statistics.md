# R4 — Profile Statistics (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                         |
| Wave       | 4                                                                                                                                                                                                                                                                                                                                                                                                      |
| Depends on | H2, H4, R1, R3; A3 if shipped                                                                                                                                                                                                                                                                                                                                                                          |
| Register   | P8, P9 (also cites P2, P5)                                                                                                                                                                                                                                                                                                                                                                             |
| Contracts  | Consumes [§2.1](v2-contracts.md#21-h1-tables), [§2.5](v2-contracts.md#25-r1-extension), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§7.3](v2-contracts.md#73-arithmetic-and-reads), [§7.4](v2-contracts.md#74-corrections), [§8](v2-contracts.md#8-deletion), [§12](v2-contracts.md#12-evidence) (E4, E6). Owns the profile reads and page data (§3). |
| Brief      | `docs/shaxda-v2.md` §10 (R4)                                                                                                                                                                                                                                                                                                                                                                           |
| Touches    | `packages/db` (read queries), `packages/i18n`, `web/src/routes/u/[username]`, `web/src/lib/profile`, `$components/profile`, tests. No `worker/` change; no migration unless E6 requires an index.                                                                                                                                                                                                      |

R4 turns the public `/u/<username>` page into a shareable record built only
from processed rated events (P8): rating, rank, W/L/D, streaks, form, peak,
Shaxda aggregates, and the ten newest rated matches. It reads R1's rating
tables, H4's stored statistics, and R3's rank, and writes nothing. R1 owns
ratings and the public-record projection, R3 rank, H2 `/history` and the
match page, H3 replay, H4 per-match statistics, A3 deletion, and R5 the
head-to-head card and rating chart later added to this page.

## 1. Outcome and non-goals

### Outcome

Anyone sees a player's rated record and Shaxda play on `/u/<username>`,
every number traced to processed rated events; the owner also gets a
`/history` link. The page link is proof of record.

### Must

1. Keep the V1.1-A page: URL, `302` alias redirect, current username and
   avatar, canonical and Open Graph metadata (username only), share action.
   Add mobile-first sections in order: overview, rated matches, statistics.
2. Overview from `player_rating` at one `asOf` (§3.3). No row means "not
   rated yet": no rating, peak, rank, or zero-filled counts.
3. The ten newest rated matches, labelled by rating state (§3.4), each
   linking to `/match/<id>`, where H3 plays the replay. Never a friendly one.
4. Shaxda aggregates over processed rated matches from H4's stored
   statistics (§3.5), or the "statistics incomplete (N games)" state.
5. A `/history` link for the owner only (server-side `isOwner`); a strictly
   public page-data shape (§5); no replay read per request; no shared cache
   while the output depends on the session.
6. A pending-deletion or deleted account's profile is a 404
   ([§8](v2-contracts.md#8-deletion)).

### Should

- A challenge link for non-owners to the normal `/online` invite flow,
  where the viewer creates a room (friendly by default, F1; Turnstile and
  identity unchanged) and shares its link. It sends the owner nothing,
  claims nothing about presence, and is dropped if it needs a new protocol.

### Not in R4

Style labels, private profiles, followers, head-to-head and rating charts
(R5), tiers, seasons, achievements (F8), guest or local records, a public
all-games record (P8), a second projection table
([§2.5](v2-contracts.md#25-r1-extension)), rating or eligibility changes,
statistics in share text, D1 writes, game Worker code.

## 2. Decisions and dependencies

### Register

| ID  | How R4 applies it                                                                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P8  | Every public number comes from processed rated events: counts, W/L/D, streaks, form, and peak from `player_rating`; Shaxda aggregates only from matches whose `match_rating.rating_status = 'processed'`. The list shows rated matches in every rating state, labelled; only processed ones count. |
| P9  | Fastest win is the shortest `ended_at − started_at` among processed rated wins with a normal board-win `end_reason`. Best streak is `best_win_streak`, the longest win run. Peak is `peak_rating`: no 1500 floor; no row, no peak.                                                                 |
| P2  | Cited. Visibility follows `match.rated`: no friendly match, no friendly count, and nothing that tells a friendly-only account from a new one.                                                                                                                                                      |
| P5  | Cited. Opponents show their current username and avatar from the account row; a pending or deleted account shows the neutral label with no link, avatar, or old name.                                                                                                                              |

Also relied on: F2, F7 (comeback), P1 (saved means played), P18 (provisional
above effective RD 110), P19 (via R3), P21 (statistics may be missing).

### Dependencies

| Spec                                 | Provides to R4                                                                                                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [H2](h2-history-match-detail.md)     | `Participant` (member, or neutral through `isNeutralAccount`), row markup and copy (outcome words, end-reason labels, streak and form chips), `formatDuration`, `formatMatchDate`, `toPublicProfile`, `/history`, and `/match/<id>`.                           |
| [H4](h4-match-stats.md)              | `readMatchStats` from `@shaxda/shared/stats`: the only way R4 reads `stats_json` (Zod-validated, `STATS_V = 1`, a typed reason instead of zeros); the backfill that brings saved matches to `stats_status = 'ok'`.                                             |
| [R1](r1-rating-system.md)            | `match_rating`, `match_player_rating`, and `player_rating` ([§2.5](v2-contracts.md#25-r1-extension)); `isProvisional` in `packages/rating` ([§7.3](v2-contracts.md#73-arithmetic-and-reads)); the `maintenance` flag ([§7.4](v2-contracts.md#74-corrections)). |
| [R3](r3-leaderboard.md)              | `readPublicRankForUser(db, userId, asOf)`: the P19 predicate and the `/leaderboard` ordering.                                                                                                                                                                  |
| [R2](r2-ranked-play-rules.md)        | The rating-state label mapping (`RatedLabel.svelte`, `ratedPlay.status.*`).                                                                                                                                                                                    |
| [R6](r6-ranking-integrity.md)        | R6-core's `rating_correction_mark` (existence only), `ratingStatus.corrected`, and `check-consistency`.                                                                                                                                                        |
| [A3](a3-account-deletion.md), V1.1-A | A3's [§8](v2-contracts.md#8-deletion) predicates behind the profile 404 and the neutral label, once shipped; V1.1-A's `resolveProfile`, alias redirect, `PageMeta`, `Avatar`, and `ShareProfile`.                                                              |

## 3. Contracts

R4 owns the reads, page data, and display rules below; the tables, rating
states, and access rows are in [v2-contracts.md](v2-contracts.md).

### 3.1 Reads

Read-only statements in `packages/db`; none selects `match.replay`.

- `resolveProfile(db, username)` (`queries/account.ts`): the `current`
  outcome gains a server-only `userId`, passed to the reads, never returned.
- `readProfileRecord(db, userId)` (`queries/profile.ts`): one `db.batch`, so
  all four results come from one database state:
  1. the `player_rating` row by primary key, or none;
  2. `rating_processor_state.maintenance`;
  3. the list: `match_player_owner_idx` range, newest first → `match` by
     `id` with `rated = 1` → the opponent's `match_player` → left joins by
     key to `match_rating`, the own seat's `match_player_rating`, R6's
     `rating_correction_mark`, and the opponent's `user`; `LIMIT 10`;
  4. the included matches: the same owner range → `match_rating` by key
     with `rating_status = 'processed'` → `match` by `id`, with the columns
     §3.5 needs; only `readMatchStats` parses the stats columns.
- R3's `readPublicRankForUser(db, userId, asOf)`, with the loader's `asOf`,
  only when a `player_rating` row exists.

### 3.2 Page data

```ts
type ProfilePageData = {
  profile: PublicProfile; // V1.1-A shape, unchanged
  isOwner: boolean; // server-side comparison only
  ratingsUpdating: boolean; // processor maintenance (contracts §7.4)
  record: { kind: "notRated" } | ({ kind: "rated" } & PublicRecord); // §3.3
  matches: ProfileMatchRow[]; // ≤ 10 rated matches, newest first (§3.4)
  stats:
    | { kind: "none" } // not rated
    | { kind: "incomplete"; missingGames: number }
    | ({ kind: "complete" } & ShaxdaStats); // §3.5
};
```

### 3.3 Overview

| Field (`PublicRecord`)             | Source and rule                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rating`, `peak`                   | `Math.round(rating)`, `Math.round(peak_rating)`; the peak may be below 1500 (P9).                                                                     |
| `provisional`                      | R1's `isProvisional` at `asOf` (effective RD from `rd`, `volatility`, `last_rated_at` above 110); renders the `?`. Exactly 110 is not.                |
| `rank`                             | R3's rank at the same `asOf`, or `null` ("not ranked yet") whatever the reason.                                                                       |
| `games`, `wins`, `losses`, `draws` | `rated_games`, `rated_wins`, `rated_losses`, `rated_draws`.                                                                                           |
| `winRatePercent`                   | `Math.round(100 × rated_wins / rated_games)`; draws stay in the denominator.                                                                          |
| `streak`, `bestWinStreak`          | `{ kind: streak_kind, length: streak_len }` when `streak_len ≥ 1`, else `null`, never capped (no `20+`); `best_win_streak`, `0` before the first win. |
| `form`                             | The `form` letters as outcomes, oldest first, at most five; H2's form chips.                                                                          |

### 3.4 Rated matches

Each `ProfileMatchRow` carries the public match id, `href` (`/match/<id>`),
the owner's `outcome`, `reason` (`online_end_reason` when set, else
`end_reason`, as in H2), `endedAt` (epoch ms), `opponent` (H2's
participant), `rating`, and `corrected`. Only a processed match counts in
any number.

| Rating state                    | `rating`                                                                                                                  | Label (§7)       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| No `match_rating` row (pending) | `{ kind: "pending" }`                                                                                                     | being calculated |
| `held`                          | `{ kind: "held" }`                                                                                                        | being checked    |
| `processed`                     | `{ kind: "processed", delta }`: `round(rating_after) − round(rating_before)` of the own seat, never `round(rating_delta)` | `+n`, `−n`, `0`  |
| `skipped`, `pairCap`            | `{ kind: "notCounted" }`                                                                                                  | not counted      |
| `skipped`, `invalidated`        | `{ kind: "removed" }`                                                                                                     | rating removed   |

Labels come from R2's mapping (§7). `corrected` is true when R6 has a
`rating_correction_mark` for the match (its existence only) and adds "rating
corrected" beside the label, except on a removed match. The delta always
equals the difference of the displayed ratings. `skipped:friendly` exists
only for `rated = 0` matches, never read here.

### 3.5 Shaxda aggregates

| Value                   | Rule                                                                                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Included matches        | The owner's matches with `match_rating.rating_status = 'processed'`; their count equals `rated_games`.                                                                                                                                                                                   |
| Usable statistics       | `readMatchStats` returns `ok`; values come from `stats.players[<own seat>]`, the seat from the owner's `match_player.seat`. Any other result (`notDerived`, `derivationFailed`, `unsupportedVersion`, `invalid`) makes `stats` `incomplete` with the count of such matches and no total. |
| Total captures          | Σ `capturesMade`; per game = total ÷ included matches (zero-capture games included), one decimal.                                                                                                                                                                                        |
| Jare, repeated jare     | Σ `jareEvents`, Σ `repeatedJareEvents`; repeated jare is shown as a subset.                                                                                                                                                                                                              |
| Average duration        | Mean `ended_at − started_at`: from play began (P1) to the end, claims included.                                                                                                                                                                                                          |
| Fastest win             | Minimum `ended_at − started_at` over included wins with `end_reason` `opponentBelowThree` or `opponentCapturedAll` (E4: the latter cannot occur in legal play); `null` when none. Resignations and claims never qualify.                                                                 |
| Wins by starting seat   | Own seat equal to / different from `starting_seat`; the two sum to wins.                                                                                                                                                                                                                 |
| Wins by first advantage | `first_advantage_seat` equal to the own seat / the other seat / `NULL` (ended before it was decided); the three sum to wins.                                                                                                                                                             |
| Comeback wins           | Wins whose own `comeback` is true (F7).                                                                                                                                                                                                                                                  |
| Draws by type           | Draws by `end_reason`: `drawTermination` (threefold repetition or 80 movement turns without capture; the ledger does not separate them), `forcedJareSpaceMaking`, and `bothBlocked` (E4: impossible in legal play; shown only when non-zero).                                            |

The mapper sums in the Worker; raw statistics never enter page data. A new
`stats_v` is edited in H4 and here in one commit; until then its matches
count as incomplete, never as zeros.

## 4. Behaviour and failure handling

### Loader

1. `resolveProfile`: missing, pending, or deleted → 404; alias → `302` to
   the current username with `cache-control: no-store`.
2. Capture `asOf = Date.now()` once; call `readProfileRecord`, then R3's
   rank when a row exists.
3. Map to page data with pure functions in `web/src/lib/profile/record.ts`
   (rounding, `provisional`, labels, H2's participant); private ids stop
   there. `isOwner = locals.user?.id === userId`, on the server; then
   `setHeaders({ "cache-control": "private, no-store" })`.

### States

| Condition                                         | Overview                                   | Rated matches    | Statistics           |
| ------------------------------------------------- | ------------------------------------------ | ---------------- | -------------------- |
| No `player_rating` row, no rated match            | Not rated yet                              | Empty line       | Hidden               |
| No row; rated matches pending, held, invalidated  | Not rated yet                              | Listed, labelled | Hidden               |
| Row; all included matches have usable statistics  | Full                                       | Listed           | Complete             |
| Row; N included matches without usable statistics | Full                                       | Listed           | Incomplete (N games) |
| `maintenance = 1`                                 | Last published values + "ratings updating" | Same             | Same                 |
| Row with `excluded = 1`                           | Full; rank "not ranked yet" like any other | Same             | Same                 |

Zero-game and friendly-only accounts get identical page data apart from
`profile`, keeping the share, `/history`, and challenge links. Sections use
headings and a `<dl>`; rows reuse H2's markup (with `<time datetime>`), fit
375 px without horizontal scrolling, and use words, not colour alone.

### Failures

- A D1 or rank read error fails the request with the Somali error page;
  never zero games, "not rated yet", or "not ranked yet".
- A processed match without its seat's `match_player_rating` row shows no
  rating label (`rating: null`) and logs `profileRatingEventMissing` with
  the public match id; R6's `check-consistency` owns repair.
- Incomplete statistics log `profileStatsIncomplete` with counts per
  `readMatchStats` reason, no ids; H4's backfill repairs `none` and `error`.
- A renamed opponent links to the current username; a reclaimed username
  shows only its new owner's record, since reads key on user id
  ([§8](v2-contracts.md#8-deletion)).

## 5. Privacy and access

R4 implements the [access-matrix](v2-contracts.md#5-access-matrix) rows
"`/u/<username>` numbers" (one public record for everyone; the owner adds
the `/history` link), "`/u/<username>` match list" (rated matches only,
labelled), and "Pending/deleted account" (profile 404, neutral label).

- The profile's user id stays on the server; page data carries `isOwner`,
  and `/history` still checks the session (H2). Opponent ids reach the
  Worker only for H2's avatar colour; no raw row or `locals.user` enters.
- Page data and HTML, the owner's included, carry no user id, email,
  provider identity, session value, ticket, room code, `seq`, `board_key`,
  `peak_seq`, `last_seq`, RD, volatility, `excluded`, replay, or
  `stats_json`.
- Friendly matches leave no row, id, count, or difference between a
  friendly-only and a new account (P2). Exclusions surface only as the
  ordinary "not ranked yet", and holds as the ordinary "being checked".
- Every profile response is `private, no-store` (session state in the root
  layout, `isOwner` on the page); shared caching waits for proven
  session-independent output, as R3 requires for `/leaderboard`.

## 6. Resource budget

Estimates until E6 records plans and rows read at 5,000 matches for one
account ([§12](v2-contracts.md#12-evidence)), before implementation.

| Item                      | Per profile view                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 round trips            | `resolveProfile`, one four-statement batch, R3's rank read when rated                                                                                |
| Rows read: record, flag   | 2, by primary key; R3's rank read is on R3's budget                                                                                                  |
| Rows read: list           | About 2 per owner row walked until ten rated matches are found, plus about 5 per listed match                                                        |
| Rows read: included       | About 2 per saved match of the owner, plus 1 per processed match                                                                                     |
| Rows written; DO wake-ups | 0; 0                                                                                                                                                 |
| Storage                   | No new table ([§2.5](v2-contracts.md#25-r1-extension)); an index only if E6 finds a plan without one ([§11](v2-contracts.md#11-migration-ownership)) |
| Requests; Worker CPU      | One SSR request per view (plus the existing session read); one `readMatchStats` parse per processed match                                            |

About 370 rows per view for 100 saved games. The worst case walks the whole
owner range twice, friendly games included, as neither `rated` nor the
rating state is on `match_player`: about 25,000 rows at 5,000 saved games,
so 200 such views use D1's 5 million free daily reads. Preview records p95,
CPU, and rows read for new, typical, friendly-heavy, and 5,000-game
accounts; a failure is fixed by a contract change, not an R4 table.

## 7. Somali copy

New keys in `siteContent.so.pages.profile`, behind
`TODO(translation-review)`, use the
[glossary drafts](README.md#somali-glossary-drafts-q4) (Q4). H2's history
keys supply outcome words, end-reason labels (also for the
`forcedJareSpaceMaking` and `bothBlocked` draw groups), streak and form
copy, duration units, and "Eeg ciyaarta"; R2's and R6's keys supply the
rating-state labels (the "reused" rows). `shaxda` and `jare` stay;
`horrayn` follows `/learn`. New templates use only `{n}`.

| Key                                                                    | Draft                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `overview.title` / `explainer`                                         | Diiwaanka tartanka / Tirooyinkan waxay ka yimaadaan ciyaaraha tartanka ee la xisaabiyay oo keliya.                              |
| `overview.rating` / `provisional`                                      | Darajo / Darajo ku meel gaar ah (label of the `?`)                                                                              |
| `overview.peak` / `games` / `bestStreak`                               | Darajada ugu sarreysay / Ciyaaro tartan / Guulaha ugu badan ee isku xigxiga                                                     |
| `overview.rank` / `notRanked`                                          | Kaalin / Weli kaalin ma laha                                                                                                    |
| `overview.rankRule`                                                    | Kaalin waxaa hela ciyaaryahan leh 10 ciyaarood oo tartan ah, darajo degan, iyo ciyaar 90-kii maalmood ee u dambeeyay.           |
| `overview.notRated` / `notRatedBody` / `ratingsUpdating`               | Weli darajo ma laha / Tirooyinku waxay soo baxaan marka ciyaar tartan ah la xisaabiyo. / Darajooyinka waa la cusboonaysiinayaa. |
| `matches.title` / `empty` / `history`                                  | Ciyaaraha tartanka ee u dambeeyay / Weli ciyaar tartan ah ma jirto. / Eeg dhammaan ciyaarahayga                                 |
| Reused: R2 `status.pending` / `held` / `notCounted` / `removed`        | Waa la xisaabinayaa / Waa la hubinayaa / Darajo laguma xisaabin / Darajada waa laga saaray                                      |
| Reused: R6 `ratingStatus.corrected`                                    | Darajada waa la saxay                                                                                                           |
| `matches.rating.up` / `down` / `same`                                  | Darajadu waxay kor u kacday {n} / Darajadu waxay hoos u dhacday {n} / Darajadu isma beddelin                                    |
| `stats.title` / `incomplete`                                           | Tirakoobka Shaxda / Tirakoobku weli ma dhammaystirna ({n} ciyaarood).                                                           |
| `stats.captures` / `capturesPerGame` / `jare` / `repeatedJare`         | Dhagxaan la qabtay / Qabasho ciyaartiiba / Jare / Jare soo noqnoqday                                                            |
| `stats.averageDuration` / `durationNote`                               | Celceliska muddada ciyaarta / Laga bilaabo tallaabadii koowaad ilaa dhammaadka.                                                 |
| `stats.fastestWin` / `noBoardWin`                                      | Guusha ugu dhakhsaha badan / Weli ma jirto                                                                                      |
| `stats.wins.starter` / `second` / `comeback`                           | Guulo isagoo bilaabay / Guulo isagoon bilaabin / Guulo dib u soo kabasho ah                                                     |
| `stats.wins.withAdvantage` / `withoutAdvantage` / `advantageUndecided` | Guulo horrayn leh / Guulo horrayn la'aan / Guulo horrayn aan la go'aamin                                                        |
| `stats.draws.drawTermination`                                          | Ku celcelin ama 80 wareeg oo qabasho la'aan ah                                                                                  |
| `challenge.action` / `hint`                                            | Ku casuun ciyaar / Qol casuumaad ah samee, kadibna xiriiriyaha u dir.                                                           |

## 8. Implementation slices

One commit each, with its tests; E6 passes before slice 3, and an index it
requires lands first as `perf(db): index the profile reads`. Every slice
passes `pnpm lint`, `typecheck`, `test`, `test:worker`, and `build`; slice 9
also `pnpm test:e2e` with `pnpm check:e2e-isolation` green.

1. `feat(db): return a server-only user id from resolveProfile`
2. `test(db): add M1–M10 and long-streak profile fixtures`
3. `feat(db): add readProfileRecord for the public record and rated list`
4. `feat(db): read processed matches for Shaxda statistics`
5. `feat(i18n): add Somali profile statistics copy`
6. `feat(web): load the public record and Shaxda totals on /u/[username]`
7. `feat(web): render the profile overview, rated matches, and statistics`
8. `feat(web): add the profile challenge link` (Should)
9. `test(e2e): show a rated game on both public profiles`

## 9. Acceptance tests

### Unit (Vitest)

- §3.3 mapping: `provisional` false at effective RD exactly 110, true just
  above; a peak below 1500 shows as stored; win rate 1/3 → 33 %, 2/3 →
  67 %; form `WLD` → win, loss, draw; no row → `notRated`.
- Delta: before 1499.5 and after 1500.4 show `0`, not `+1`.
- Each rating state maps to its §3.4 label; a marked match adds "rating
  corrected" unless removed; `bothBlocked` hides at zero;
  no fastest win renders `stats.noBoardWin`. Copy is Somali only.

### Workers and D1 (Workers Vitest pool, Miniflare D1)

- Zero games → `notRated`, no matches, statistics `none`. Friendly-only
  (M1, M9) → identical page data apart from `profile`.
- The sample-matches table holds on both profiles; pending rows (no
  `match_rating` row) show "being calculated" and held rows "being checked",
  counted nowhere.
- Rank equals R3's at one `asOf` for eligible, provisional, 9-game,
  91-day-inactive, and excluded players, and at RD 110, 10 games, 90 days.
- Processed matches with `stats_status` `none` or `error`, `stats_v = 2`,
  or an `ok` row whose JSON fails the schema → `incomplete` with their count
  and no totals; `complete` after the H4 backfill. Unprocessed matches never
  make the section incomplete.
- On H4 golden matches, totals equal the per-seat values summed by hand;
  starter and first-advantage partitions sum to `rated_wins`, draw groups
  to `rated_draws`; the included count equals `rated_games`. Fastest win
  is the minimum normal board win; resignation and claim wins never count.
- 25 processed wins → current 25 wins, best 25 (no 20-row cap); then a
  loss → current 1 loss, best 25; a draw also ends a win run.
- `maintenance = 1` → last published values and `ratingsUpdating`. No
  statement selects `match.replay`; a failing statement makes
  `readProfileRecord` throw.
- `EXPLAIN QUERY PLAN`: `match_player` via `match_player_owner_idx`, every
  other table by primary key or unique index; no `SCAN`.

### Web (Vitest)

- Loader signed out, as owner, as another account, and as an incomplete
  one: only the owner gets `isOwner` and `/history`; missing → 404; alias →
  `302` `no-store`; `private, no-store` always; D1 failure → error page.
- Privacy: `JSON.stringify(data)` and rendered HTML, for owner and
  signed-out requests, contain none of the seeded user ids, emails,
  provider ids, tickets, room codes, internal keys, RD, volatility, replay,
  `stats_json`, or friendly match ids; `data` has no `userId` property.
- 375 px and desktop without horizontal scroll; words on results, deltas,
  and form; empty, not-rated, incomplete, and maintenance states; existing
  metadata and share tests unchanged. The challenge link (Should) is hidden
  for the owner, points to `/online`, and creates no room on load.

### End to end (Playwright)

- Two accounts play a rated game (R2 consent) and a friendly one. Both
  profiles list the rated game, opposite results, one `/match/<id>`, then a
  signed delta after "being calculated"; neither lists the friendly game,
  which both `/history` pages show. Signed out, no `/history` link.

### Sample matches

| ID  | `/u/A` and `/u/B` list                                  | Public numbers             | Shaxda statistics                                                     |
| --- | ------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| M1  | Not listed; `/history` only                             | Not counted                | Not included                                                          |
| M2  | A win, B loss, resignation, signed deltas               | Counted                    | Included; A's win has first advantage undecided, no fastest-win entry |
| M3  | B win, A loss, idle                                     | Counted                    | Included; no fastest-win entry                                        |
| M4  | "Not counted", no delta                                 | Not counted                | Not included                                                          |
| M5  | Draw for both, draw reason                              | Counted as a draw for both | Included; `drawTermination` group                                     |
| M6  | No row                                                  | —                          | —                                                                     |
| M7  | No row                                                  | —                          | —                                                                     |
| M8  | "Rating removed" after the rebuild                      | Excluded after the rebuild | Excluded after the rebuild                                            |
| M9  | Rematch not listed                                      | Not counted                | Not included                                                          |
| M10 | `/u/A` shows M2 with B as the neutral label; `/u/B` 404 | A's M2 event unchanged     | A's M2 statistics unchanged                                           |

## 10. Rollout and rollback

| Environment | Steps                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| dev         | Miniflare D1 with the H1 and R1 migrations (A3's when present); a fixture helper seeds M1–M10, a 25-win streak, and a 5,000-match account.                         |
| e2e         | The shared local D1 ([§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)); tests wait for `save.status = "saved"` and the rating decision before reading profiles. |
| preview     | E6 plans and rows read recorded; H4 backfill run; privacy scans of real owner and signed-out responses; rank checked against `/leaderboard` at the same `asOf`.    |
| production  | Web deploy after R3 is enabled and the H4 backfill has reported its remaining processed matches without usable statistics (target zero).                           |

- Deploy order: web only; an E6-driven index goes migration → web
  ([§6.5](v2-contracts.md#65-deploy-order)).
- Kill switch: none; R4 adds no binding or flag
  ([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)).
  Rollback redeploys the previous web Worker, restoring the V1.1-A profile;
  no data changes. The processor's `maintenance` note keeps working.

### Done when

A player can share a canonical `/u/<username>` whose every number comes
from processed rated events; the ten newest rated matches carry honest
labels and friendly games never appear; statistics are complete or
honestly incomplete; rank equals R3's at the same `asOf`; only the owner
sees `/history`; E6 and the preview privacy and cost checks pass; M1–M10
behave as §9 states. Production verification belongs in the ops record.
