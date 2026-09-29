# H2 — Match History and Match Detail (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                                   |
| Wave       | 1 (with H1 and X1a)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Depends on | H1                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Register   | F2, F8, P2, P5, P8 ([register](README.md#decision-register))                                                                                                                                                                                                                                                                                                                                                                                     |
| Contracts  | Consumes [§2.1](v2-contracts.md#21-h1-tables), [§2.3](v2-contracts.md#23-public-match-id), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§6.2](v2-contracts.md#62-server-to-client), [§8](v2-contracts.md#8-deletion), [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e), [§12 E6](v2-contracts.md#12-evidence); from R1, `match_rating` in [§2.5](v2-contracts.md#25-r1-extension). Owns none. |
| Brief      | `docs/shaxda-v2.md` §9 (H2)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Touches    | `packages/db` (read queries, test fixtures), `packages/shared` (history schemas), `packages/i18n` (copy, `/legal`), `web/`, `tests/e2e/`, `docs/ops/`                                                                                                                                                                                                                                                                                            |

H2 is read-only: `/history` for the signed-in owner, `/match/<id>` for one
match (public when rated, participants only when friendly), the save status
and a "view match" link in the `/online` result overlay, and the wave-1
`/legal` disclosure.
Ledger writes and `matchStatus.save` stay with H1, replay with H3, the stats
panel with H4, rating numbers with R1 and R4, the public rated-game `/legal`
text with R2, and deletion states with A3.

## 1. Outcome and non-goals

**Outcome.** Both players of a saved match find it in `/history` and open
its page. A rated match page is public and shareable; to anyone else a
friendly match is indistinguishable from one that does not exist.

### Must

1. `/history`, owner only, newest first, 20 per page: opponent (current name
   and avatar, or the neutral label), outcome, reason, rated/friendly or
   quick label, date, duration, final pieces `mine – theirs`, and links to
   the match and the opponent; cards below `md`, grid rows above. Filters
   `all`, `wins`, `losses`, `draws`, `rated`, `friendly`; separate empty
   states for no games and an empty filter; on the first page, a summary of
   all saved games (games, W/L/D, win rate, current streak, recent form).
2. `/match/<id>`: both players, result, reason, date and time (UTC),
   duration, mode, rated/friendly, starting seat, first advantage and how it
   was decided, final pieces, captures, action count, profile links, and the
   H3/H4 insertion point, with access per contracts §5.
3. The save status and a "view match" link in the `/online` result overlay
   (§3.3), and `/history` links in the account panel and on `/account`.
4. Somali copy and the wave-1 `/legal` disclosure (§7); rating-status labels
   after R1's migration (§3.4).

**Should:** opponent-username search (alias-safe), a `from`/`to` UTC date
filter, and times in the viewer's time zone after hydration.

### Not in H2

- D1 writes, Durable Object, game Worker, or protocol changes; a migration
  only if E6 demands an index (§6).
- Replay and `?a=<index>` (H3; query parameters are ignored, so `?a=` never
  404s), the stats panel (H4), rating numbers and history (R1, R4, R5),
  profile match lists and the owner's `/history` action on `/u/<username>`
  (R4), the rated-public `/legal` text (R2), and deletion flows (A3).
- Edge caching, dynamic OG images, hiding or reporting a match, and guests,
  whose games are never saved (F8).

## 2. Decisions and dependencies

| ID  | How H2 applies it                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| F2  | A rated match page is public and its OG names both players and the result; a friendly match is shown only to its two players.                         |
| F8  | Every row is account vs account; the copy says guest games are not saved.                                                                             |
| P2  | Visibility reads `match.rated` and nothing else. A cap-skipped or invalidated rated match stays public with its label (§3.4).                         |
| P5  | Names and avatars come from the current `user` row at read time; pending and deleted accounts get the neutral label (§4.3).                           |
| P8  | H2 shows no public numbers. `/history` lists all saved games, each labelled rated or friendly, and its owner-only summary says it counts all of them. |

| Dependency | What it provides                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1         | The §2.1 rows; `matchStatus.save`; `matchIdSchema` in `packages/shared` (the §2.3 pattern, shared with `save.matchId`); the ledger writer in `@shaxda/db/match`, which H2's fixtures call; the shared local D1 in e2e (§10.4). |
| E6         | Plans and rows read for H2's queries at 5,000 matches for one owner, recorded before implementation (§6).                                                                                                                      |
| R1         | `match_rating` (§2.5) for the rating-status labels.                                                                                                                                                                            |
| R2         | The first rated rows and the `/legal` paragraph about public rated games.                                                                                                                                                      |
| A3         | Pending and final account states: A3 moves H2's one neutral-account predicate (§4.3) into its reader helper and sends a pending owner from `/history` to its status page.                                                      |

## 3. Contracts

H2 owns no section of the contracts: it reads §2.1 and obeys §5 and §8. The
interfaces below are its own; H3, H4, and R4 build on them.

### 3.1 Read queries

`packages/db/src/queries/history.ts`, exported from the bare `@shaxda/db`
entry that only the web Worker imports (never `@shaxda/db/match`): raw
read-only statements. `toPublicProfile` moves out of `resolveProfile` so
both modules share it.

| Function                                                      | Returns                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `readHistoryPage(db, { userId, filter, cursor, limit = 20 })` | `{ rows, nextCursor }`, reading `limit + 1` rows                |
| `readHistorySummary(db, userId)`                              | counts by result and the newest 20 results                      |
| `readMatchForViewer(db, matchId, viewerUserId \| null)`       | `{ kind: "found"; match; viewerSeat }` or `{ kind: "missing" }` |

H2 selects only what §1 displays: `match.id`, `mode`, `rated`,
`starting_seat`, `first_advantage_seat`, `first_advantage_by`,
`winner_seat`, `end_reason`, `online_end_reason`, `action_count`,
`started_at`, `ended_at`; per seat `result`, `pieces_left`, `captured`; the
current `user` name and avatar; after R1, the `match_rating` status. H2's
statements select nothing else: no `seq` (of either table), `replay`,
`rules_v`, `replay_v`, stats columns, `payload_hash`, room columns,
`consent_policy_v`, or `saved_at`. H3 (replay) and H4 (stats) add their own
columns behind the same access check; no reader ever selects `seq`,
`payload_hash`, or the room columns. User ids never leave the module.

`readMatchForViewer` is the whole access rule. It returns the same `missing`
for an unknown id, a row without exactly seats A and B, and a friendly row
whose viewer is signed out or not one of its `user_id`s. H3 and H4 extend it
or call it first; nothing else decides access to a match.

The page query reads the owner's range of `match_player_owner_idx`
(`mp.user_id = ?`, `ORDER BY mp.ended_at DESC, mp.match_id DESC`,
`LIMIT 21`, so no sort). It joins `match` by `id` and the opponent seat by
primary key through `CROSS JOIN`, which keeps that range the outer loop
(never `match_rated_ended_idx`), and `user` through `LEFT JOIN`. The filter
(`mp.result = ?` or `m.rated = ?`) and the cursor
(`(mp.ended_at, mp.match_id) < (?, ?)`, which holds the range across equal
`ended_at`) are fixed fragments, never `?n IS NULL OR …`. The summary
counts the owner's rows by result and reads the newest 20; the match read
takes the row by `id` and both seats `LEFT JOIN user`.

### 3.2 History parameters and page data

- `historyFilterSchema` is the six names with `.catch("all")`. `after` is
  `base64url("<ended_at>:<match_id>")` of the last row shown;
  `parseHistoryCursor` returns `null`, the first page, unless `ended_at` is
  a non-negative integer and `match_id` matches §2.3. Both live in
  `packages/shared/src/history/schemas.ts`.
- Pagination is forward-only. Invalid values fall back to defaults, never a
  400; `nextHref` keeps the filter; an empty cursor page links to the first.
- `Participant` is `{ kind: "member"; profile: PublicProfile; href }` or
  `{ kind: "neutral" }`. Page data adds `visibility` (`public` or
  `participants`), `viewerSeat`, `meta`, and `ratingNote` to the §1 fields.

### 3.3 Result-overlay link

H2 reads `matchStatus.save` (contracts §6.2) and adds no message.
`OnlineGameController` tracks it only for the displayed `matchNumber`; an
older match's save and a missing `save` (guest seats, pre-play endings) show
nothing. `pending` and `stalled` show a quiet status line
(`online-save-status`, `role="status"`); `saved` with a `matchId` that
passes `matchIdSchema` sets `savedMatchId`. Both clear on a new match number
and in `resetDisplayedRoomState`. `GameResultOverlay` renders a
`GameResultAction` with `href` as a `ButtonLink`, keeping focus on the first
action; `OnlineTabletop` adds `online-view-match` after rematch, never
first.

### 3.4 Rating-status labels (after R1's migration)

The slice adds `LEFT JOIN match_rating mr ON mr.match_id = m.id`, a key
lookup, and selects only `mr.rating_status` and `mr.rating_skip_reason`. No
row means pending (contracts §2.5).

| `match.rated` | `match_rating`           | Label on the row and the match page                        |
| ------------- | ------------------------ | ---------------------------------------------------------- |
| 0             | any, or none             | "Saaxiibtinimo" only                                       |
| 1             | none                     | "Tartan" and "Waa la xisaabinayaa"                         |
| 1             | `held`                   | "Tartan" and "Waa la hubinayaa"                            |
| 1             | `processed`              | "Tartan" only (the change is on R1's overlay, R4's list)   |
| 1             | `skipped`, `pairCap`     | "Tartan" and "Darajo laguma xisaabin"                      |
| 1             | `skipped`, `invalidated` | "Tartan" and "Darajada waa laga saaray"; the result stands |

The labels come from R2's single mapping (`web/src/lib/rated-play/label.ts`),
so the overlay, `/history`, `/match/<id>`, and R4's list always agree.
R6-core adds "Darajada waa la saxay" (rating corrected) to that mapping for
a match its correction changed, beside the labels above unless invalidated,
with one primary-key lookup on `rating_correction_mark` in these reads.
During an R1 correction the labels show the last published decision
(contracts §7.4). Before this slice, rated rows show "Tartan" only; none
exist until R2 and R1 activate.

## 4. Behaviour and failure handling

### 4.1 Loaders

Both routes are `prerender = false`, server `load` only, and set
`cache-control: no-store` first (§5).

- `/history` (`web/src/routes/history/+page.server.ts`):
  `requireCompleteAccount(locals, "/history")`, moved from `/account` to
  `web/src/lib/server/account.ts` with a return-path parameter (today it
  always returns to `/account`), redirects (303) to
  `/login?returnTo=/history` or `/register?returnTo=/history`. The first
  page reads the summary and the page with `Promise.all`, later pages only
  the page. The summary ignores the filter.
- `/match/<id>` (`web/src/routes/match/[id]/+page.server.ts`): a failed
  `matchIdSchema.safeParse(params.id)` throws
  `error(404, "match-not-found")` before any D1 call, and `missing` from
  `readMatchForViewer` throws the same. Query parameters are ignored.
- A missing `DB` binding throws, as on `/account`; a D1 error is a 500 for
  every id alike, never partial data. The 404 uses the Somali `notFound`
  variant of `+error.svelte`, which already has `noindex`.

### 4.2 Display rules

- A set `online_end_reason` replaces the synthetic `resignation` with its
  sentence naming the absent or idle seat (the loser); otherwise the engine
  sentence from `messages.so.localGame.result.reasons`. Every engine reason
  keeps a label, although E4 shows two cannot occur in legal play.
- A `NULL` first advantage reads "not decided" (the game ended in
  placement, M2). Duration is `ended_at − started_at`, from play began (P1).
- SSR formats dates in UTC inside `<time datetime>` with
  `Intl.DateTimeFormat("so-SO", { dateStyle: "medium", timeZone: "UTC" })`.
  `web/src/lib/history/format.ts` exports `formatDuration`,
  `formatMatchDate`, `formatMatchDateTime`, `computeStreak`, and
  `recentForm` for R4 and R5 to reuse.
- Streak and form use the newest 20 results (`20+` when a run fills them;
  draws are their own runs); win rate is wins over all games; form chips
  put the word in `aria-label`. No page mentions a rematch or a room code.

### 4.3 Participants and the neutral label

- A seat is neutral when its `user` row is missing or has no username,
  decided in one place (`isNeutralAccount`). A3 moves it into its reader
  helper and adds the pending and final states (contracts §8).
- A member shows its `PublicProfile` and links to `profilePath` of the
  current username, so links are alias-safe and a reclaimed name never
  inherits old matches. A neutral seat shows the label, a plain placeholder
  avatar, no link, and no old name, in a rated match's OG text too (M10).

### 4.4 Presentation

- Match page: player blocks (avatar, name, seat token, result, "(Adiga)" for
  the viewer) around the headline; the reason; the H3/H4 insertion point (a
  code comment, no empty node, no disabled replay button); the details;
  then `ShareLink` when public, or the private note when not, since a shared
  private link would be a 404.
- `ShareProfile.svelte` wraps a new `web/src/lib/components/ShareLink.svelte`
  with the same Web Share → clipboard → failed flow; `matchPath` and
  `matchUrl` join `profilePath` in `web/src/lib/site/metadata.ts`.
  `PageMeta` gains `noindex`: a public match gets title `{a} iyo {b}`, a
  description by result, and the static `og-image.png`; a participant match
  gets the generic title and description with `noindex`, as `/history` does.
- `/history` rows are `<article>`s with two links (profile, match); filters
  and "older" are plain links. `topBarConfig.ts` adds `history` after the
  profile item for complete accounts; `/account` gets a `ButtonLink`.

## 5. Privacy and access

| Contracts §5 row        | H2 implementation                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/match/<id>`, rated    | Full to everyone. Title and OG carry current names and the result. Indexable. `ShareLink`.                                                                       |
| `/match/<id>`, friendly | Signed out or unrelated: the same 404 as an unknown or malformed id, on the page and on `__data.json`. Participants: full page, `noindex`, generic OG, no share. |
| `/history`              | Signed out → login redirect. Owner key from the session only; no user or username parameter exists. `noindex`.                                                   |
| Pending/deleted account | The neutral label wherever H2 renders a player, rated OG text included.                                                                                          |

- `no-store` covers every response of both routes, `__data.json` included:
  rated pages vary by session (top bar, "(Adiga)"), and one header for every
  outcome keeps the 404s identical.
- One code path makes the 404: same status, message, headers, and body,
  except the requested id echoed in SvelteKit's hydration data. Unknown and
  private ids run the same reads.
- No loader returns a user id, email, room code, provider identity, ticket,
  `seq`, or raw replay or stats JSON. H3's validated replay and H4's parsed
  statistics join the page data only after `readMatchForViewer`.
- PWA: neither route is prerendered, so Workbox's `globPatterns` has nothing
  to precache; H2 adds no `runtimeCaching` and keeps
  `navigateFallbackAllowlist` at `/local$` (`web/vite.config.ts`). There is
  no sitemap.
- Loaders log no ids, usernames, or cursors. Opponent search (Should)
  resolves `username_claim` only to a non-neutral account, so a deleted
  member's former name finds nothing.

## 6. Resource budget

| Request                | D1 rows read (logical)                                                                      | Writes |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------ |
| `/history`, first page | G + 20 + ≤ 21 × 4 (own seat, match, opponent seat, opponent user); + 21 with `match_rating` | 0      |
| `/history`, later page | ≤ 21 × 4 (+ 21 with `match_rating`); a sparse filter walks at most G owner rows             | 0      |
| `/match/<id>`          | 5 (match, two seats, two users); 6 with `match_rating`                                      | 0      |
| Malformed id           | 0                                                                                           | 0      |

G is the owner's number of saved games. No Durable Object wake-up (the
overlay reads the existing `matchStatus`), table, column, or binding is
added; a page view is one SSR request plus the existing session read.

**E6, before implementation.** One owner with 5,000 matches against about
50 opponents on Miniflare D1 (mixed results and `rated`, runs of equal
`ended_at`, neutral opponents). Record `EXPLAIN QUERY PLAN` and
`meta.rows_read` in [contracts §12](v2-contracts.md#12-evidence) for the
page query (every filter, with and without a cursor), the summary, and the
match read. Pass: the owner range uses `match_player_owner_idx`; joins are
key lookups (`match.id` unique index, `match_player` and `user` primary
keys); no `SCAN`, no `USE TEMP B-TREE FOR ORDER BY`. A failing plan gets an
index in an H2 migration ([§11](v2-contracts.md#11-migration-ownership)).
The labels slice re-runs the plans with the `match_rating` join.

**Scale trigger.** Only the summary grows with a record. When one owner
passes 5,000 saved games, or `/history` passes 10 % of daily D1 reads, move
it to a per-account aggregate through a contract change.

## 7. Somali copy

Drafts ship behind `TODO(translation-review)` and reuse the
[glossary drafts](README.md#somali-glossary-drafts-q4) (Q4); `shaxda` and
`jare` stay unchanged. `history.` is `siteContent.so.pages.history`;
`match.` is `siteContent.so.pages.match`.

| Key                                                                                                                                                                | Draft                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nav.history`, `pages.account.historyLink`, `history.title`                                                                                                        | Ciyaarahayga                                                                                                                                                                                      |
| `history.description` / `eyebrow` / `summary.caption`                                                                                                              | Liiska ciyaaraha aad akoonkaaga ku ciyaartay. / Taariikhda ciyaaraha / Dhammaan ciyaarahaaga la kaydiyay                                                                                          |
| `history.summary.games` / `winRate` / `streak` / `form`                                                                                                            | Ciyaaro / Heerka guusha / Isku xigxig / Natiijooyinkii u dambeeyay                                                                                                                                |
| `history.summary.wins` / `losses` / `draws`, `history.row.outcome.*`                                                                                               | Guul / Guuldarro / Barbaro                                                                                                                                                                        |
| `history.streak.win` / `loss` / `draw` / `capped`                                                                                                                  | {n} guul oo isku xigxiga / {n} guuldarro oo isku xigxiga / {n} barbaro oo isku xigxiga / {n}+                                                                                                     |
| `history.form.marks.win` / `loss` / `draw`                                                                                                                         | G / K / B (guul, khasaare, barbaro)                                                                                                                                                               |
| `history.filters.label` / `all` / `wins` / `losses` / `draws`                                                                                                      | Shaandhee ciyaaraha / Dhammaan / Guulaha / Guuldarrooyinka / Barbarooyinka                                                                                                                        |
| `history.filters.rated` / `friendly`, `history.row.rated` / `friendly`, `match.rated` / `friendly`                                                                 | Tartan / Saaxiibtinimo                                                                                                                                                                            |
| `history.row.quick`, `match.modes.quick` / `invite`                                                                                                                | Kulan degdeg ah; Kulan degdeg ah / Casuumaad                                                                                                                                                      |
| `history.row.pieces` / `duration` / `opponent` / `view`, `messages.so.onlineGame.result.viewMatch`                                                                 | Dhagaxa haray / Muddada / Ka soo horjeeda / Eeg ciyaarta; Eeg ciyaarta                                                                                                                            |
| `messages.so.onlineGame.result.saving` / `notSaved`                                                                                                                | Ciyaarta waa la kaydinayaa… / Ciyaartan weli lama kaydin.                                                                                                                                         |
| `history.endReasons.*`: `opponentBelowThree`, `opponentCapturedAll`, `resignation`, `drawTermination`, `bothBlocked`, `forcedJareSpaceMaking`, `abandoned`, `idle` | Wax ka yar saddex dhagax; Dhammaan waa la qabtay; Is dhiibid; Barbaro; Labaduba xanniban; Jare qasab ah; Ka bixid; Hakad                                                                          |
| `history.older` / `emptyFiltered` / `empty.title` / `empty.body` (`empty.cta` reuses `nav.onlinePlay`)                                                             | Ciyaaro ka hor / Shaandhadan ciyaar kuma jirto. / Weli ciyaar lama kaydin / Ciyaaraha aad la ciyaarto akoon kale ayaa halkan ku kaydsama. Ciyaaraha martida lama kaydiyo.                         |
| `history.durationUnits.hours` / `minutes` / `seconds`                                                                                                              | s / daq / il                                                                                                                                                                                      |
| `match.title`, `match.privateMeta.title` / `description`                                                                                                           | Ciyaar Shaxda ah / Faahfaahinta ciyaar Shaxda ah.                                                                                                                                                 |
| `match.pageTitle`, `match.share.shareTitle`                                                                                                                        | {a} iyo {b}; {a} iyo {b} — Shaxda                                                                                                                                                                 |
| `match.pageDescription.win` / `draw`                                                                                                                               | {winner} ayaa ka guuleystay {loser} ciyaar Shaxda ah. / {a} iyo {b} waxay ku kala tageen barbaro.                                                                                                 |
| `match.headline.win` / `draw`, `match.playerResult.win` / `loss` / `draw`, `match.youLabel`                                                                        | {winner} ayaa guuleystay / Barbaro; Guuleystay / Khasaaray / Barbaro; Adiga                                                                                                                       |
| `match.onlineEndReasons.abandoned` / `idle`                                                                                                                        | {name} wuu ka baxay ciyaarta. / {name} wuu hakaday, wareeggiisiina wuu dhaafay.                                                                                                                   |
| `match.details.heading` / `playedAt` / `utc` / `duration` / `mode` / `startingSeat` / `pieces` / `captures` / `actions`                                            | Faahfaahinta ciyaarta / Taariikhda / UTC / Muddada / Nooca / Bilaabay / Dhagaxa haray / Qabashooyin / Tallaabooyin                                                                                |
| `match.details.firstAdvantage` / `undecided` / `firstAdvantageBy.placementJare` / `noJareFallback`                                                                 | Horrayn / Lama go'aamin / jare intii dhigista / jare la'aan, ciyaaryahanka labaad                                                                                                                 |
| `siteContent.so.neutralMember` (shared with R3, R4, A3), `match.privateNote`                                                                                       | Xubin la tirtiray; Ciyaartan waxaa arki kara labada ciyaaryahan oo keliya.                                                                                                                        |
| Reused: R2 `status.pending` / `held` / `notCounted` / `removed` (R2 §4.5)                                                                                          | Waa la xisaabinayaa / Waa la hubinayaa / Darajo laguma xisaabin / Darajada waa laga saaray                                                                                                        |
| Reused: R6 `ratingStatus.corrected`                                                                                                                                | Darajada waa la saxay                                                                                                                                                                             |
| `match.share.action` / `statusLabel` / `shareText` / `shared` / `copied` / `failed`                                                                                | La wadaag ciyaarta / Xaaladda wadaagista / Eeg ciyaartan Shaxda ah. / Ciyaarta waa la wadaagay. / Xiriiriyaha ciyaarta waa la koobiyeeyay. / Wadaagiddu ma shaqayn. Xiriiriyaha gacanta ku koobi. |

`{a}`, `{b}`, `{winner}`, `{loser}`, and `{name}` take `@username` for a
member and the neutral label otherwise. The rating labels are README glossary drafts awaiting the Q4 review.

**`/legal`, wave 1.** In `packages/i18n/src/content/legal.so.ts`, the
`xogta` sentences saying Shaxda stores no game history, results, or replays
become:

> Ciyaaraha khadka ah ee ay labada dhinacba akoon ku galeen waa la kaydiyaa
> marka ay dhammaadaan: natiijada, sababta ay ku dhammaatay, tirada dhagaxa
> iyo qabashooyinka, waqtiyada, tallaabooyinka ciyaarta, koodhka qolka, iyo
> aqoonsiga gudaha ee labada akoon. Magacyo laguma kaydiyo ciyaarta; magaca
> dadweynaha iyo sawirka akoonka ee hadda ayaa la muujiyaa. Ciyaar la
> kaydiyay waxaa bogga ku arki kara labada ciyaaryahan ee ciyaaray oo
> keliya; ciyaaryahannada kale iyo booqdayaashu ma arkaan. Ciyaaraha la
> kaydiyay way sii jiraan haddii akoon la tirtiro, laakiin magaca akoonkaas
> lama muujiyo. Ciyaaraha uu marti ka qayb qaatay lama kaydiyo.

The same commit fixes two sentences H1 makes false: `adeegyada` becomes
"Kaydka D1 wuxuu hayaa xogta akoonka iyo ciyaaraha la kaydiyay ee u
dhexeeya laba akoon. Xogta martida laguma hayo.", and the `shuruudaha`
clause on stored results becomes "Ciyaaraha martida ma kaydiyo, mana bixiyo
ballanqaad ah in qol ama ciyaar aan dhammaan dib loo soo celin karo."
Nothing promises public pages, rated play, or a replay viewer; R2 amends
the visibility sentence when rated play launches.

## 8. Implementation slices

Gate: E6 is recorded in contracts §12 before slice 1. One logical change per
commit; tests land with the code they cover.

```txt
1.  feat(shared): add history filter and cursor schemas
2.  refactor(db): extract toPublicProfile from resolveProfile
3.  test(db): add a ledger fixture builder on H1's writer
4.  feat(db): add readHistoryPage with keyset pagination            (+ plan assertions)
5.  feat(db): add readHistorySummary with streak and form
6.  feat(db): add readMatchForViewer with the participant check
7.  refactor(web): extract requireCompleteAccount
8.  feat(i18n): add Somali copy for history and match pages
9.  feat(i18n): disclose saved account games on /legal
10. feat(web): add the /history loader and PageMeta noindex
11. feat(web): render the history summary, list, filters, and empty states
12. feat(web): add the /match/[id] loader with the access check
13. refactor(web): generalise ShareProfile into ShareLink
14. feat(web): render /match/[id] with metadata and sharing
15. feat(web): show the save status and saved-match link in the overlay
16. feat(web): link history from the account panel and /account
17. test(e2e): cover history, match access, and the PWA cache with seeded matches
18. test(e2e): cover a real account game reaching both histories
19. docs(ops): add H2 release checks
20. feat(web): label rating status on history and match pages     (after R1's migration)
21. feat(web): search history by opponent username                 (Should)
22. feat(web): add a date-range filter to history                  (Should)
23. feat(web): show match times in the viewer's time zone          (Should)
```

## 9. Acceptance tests

### 9.1 Unit and component (Vitest, jsdom)

Every rule in §3–§5 gets a test; these guard privacy and correctness:

- Cursor parsing returns `null` for bad base64, a negative or non-integer
  `ended_at`, or an id outside §2.3 (lowercase, `0`, `1`, `I`, `O`, 19 or 21
  characters); `formatDuration` (`45 il`, `3 daq 2 il`, `1 s 5 daq`);
  `computeStreak` (mixed, `20+`, draw runs, empty); a label per reason.
- `/match/[id]` loader: a malformed id → 404 with no DB call; signed out and
  unrelated, a private id throws the same error with the same headers as an
  unknown id; `?a=12` → 200; `isViewer` only on the viewer's seat. Neither
  loader's data has a `userId`, `roomCode`, `seq`, `replay`, or `stats` key,
  a seeded id, or an email.
- Pages: a rated match has title `@a iyo @b | Shaxda`, a description by
  result, canonical and `og:url`, and `share-match`; a friendly match has no
  username or result word in `<title>` or any `<meta>`, robots `noindex`,
  the private note, and no share. A neutral player has no anchor or avatar
  image; the online sentence replaces the resignation.
- The overlay links only a `saved` save with a valid id for the displayed
  `matchNumber`: a stale number, a malformed id, `pending`, `stalled`, or no
  `save` keeps `online-view-match` hidden, and it is never first;
  `online-save-status` appears only for `pending` and `stalled` of the
  displayed match. `ShareLink` inherits `ShareProfile`'s tests plus a
  wrapper test.

### 9.2 Workers and D1 (`packages/db`, Miniflare, real migrations)

- Fixture via H1's writer: 45 matches among u1–u4 with mixed outcomes, rated
  and friendly, both claim reasons, a rated quick match, six rows on one
  `ended_at` across the 20-row boundary, a released alias, a deleted user.
- Paging by 20 returns each of u1's matches once, in `(ended_at, match_id)`
  descending order across the tie, under every filter; a cursor from u2's
  page never yields u2's matches to u1; the summary matches a hand-computed
  table, and 25 straight wins give `20+`.
- `readMatchForViewer`: rated → found for everyone; friendly → found for
  each participant and deep-equal to the unknown-id result for signed-out
  and unrelated viewers; one seat row → missing; a deleted opponent →
  neutral. The module's SQL never names `seq`, `payload_hash`, `room_code`,
  `room_created_at`, or `match_number`, and every plan meets E6.

### 9.3 End to end (Playwright)

`tests/e2e/fixtures/match.ts` `seedMatches(...)` writes rows valid under
every §2.1 `CHECK` through `seedAccount`'s `wrangler d1 execute` path and
`SQLITE_BUSY` retry, with a `cleanup()`.

- `/history`: signed out → `/login?returnTo=/history`; with 25 games, the
  summary, 20 rows, older → 5, the `wins` filter, current-username links
  despite a released alias, and no account id in the body; zero games → the
  empty state.
- Guessed private id, signed out and as an unrelated account: `/match/<id>`
  and its `__data.json` equal the unknown-id responses in status,
  `cache-control`, and body (after replacing the id). A participant's view
  has no username or result word in `<head>` and robots `noindex`; a rated
  match signed out has both names in `og:title`, the result in
  `og:description`, and `share-match` copies `<origin>/match/<id>`.
- PWA: after `navigator.serviceWorker.ready` (as in `local-game.spec.ts`)
  and participant visits to `/history` and a private match, Cache Storage
  holds nothing under `/match/` or `/history`, `/sw.js` precaches neither,
  and an offline reload of the private match fails.
- M10: the opponent's `seedAccount` `cleanup()` turns the row and the page
  into the neutral label without a link.
- Real game on the shared local D1 (contracts §10.4), as in
  `online-identity.spec.ts`: two seeded accounts create and join a room,
  each places a piece, and the creator resigns. After
  `save.status = "saved"` both overlays show `online-view-match`; the joiner
  opens it and sees both names and the resignation; both histories list it
  (`Guuldarro` for the creator, `Guul` for the joiner, `Saaxiibtinimo`); a
  signed-out context and a third account get the identical 404; no page
  contains an account id.

Checks: `pnpm check` and `pnpm test:e2e`.

### 9.4 Sample matches

Rated rows are seeded; the real game covers M1's shape end to end.

| ID  | `/history` for A and B                       | `/match/<id>`, signed out or unrelated                          | Participant view and labels                     |
| --- | -------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| M1  | listed, "Saaxiibtinimo"                      | same 404 as an unknown id                                       | full, `noindex`, generic OG, private note       |
| M2  | listed, "Tartan", "Is dhiibid"               | public; resignation; first advantage "not decided"; names in OG | "(Adiga)"; no rating label once processed       |
| M3  | listed, "Tartan", "Hakad"                    | public; the idle sentence names A, never "resigned"             | no rating label once processed                  |
| M4  | listed, "Tartan"                             | public                                                          | "Darajo laguma xisaabin" once R1 exists         |
| M5  | listed, "Tartan", "Barbaro"                  | public; draw headline and reason                                | no rating label once processed                  |
| M6  | nothing (no row)                             | no id exists                                                    | the overlay shows no link                       |
| M7  | nothing (no row)                             | no id exists                                                    | the overlay shows no link                       |
| M8  | listed, result unchanged                     | public, result unchanged                                        | "Darajada waa laga saaray" once R1 and R6 exist |
| M9  | rematch "Saaxiibtinimo"; first game "Tartan" | rematch: same 404; first game public                            | rematch full to A and B                         |
| M10 | A's row shows the neutral label, no link     | public; B is the neutral label on the page and in OG            | B has no history (A3 gate, or no account)       |

## 10. Rollout and rollback

- Environments: dev needs H1's migration in Miniflare; e2e needs H1's shared
  local D1 (contracts §10.4) and `seedMatches`; preview and production need
  H1's migration and game Worker first, and on preview a saved real account
  game. H2 adds no binding, secret, var, or cron.
- Deploy order ([contracts §6.5](v2-contracts.md#65-deploy-order)):
  migration → game Worker → web Worker; H2 is web-only and ships after H1's
  game Worker in each environment. The `/legal` slice is live in production
  no later than H1's first production save (disclosure precedes
  collection); it is content-only and may ship first. The rating labels
  ship after R1's migration and before `RATED_PLAY_ENABLED` turns on in
  production.
- Kill switch: none
  ([contracts §10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)).
  H2 writes nothing, so rollback redeploys an earlier web version, but only
  one that contains the `/legal` slice while H1 is saving; otherwise revert
  H2's routes in a new commit.
- Release checks (slice 19): on preview, both players of a real game see it
  in `/history` and open it; the same id signed out and as a third account
  returns the identical 404; responses carry `no-store`; neither page source
  nor `__data.json` contains an account id or room code.

**Done when** both players of a real preview game find it in `/history` and
open its page; a signed-out browser and a third account get the identical
404 for it; every test in §9 passes, the real-game e2e included; E6 is
recorded; `/legal` discloses saved games before H1 saves in production; and
no loader output contains a user id, email, room code, `seq`, or raw replay.
The README marks H2 `shipped@<date>` only in its shipping commit.
