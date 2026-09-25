# H2 — Match History and Match Detail (Spec)

| Field          | Value                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Status         | Draft, not started. Blocked on H1: no H1 spec or code exists on `main` as of 2026-09-19.                                           |
| Brief          | `docs/shaxda-v2.md` §9 (H2), §7.2 (tables), §16 (D4, D8)                                                                           |
| Workspace      | `h2-history-match-detail`                                                                                                          |
| Depends on     | H1 (ledger rows, `matchSaved`). Independent of X1; may run beside S1 (`shaxda-v2.md` §14 step 2).                                  |
| Unblocks       | H3 (mounts on `/match/<id>`), H4 (stats panel slot on the match page), R4 (reuses the row component and the history queries)      |
| Touches        | `packages/db` (read queries only), `packages/shared` (match id and filter schemas), `packages/i18n`, `web/`                        |
| Does not touch | `worker/` (except the `matchSaved` fallback in §3.3), `packages/game-engine`, auth tables, Turnstile, `/local`, any D1 write path |

This spec refines the H2 brief; it does not widen it. Where it makes a choice
the brief left open, the choice is recorded in §14 with its rationale. Read
`docs/shaxda-v2.md` §1–§7 and §9, and `AGENTS.md`, before implementing.

H2 is a **read-only** milestone: it adds no D1 write, no Durable Object
change, and no migration unless an index it needs is missing from H1 (§3.2).
Everything it renders comes from rows H1 wrote.

---

## 1. Goal and scope

**Goal.** Players can see their games; anyone can open a match page.

### Must

1. `/history` — owner-only, session-aware SSR. A reverse-chronological list of
   the signed-in account's persisted games with opponent username + avatar,
   result badge, end reason, rated/friendly, date, duration, final piece
   counts, a link to `/match/<id>` and a link to the opponent's profile.
   Cursor pagination, 20 rows per page. One markup that renders as compact
   cards below `md` and as rows from `md` up.
2. Filters on `/history`: `all` / `wins` / `losses` / `draws` / `rated` /
   `friendly`, as server-rendered links. Empty state for accounts with no
   games.
3. History summary header: games, W/L/D, win rate, current streak, recent form
   (last five results).
4. `/match/[id]` — public SSR. Both players, result, termination reason,
   date/time, duration, starting player, first advantage and how it was
   decided, final pieces, captures, action count, links to both profiles, a
   share button, and a documented insertion point for the H3 replay viewer.
5. Open Graph metadata for match pages using the existing static OG image.
6. The `/online` result overlay gains a "view match" link once the room
   reports `matchSaved` for the current match.
7. `/history` reachable from the account navigation panel and from `/account`.
8. Somali copy for all of the above in `packages/i18n`, plus one paragraph on
   `/legal` disclosing that account-vs-account games are stored and that match
   pages are public (D8).

### Should

- Search history by opponent username (alias-safe: resolves to the account,
  not the string).
- Date-range filter (`from`/`to` UTC days).
- Match-page times shown in the viewer's time zone after hydration (SSR renders
  UTC).

### Not in H2

From the brief: replay playback, ratings on rows (R4 adds the delta), private
history.

Added by this spec (each is a deliberate non-goal, not an oversight):

- Any D1 write, any Durable Object change, any change to the game Worker
  beyond §3.3.
- Handling of `?a=<index>` on match pages. H3 owns it; H2 only guarantees the
  query string is ignored, never a 404.
- Stats panel on the match page (H4 fills the reserved slot).
- Recent matches on `/u/<username>` (R4).
- Rendering of result values H1 does not produce (`aborted`, `skipped`); R2
  adds them with its own contract-change commit and copy.
- Dynamic OG result images.
- Edge caching of match pages (§6.2, H2-D6).
- Hiding, deleting, or reporting individual matches.
- Anything for guests: guest games are never persisted (D4), so a guest has no
  history and no match page mentions a guest.

---

## 2. Definitions

| Term              | Definition                                                                                                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Match             | One `match` row: a completed account-vs-account game, identified by `match.id`. A rematch is a separate match (`match_number + 1` in the same room).                                                                                                                                                             |
| Match id          | The opaque, URL-safe value in `match.id` (§3.1, H2-D1). Never derived from the room code by H2.                                                                                                                                                                                                                  |
| Owner             | The signed-in complete account whose `locals.user.id` matches `match_player.user_id`. Only the owner sees `/history`; there is no user parameter (H2-D2).                                                                                                                                                       |
| Opponent          | The `match_player` row of the other seat.                                                                                                                                                                                                                                                                       |
| Outcome           | The owner's perspective: `win`, `loss`, or `draw`, read from `match_player.result`. Used only on `/history`.                                                                                                                                                                                                     |
| Result            | The neutral perspective: `winner` seat or draw, read from `match.winner` / `match.result`. Used on `/match/<id>` and in OG text.                                                                                                                                                                                 |
| Engine reason     | `match.end_reason`, one of the six `GameEndReason` values.                                                                                                                                                                                                                                                       |
| Online reason     | `match.online_end_reason`: `abandoned`, `idle`, or `NULL`. When non-null the game ended by claim-win and the engine reason is the synthetic `resignation`; the online reason replaces it in every user-facing string (H2-D16).                                                                                    |
| Duration          | `ended_at − started_at` in milliseconds. `started_at` is whatever H1 defined (both seats present, or first action); H2 formats, it does not interpret.                                                                                                                                                          |
| Current streak    | Length of the run of the newest outcome kind counting back from the newest match, computed over the newest 20 rows and shown as `20+` when the run fills the window (H2-D14). Draws form their own runs.                                                                                                        |
| Recent form       | The newest five outcomes, newest last, rendered as labelled chips.                                                                                                                                                                                                                                              |
| Win rate          | `wins / games`, games including draws, rendered as a whole percentage.                                                                                                                                                                                                                                          |
| Cursor            | `base64url("<ended_at>:<match_id>")` of the last row on the page. Forward-only (older games). Opaque to the client; parsed with Zod on the server (H2-D4).                                                                                                                                                       |
| Current username  | `user.username` at read time, always what links and labels use. `match_player.username_snapshot` is only a fallback label when the account no longer has a username (H2-D3).                                                                                                                                    |
| Deleted member    | A `match_player` row whose `user` row is missing or has `username IS NULL` (the A3 tombstone). Rendered as a neutral label with no link.                                                                                                                                                                         |

---

## 3. H1 contract this spec assumes

H1 has no spec yet. Everything below is taken from `shaxda-v2.md` §7.2, §7.3
and §9 (H1) and is the minimum H2 reads. **When the H1 spec is written, §3 is
checked against it in H2's first commit** (§16 step 1). A difference is a
contract change for H2, recorded in §14, never a silent adaptation in a query.

