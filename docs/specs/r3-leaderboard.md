# R3 — Leaderboard (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `frozen@5c6d76a` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Wave       | 4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Depends on | R1 (public record in `player_rating`), R2 (which matches are processed), R6-core (exclusions and corrections); A3 if shipped                                                                                                                                                                                                                                                                                                                                                                      |
| Register   | P8, P18, P19, P20                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Contracts  | Consumes [§2.5](v2-contracts.md#25-r1-extension), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§7.3](v2-contracts.md#73-arithmetic-and-reads), [§7.4](v2-contracts.md#74-corrections), [§7.5](v2-contracts.md#75-exclusion-projection), [§8](v2-contracts.md#8-deletion), [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone), [§12](v2-contracts.md#12-evidence). Owns the reads, cursor, and `/api/leaderboard/me` shape (§3). |
| Brief      | `docs/shaxda-v2.md` §10 (R3), §7.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Touches    | `packages/db` (reads; an index only if E6 needs one), `packages/shared` (Zod schemas), `packages/i18n`, `web` (hooks, root layout, top bar, navigation, `/leaderboard`, `/api/leaderboard/me`), tests                                                                                                                                                                                                                                                                                             |

R3 publishes R1's public record as a leaderboard: a cached public list with
keyset pages, a private "your rank" context, and the rank query R4 reuses. It
reads `player_rating` and the account row and writes nothing. R1 owns the
numbers, R2 which matches count, R6-core exclusions and corrections, A3
account states, and R5 the form strip on rows.

## 1. Outcome and non-goals

**Outcome.** Anyone can browse the leaderboard past the first 100. A
signed-in player sees their exact rank with up to three players on each side,
however far down, or why they are not listed. Every number comes from
processed rated events (P8), and R4 shows the same rank.

### Must

1. `/leaderboard`, a Somali, mobile-first SSR page. Rows show rank, current
   avatar, current username (linking to `/u/<username>`), whole-number
   rating, rated games, W/L/D, and the current streak with its kind.
2. Listing and order as §3.1 at one `asOf` per response; pages of 100 by
   keyset (§3.3), never `OFFSET`.
3. Session-independent output behind a 55 s public edge cache (§4.2); a D1
   error is never cached or shown as an empty board.
4. Private `GET /api/leaderboard/me` (§3.5) with the rank and up to three
   neighbours per side, or the reasons for not being listed; and
   `readPublicRankForUser(db, userId, asOf)` for R4, with the same rule.
5. A truthful empty state, and the "ratings updating" note during a
   correction ([§7.4](v2-contracts.md#74-corrections)).
6. Indexed reads with plans recorded in E6; cached p95 < 200 ms in preview.
7. A navigation link, and a link to R2's rated-play explanation on `/learn`.

**Should.** A "most active" list (§4.6), labelled as activity rather than a
ranking, shipped after the Must path is measured.

**Not in R3.** Seasons, tiers, friends filters, weekly rating boards; rating
arithmetic, rated-play policy, pair caps, exclusion tools, and corrections
(R1, R2, R6); the form strip (R5 adds `form` to R3's rows) and the profile
rank display (R4); guest rankings; any stored rank, eligibility flag,
projection table, or write.

## 2. Decisions and dependencies

| ID  | How R3 applies it                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P8  | Every public number comes from `player_rating`, which R1 builds from processed rated events only. Pending, held, and skipped matches never count; R3 has no other source for counts. |
| P18 | Provisional is effective RD > 110 at `asOf`. R3 never tests stored RD: lists use `eligible_until`, the private reasons use R1's effective-RD function. No rating estimates.          |
| P19 | The listing rule in §3.1. E5 reports, before activation, how many simulated players qualify; an empty board ships with the truthful empty state, not a lower bar.                    |
| P20 | Ties break on `board_key`, so a cursor carries `(rating, board_key)`, never a user id, and needs no encryption.                                                                      |

| Dependency      | What it provides                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1              | `player_rating` and `player_rating_board_idx` ([§2.5](v2-contracts.md#25-r1-extension)); `eligible_until`, effective RD, one `asOf` per read ([§7.3](v2-contracts.md#73-arithmetic-and-reads)); maintenance flag and swap (§7.4). |
| R2              | The rating decision that makes a match processed or skipped ([§4.2](v2-contracts.md#42-rating-decision)); the Somali rated-play explanation.                                                                                      |
| R6-core         | `excluded`, projected from the audited exclusion source ([§7.5](v2-contracts.md#75-exclusion-projection)); invalidation and rescission through the §7.4 rebuild.                                                                  |
| A3, once merged | Pending and final states ([§8](v2-contracts.md#8-deletion)), excluded with the predicate of A3's reader helper. Until A3 merges, no account can be pending or final.                                                              |
| V1.1-A          | `user.username`, avatar fields, the `PublicProfile` projection of `resolveProfile`, and session handling in `web/src/hooks.server.ts`.                                                                                            |
| Evidence        | E5 (pending) before activation; E6 (pending) records R3's plans before implementation ([§12](v2-contracts.md#12-evidence)).                                                                                                       |

## 3. Contracts

R3 owns only the reads, cursor, and HTTP surfaces below. The Must path reads
`player_rating`, `user` by primary key, and the one-row maintenance flag (for
the §7.4 note); never the ledger or rating-event tables (§4.6 excepted).

### 3.1 Listing rule and order

A `player_rating` row is **listed** at `asOf` when:

1. `eligible_until > asOf`, meaning effective RD ≤ 110 and a processed rated
   game in the 90-day window ([§7.3](v2-contracts.md#73-arithmetic-and-reads));
   the SQL does no inactivity arithmetic;
2. `rated_games >= 10`;
3. `excluded = 0`; and
4. the `user` row exists, its `username` is not null, and the account is
   active (neither pending nor final, §8).

Order is `rating DESC, board_key ASC` at full precision; rank is 1 plus the
listed rows ahead. Rounded ratings, names, counts, and RD never order rows.
`asOf` is one `Date.now()` per response, bound into each of its reads and
returned with it. Nothing stores a rank or an eligibility flag, so leaving the
list needs no write. Effective RD of exactly 110 is listed; 10 rated games are
listed and 9 are not; the window is half-open, so a last processed rated game
exactly 90 × 86,400,000 ms before `asOf` no longer lists the player.

### 3.2 Read functions

In `packages/db/src/queries/leaderboard.ts`, exported from `@shaxda/db`:

| Function                                        | Returns                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `readLeaderboardPage(db, { after, asOf })`      | `{ rows, next, maintenance }`: up to 100 rows and the next cursor, or `null` |
| `readLeaderboardStanding(db, { userId, asOf })` | `{ standing, maintenance }` (§3.5)                                           |
| `readPublicRankForUser(db, userId, asOf)`       | The rank, or `null` whenever the account is not listed                       |

A row is the `PublicProfile` fields (username, avatar mode, image URL, avatar
colour, initial) plus `rank`, a whole-number `rating` (R1's display rounding),
`ratedGames`, `wins`, `losses`, `draws`, and `streak` (kind and length, or
null). The row queries also select `player_rating.form`, so R5 adds its
`form` field to public and around-you rows without a new statement.

- A page is one D1 batch: the page query, with `LIMIT 101` to detect a next
  page, and the maintenance flag.
- Keyset term: `rating <= :r AND (rating < :r OR board_key > :k)`, so the
  plan seeks straight to the cursor.
- Standing and rank first read the viewer's row and account (2 rows; the
  standing adds the maintenance flag); an unlisted viewer stops there. A
  listed viewer gets one batch that re-reads the viewer's key by subquery,
  counts listed rows ahead, and fetches up to three neighbours each side
  (those above by a reverse index walk), so every part sees one state.

### 3.3 Cursor

`/leaderboard?after=<token>`; the token is base64url of the JSON array
`[1, rating, boardKey]`: a version tag and the last row's full-precision
rating and `board_key`. JavaScript's shortest round-trip number text keeps the
rating exact. A Zod schema in `packages/shared` requires at most 96
characters, version 1, a finite rating, and a positive safe integer; anything
else is a 400. The token holds no user id and is neither encrypted nor signed
(P20). The server computes each page's first rank by counting the listed rows
ahead of the cursor key in the same batch, so a hand-edited token can move
where a page starts but can never print a wrong rank; at Shaxda's scale the
count reads at most the number of listed players.

### 3.4 HTTP surfaces

| Surface                                  | `Cache-Control`                                                    | Session        | Response                                                   |
| ---------------------------------------- | ------------------------------------------------------------------ | -------------- | ---------------------------------------------------------- |
| `GET /leaderboard` and its `__data.json` | `public, max-age=0, s-maxage=55`, set only after a successful read | never resolved | 100 rows, `asOf`, next link, maintenance note              |
| `GET /leaderboard?after=<token>`         | same                                                               | never resolved | The next page; `noindex`, canonical link to `/leaderboard` |
| Any other query string                   | none                                                               | never resolved | 302 to the canonical URL, before any D1 read               |
| Malformed `after`                        | none                                                               | never resolved | 400 Somali error page, before any D1 read                  |
| `GET /api/leaderboard/me`                | `private, no-store`                                                | session only   | §3.5; 503 JSON on a D1 error, still `no-store`             |

Processing lands seconds after the save, so 55 s keeps a new player's
appearance within a minute. The pinned adapter answers from `caches.default`
before SvelteKit runs (keyed by URL only, per data centre) and offers it every
200 whose `Cache-Control` is not private, no-cache, or no-store (never a 302,
400, 500, or 503), so session independence (§4.2) must come first.

### 3.5 `/api/leaderboard/me` response

| Field                 | Values                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account`             | Always: the top-bar state the root layout would return for this session, including A3's pending-deletion state once A3 exists                       |
| `status`              | `signedOut` (also a pending-deletion session, which A3 handles as signed out), `incomplete`, or `complete`; only `complete` has the fields below    |
| `asOf`, `maintenance` | As on the page                                                                                                                                      |
| `standing`            | `{ kind: "ranked", rank, row, above, below }` (at most 3 rows each, page order) or `{ kind: "unranked", rating, provisional, ratedGames, reasons }` |

| Reason (fixed order) | Condition at `asOf`                                                   |
| -------------------- | --------------------------------------------------------------------- |
| `tooFewGames`        | `rated_games < 10`, or no `player_rating` row (then `rating` is null) |
| `provisional`        | R1's effective RD > 110                                               |
| `inactive`           | `asOf >= last_rated_at + 90 days`                                     |
| `excluded`           | `excluded = 1`                                                        |

`eligible_until <= asOf` holds exactly when `provisional` or `inactive` does.
Tests check responses against strict schemas, so a stray `userId` fails; the
client strips unknown keys, so an additive field never breaks a cached PWA.

## 4. Behaviour and failure handling

### 4.1 Public page

- Validate the query (302 or 400) before touching D1; capture `asOf`, run the
  page batch, and only then set the cache header and render.
- Each page shows its `asOf` (UTC, in `<time datetime>`) and claims no
  cross-page snapshot. Over an unchanged set, cursors return every listed row
  once, in order, with continuous ranks; after ratings change or a correction
  renumbers `board_key`, a row at a page boundary may repeat or be skipped.
- Past the last row: "no more players" and a link to page 1. A healthy empty
  board shows the empty state with the three requirements, never sample rows.
- With `maintenance = 1`, show the last published rows and the note. D1
  serialises queries during a swap, so an uncached read may wait (§7.4).
- A D1 error or missing binding throws: SvelteKit renders the error page with
  a 5xx status and no public cache header, never an empty board.
- A hand-edited cursor can shift where its own URL starts, but not the ranks,
  row data, page 1, the standing, or R4's rank: ranks are always counted.

### 4.2 Session independence

1. `web/src/hooks.server.ts` treats `/leaderboard` (and the Should route) like
   the prerendered game routes: no `getSession`, so `locals.user` is null and
   Better Auth cannot send a refreshed-session `Set-Cookie`. It also sets a
   `locals` flag for these routes.
2. With that flag, the root `+layout.server.ts` returns a `deferred` account
   status, never `null` (signed out). It gains no `route` or `url` dependency,
   so client navigation does not rerun it and prerendered `/local` and
   `/online` keep today's behaviour.
3. `AppTopBar` treats `deferred` as unknown: it keeps the account it already
   shows, or a neutral account button linking to `/account`, then adopts the
   `account` from `/api/leaderboard/me` until a full load or `invalidateAll`.
4. HTML, `__data.json`, and headers carry no cookie-derived value,
   `Set-Cookie`, or `Vary: Cookie`; one fixture and `asOf` give byte-identical
   bodies signed in and out. Later layouts, hooks, or components on these
   routes (an analytics identity, say) must keep this.

### 4.3 Private standing

- Signed out (or pending deletion) gives `signedOut`; incomplete gives
  `incomplete`, with a link to `/register`; complete gives a standing at a
  fresh `asOf`, up to 55 s fresher than the cached page. Each shows its time.
- Ranked only when listed. Neighbours are the listed rows just ahead and
  behind (`rank − 3` to `rank + 3`, fewer at either end); rank 10,000 costs
  one batch, and the client never loops through pages.
- Unranked shows the rounded rating with R1's `?` when provisional (the only
  `?` on these routes), the rated-game count, and the reasons in order; `excluded`
  reads only "not currently listed". No rank, no neighbours.
- The card stays visible across pages without covering page controls on a
  narrow screen. On a page that holds the viewer (matched by username), it
  links to and highlights that row client-side; the HTML never marks it.
- On a D1 error the card offers a retry. Loading, error, and retry states
  never show a number, a rank of zero, or an earlier viewer's context.

### 4.4 Freshness

The page trails a processed match, exclusion, deletion request, rename, swap,
or `eligible_until` exit by at most 55 s; the standing and R4's rank see each at
once. A time-based exit needs no write. If the processor stops, the board
keeps the last processed state until R1's minute sweep catches up; a pending
match is uncounted, never a guessed rank.

### 4.5 Snapshot fallback, only on measured failure

If preview misses cached p95 < 200 ms or live reads break the §6 budget, R3
may move to a snapshot rebuilt from `player_rating` at one `asOf`, refreshed
at most once a minute and after processed events, swapped atomically for
page, standing, and R4 alike, and still inside the one-minute gate. It adds a
table and a job, so it needs a
[contract-change commit](README.md#contract-changes-after-the-freeze).

### 4.6 Most active (Should)

`/leaderboard/active` (rules of §3.4 and §4.2) lists up to 20 active accounts
with a current username and `excluded = 0` by processed rated games
(`match_rating` status `processed`) ended in the 7 days up to `asOf`, then
`board_key`; counts only, under an activity heading, no ranks or ratings. It
is R3's one ledger read (`match_rated_ended_idx`, then primary keys); E6
records its plan first.

## 5. Privacy and access

R3 implements the [§5](v2-contracts.md#5-access-matrix) rows `/leaderboard`
(public edge-cached list, private `no-store` rank context, session-independent
HTML first) and pending/deleted account (excluded from leaderboard reads).

- Public output carries `PublicProfile` fields, rounded ratings, counts,
  streaks, ranks, `asOf`, cursors, and R5's `form` only: never a user id,
  email, provider identity, session, ticket, RD, or volatility. A cursor alone
  holds `board_key` and one full-precision rating (P20); neither identifies
  an account.
- A user id reaches the reads only from the server session or R4's
  server-side profile resolution; `/api/leaderboard/me` ignores any user or
  username parameter and sends no CORS headers.
- Pending or final accounts are unlisted, have no rank, count toward no rank,
  and are never neighbours; their `player_rating` rows and every opponent's
  rating stay unchanged (M10). A pending-deletion session is handled as
  signed out, as A3 specifies: no standing. Rows join `user` by id, so a
  username claimed again after A3's 30-day hold never inherits the old rank.
- Excluded accounts are unlisted and uncounted; no response carries the
  operator's reason. Guests never reach the ledger.
- Both routes stay out of the PWA caches. Only page 1 is indexable. No
  third-party scripts; avatars load lazily, as on profiles.

## 6. Resource budget

`N` is the number of `player_rating` rows; `d` is the listed share of walked
rows (lower when provisional or inactive players sit among high ratings).

| Operation                    | How often                                | D1                          | Rows read (approx.)                          |
| ---------------------------- | ---------------------------------------- | --------------------------- | -------------------------------------------- |
| Page (first or cursor)       | per URL, per data centre, per 55 s       | 1 batch                     | 101 ÷ d `player_rating` + ≤ 101 `user` + 1   |
| Standing, unlisted viewer    | every signed-in page view (never cached) | 1 batch                     | 3                                            |
| Standing, listed viewer      | every signed-in page view (never cached) | 2 batches                   | 3 + (rank + 6) ÷ d + rank + 6, at most ≈ 2N  |
| Standing, signed out         | every anonymous page view                | none                        | 0                                            |
| `readPublicRankForUser` (R4) | per profile load                         | 1 read, + 1 batch if listed | 2, or 2 + rank ÷ d + rank                    |
| Most active (Should)         | per cache miss                           | 1 query                     | ≈ 4 per processed rated match in 7 days + 20 |

- At `N` = 5,000 and d = 1, a page reads about 200 rows and a standing at rank
  4,000 about 8,000; at d = 0.1 the first page reads about 1,100.
- Writes 0; Durable Object wake-ups 0; one extra request per page view; no
  new storage unless E6 justifies the `eligible_until` index §2.5 allows.
- Budget: an uncached page reads ≤ 2,000 rows and spends ≤ 100 ms in D1.
- E6 (pending) records `EXPLAIN QUERY PLAN` and `meta.rows_read` for page 1, a
  deep page, the last-rank count, both neighbour reads, and the Should list on
  5,000 seeded rows at d ≈ 0.9 and d ≈ 0.1, before implementation. Pass: a
  `SEARCH` on the board index or a primary key, no scan of `player_rating` or
  `user`, no temp B-tree for ordering. If the d ≈ 0.1 page breaks the budget,
  R3's migration adds the `eligible_until` index; if still over, see §4.5.

## 7. Somali copy

Keys live in `packages/i18n` under `siteContent.so.pages.leaderboard` (and
`siteContent.so.nav.leaderboard`), behind `TODO(translation-review)`, using
the [glossary drafts](README.md#somali-glossary-drafts-q4) and H2's W/L/D and
streak drafts.

| Key                                                   | Draft                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nav.leaderboard`, `title`                            | Miiska darajada                                                                                                                                                                                                         |
| `description`                                         | Ciyaartoyda Shaxda oo lagu kala horreysiiyay darajada ciyaaraha tartanka.                                                                                                                                               |
| `intro`                                               | Darajada ayaa kala horreysiisa ciyaartoyda. Waxaa ku jira ciyaaryahan kasta oo ciyaaray ugu yaraan 10 ciyaarood oo tartan ah, darajadiisuna xasishay, kuna ciyaaray ciyaar tartan ah 90-kii maalmood ee la soo dhaafay. |
| `rulesLink` / `updatedAt`                             | Sida ciyaaraha tartanku u xisaabmaan / La cusboonaysiiyay {time} (UTC)                                                                                                                                                  |
| `maintenance`                                         | Darajooyinka waa la cusboonaysiinayaa. Waxaad aragtaa xaaladdii ugu dambaysay.                                                                                                                                          |
| `columns.rank` / `player` / `rating` / `games`        | Kaalin / Ciyaaryahan / Darajo / Ciyaaro tartan                                                                                                                                                                          |
| `columns.wins` / `losses` / `draws` / `streak`        | Guul / Guuldarro / Barbaro / Isku xigxig                                                                                                                                                                                |
| `streak.win` / `loss` / `draw`                        | {n} guul oo isku xigxiga / {n} guuldarro oo isku xigxiga / {n} barbaro oo isku xigxiga                                                                                                                                  |
| `next` / `backToTop` / `endOfList` / `invalidPage`    | Ciyaartoyda xigta / Ku noqo bogga koowaad / Ciyaartoy kale ma jiraan. / Boggan miiska darajada lama helin.                                                                                                              |
| `empty.title` / `empty.body`                          | Weli cidna kuma jirto miiska darajada / Ciyaaryahanka ugu horreeya ee buuxiya shuruudaha kor ku xusan ayaa halkan ka soo muuqan doona.                                                                                  |
| `me.title` / `me.rank` / `me.around` / `me.jump`      | Kaalintaada / Kaalinta {rank}aad / Kuwa kuu dhow / U gudub safkaaga                                                                                                                                                     |
| `me.signedOut` / `me.incomplete`                      | Gal si aad u aragto kaalintaada. / Dhammee isdiiwaangelinta si aad kaalin u hesho.                                                                                                                                      |
| `me.unranked` / `me.notRated` / `me.provisionalLabel` | Weli kuma jirtid miiska darajada. / Weli ciyaar tartan ah laguuma xisaabin. / Darajo ku meel gaar ah                                                                                                                    |
| `me.reasons.tooFewGames` / `provisional`              | Waxaad u baahan tahay {remaining} ciyaarood oo tartan ah oo kale; 10 ayaa loo baahan yahay. / Darajadaadu weli ma xasilin; ciyaaro tartan ah oo kale ayaa xasiliya.                                                     |
| `me.reasons.inactive` / `excluded`                    | 90-kii maalmood ee la soo dhaafay kuma aadan ciyaarin ciyaar tartan ah. / Hadda laguma soo bandhigayo miiska darajada.                                                                                                  |
| `me.loading` / `me.error` / `me.retry`                | Kaalintaada waa la raadinayaa… / Kaalintaada lama soo saari karo hadda. / Isku day mar kale                                                                                                                             |
| `active.title` / `active.note` / `active.games`       | Ugu firfircoon 7-dii maalmood ee la soo dhaafay / Tani ma aha kaalin: waxay tirinaysaa ciyaaraha tartanka ee la xisaabiyay. / {n} ciyaarood oo tartan ah                                                                |

A streak label always names its kind, so a draw run never reads as a win
streak. At 375 px, rank, player, and rating come first and the rest wraps
below without horizontal scrolling; rows use table semantics and text labels.

## 8. Implementation slices

1. `feat(shared): add leaderboard cursor and standing schemas`
2. `test(db): cover leaderboard listing boundaries and order`
3. `feat(db): read leaderboard pages, standing, and public rank`
4. `perf(db): index eligible_until for the leaderboard walk` (only if E6
   requires it)
5. `refactor(web): defer account data on session-free routes`
6. `feat(i18n): add Somali leaderboard copy`
7. `feat(web): add the public leaderboard page`
8. `feat(web): add the private leaderboard standing`
9. `feat(web): link the leaderboard from navigation`
10. `test(e2e): cover leaderboard listing and private rank`
11. `feat(web): add the most-active list` (Should, after measurement)

## 9. Acceptance tests

**Unit** (`packages/shared`, `web`): the cursor round-trips exact doubles
(`1623.4471829301`, `1500`, `1499.9999999999998`) and rejects a wrong version,
a non-finite rating, a non-positive or fractional key or rank, an over-long
token, and bad base64url or JSON; strict schemas reject extra keys; only
session-free routes get `deferred`, which shows no sign-in prompt; reasons
render in order, `excluded` only as the neutral line, `?` only in the card.

**Workers and D1** (`packages/db`, Miniflare):

| Case                                                                       | Expected                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Stored post-event RD exactly 110; RD just above 110                        | Listed until the next day boundary (its `eligible_until`); never listed, `provisional`      |
| RD 30, volatility 0.06, so the 90-day rule binds first                     | Listed at `last_rated_at + 90 d − 1 ms`; not at `+ 90 d`; `inactive`                        |
| 10 against 9 rated games                                                   | Listed against `tooFewGames`                                                                |
| The same rows read at two `asOf` values across `eligible_until`            | Listed, then not listed, with `meta.rows_written = 0` and no row changed                    |
| `excluded = 1`, pending, final, missing `user` row, or null `username`     | Never listed, no rank, counted toward no rank, never a neighbour                            |
| Equal full-precision ratings; equal rounded ratings                        | Ordered by `board_key`; page, standing, and rank agree                                      |
| 250 listed rows among 250 unlisted                                         | Pages of 100, 100, 50; each listed row once; ranks 1–250 continuous; no `OFFSET` in the SQL |
| Viewer at rank 1, a middle rank, rank 150, and the last rank               | Correct rank; 0/3/3/3 rows above and 3/3/3/0 below                                          |
| Viewer without a `player_rating` row                                       | `unranked`, null `rating`, `tooFewGames`                                                    |
| Reasons against `eligible_until` over a grid of `asOf` values              | `eligible_until <= asOf` exactly when `provisional` or `inactive`                           |
| `readPublicRankForUser` for every row at one `asOf`                        | Page position and standing rank; `null` for every unlisted row                              |
| Username or avatar change; `maintenance = 1`; failing D1 binding           | New details at the same rank; last rows with `maintenance: true`; a throw, never empty rows |
| `EXPLAIN QUERY PLAN` for page, deep page, rank count, both neighbour reads | Index search; no table scan; no temp B-tree for ordering                                    |

**Sample matches.** Each fixture runs R1's processor (and R6's rebuild for M8)
over a seeded ledger; R3 then reads the board.

| ID     | Fixture                                                | On the board                                                                                                                            |
| ------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| M1, M9 | Friendly game; friendly rematch in a rated room        | No change for either player                                                                                                             |
| M2     | Rated, B resigns in placement                          | A +1 win, B +1 loss; streaks, form, and ranks follow the new rows                                                                       |
| M3     | Rated, idle claim, A loses                             | A +1 loss, B +1 win                                                                                                                     |
| M4     | Same pair's 4th rated game in 24 h (`skipped:pairCap`) | Counts, W/L/D, streak, form, and rating unchanged for both                                                                              |
| M5     | Rated draw                                             | +1 draw each; streak kind `draw`                                                                                                        |
| M6, M7 | No ledger row                                          | Nothing changes                                                                                                                         |
| M8     | Rated A win, then invalidated and rebuilt              | After the swap the game is gone from both players' counts, W/L/D, streak, form, and ratings                                             |
| M10    | B requests deletion after M2, then finalizes           | From the request on, B is unlisted with no rank and those ranked below B move up one place; A's row (with M2) and B's row are unchanged |

**Web** (loader and endpoint): an unknown parameter gives a 302 and a
malformed cursor a 400, both without a D1 call or cache header; success sets
`public, max-age=0, s-maxage=55`, and a throwing read gives a 5xx without it;
no `Set-Cookie` or `Vary: Cookie`; HTML and `__data.json` are byte-identical
anonymous and signed in at a fixed clock, with no seeded user id, email,
Google name, or session token; `/api/leaderboard/me` covers every status (a
pending-deletion session gets `signedOut` with A3's top-bar state), ignores
`?userId=` and `?username=`, and is `private, no-store` even on 503;
the top bar shows the right account on `/u/x` → `/leaderboard` → `/account`
and on a direct `/leaderboard` load followed by `/u/x`.

**End to end** (local fixtures, shared D1 per
[§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)): a player seeded with 9
rated games and a settled RD finishes a 10th rated game, and after processing
a `/leaderboard` request with a `no-cache` header (skipping the adapter's
cache lookup) lists them; the next link reaches rank 101; a viewer at rank
150 sees the card and six neighbours; rows link to `/u/<username>`; 375 px
has no horizontal scroll.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:worker`,
`pnpm build`, `pnpm test:e2e`, and `pnpm check` (with `check:e2e-isolation`
and `check:hibernation`). Tests never run remote migrations.

## 10. Rollout and rollback

| Environment | Steps                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev, e2e    | Local Miniflare D1 with every migration through R1's and R6-core's; fixtures only.                                                                                                                                                                                                                                                                                                                                                                      |
| preview     | Once R1, R2, and R6-core run in preview: apply R3's index migration explicitly if E6 required one, then deploy the web preview. Check that a real qualifying game appears within a minute, an unlisted player, rank beyond 100, identical anonymous and signed-in bytes, no D1 read for a repeat request within 55 s, a time-window exit, a rename, and the note in a rehearsed correction. Record plans, p95, rows read, and completion-to-visibility. |
| production  | The same order, after E5 is recorded and the preview checks pass.                                                                                                                                                                                                                                                                                                                                                                                       |

- Deploy order: the index migration, if any, then the web Worker
  ([§6.5](v2-contracts.md#65-deploy-order)). No game Worker change and no new
  binding, job, or kill switch (§10.3).
- Rollback: redeploy the previous web Worker version. R3 writes nothing, so
  nothing is lost; cached pages expire within 55 s; an added index can stay.
- Monitoring: D1 duration and `meta.rows_read` per read, without user ids.
  Activation waits for E5; an empty predicted board still ships (P19).

**Done when** the public list and deep pages work; a signed-in player sees an
exact rank with neighbours or a truthful unranked state; R4 shows the same
rank; no private data reaches a public response or the edge cache; cached p95
is under 200 ms in preview; a newly listed player appears within a minute on
the healthy path; E5 and R3's E6 plans are recorded; and §9 passes. A saved
spec alone is not shipment.