### 3.1 Columns read by H2

`match` (H2 never reads `replay_json`; H3 does):

| Column                     | Type                 | H2 use                                                              |
| -------------------------- | -------------------- | ------------------------------------------------------------------- |
| `id`                       | text PK              | URL segment; opaque, matches `^[A-Za-z0-9_-]{10,40}$` (H2-D1)        |
| `room_code`, `match_number` | text, integer       | Not rendered. Uniqueness only.                                      |
| `mode`                     | `'invite' \| 'quick'` | Mode label (`quick` label shipped now so K1 needs no H2 change)     |
| `rated`                    | integer 0/1          | Rated/friendly badge and filter                                     |
| `starting_player`          | `'A' \| 'B'`         | Match page details                                                  |
| `first_advantage`          | `'A' \| 'B' \| NULL` | Match page details; `NULL` = ended before it was decided            |
| `first_advantage_how`      | `'placementJare' \| 'noJare' \| NULL` | "How it was decided"                               |
| `winner`                   | `'A' \| 'B' \| NULL` | Result headline                                                     |
| `result`                   | `'A' \| 'B' \| 'draw'` | Result; R2 may add `'aborted'` later                              |
| `end_reason`               | `GameEndReason`      | Reason text                                                         |
| `online_end_reason`        | `'abandoned' \| 'idle' \| NULL` | Reason text override                                     |
| `pieces_a`, `pieces_b`     | integer              | Final on-board counts                                               |
| `captured_a`, `captured_b` | integer              | Capture counts                                                      |
| `action_count`             | integer              | Match page details                                                  |
| `started_at`, `ended_at`   | integer (epoch ms)   | Date, duration, ordering                                            |

`match_player`:

| Column              | Type                        | H2 use                                       |
| ------------------- | --------------------------- | -------------------------------------------- |
| `match_id`          | text FK → `match.id`        | Join                                         |
| `user_id`           | text                        | Owner predicate and `user` join; never rendered |
| `seat`              | `'A' \| 'B'`                | Seat, piece colour                           |
| `result`            | `'win' \| 'loss' \| 'draw'` | Outcome, W/L/D filter, summary               |
| `username_snapshot` | text                        | Fallback label only (H2-D3)                  |
| `ended_at`          | integer (epoch ms)          | Denormalised for the owner index             |

Primary key `(match_id, seat)`. Two rows per match, written in one batch, so
H2 treats "not exactly two player rows" as a missing match.

The `online_end_reason` values above are the stored names from the brief. The
wire names remain `opponentAbandoned` / `opponentIdleTimeout`; the mapping is
H1's, and the H2 copy is keyed by the stored names.

### 3.2 Indexes H2 relies on

| Query (§5)                     | Index required                              | Ships in |
| ------------------------------ | ------------------------------------------- | -------- |
| History page, summary, form    | `match_player (user_id, ended_at)`           | H1 (§7.2) |
| Match page player rows         | PK prefix `(match_id)`                       | H1       |
| Opponent search (Should)       | PK prefix `(match_id)` on the opponent join  | H1       |
| Match page                     | `match` PK                                   | H1       |

Recommendation to H1: define the owner index as
`(user_id, ended_at, match_id)` so the cursor tie-break needs no sorter. If
H1 ships the two-column form, H2 still works: SQLite scans the owner's range
in reverse and uses a temp B-tree only for the right part of `ORDER BY`. The
Workers test in §13 asserts the plan uses the owner index and never reports
`SCAN match_player`; a temp B-tree is acceptable.

If any index above is missing when H2 starts, H2 adds it in its own
hand-written migration (`000N_history_indexes.sql`, numbered after whatever X1
and H1 merged) with a `meta/_journal.json` entry. That is the only migration
H2 may add (H2-D12).

### 3.3 `matchSaved` server message

The brief lists this as an H1 Should. H2 needs it for Must item 6. Assumed
shape, additive to protocol `v: 1`:

```ts
export const matchSavedServerMessageSchema = z.object({
  ...envelopeBase,
  type: z.literal("matchSaved"),
  roomCode: roomCodeSchema,
  // The match this id belongs to, so a client that already agreed a rematch
  // never links the new game to the previous match's page.
  matchNumber: z.number().int().positive(),
  matchId: matchIdSchema,
});
```

Required behaviour: sent to both seats after the D1 batch succeeds, and
re-sent to a socket that joins or reconnects while the room's current
`matchNumber` is persisted and the game is over, so a refresh after game over
still shows the link.

If H1 merges without it, H2's first feature commit is the contract-change
commit that adds it to `packages/shared` and `worker/src/match-room.ts`
(§16 step 15). That is the only `worker/` change H2 may make and it must keep
`pnpm check:hibernation` passing.

### 3.4 Harness requirements

- Workers tests in `packages/db` need a way to insert ledger rows. H2 uses
  H1's insert function when it is exported from `@shaxda/db`; otherwise a
  test-only builder in `packages/db/src/test-fixtures/ledger.ts` writes raw
  SQL against the real migrations (§13).
- The real-game e2e (§13) needs the game Worker started by
  `scripts/start-worker-e2e.mjs` to bind the same local D1 file the web e2e
  uses (`test-results/wrangler-web-e2e`, `shaxda-db-e2e`). That wiring is H1's
  harness work and must keep `pnpm check:e2e-isolation` passing. Until it
  exists, the real-game test is `test.skip` with that reason and the seeded
  tests carry the coverage.

---

## 4. Privacy and authorization model

- `/history` reads rows for `locals.user.id` only. The route accepts no user,
  username, or account parameter of any kind; the owner is the session
  (H2-D2). Signed out → `303 /login?returnTo=/history`; incomplete account →
  `303 /register?returnTo=/history`, the same rule `/account` applies.
- `/match/<id>` is public (D8). Its loader output contains: current usernames,
  avatar mode, avatar colour, Google image URL when the account chose the
  Google avatar (exactly what `/u/<username>` already exposes), the result,
  reasons, counts and timestamps. It never contains `user_id`, email, the
  room code, the Google name, or the replay.
- Loader outputs are typed so that `user_id` cannot reach page data (§7); the
  tests in §13 scan serialised page data for the seeded ids.
- `avatarColorForUserId(userId)` is computed server-side, as profiles already
  do; the hash is not reversible and is already public on every profile.
- Match pages are indexable and shareable. `/history` carries
  `<meta name="robots" content="noindex">` and `cache-control: no-store`.
- Nothing here uses cookies beyond the existing session cookie, and nothing
  is logged from request bodies (there are none).

---

## 5. Read queries (`packages/db/src/queries/match.ts`)

Raw D1 prepared statements on `AnyD1Database`, matching `queries/account.ts`,
exported from `@shaxda/db`. All are read-only; the module contains no
`INSERT`, `UPDATE`, or `DELETE`.

| Function                                                      | Used by                          |
| ------------------------------------------------------------- | -------------------------------- |
| `readHistoryPage(db, { userId, filter, cursor, limit })`      | `/history` loader                |
| `readHistorySummary(db, userId)`                              | `/history` loader                |
| `readMatch(db, matchId)`                                      | `/match/[id]` loader             |
| `resolveOpponentUserId(db, username)`                         | `/history` opponent search (Should) |

Shared helper: `toPublicProfile({ id, username, image, avatar_mode })`, moved
out of `resolveProfile` in `queries/account.ts` so both modules build the same
`PublicProfile` (username, avatarMode, imageUrl, avatarColor, initial).

### 5.1 `readHistoryPage`

Input: `userId`, `filter: "all" | "wins" | "losses" | "draws" | "rated" |
"friendly"`, `cursor: { endedAt: number; matchId: string } | null`, `limit`
(20). Fetches `limit + 1` rows to learn whether an older page exists.

The SQL is composed from fixed fragments per filter; it never uses the
`?n IS NULL OR …` pattern, which stops SQLite from using the index range:

```sql
SELECT m.id, m.mode, m.rated, m.winner, m.result, m.end_reason,
       m.online_end_reason, m.pieces_a, m.pieces_b, m.captured_a,
       m.captured_b, m.started_at, m.ended_at,
       mp.seat        AS my_seat,
       mp.result      AS my_result,
       opp.username_snapshot AS opp_snapshot,
       u.id           AS opp_user_id,      -- consumed by toPublicProfile, never returned
       u.username     AS opp_username,
       u.image        AS opp_image,
       u.avatar_mode  AS opp_avatar_mode
FROM match_player mp
JOIN match m          ON m.id = mp.match_id
JOIN match_player opp ON opp.match_id = mp.match_id AND opp.seat <> mp.seat
LEFT JOIN user u      ON u.id = opp.user_id
WHERE mp.user_id = ?1
  -- filter fragment, one of:
  --   (none)                       all
  --   AND mp.result = ?2           wins | losses | draws  (win | loss | draw)
  --   AND m.rated = ?2             rated (1) | friendly (0)
  -- cursor fragment, only when a cursor is given:
  --   AND (mp.ended_at, mp.match_id) < (?3, ?4)
ORDER BY mp.ended_at DESC, mp.match_id DESC
LIMIT ?5;
```

Returns `{ rows: HistoryRowRecord[]; nextCursor: string | null }`. The record
maps `opp_*` through `toPublicProfile` when `opp_username` is non-null, else
to `{ deleted: true, label: opp_snapshot }`, and drops `opp_user_id` before
returning.

Row-value comparison (`(a, b) < (?, ?)`) is the SQLite-documented form for
scrolling windows and lets the planner keep the owner index range.

### 5.2 `readHistorySummary`

One `db.batch()`:

```sql
-- counts
SELECT result, COUNT(*) AS n FROM match_player WHERE user_id = ?1 GROUP BY result;
-- streak and form window
SELECT result FROM match_player WHERE user_id = ?1
 ORDER BY ended_at DESC, match_id DESC LIMIT 20;
```

Returns `{ games, wins, losses, draws, winRate, streak: { kind, length,
capped }, form: Outcome[] }` with streak and form computed in TypeScript by
pure helpers (`computeStreak`, `recentForm`) that have their own unit tests.
The summary ignores the active filter (H2-D5).

### 5.3 `readMatch`

One `db.batch()`:

```sql
SELECT id, mode, rated, starting_player, first_advantage, first_advantage_how,
       winner, result, end_reason, online_end_reason, pieces_a, pieces_b,
       captured_a, captured_b, action_count, started_at, ended_at
FROM match WHERE id = ?1;

SELECT mp.seat, mp.result, mp.username_snapshot,
       u.id AS user_id, u.username, u.image, u.avatar_mode
FROM match_player mp LEFT JOIN user u ON u.id = mp.user_id
WHERE mp.match_id = ?1 ORDER BY mp.seat;
```

Returns `{ kind: "found"; match: MatchRecord }` or `{ kind: "missing" }`.
Missing when the `match` row is absent **or** the player result does not
hold exactly seats `A` and `B`. `user_id` is used for `avatarColorForUserId`
and for the loader's "is this the viewer" check, then dropped: `MatchRecord`
has no `userId` field; the loader receives `playerUserIds` as a separate
value it never returns (§6.2).

### 5.4 `resolveOpponentUserId` (Should)

`normalizeUsername` → `validateUsername` →

```sql
SELECT user_id FROM username_claim WHERE username = ?1 LIMIT 1;
```

A released claim (old alias) still resolves to the account, so searching by a
former username finds the same games. The page then adds
`AND opp.user_id = ?n` to the §5.1 query. The opponent join is by `(match_id,
seat)`; the extra predicate is a filter on rows already selected by the owner
index.

### 5.5 Query coverage

| Query                       | Index used                                  | Rows read                     |
| --------------------------- | ------------------------------------------- | ----------------------------- |
| History page                | `match_player (user_id, ended_at)` range, then PK lookups on `match`, `match_player`, `user` | ≤ 21 × 4 |
| Summary counts              | `match_player (user_id, ended_at)` range     | owner's games (see §12)       |
| Form window                 | same index, reverse, `LIMIT 20`             | 20                            |
| Match row                   | `match` PK                                  | 1                             |
| Player rows                 | `match_player` PK prefix `(match_id)` + `user` PK | 2 + 2                   |
| Opponent search             | `username_claim` PK                         | 1                             |

Rules carried from `shaxda-v2.md` §7.2: every list query hits an index; no
per-move rows are ever read (H2 never selects `replay_json`).

---

## 6. Routes

Both routes: `export const prerender = false`, server `load` only (no
`+page.ts`), Somali copy from `packages/i18n`, `PageMeta` for metadata.
`hooks.server.ts` already resolves the session for every non-prerendered
route, so `locals.user` is available and no hook change is needed.

### 6.1 `/history`

`web/src/routes/history/+page.server.ts`:

1. `const user = requireCompleteAccount(locals, "/history")` (§6.3).
2. Parse the query with `historyQuerySchema` (`packages/shared`):
   `filter` = `z.enum([...]).catch("all")`; `after` = optional cursor string,
   decoded by `parseHistoryCursor` which returns `null` for anything that is
   not `base64url("<int>:<matchId>")`. An invalid filter or cursor falls back
   to the default, never a 400 (H2-D15). Should: `q` (opponent username,
   `usernameSchema.optional()`), `from`/`to` (`YYYY-MM-DD`).
3. `db.batch`-free sequence: `readHistorySummary` and `readHistoryPage` run
   with `Promise.all` (two independent batches).
4. `setHeaders({ "cache-control": "no-store" })`.
5. Return `{ summary, filter, rows, nextHref }` where `nextHref` is
   `/history?filter=<f>&after=<cursor>` or `null`.

`+page.svelte` sets `<meta name="robots" content="noindex">` through a new
optional `noindex` prop on `PageMeta` (also useful to X1's `/admin/stats`).

### 6.2 `/match/[id]`

`web/src/routes/match/[id]/+page.server.ts`:

1. `matchIdSchema.safeParse(params.id)`; failure → `error(404,
   "match-not-found")` **before** any D1 call. `/match` with no id has no
   route and 404s through SvelteKit.
2. `readMatch(db, id)`; `missing` → `error(404, "match-not-found")`.
3. `viewerSeat`: `"A" | "B" | null`, computed by comparing `locals.user?.id`
   with the player user ids returned beside the record, never returned as
   ids.
4. Ignore every query parameter (`?a=` is reserved for H3).
5. No explicit cache header (H2-D6). The existing 404 renders the Somali
   `notFound` variant of `+error.svelte`; no match-specific error page.

### 6.3 Shared server helpers

- `web/src/lib/server/account.ts`: `requireCompleteAccount(locals, returnTo)`
  extracted from `web/src/routes/account/+page.server.ts`, behaviour
  unchanged (`/login?returnTo=…` when signed out or without a session,
  `/register?returnTo=…` when the username is missing). `/account` switches
  to it in the same commit. `returnTo` is a fixed internal path chosen by the
  route, never user input.
- `web/src/lib/history/format.ts`: `formatDuration(ms, copy)`,
  `formatMatchDate(ms)` (`Intl.DateTimeFormat("so-SO", { dateStyle:
  "medium", timeZone: "UTC" })`), `formatMatchDateTime(ms)` (adds
  `timeStyle: "short"` and the UTC marker), `computeStreak`, `recentForm`.
  Module-level formatters, like `/account`.

---

## 7. Page data shapes

```ts
// packages/shared/src/history/schemas.ts
export const matchIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,40}$/);
export const historyFilterSchema = z
  .enum(["all", "wins", "losses", "draws", "rated", "friendly"])
  .catch("all");
export const historyOutcomeSchema = z.enum(["win", "loss", "draw"]);
export const matchModeSchema = z.enum(["invite", "quick"]);
export const onlineEndReasonStoredSchema = z.enum(["abandoned", "idle"]);
export const firstAdvantageHowSchema = z.enum(["placementJare", "noJare"]);

// web/src/lib/history/types.ts (derived from @shaxda/db records)
type Participant =
  | { kind: "member"; username: string; profile: PublicProfile; href: string }
  | { kind: "deleted"; label: string };            // label = snapshot, no link

interface HistoryRow {
  id: string;
  href: string;                                    // /match/<id>
  outcome: "win" | "loss" | "draw";
  rated: boolean;
  mode: "invite" | "quick";
  reasonLabel: string;                             // short, online reason wins
  endedAt: number;                                 // epoch ms, for <time datetime>
  endedAtLabel: string;                            // SSR Somali date
  durationLabel: string;
  pieces: { mine: number; theirs: number };
  opponent: Participant;
}

interface HistorySummary {
  games: number; wins: number; losses: number; draws: number;
  winRatePercent: number;
  streak: { kind: "win" | "loss" | "draw"; length: number; capped: boolean } | null;
  form: ("win" | "loss" | "draw")[];               // ≤ 5, newest last
}

interface MatchPageData {
  id: string;
  players: Record<"A" | "B", Participant & { result: "win" | "loss" | "draw"; isViewer: boolean }>;
  result: { kind: "win"; winner: "A" | "B" } | { kind: "draw" };
  reasonText: string;                              // full sentence, online reason wins
  rated: boolean;
  mode: "invite" | "quick";
  playedAt: number; playedAtLabel: string;
  durationLabel: string;
  startingPlayer: "A" | "B";
  firstAdvantage: { player: "A" | "B"; how: "placementJare" | "noJare" } | null;
  pieces: Record<"A" | "B", number>;
  captures: Record<"A" | "B", number>;
  actionCount: number;
  share: { url: string; title: string; text: string };
}
```

No shape above has a `userId`, `email`, `roomCode`, or `replay` field. The
loader tests assert this structurally (`expect(data).not.toHaveProperty`) and
by scanning `JSON.stringify(data)` for the seeded ids.

---

## 8. Presentation

Mobile-first, Tailwind, the existing `board-*` palette, `Avatar` at
`size="small"` in rows and the large size on the match page. No new
dependencies, no client-side data fetching: both pages are plain SSR with
links.

### 8.1 History summary header

Rendered only when `games > 0`. A `<section aria-labelledby>` with:

- headline `N ciyaaro`;
- three chips `W` / `L` / `D` with the Somali words, not letters;
- win rate as `NN%` with its label;
- current streak sentence (`3 guul oo isku xigxiga`, `20+` when capped) or
  the dash when there is no streak;
- recent form: five chips, newest last, each with a visible short mark and an
  `aria-label` carrying the full word (§10, open question 2).

`data-testid="history-summary"`.

### 8.2 History list

`<ol data-testid="history-list">` of `<li>` `<article data-testid="history-row">`
elements. One markup, two layouts:

- below `md`: a card — first line avatar + `@username` link + outcome badge;
  second line reason · date · duration; third line pieces `7 – 4` and the
  rated/friendly chip; a full-width "Eeg ciyaarta" link;
- `md` and up: a CSS grid row with columns opponent / outcome / reason / date /
  duration / pieces / link, header row rendered once above the list with
  `role="presentation"` (the `<article>` structure stays the accessible one).

The card is not one giant link. Exactly two links per row: the opponent
profile (`profilePath(currentUsername)`, alias-safe by construction) and the
match page. A deleted opponent renders the neutral label without a link.

Outcome badge colours: win uses the existing success tone, loss the danger
tone, draw the neutral board tone; the badge text is the word, never colour
alone. Rated/friendly is a small outlined chip. Pieces are shown as
`mine – theirs`, labelled.

### 8.3 Filters and pagination

- `<nav aria-label={copy.filters.label}>` of six links `?filter=<name>`; the
  active one has `aria-current="page"` and `data-testid="history-filter-<name>"`.
  Filters are server-rendered links, so the page works without JavaScript and
  every filter state has a URL.
- Pagination: one link at the bottom, "Ciyaaro ka hor", to `nextHref`
  (`data-testid="history-older"`), hidden when there is no older page.
  Forward-only; the browser's back button returns to newer pages (H2-D4).
- A filter with no rows shows the empty state variant `filtered` (different
  copy from the no-games state) and keeps the filter nav.

### 8.4 Empty state

`data-testid="history-empty"`: title, one sentence explaining that games
played against another account are saved here and guest games are not, and a
`ButtonLink` to `/online`. The summary header is not rendered.

### 8.5 Match page

`web/src/routes/match/[id]/+page.svelte`, in order:

1. `<header>`: two player blocks (seat A, seat B), each with the large
   `Avatar`, the `@username` profile link (or the deleted label), a piece
   token in the seat's colour (reusing the light/dark token style from
   `GameResultOverlay`), a per-player result label (`Guuleystay` /
   `Khasaaray` / `Barbaro`) and `(Adiga)` when `isViewer`. Between them the
   headline: `@winner ayaa guuleystay` or `Barbaro`.
2. Reason line: `reasonText`.
3. **Replay insertion point.** No element is rendered in H2. The layout leaves
   the slot between the header and the details list; H3 mounts the viewer
   here and H4 adds the stats panel after it. Documented in a code comment,
   not as an empty DOM node (H2-D10).
4. `<dl>` details: date and time (UTC, in `<time datetime>`), duration, mode
   and rated/friendly, starting player, first advantage (player + how, or
   "not decided"), final pieces per player, captures per player, action count.
5. Actions: `ShareLink` (§8.6) and two profile links.

Test ids: `match-page`, `match-player-A`, `match-player-B`, `match-headline`,
`match-reason`, `match-details`, `share-match`.

### 8.6 Share and Open Graph

- `ShareProfile.svelte` is generalised into
  `web/src/lib/components/ShareLink.svelte` with props `{ url, title, text,
  label, copy: { statusLabel, shared, copied, failed }, variant, class,
  testId }` and the same Web Share → clipboard → failed behaviour and
  `AbortError` handling. `ShareProfile` becomes a thin wrapper that keeps its
  current props and tests (H2-D8).
- Match share payload: `url = absoluteUrl(matchPath(id))`, `title`/`text` from
  §10 with the two current usernames. `matchPath(id)` and `matchUrl(id)` join
  `profilePath` in `web/src/lib/site/metadata.ts`.
- `PageMeta` on the match page: title `@a iyo @b`, description from the
  result (`win` or `draw` variant), `path = matchPath(id)`, the static
  `og-image.png` as today. `/history` uses `PageMeta` with `noindex`.

### 8.7 Navigation entry points

- `topBarConfig.ts` `accountGroup`: for a complete account, insert
  `{ id: "history", label: nav.history, icon: History, href: "/history" }`
  between the profile item and account settings. Incomplete and signed-out
  states are unchanged.
- `/account`: a `ButtonLink` to `/history` beside the existing profile link.
- Nothing is added to the public marketing navigation or the sitemap-free
  footer; match pages are reached through history, the result overlay, and
  shared links.

---

## 9. Result overlay link in `/online`

`/online` stays prerendered and client-only; the link is an ordinary in-app
navigation to an SSR page.

- `packages/shared`: `matchSavedServerMessageSchema` (§3.3) in
  `serverMessageSchema` if H1 did not add it.
- `OnlineGameController` (`web/src/lib/online/onlineGame.svelte.ts`):
  `savedMatchId = $state<string | null>(null)`. On `matchSaved`, set it only
  when `message.matchNumber === this.matchNumber`; otherwise ignore. Cleared
  in `receiveRematchStatus` when the match number changes, in
  `resetDisplayedRoomState`, and therefore on `leave()`.
- `GameResultAction` gains `href?: string`. `GameResultOverlay` renders an
  action with `href` as a `ButtonLink` (same variants), keeping `bind:element`
  and initial focus on the first action, which stays a button.
- `OnlineTabletop` appends `{ id: "view-match", label:
  copy.result.viewMatch, href: "/match/<id>", variant: "outline", testId:
  "online-view-match" }` to `resultActions` whenever `savedMatchId` is
  non-null. It is never the primary action; rematch keeps that place. Action
  counts become 3 (`rematch`, `newMatch`, `viewMatch`) or 4 in the
  `opponentRequested` case, which the overlay's odd/even grid already handles.
- Following the link leaves the room like any navigation. The seat remains
  reclaimable through `/online?room=<code>` for the room's normal lifetime;
  H2 adds no "back to room" affordance (H2-D9).

---

## 10. Somali copy

All new user-visible text is Somali. Drafts below are placeholders for a
native review under the repo's `TODO(translation-review)` convention. Terms
for "history", "rated", "friendly", "quick match", and "replay" are open in
`shaxda-v2.md` §17 question 4; the drafts here are the proposal.

`siteContent.so.nav.history`: "Ciyaarahayga".

`siteContent.so.pages.history`:

| Key                           | Draft                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `path`                        | `/history`                                                                                                              |
| `title`                       | Ciyaarahayga                                                                                                            |
| `description`                 | Liiska ciyaaraha aad akoonkaaga ku ciyaartay.                                                                           |
| `eyebrow`                     | Taariikhda ciyaaraha                                                                                                    |
| `summary.games`               | Ciyaaro                                                                                                                 |
| `summary.wins` / `losses` / `draws` | Guul / Guuldarro / Barbaro                                                                                        |
| `summary.winRate`             | Heerka guusha                                                                                                           |
| `summary.streak`              | Isku xigxig                                                                                                             |
| `summary.form`                | Natiijooyinkii u dambeeyay                                                                                              |
| `streak.win`                  | {n} guul oo isku xigxiga                                                                                                |
| `streak.loss`                 | {n} guuldarro oo isku xigxiga                                                                                           |
| `streak.draw`                 | {n} barbaro oo isku xigxiga                                                                                             |
| `streak.capped`               | {n}+                                                                                                                    |
| `form.marks.win` / `loss` / `draw` | G / K / B (Guul / Khasaare / Barbaro; open question 2)                                                             |
| `filters.label`               | Shaandhee ciyaaraha                                                                                                     |
| `filters.all`                 | Dhammaan                                                                                                                |
| `filters.wins` / `losses` / `draws` | Guulaha / Guuldarrooyinka / Barbarooyinka                                                                         |
| `filters.rated` / `friendly`  | Tartan / Saaxiibtinimo                                                                                                  |
| `row.outcome.win` / `loss` / `draw` | Guul / Guuldarro / Barbaro                                                                                        |
| `row.rated` / `row.friendly`  | Tartan / Saaxiibtinimo                                                                                                  |
| `row.pieces`                  | Dhagaxa haray                                                                                                           |
| `row.duration`                | Muddada                                                                                                                 |
| `row.opponent`                | Ka soo horjeeda                                                                                                         |
| `row.view`                    | Eeg ciyaarta                                                                                                            |
| `endReasons.opponentBelowThree` | Wax ka yar saddex dhagax                                                                                              |
| `endReasons.opponentCapturedAll` | Dhammaan waa la qabtay                                                                                               |
| `endReasons.resignation`      | Is dhiibid                                                                                                              |
| `endReasons.drawTermination`  | Barbaro                                                                                                                 |
| `endReasons.bothBlocked`      | Labaduba xanniban                                                                                                       |
| `endReasons.forcedJareSpaceMaking` | Jare qasab ah                                                                                                      |
| `endReasons.abandoned`        | Ka bixid                                                                                                                |
| `endReasons.idle`             | Hakad                                                                                                                   |
| `older`                       | Ciyaaro ka hor                                                                                                          |
| `empty.title`                 | Weli ciyaar lama kaydin                                                                                                 |
| `empty.body`                  | Ciyaaraha aad la ciyaarto akoon kale ayaa halkan ku kaydsama. Ciyaaraha martida lama kaydiyo.                           |
| `empty.cta`                   | Ciyaar marti ah                                                                                                         |
| `emptyFiltered`               | Shaandhadan ciyaar kuma jirto.                                                                                          |
| `durationUnits.hours` / `minutes` / `seconds` | s / daq / il                                                                                            |

`siteContent.so.pages.match`:

| Key                             | Draft                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `path`                          | `/match/[id]`                                                                                      |
| `title`                         | Ciyaar Shaxda ah                                                                                   |
| `pageTitle`                     | @{a} iyo @{b}                                                                                      |
| `pageDescription.win`           | @{winner} ayaa ka guuleystay @{loser} ciyaar Shaxda ah.                                            |
| `pageDescription.draw`          | @{a} iyo @{b} waxay ku kala tageen barbaro.                                                        |
| `headline.win`                  | @{winner} ayaa guuleystay                                                                          |
| `headline.draw`                 | Barbaro                                                                                            |
| `playerResult.win` / `loss` / `draw` | Guuleystay / Khasaaray / Barbaro                                                              |
| `youLabel`                      | Adiga                                                                                              |
| `onlineEndReasons.abandoned`    | @{username} wuu ka baxay ciyaarta.                                                                 |
| `onlineEndReasons.idle`         | @{username} wuu hakaday, wareeggiisiina wuu dhaafay.                                               |
| `details.heading`               | Faahfaahinta ciyaarta                                                                              |
| `details.playedAt`              | Taariikhda                                                                                         |
| `details.utc`                   | UTC                                                                                                |
| `details.duration`              | Muddada                                                                                            |
| `details.mode`                  | Nooca                                                                                              |
| `details.startingPlayer`        | Bilaabay                                                                                           |
| `details.firstAdvantage`        | Horrayn                                                                                            |
| `details.firstAdvantageHow.placementJare` | jare intii dhigista                                                                      |
| `details.firstAdvantageHow.noJare` | jare la'aan, ciyaaryahanka labaad                                                             |
| `details.undecided`             | Lama go'aamin                                                                                      |
| `details.pieces`                | Dhagaxa haray                                                                                      |
| `details.captures`              | Qabashooyin                                                                                        |
| `details.actions`               | Tallaabooyin                                                                                       |
| `modes.invite` / `modes.quick`  | Casuumaad / Kulan degdeg ah                                                                        |
| `rated` / `friendly`            | Tartan / Saaxiibtinimo                                                                             |
| `deletedMember`                 | Xubin la tirtiray                                                                                  |
| `profilesHeading`               | Bogagga ciyaaryahannada                                                                            |
| `share.action`                  | La wadaag ciyaarta                                                                                 |
| `share.statusLabel`             | Xaaladda wadaagista                                                                                |
| `share.shareTitle`              | @{a} iyo @{b} — Shaxda                                                                             |
| `share.shareText`               | Eeg ciyaartan Shaxda ah.                                                                           |
| `share.shared` / `copied` / `failed` | Ciyaarta waa la wadaagay. / Xiriiriyaha ciyaarta waa la koobiyeeyay. / Wadaagiddu ma shaqayn. Xiriiriyaha gacanta ku koobi. |

The engine reason on the match page reuses
`messages.so.localGame.result.reasons[endReason]` unchanged; only the online
override sentences are new.

`messages.so.onlineGame.result.viewMatch`: "Eeg ciyaarta".

`siteContent.so.pages.account.historyLink`: "Ciyaarahayga".

`/legal`, section `xogta` (stored data), new paragraph:

> Ciyaaraha ay labada dhinacba akoon ku galeen waa la kaydiyaa: magacyada
> dadweynaha ee labada ciyaaryahan, natiijada, sababta ciyaartu ku
> dhammaatay, tirada dhagaxa iyo qabashooyinka, taariikhda, iyo tallaabooyinka
> ciyaarta si dib loogu daawan karo. Bogga ciyaar kastaa waa mid dadweyne ah
> oo qof kastaa furi karo. Iimaylkaaga iyo aqoonsiga Google lagama arko.
> Ciyaaraha uu marti ka qayb qaatay lama kaydiyo.

---

## 11. Configuration by environment

Nothing new: no secrets, no bindings, no cron, no `vars`. H2 reads through
the existing `DB` binding of the web Worker in every environment.

| Item                 | dev                        | e2e                                                | preview / production                    |
| -------------------- | -------------------------- | -------------------------------------------------- | --------------------------------------- |
| Ledger tables        | H1 migration via Miniflare | applied by the e2e harness like `0000`             | applied by the H1 rollout, before H2 deploys |
| Optional H2 index migration (§3.2) | Miniflare, applied by tests | e2e harness                              | `wrangler d1 migrations apply` (operational step) |
| Seeded history rows  | none                       | `tests/e2e/fixtures/match.ts` (§13)                | none                                    |
| `PUBLIC_SITE_ORIGIN` | existing                   | existing                                           | existing; match share URLs derive from it |

`web/.env.production` and `.dev.vars` are untouched; the e2e harness keeps
`pnpm check:e2e-isolation` passing.

---

## 12. Cost model

At the `shaxda-v2.md` §15 target of ~1,500 DAU / ~10,000 MAU, assuming one
`/history` view per active account per day and five match-page views per
completed game:

| Item                              | Per day                                                | Free tier |
| --------------------------------- | ------------------------------------------------------ | --------- |
| D1 rows read, `/history`          | ~1,500 × (owner's games + 20 + 84)                     | 5M        |
| D1 rows read, `/match/<id>`       | ~5 × games/day × 6                                     | 5M        |
| D1 rows written                   | 0                                                      | 100k      |
| Storage                           | 0 new tables                                           | 5 GB      |
| Worker requests                   | +1 SSR request per page view (plus the session read that `hooks.server.ts` already performs) | 100k/day |
| Durable Object time               | none                                                   | —         |

The summary count is the one term that grows with a player's record: an
account with 2,000 games reads 2,000 rows per `/history` load. R4 introduces
precomputed player aggregates; when the median owner passes ~500 games, move
the summary onto those aggregates rather than adding a table in H2.

A match link shared into a large WhatsApp group costs six rows per view; a
100k-view day is ~12% of the free read allowance. Acceptable; edge caching
is the escape hatch and is deliberately not in H2 (H2-D6).

---

## 13. Tests

Vitest (web, jsdom):

- `history/+page.server.ts`: signed out → `303 /login?returnTo=/history`;
  session without username → `303 /register?returnTo=/history`; invalid
  `filter` → `all`; invalid `after` → first page; `nextHref` keeps the filter;
  `cache-control: no-store`; serialised data contains neither the owner's nor
  any opponent's `user_id` nor email.
- `match/[id]/+page.server.ts`: malformed id → 404 and the DB spy is never
  called; unknown id → 404; `?a=12` → 200; `isViewer` true for the signed-in
  player only, false for both when signed out; deleted opponent → `deleted`
  participant; output has no `userId`, `roomCode`, or `replay` property.
- `history/+page.svelte`: summary hidden at zero games; one `history-row` per
  row with the outcome word; opponent link href is `/u/<currentUsername>`;
  deleted opponent renders the label without an anchor; active filter has
  `aria-current`; older link present/absent; filtered empty copy differs from
  the no-games copy; `noindex` meta present.
- `match/[id]/+page.svelte`: title `@a iyo @b | Shaxda`; description win vs
  draw; canonical and `og:url` at `/match/<id>`; headline per result; reason
  line uses the online override when set; details list values; both profile
  links; `(Adiga)` only on the viewer's block.
- `ShareLink`: the existing `ShareProfile` tests move to the generic component
  (share sheet, cancelled sheet, clipboard fallback, failure) and
  `ShareProfile` keeps a wrapper test proving the payload is unchanged.
- `format.ts`: `formatDuration` (`45 il`, `3 daq 2 il`, `1 s 5 daq`),
  `computeStreak` (mixed, all-same → capped, draws as their own run, empty),
  `recentForm` (≤ 5, newest last).
- `OnlineGameController`: `matchSaved` with the current `matchNumber` sets
  `savedMatchId`; a stale `matchNumber` is ignored; cleared on
  `rematchStatus` with a new number, on `leave()`, and on `joinRoom()`.
- `GameResultOverlay`: an action with `href` renders as a link with the
  expected variant; the first action remains a focused button.
- `OnlineTabletop`: `online-view-match` appears only when `savedMatchId` is
  set and is never first.
- `topBarConfig`: complete account → history item between profile and
  settings; incomplete and signed-out → absent.
- `PageMeta`: `noindex` prop emits the robots meta; default does not.

Vitest Workers pool (`packages/db`, Miniflare D1, real migrations):

- Ledger fixture: 45 matches across three accounts (`u1` vs `u2`, `u1` vs
  `u3`, `u2` vs `u3`), mixed outcomes, rated and friendly, two claim-win rows,
  three rows sharing one `ended_at` millisecond, one opponent with a released
  alias, one opponent whose `user.username` is `NULL`.
- `readHistoryPage`: walking pages of 20 yields every one of `u1`'s matches
  exactly once, in `(ended_at, match_id)` descending order, including across
  the tie; each filter returns only matching rows; a cursor built from `u2`'s
  rows never leaks `u2`'s matches to `u1`; a user with no rows → empty page,
  `nextCursor: null`.
- `readHistorySummary`: counts, win rate, streak, and form equal a
  hand-computed table; `20+` capping on a synthetic run of 25 wins.
- `readMatch`: found with both participants; missing id; a match with one
  player row (inserted deliberately) → `missing`; `NULL` username → deleted
  participant; the returned record has no `userId`.
- `resolveOpponentUserId` (Should): current username, released alias, and an
  unknown name.
- `EXPLAIN QUERY PLAN` for the page query (with and without cursor, each
  filter), the summary query, and the form query: every plan line for
  `match_player` contains `USING INDEX` on the owner index and none contains
  `SCAN match_player`.

Playwright (existing harness):

- New fixture `tests/e2e/fixtures/match.ts` `seedMatches(owner, opponent,
  spec[])` writing `match` + `match_player` rows with `wrangler d1 execute`
  exactly like `seedAccount` (same retry on `SQLITE_BUSY`), with a `cleanup()`.
- `/history` signed out redirects to `/login?returnTo=/history`.
- Signed in with 25 seeded games: summary numbers, 20 rows, older link → 5
  rows, `wins` filter shows only wins, opponent link goes to
  `/u/<current username>` even when the seeded snapshot is the alias, the
  page body never contains an account id.
- Zero games → empty state with the `/online` link.
- Open a row → match page shows both usernames, the reason, and the details;
  `share-match` copies `<origin>/match/<id>`; `/match/does-not-exist` shows
  the Somali 404 page.
- Real game (needs §3.4; `test.skip` with that reason until then): two seeded
  complete accounts create/join a room, each places one piece, the creator
  resigns; both `online-game-result` overlays show `online-view-match`; the
  joiner follows it and sees both usernames and the resignation reason; both
  `/history` pages list the match with `Guuldarro` for the creator and `Guul`
  for the joiner; neither page contains an account id.

Checks: `pnpm check` (format, `check:hibernation`, `check:e2e-isolation`,
lint, typecheck, test, `test:worker`, build).

---

## 14. Decisions

| ID     | Decision                                                                                                                                              | Rationale                                                                                                                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H2-D1  | Match ids are opaque, validated by `^[A-Za-z0-9_-]{10,40}$` before any query, and never derived from `room_code`/`match_number`. Recommendation to H1: 16 characters from `ROOM_CODE_ALPHABET`, minted in the DO (~80 bits). | A URL should not reveal the room code (invite links are shared and rooms outlive games), and public pages should not be enumerable. The tolerant regex means H2 does not care which id format H1 picks. |
| H2-D2  | `/history` is keyed on the session only; no user/username parameter exists.                                                                          | `AGENTS.md`: never accept a user id from the browser. D8: history is owner-only.                                                                                                                                                                       |
| H2-D3  | Opponent labels and links use the current `user.username` joined at read time; `username_snapshot` is only the label for deleted members.             | Alias-safe links by construction; a renamed opponent is still findable; the snapshot stays useful for A3 tombstones.                                                                                                                                   |
| H2-D4  | Cursor pagination, forward-only, 20 rows, cursor = `base64url("<ended_at>:<match_id>")`, row-value comparison in SQL.                                 | Stable under inserts (new games only get newer `ended_at`), index-friendly, no offset scans. A row persisted late by an H1 retry appears on reload; accepted.                                                                                          |
| H2-D5  | The summary header ignores the active filter.                                                                                                        | The header is the account's record; filters narrow the list. Filter-scoped counts would double the aggregate reads for little value.                                                                                                                    |
| H2-D6  | Match pages set no explicit cache header; no edge caching in H2.                                                                                     | The response varies by session (top bar, `(Adiga)`), so shared caching needs work R3 will do properly. Six rows per view is cheap (§12).                                                                                                               |
| H2-D7  | Dates are formatted server-side in UTC with `so-SO`, wrapped in `<time datetime>`; viewer-zone formatting is a Should.                                | Same formatter `/account` already ships; SSR cannot know the viewer's zone; the machine-readable timestamp makes the enhancement trivial.                                                                                                              |
| H2-D8  | `ShareProfile` is generalised into `ShareLink`; `ShareProfile` stays as a wrapper.                                                                   | The brief asks to reuse the share component; a wrapper keeps the profile tests and call sites untouched.                                                                                                                                               |
| H2-D9  | The overlay "view match" action is an in-app link, always secondary.                                                                                 | Rematch stays the primary flow; a new tab is hostile inside the installed PWA; the seat remains reclaimable through `/online?room=`.                                                                                                                    |
| H2-D10 | H2 renders no replay control, only a documented insertion point.                                                                                     | A disabled "coming soon" button is dead UI; H3 lands the control with the viewer.                                                                                                                                                                      |
| H2-D11 | H2 owns the `/legal` disclosure of stored, public matches.                                                                                            | H1 stores rows but exposes nothing; H2 is the first milestone that makes them visible.                                                                                                                                                                 |
| H2-D12 | H2 adds no D1 write path and no migration unless a §3.2 index is missing.                                                                            | Keeps the milestone reviewable and the ledger's single writer in the DO (`shaxda-v2.md` §6.1).                                                                                                                                                         |
| H2-D13 | `first_advantage = NULL` renders "not decided"; `first_advantage_how` uses neutral labels.                                                            | Games can end during placement; the page must not invent a value.                                                                                                                                                                                      |
| H2-D14 | Streak and form come from the newest 20 rows; a full-window run shows `20+`.                                                                         | Bounded reads; a longer exact streak is a vanity number R4 can compute from aggregates.                                                                                                                                                                |
| H2-D15 | Invalid `filter`/`after` values fall back to defaults instead of 400.                                                                                 | User-facing page reached by links; a stale or mistyped URL should still show the history.                                                                                                                                                              |
| H2-D16 | When `online_end_reason` is set, its sentence replaces the engine reason everywhere.                                                                  | Claim-win is stored as a synthetic `resignation`; showing "a player resigned" would be false.                                                                                                                                                          |
| H2-D17 | `/match/<id>` ignores all query parameters and reserves `?a=` for H3.                                                                                 | H3 deep links must not 404 on a deployment that is between H2 and H3.                                                                                                                                                                                  |

---

## 15. Open questions for the founder

Answers change copy or small layout choices, not the design.

1. Somali terms in §10, in particular "Ciyaarahayga" for history, "Tartan"
   for rated, "Saaxiibtinimo" for friendly, and "Kulan degdeg ah" for quick
   match (ties to `shaxda-v2.md` §17 question 4).
2. Recent-form marks: letters `G / K / B`, coloured chips with no letter, or
   full words? Letters collide in Somali (`guul` and `guuldarro` both start
   with G), hence `K` for khasaare in the draft.
3. Should history rows show the time of day, or only the date (chosen)? Match
   pages show both.
4. Should a deleted opponent's old username be shown at all (chosen: no, the
   neutral "Xubin la tirtiray" label only)?
5. Should the match page mention that the game was a rematch (`2aad` in the
   room)? Chosen: no, the room is not a public concept.

---

## 16. Implementation plan

One logical change per commit, in this order. Steps 2–6 are the TDD-first
slice with no UI.

```txt
1.  docs: link H2 spec from shaxda-v2 §9; confirm §3 against the H1 spec
2.  feat(shared): add match id, history filter, and cursor schemas
3.  test(db): add ledger test fixture builder                        (only if H1 exports no insert helper)
4.  feat(db): add readHistoryPage with cursor pagination             (+ plan assertions)
5.  feat(db): add readHistorySummary with streak and form            (+ tests)
6.  feat(db): add readMatch                                          (+ tests)
7.  refactor(web): extract requireCompleteAccount and toPublicProfile
8.  feat(i18n): add Somali copy for history, match pages, and navigation
9.  feat(i18n): disclose stored public matches on /legal
10. feat(web): add /history loader with filters and cursor pagination (+ loader tests)
11. feat(web): render the history summary, list, filters, and empty state
12. feat(web): add /match/[id] loader                                (+ tests)
13. refactor(web): generalise ShareProfile into ShareLink
14. feat(web): render /match/[id] with Open Graph metadata and sharing
15. feat(shared): add the matchSaved server message                 (only if H1 did not; contract-change commit, touches worker/)
16. feat(web): link the online result overlay to the saved match
17. feat(web): link history from the account panel and /account
18. test(e2e): add match seeding fixture and history/match coverage
19. test(e2e): cover a real account game reaching both histories     (skipped until §3.4)
20. feat(web): search history by opponent username                   (Should)
21. feat(web): add a date-range filter to history                    (Should)
22. feat(web): show match times in the viewer's time zone            (Should)
23. docs(ops): add H2 release verification to the V2 runbook
```

Rollout (from step 23):

1. Preview: confirm the H1 migration is applied and at least one match row
   exists; deploy the web Worker; open `/history` as each player and the
   match page signed out; check `og:` tags with a link preview tool.
2. Production: deploy after H1 has persisted real games for at least a day;
   spot-check that no match page or history payload contains an account id
   (the §13 tests enforce it, the reviewer confirms on production).

---

## 17. Done when

From the brief: both players of an H1 match can find it, open it, and share
it.

Additionally:

- `pnpm check` passes with the new web, Workers, and e2e tests; the real-game
  e2e is unskipped once §3.4 is in place.
- §3 has been reconciled with the H1 spec and any difference is recorded in
  §14.
- A search of the H2 loaders, page data types, and rendered pages finds no
  `user_id`, email, room code, or replay payload.
- `/legal` discloses stored matches and public match pages.
- `docs/shaxda-v2.md` §4 marks H2 **shipped** with the merge date.
