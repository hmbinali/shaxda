# X1 — Product Analytics (Spec)

| Field         | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| Status        | Draft, not started                                         |
| Brief         | `docs/shaxda-v2.md` §8 (X1), §7.2 (tables), §16 (D10)      |
| Workspace     | `x1-product-analytics`                                     |
| Depends on    | Nothing. Runs in parallel with H1.                         |
| Unblocks      | S1/S2/S3 (numbers to sell against), every V2 success metric |
| Touches       | `packages/shared`, `packages/db`, `packages/i18n`, `web/`  |
| Does not touch | `worker/`, `packages/game-engine`, Turnstile, auth tables |

This spec refines the X1 brief; it does not widen it. Where it makes a choice
the brief left open, the choice is recorded in §15 with its rationale. Read
`docs/shaxda-v2.md` §1–§8 and `AGENTS.md` before implementing.

---

## 1. Goal and scope

**Goal.** Know DAU, WAU, MAU, and the game funnel exactly, with no PII, before
any retention or revenue claim is made.

### Must

1. A stable anonymous id per device or account, derived server-side with a
   keyed hash. Raw guest ids, account ids, IP addresses, and user agents are
   never stored by X1.
2. A once-per-day client beacon `POST /api/analytics/active` that writes one
   `active_user_day` row, guarded by a localStorage "reported for day" marker.
   Works from the prerendered `/local` and `/online` routes.
3. Daily counters in `event_daily` for the game funnel: local game
   started/completed, online invite game started/completed, room
   created/joined, account registered, PWA installed. Client-reported events
   go through `POST /api/analytics/event` (Zod validated, same-origin only,
   rate limited). `account_registered` is counted server-side only.
4. Nightly job: roll DAU/WAU/MAU (total, guest, account) and new-device counts
   for the previous day into `event_daily`; prune `active_user_day` rows older
   than 400 days.
5. Internal `/admin/stats` page (SSR, allowlisted user ids) showing DAU, WAU,
   MAU with guest/account split, a 30-day trend table, games per day by mode,
   completion rate, and guest→account conversion.
6. Somali privacy note on `/legal` describing the anonymous counter and the new
   localStorage key.

### Should

- D7/D30 retention cohorts for accounts from `active_user_day`.
- CSV export of `event_daily` from `/admin/stats`.
- Catch-up-on-read: `/admin/stats` fills any gauge missing for the last 35
  days, so a missed cron never leaves holes.

### Not in X1

From the brief: Workers Analytics Engine, per-move events, funnels by page,
third-party analytics.

Added by this spec (each is a deliberate non-goal, not an oversight):

- Any change to the game Worker or Durable Objects. Online funnel counts are
  client-reported in X1 (§15, X1-D1).
- Idempotency keys or per-game rows of any kind. Two tables only.
- Real-time dashboards, charts libraries, alerts.
- Sponsor impressions and clicks (S2 owns them; it reuses the anonymous id).
- Linking a guest id to the account it later creates. Conversion is a ratio of
  daily aggregates (§10.3), never an identity join.
- A consent banner. Nothing here uses cookies or identifies a person; the legal
  page documents it.

---

## 2. Definitions

| Term          | Definition                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Day           | UTC calendar day as `YYYY-MM-DD`. The server assigns the day from its own clock; the client never sends one.                                     |
| Anon id       | `base64url(HMAC-SHA-256(key = ANALYTICS_SALT, msg = "<kind>:<rawId>"))`. Kind is `guest` or `account`. 43 characters.                             |
| Kind          | `account` when the beacon request carries a valid Better Auth session (complete or incomplete account); otherwise `guest`.                       |
| Active user   | An anon id with an `active_user_day` row for that day.                                                                                            |
| DAU(d)        | `COUNT(*) FROM active_user_day WHERE day = d`.                                                                                                    |
| WAU(d)        | `COUNT(DISTINCT anon_id)` over `day BETWEEN d-6 AND d`.                                                                                           |
| MAU(d)        | `COUNT(DISTINCT anon_id)` over `day BETWEEN d-29 AND d`.                                                                                          |
| New guest(d)  | Guest anon ids active on `d` with no `active_user_day` row before `d` (within the 400-day window).                                                |
| Counter event | A row in `event_daily` that is incremented by 1 per occurrence.                                                                                   |
| Gauge event   | A row in `event_daily` whose `count` is a value computed for that day and replaced on each rollup.                                                |
| Reporter      | For online events, the one client designated to send the beacon so a two-player game is counted once (§5.2).                                      |

Counting caveats the founder must know when quoting numbers:

- A device used signed-out and then signed-in on the same day yields two anon
  ids (one guest, one account) and counts twice on that day only.
- One account on three devices counts once.
- A cleared browser or a new guest id counts as a new guest device.
- Rotating `ANALYTICS_SALT` changes every anon id; WAU/MAU spanning the
  rotation double-count. Rotate only deliberately, and note the date.

---

## 3. Privacy model

What the server stores per active beacon: `day`, `anon_id`, `kind`,
`first_seen_at` (epoch ms, for debugging only). Nothing else.

What is never stored, logged, or echoed: the raw guest id, the account id, the
username, the IP address, the user agent, the page URL, the room code, the
session token. Route handlers must not `console.log` request bodies.

- The salt is `ANALYTICS_SALT`, a Worker secret of at least 32 random
  characters, set per environment through `wrangler secret put`. The route
  fails closed (`503`) when it is missing; it never hashes without a key.
- The hash is keyed (HMAC) rather than `SHA-256(salt || id)`; this is the
  standard construction and satisfies the brief's "salted SHA-256". The helper
  lives in `packages/shared/src/analytics/anonId.ts` next to the existing HMAC
  helpers in `identity/ticket.ts`.
- `event_daily` holds only aggregate integers and is kept indefinitely.
- `active_user_day` is pruned after 400 days (§9). 400 days keeps one full
  year-over-year comparison.
- Cloudflare Web Analytics stays exactly as it is (`AnalyticsBeacon.svelte`).
  X1 adds no third-party script.
- `/legal` gains one paragraph in the existing `cabbiraadda` section and one
  entry in the `kaydka-qalabka` key list (§11). The section's `xogta`
  paragraph that still says Shaxda has no accounts and no D1 is stale from
  V1.0; fix it in the same i18n commit since X1 is editing the neighbouring
  text.

---

## 4. Data model

Migration `packages/db/migrations/000N_analytics.sql`, hand-written, with a
matching `meta/_journal.json` entry and Drizzle definitions in
`packages/db/src/schema.ts` for typed reads. `N` is assigned at merge time:
`0001` if X1 lands before H1, otherwise `0002` (H1 owns `000N_matches.sql`;
whichever merges second takes the next number).

```sql
CREATE TABLE `active_user_day` (
  `day`           text    NOT NULL,
  `anon_id`       text    NOT NULL,
  `kind`          text    NOT NULL,
  `first_seen_at` integer NOT NULL,
  PRIMARY KEY (`day`, `anon_id`),
  CONSTRAINT "active_user_day_day_check"  CHECK (length(`day`) = 10),
  CONSTRAINT "active_user_day_kind_check" CHECK (`kind` IN ('guest','account')),
  CONSTRAINT "active_user_day_anon_check" CHECK (length(`anon_id`) BETWEEN 40 AND 64)
);
--> statement-breakpoint
CREATE INDEX `active_user_day_anon_day_idx` ON `active_user_day` (`anon_id`, `day`);
--> statement-breakpoint
CREATE TABLE `event_daily` (
  `day`        text    NOT NULL,
  `event`      text    NOT NULL,
  `count`      integer NOT NULL DEFAULT 0,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`day`, `event`),
  CONSTRAINT "event_daily_day_check"   CHECK (length(`day`) = 10),
  CONSTRAINT "event_daily_count_check" CHECK (`count` >= 0)
);
```

Query coverage (every query in §10 and §9 hits one of these):

| Query                                   | Index used                        |
| --------------------------------------- | --------------------------------- |
| DAU for a day, by kind                  | PK prefix `(day)`                 |
| WAU/MAU distinct over a day range       | PK prefix `(day)` range scan      |
| New devices on a day (`NOT EXISTS` earlier row) | `active_user_day_anon_day_idx` |
| Cohort lookups by anon id               | `active_user_day_anon_day_idx`    |
| Trend rows for N days × M events        | PK prefix `(day)` range scan      |
| Increment / gauge upsert                | PK                                |
| Prune `day < ?`                         | PK prefix `(day)` range delete    |

Rules carried from `shaxda-v2.md` §7.2: no per-move or per-game rows; the game
Worker never touches these tables; migrations stay hand-written.

Event names are validated by Zod in `packages/shared`, not by a SQL `CHECK`, so
K1/K2 can add `queue_joined`, `online_quick_started`, … with a contract-change
commit and no migration.

### 4.1 Event names (`packages/shared/src/analytics/events.ts`)

```ts
export const clientCounterEvents = [
  "local_started",
  "local_completed",
  "online_invite_started",
  "online_invite_completed",
  "room_created",
  "room_joined",
  "pwa_installed",
] as const;

export const serverCounterEvents = ["account_registered"] as const;

export const gaugeEvents = [
  "dau", "dau_guest", "dau_account",
  "wau", "wau_guest", "wau_account",
  "mau", "mau_guest", "mau_account",
  "new_guest", "new_account",
  // Should (§10.4): keyed by cohort day, not by the day they were computed.
  "cohort_accounts", "retained_d7", "retained_d30",
] as const;
```

`clientEventNameSchema = z.enum(clientCounterEvents)` is the only enum the
public route accepts. A client posting `account_registered` or a gauge name
gets `400`.

---

## 5. Event catalogue

### 5.1 Local (`/local`, `web/src/lib/game/localGame.svelte.ts`)

| Event             | Fires when                                                                                      | Once-only guarantee                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `local_started`   | `apply()` succeeds and the *previous* state was the initial state (empty board, placement phase) | The state stops being initial after the first action; a resumed game never re-fires |
| `local_completed` | `apply()` transitions `phase` to `gameOver`                                                     | `gameOver` is terminal and the saved game is cleared on it                    |

Helper `isInitialState(state)` goes in `packages/game-engine` only if a pure
check does not already exist there; otherwise compare against
`createInitialState(state.startingPlayer)` in the web layer. Do not add
analytics concepts to the engine.

### 5.2 Online (`/online`, `web/src/lib/online/onlineGame.svelte.ts`)

Two clients see every online game. Exactly one is the **reporter** for each
event, chosen from state alone so no client has to wait for another message:

| Event                     | Fires when                                                                                              | Reporter                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `room_created`            | `OnlineGameClient.createRoom()` resolves with a room code                                               | The creating client                                                                             |
| `room_joined`             | First `joined` message for a room this page did not create                                              | The joining client; deduped per room code for the page lifetime                                 |
| `online_invite_started`   | `receiveState()` applies exactly one action (pending or inferred) and the previous state was initial     | The client whose `mySlot === state.startingPlayer` (it just moved, so it is present)             |
| `online_invite_completed` | `receiveState()` observes `phase` becoming `gameOver` by any path (action, inferred action, state sync) | The client whose `mySlot === state.winner`; on a draw (`winner === null`) the starting player's client |

Why these reporters: the starting player is present at the first action by
definition; the winner is present at every kind of ending, including claim-win
(the claimant is the winner) and idle timeout. The idle-but-connected loser
therefore never reports, which removes the double count a "slot A reports"
rule would have on idle claims. Claim-win order on the wire is `state` →
`matchStatus` → `matchEnded` (`worker/src/match-room.ts`), so a rule that
needed the online reason would have to wait; this one does not.

Per-page dedupe sets are keyed by `${roomCode}:${matchNumber}`; rematches
increment `matchNumber` and count again. A full page reload during the first
move can produce one duplicate `online_invite_started`; accepted (§15,
X1-D6). Exact account-vs-account counts arrive with the H1 ledger, which also
calibrates these client numbers.

Game stores stay free of `fetch`: `LocalGame` and `OnlineGame` accept an
optional `report?: (event: ClientEventName) => void` in their existing
options object (same dependency-injection style as `storage`, `fetchFn`,
`WebSocketCtor`). Pages pass `reportEvent` from `$lib/analytics`; tests pass a
spy.

### 5.3 Shell

| Event           | Fires when                                                     | Where                                                       |
| --------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| `pwa_installed` | `appinstalled` window event                                    | `web/src/lib/pwa/pwa.svelte.ts` `handleAppInstalled`, via an injected `report` |

### 5.4 Server-side

| Event                | Fires when                                                  | Where                                                                                   |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `account_registered` | `claimUsername()` returns `{ kind: "claimed" }`             | `web/src/routes/register/+page.server.ts` `confirm` action, `platform.context.waitUntil(incrementDailyEvent(...))`, awaited when no context |

Once per account by construction: the initial username claim succeeds exactly
once. Failure outcomes (`taken`, `alreadyComplete`, `missing`) do not count.

---

## 6. Client beacons (`web/src/lib/analytics/`)

```txt
web/src/lib/analytics/
  AnalyticsBeacon.svelte      existing Cloudflare Web Analytics tag (unchanged)
  ActiveUserBeacon.svelte     mounts reportActiveToday() in the root layout
  activeBeacon.ts             daily marker + POST /api/analytics/active
  eventBeacon.ts              fire-and-forget POST /api/analytics/event + dedupe sets
  day.ts                      utcDay(now): "YYYY-MM-DD"
```

### 6.1 Daily active beacon

- localStorage key `shaxda:analytics-active-day:v1`, value `YYYY-MM-DD`. Same
  naming and `try/catch` handling as `guestIdentity.ts`.
- `reportActiveToday({ storage, fetchFn, guestId, now })`:
  1. If `!navigator.onLine`, return (PRD §13: offline analytics are discarded
     silently; no queue).
  2. If the marker equals `utcDay(now)`, return.
  3. If an attempt is already in flight or failed on this page load, return
     (module-level flag; no retry loop, the next navigation retries).
  4. `fetch("/api/analytics/active", { method: "POST", keepalive: true,
     credentials: "same-origin", headers: { "content-type": "application/json" },
     body: { v: 1, guestId } })`.
  5. On `200`, store the `day` from the response body as the marker. On any
     other result, store nothing.
- `ActiveUserBeacon.svelte` is rendered in `web/src/routes/+layout.svelte`
  next to `<AnalyticsBeacon />`. It runs on `onMount` and again on
  `visibilitychange → visible`, so an installed PWA left open across midnight
  UTC reports the new day. It never runs during SSR or `building`.
- `guestId` comes from `getOrCreateGuestId()`; the server decides `kind`, the
  client never sends an account id.

### 6.2 Event beacon

- `reportEvent(name)`: same online check, `fetch(..., { keepalive: true })`
  so a game-over beacon survives navigation to the result screen or away
  from the page. No await in any interaction path, no retry, errors swallowed.
- Dedupe sets live in module memory (per page load), keyed as §5 describes.
- Never blocks or delays a move, a capture prompt, or a blocked prompt.

---

## 7. API routes (web Worker)

Both routes: `export const prerender = false`, `Cache-Control: no-store`,
JSON bodies only, and the guard order below. They copy the shape of
`web/src/routes/api/online/identity/+server.ts`.

Guard order for both:

1. `platform.env` present, else `503`.
2. `Origin` header must equal `canonicalAuthOrigin(env.AUTH_BASE_URL)`, else
   `403` (browsers always send `Origin` on same-origin POST, including
   `keepalive` fetches).
3. `content-type` starts with `application/json`, else `415`.
4. Body ≤ 1 KB, parsed with the Zod schema, else `400`.
5. Rate limit by client IP (`cf-connecting-ip`) through the
   `ANALYTICS_RATE_LIMIT` binding: 120 requests / 60 s / IP shared by both
   routes. Over limit → `429`. Binding absent (dev, e2e, unit tests) → allow;
   the handler receives a `limiter` interface so tests inject a fake.
6. `ANALYTICS_SALT` present (active route only), else `503`.

### 7.1 `POST /api/analytics/active`

Request (`analyticsActiveRequestSchema`, `packages/shared`):

```ts
{ v: 1, guestId: string /* guestIdSchema: 8–128 chars */ }
```

Handler:

- `kind = locals.user === null ? "guest" : "account"`;
  `rawId = kind === "account" ? locals.user.id : body.guestId`.
- `anonId = await anonIdFor(kind, rawId, env.ANALYTICS_SALT)`.
- `recordActiveUser(db, { day: utcDay(now), anonId, kind, now })` runs
  `INSERT OR IGNORE INTO active_user_day (day, anon_id, kind, first_seen_at)
  VALUES (?1, ?2, ?3, ?4)`. The unique primary key makes repeats a no-op.
- Response `200 { day }`. The client stores that day.

The session lookup in `hooks.server.ts` already runs for this route and is
what makes `kind` trustworthy: the client cannot claim to be an account.

### 7.2 `POST /api/analytics/event`

Request (`analyticsEventRequestSchema`):

```ts
{ v: 1, event: ClientEventName }
```

Handler: `incrementDailyEvent(db, utcDay(now), event, now)` runs

```sql
INSERT INTO event_daily (day, event, count, updated_at) VALUES (?1, ?2, 1, ?3)
ON CONFLICT (day, event) DO UPDATE
  SET count = count + 1, updated_at = excluded.updated_at;
```

Response `204`. No session is needed: add `/api/analytics/event` to a
`sessionlessRouteIds` set in `hooks.server.ts` beside
`prerenderedGameRouteIds` so each event does not cost a D1 session read.

### 7.3 Idempotency, stated precisely

The brief's test line is "counters are idempotent under retries". In X1:

- The active write is idempotent by primary key, at any retry count.
- The event upsert is atomic per statement, so concurrent increments never
  lose updates (`Promise.all` of N increments yields exactly N).
- The client never retries an event beacon and dedupes re-sends within a page
  (§5). There is no server-side idempotency key, by design (§15, X1-D6).

---

## 8. Queries (`packages/db/src/queries/analytics.ts`)

Raw D1 prepared statements on `AnyD1Database`, matching `queries/account.ts`.
All exported from `@shaxda/db`.

| Function                                       | Used by            |
| ---------------------------------------------- | ------------------ |
| `recordActiveUser(db, { day, anonId, kind, now })` | active route   |
| `incrementDailyEvent(db, day, event, now)`     | event route, register action |
| `setDailyGauge(db, day, event, value, now)`    | rollup             |
| `rollupAnalyticsDay(db, day, now)`             | cron, catch-up     |
| `pruneActiveUserDays(db, olderThanDay)`        | cron, catch-up     |
| `readStats(db, { today, days: 30 })`           | `/admin/stats`     |
| `readCohorts(db, { cohortDays })`              | `/admin/stats` (Should) |
| `readEventDailyCsv(db, { from, to })`          | CSV export (Should) |

`rollupAnalyticsDay(db, day)` computes, in one `db.batch()` of gauge upserts:

```sql
-- dau / dau_guest / dau_account
SELECT kind, COUNT(*) FROM active_user_day WHERE day = ?1 GROUP BY kind;
-- wau (and per kind)
SELECT COUNT(DISTINCT anon_id) FROM active_user_day WHERE day BETWEEN ?2 AND ?1;
-- mau (and per kind)
SELECT COUNT(DISTINCT anon_id) FROM active_user_day WHERE day BETWEEN ?3 AND ?1;
-- new_guest / new_account
SELECT a.kind, COUNT(*) FROM active_user_day a
 WHERE a.day = ?1
   AND NOT EXISTS (SELECT 1 FROM active_user_day b
                    WHERE b.anon_id = a.anon_id AND b.day < a.day)
 GROUP BY a.kind;
```

Gauge writes use `ON CONFLICT DO UPDATE SET count = excluded.count`
(replace), never `+ 1`. Running the rollup twice for the same day is a no-op.

---

## 9. Nightly rollup and retention

### 9.1 Job

`runAnalyticsNightly(env, now)` in `web/src/lib/server/analytics/nightly.ts`:

1. `D = utcDay(now) - 1 day`. Roll up `D` and `D - 1` (the second run heals a
   missed night; both are idempotent).
2. Should: cohort gauges for cohort days `D - 8` (D7) and `D - 31` (D30),
   see §10.4.
3. `pruneActiveUserDays(db, D - 400 days)`: `DELETE FROM active_user_day WHERE
   day < ?1`. ISO days compare lexicographically. After the first 400 days this
   deletes about one day of rows per night.

Trigger: cron `15 0 * * *` (UTC, 00:15, after the day is complete). Somalia is
UTC+3, so the founder sees "yesterday" finalised at 03:15 local time.

### 9.2 Wiring (spike first, ≤ 2 hours)

The web Worker's `main` is the adapter output `.svelte-kit/cloudflare/_worker.js`,
which exports `fetch` only. Confirm whether `@sveltejs/adapter-cloudflare`
7.x can emit a `scheduled` handler. If it cannot, use a thin wrapper:

```ts
// web/src/worker-entry.ts — bundled by wrangler; the adapter output is unchanged.
import kit from "../.svelte-kit/cloudflare/_worker.js";
import { runAnalyticsNightly } from "$lib/server/analytics/nightly";

export default {
  fetch: kit.fetch,
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runAnalyticsNightly(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<App.Platform["env"]>;
```

- `wrangler.jsonc` and `wrangler.preview.jsonc`: `main` → the wrapper,
  `"triggers": { "crons": ["15 0 * * *"] }`.
- `wrangler.e2e.jsonc` keeps `.svelte-kit/e2e/cloudflare/_worker.js`; the cron
  is not e2e-tested and `pnpm check:e2e-isolation` must keep passing
  untouched.
- `scripts/check-production-bundle.mjs` scans `.svelte-kit/cloudflare/`; the
  wrapper does not change what it scans. Re-run `pnpm check:bundle` in the
  spike to be sure.
- Local test of the handler: build, then
  `pnpm --filter @shaxda/web exec wrangler dev --test-scheduled` and
  `curl "http://localhost:8787/__scheduled?cron=15+0+*+*+*"`.

Fallback if the wrapper is unworkable: promote the Should "catch-up-on-read"
(§10.5) to Must, so `/admin/stats` performs the rollup and prune for missing
days through `platform.context.waitUntil`, and record the change in §15.

---

## 10. Admin

### 10.1 Allowlist

- `ADMIN_USER_IDS`: comma-separated permanent user ids, set with
  `wrangler secret put` per environment, `.dev.vars.example` entry left empty.
  Not a `vars` entry, so ids never sit in Git. No admin table, no role column.
- `web/src/lib/server/admin.ts`: `isAdminUser(env, userId)` and
  `requireAdmin(locals, env, returnTo)`:
  - signed out → `redirect(303, "/login?returnTo=<path>")` (same as
    `/account`);
  - signed in, not listed → `error(403)`;
  - listed → returns the user.
- S1 reuses this helper for `/admin/sponsors`.
- `+error.svelte` gains a `forbidden` variant (Somali) beside `notFound` and
  `unexpected`, because it currently renders 403 as "unexpected".

### 10.2 `/admin/stats`

`web/src/routes/admin/stats/+page.server.ts` + `+page.svelte`, SSR only
(`prerender = false`), `setHeaders({ "cache-control": "no-store" })`,
`<meta name="robots" content="noindex">`, not linked from public navigation,
not in the sitemap.

Data (`readStats`), all UTC:

| Block              | Content                                                                                                   | Source                          |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Headline           | DAU / WAU / MAU for yesterday, each with guest and account split                                          | gauges                          |
| Today so far       | Live DAU for today, by kind                                                                               | `COUNT(*)` on today             |
| 30-day trend table | one row per day: `dau`, `wau`, `mau`, `new_guest`, `new_account`, all counter events                      | `event_daily` range read        |
| Games              | started/completed per day for `local` and `online_invite`; completion rate over 7 and 30 days             | derived from the trend rows     |
| Rooms              | `room_created`, `room_joined`, rooms → started ratio (30 days)                                            | derived                         |
| Conversion         | `account_registered(30d) / new_guest(30d)`, labelled as an aggregate ratio                                | derived                         |
| Freshness          | last rollup day present; a warning line when yesterday's gauges are missing                              | gauges                          |

Presentation: Somali labels with metric codes (`DAU`, `WAU`, `MAU`), plain
tables, mobile-first (the founder will read it on a phone). No chart library.
An inline SVG bar strip per trend column is optional polish after the tables
work. Copy lives in `packages/i18n` under `siteContent.so.adminStats` with the
existing `TODO(translation-review)` marker.

Cost per page load at 1,500 DAU: ≈ 450 gauge/counter rows + ≈ 1,500 rows for
"today so far". Nothing scans `active_user_day` beyond one day.

### 10.3 Definitions shown on the page

The page prints its definitions in Somali so numbers are never quoted with the
wrong meaning: UTC days; DAU/WAU/MAU as in §2; completion rate =
`completed / started` for the same mode and window; conversion as above,
explicitly "not linked per person".

### 10.4 Retention cohorts (Should)

Cohort `X` = account anon ids with `MIN(day) = X` (first seen on `X`). D7 =
share active on any day in `(X, X+7]`; D30 = share active in `(X, X+30]`.
Computed by the nightly job for `X = D-8` and `X = D-31` and stored as gauges
keyed by the **cohort day**: `cohort_accounts` (denominator), `retained_d7`,
`retained_d30` (numerators). The page shows the last 8 weekly cohorts as
percentages. Cohorts need the `(anon_id, day)` index, which the migration
already ships.

### 10.5 Catch-up-on-read (Should; Must if §9.2 falls back)

On `/admin/stats` load, if any day in the last 35 (excluding today) lacks a
`dau` gauge, run `rollupAnalyticsDay` for those days and the prune inside
`platform.context.waitUntil`, and render the current request from what exists.

### 10.6 CSV export (Should)

`GET /admin/stats.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` (max 400 days) returns
`text/csv`, one row per day, one column per event name, behind the same
`requireAdmin`. `Content-Disposition: attachment`.

---

## 11. Somali copy

All new user-visible text is Somali. Drafts below are placeholders for a native
review under the repo's existing `TODO(translation-review)` convention.

`/legal`, section `cabbiraadda`, new paragraph:

> Shaxda waxay sidoo kale haysaa tirakoob aan qof lagu aqoonsan karin oo
> muujinaya inta qalab ama akoon ee maalin kasta adeegga isticmaasha. Qalabku
> hal mar maalintii wuxuu server-ka u diraa aqoonsiga martida (ama, haddii aad
> gashay, server-ku wuxuu isticmaalaa aqoonsiga akoonkaaga). Server-ku wuxuu
> ku beddelaa summad la qariyey oo aan dib loo furi karin, kadibna wuxuu
> kaydiyaa summaddaas, taariikhda, iyo in ay marti tahay ama akoon. Aqoonsiga
> ceeriin, cinwaanka IP-ga, iyo magaca isticmaalaha lama kaydiyo. Safafkan
> waxaa la tirtiraa 400 maalmood kadib. Tirooyinka ciyaaraha (la bilaabay, la
> dhammeeyey, qolal la sameeyey) waxaa loo kaydiyaa tiro maalinle ah oo aan
> qof gaar ah ku xirnayn.

`/legal`, section `kaydka-qalabka`, new detail:

> `shaxda:analytics-active-day:v1` — Taariikhda (UTC) ee ugu dambaysay ee
> qalabku u sheegay server-ka inuu firfircoon yahay. Ma jiro aqoonsi ku jira.

Admin page keys (`adminStats.*`): `title` "Tirakoobka isticmaalka",
`headline.dau` "Isticmaalayaal firfircoon maalintii", `headline.wau`
"… toddobaadkii", `headline.mau` "… bishii", `split.guest` "Marti",
`split.account` "Akoon", `todaySoFar` "Maanta ilaa hadda", `trend`
"Isbeddelka 30 maalmood", `games` "Ciyaaraha", `completionRate`
"Heerka dhammaystirka", `conversion` "Marti → akoon", `freshnessWarning`
"Tirooyinka shalay weli lama xisaabin.", `csv` "Soo deji CSV". Error page
`forbidden` "Boggan kuuma oggola" / "Akoonkaagu ma laha ogolaansho boggan."

---

## 12. Configuration by environment

| Item                          | dev (`.dev.vars`)                 | e2e (`wrangler.e2e.jsonc`)                     | preview                          | production                       |
| ----------------------------- | --------------------------------- | ---------------------------------------------- | -------------------------------- | -------------------------------- |
| `ANALYTICS_SALT`              | example value in `.dev.vars.example` | committed test value; add it to the committed-secret list in `check-production-bundle.mjs` | `wrangler secret put`            | `wrangler secret put`            |
| `ADMIN_USER_IDS`              | empty by default                  | e2e fixture user id if the harness has a signed-in fixture, else empty | secret                           | secret                           |
| `ANALYTICS_RATE_LIMIT`        | declared; verify local support in the spike | declared or absent (fail-open)        | `ratelimits` binding, 120/60 s   | same                             |
| Cron `15 0 * * *`             | `--test-scheduled` only           | none                                           | `triggers.crons`                 | `triggers.crons`                 |
| `main`                        | unchanged for `vite dev`          | unchanged                                      | wrapper (§9.2)                   | wrapper (§9.2)                   |
| D1 migration `000N_analytics` | Miniflare, applied by tests       | applied by the e2e harness like `0000`         | `wrangler d1 migrations apply --config wrangler.preview.jsonc` | `wrangler d1 migrations apply --config wrangler.jsonc` |

`App.Platform["env"]` in `web/src/app.d.ts` gains `ANALYTICS_SALT?: string`,
`ADMIN_USER_IDS?: string`, `ANALYTICS_RATE_LIMIT?: RateLimit`.

Wrangler binding shape (verify against the installed wrangler schema during
the spike; the key moved from `unsafe.bindings` to top level in 2025):

```jsonc
"ratelimits": [
  { "name": "ANALYTICS_RATE_LIMIT", "namespace_id": "1001",
    "simple": { "limit": 120, "period": 60 } }
]
```

Preview and production migrations are operational deployment steps
(`AGENTS.md` §4), never a side effect of tests.

---

## 13. Cost model

At the §15 traffic target of ~1,500 DAU / ~10,000 MAU:

| Item                     | Per day                                              | Free tier            |
| ------------------------ | ---------------------------------------------------- | -------------------- |
| D1 rows written          | ~1.5k active + ≤ 15k event upserts ≈ 17k             | 100k                 |
| D1 rows read             | cron ≈ 3 scans × 45k ≈ 135k; admin ≈ 2k per load     | 5M                   |
| Storage                  | 1.5k rows × 400 days × ~100 B ≈ 60 MB                | 5 GB                 |
| Worker requests          | +1 per device/day, + ~3 per game                     | 100k/day             |
| Durable Object time      | none (game Worker untouched)                         | —                    |

Revisit when DAU passes ~10k (storage ≈ 400 MB, cron scans ≈ 1M rows/day):
shorten retention or move `active_user_day` to Analytics Engine, which the
brief names as the escape hatch.

---

## 14. Tests

Vitest (web, jsdom):

- `activeBeacon`: no marker → posts once and stores the returned day; marker
  equals today → no request; marker from yesterday → posts; response `500` →
  no marker and no second attempt on the same page load; offline → no request;
  `visibilitychange` after midnight → posts.
- `eventBeacon`: sends `keepalive`, never throws, never retries, dedupes by
  key.
- `LocalGame`: `local_started` once on the first action, not on resume;
  `local_completed` once on `gameOver`.
- `OnlineGame`: reporter rules — starting player reports `started`; winner
  reports `completed`; draw → starting player; idle-claim loser does not
  report; rematch reports again with the new `matchNumber`; reconnect state
  sync does not re-report.
- `pwa.svelte.ts`: `appinstalled` → `pwa_installed`.
- Routes (mocked `platform` like `identity-route.test.ts`): wrong origin
  `403`, wrong content type `415`, invalid body `400`, `account_registered`
  from a client `400`, missing salt `503`, limiter says no `429`, guest vs
  account `kind` from `locals.user`, bound values never contain the raw guest
  id or user id, same input + same salt → same anon id, different salt →
  different anon id, `cache-control: no-store`.
- `hooks.server.ts`: `/api/analytics/event` does not call `getSession`.
- Admin: signed out → redirect; non-admin → `403`; admin → `200`, `noindex`,
  `no-store`; `readStats` shape.
- Register action: `account_registered` incremented exactly once on
  `claimed`, never on `taken`/`alreadyComplete`.

Vitest Workers pool (`packages/db`, Miniflare D1, real migrations):

- Migration `0001` applies after `0000`; constraints (`kind`, `day` length,
  `count >= 0`) reject bad rows.
- `recordActiveUser` twice → one row.
- 50 concurrent `incrementDailyEvent` → `count = 50`.
- `setDailyGauge` twice → second value wins.
- `rollupAnalyticsDay` on a fixture of ~30 devices across 40 days matches a
  hand-computed DAU/WAU/MAU/new per kind; running it twice changes nothing.
- `pruneActiveUserDays` keeps `day = D-400`, deletes `D-401`.
- Cohorts: fixture with known D7/D30 outcomes.

Shared:

- Schemas reject unknown events, wrong `v`, oversize guest ids.
- `anonIdFor` output length and base64url alphabet.

Playwright (existing harness, no new fixtures files):

- Finishing a local game emits one `POST /api/analytics/event` with
  `local_completed` (request intercept).
- Visiting `/` sends one `POST /api/analytics/active`; a reload sends none.
- `/admin/stats` returns `403` for the e2e signed-in fixture when not
  allowlisted.

Checks: `pnpm check` (format, `check:hibernation`, `check:e2e-isolation`,
lint, typecheck, test, `test:worker`, build) and `pnpm check:bundle` after the
wrapper lands.

---

## 15. Decisions

| ID     | Decision                                                                                                                                                                                                                                                              | Rationale                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1-D1  | Game-funnel counts are client-reported. The game Worker is not modified.                                                                                                                                                                                             | The brief says "server-side where the event already passes through a Worker", but room/game events pass only through the game Worker, which has no D1 in X1 (§6.1 gives it match tables only, in H1). Keeping X1 independent is worth more than exact online counts; H1's ledger gives exact account-vs-account counts and calibrates these. If drift exceeds ~10%, add a signed game-Worker → web-Worker channel as a follow-up. |
| X1-D2  | Reporter = starting player for `started`, winner for `completed`, starting player on draws.                                                                                                                                                                          | Chosen from state alone, always a present client, no race with `matchEnded`.                                                                                                                                    |
| X1-D3  | Anon id = HMAC-SHA-256 keyed by `ANALYTICS_SALT`, base64url.                                                                                                                                                                                                         | Standard keyed hash; satisfies "salted SHA-256"; reuses the HMAC helper pattern in `packages/shared/identity`.                                                                                                   |
| X1-D4  | Days are UTC; the server assigns them.                                                                                                                                                                                                                               | One clock; clients cannot back-date.                                                                                                                                                                             |
| X1-D5  | DAU/WAU/MAU/new/cohort values are nightly **gauges in `event_daily`**; no third table.                                                                                                                                                                              | Trends become one indexed range read instead of 30 distinct-count scans per page load; history survives the 400-day prune.                                                                                       |
| X1-D6  | Event beacons are sent at most once and never retried; no server idempotency keys.                                                                                                                                                                                  | Storing keys means a row per game. An occasional lost or duplicate beacon is within the tolerance of an internal funnel.                                                                                          |
| X1-D7  | Cron via a wrapper worker entry; fallback is catch-up-on-read from `/admin/stats`.                                                                                                                                                                                  | The adapter output exports `fetch` only. The wrapper leaves the adapter and the e2e harness untouched.                                                                                                           |
| X1-D8  | Admin allowlist = `ADMIN_USER_IDS` secret; no role column, no admin table.                                                                                                                                                                                          | One founder. Ids stay out of Git. S1 reuses the helper.                                                                                                                                                          |
| X1-D9  | Rate limiting via the Workers Rate Limiting binding, fail-open when absent.                                                                                                                                                                                         | The web Worker has no Durable Object to count in; analytics is non-critical, so a missing binding must not break pages.                                                                                          |
| X1-D10 | Same device signed-out then signed-in counts as two anon ids on that day.                                                                                                                                                                                            | Linking them would require storing the guest→account pair, which is exactly the identity join the brief forbids.                                                                                                 |
| X1-D11 | `account` kind includes incomplete accounts (signed in, no username yet).                                                                                                                                                                                            | The session is the trust signal; username completion is a separate funnel step already counted by `account_registered`.                                                                                          |

---

## 16. Open questions for the founder

Answers change copy or numbers, not the design.

1. Somali wording in §11 (needs a native review before merge).
2. Retention definition: "returned within N days" (chosen) vs "active on day N
   exactly".
3. Rate limit of 120 requests/min/IP: fine for shared NAT (a school, a
   café)? Raise to 300 if in doubt.
4. Keep 400-day retention for `active_user_day`, or shorten to 13 months?
5. Should `/admin/stats` be reachable on the preview deployment with a
   separate allowlist, or production only?

---

## 17. Implementation plan

One logical change per commit, in this order. Steps 2–4 have no UI and are
the TDD-first slice.

```txt
1.  docs: link X1 spec from shaxda-v2 §8; add V2 pointer to PRD §18 and AGENTS.md
2.  feat(shared): add analytics event names, beacon schemas, and anon id hashing
3.  feat(db): add active_user_day and event_daily migration          (+ test(db))
4.  feat(db): add analytics record, increment, gauge, rollup, prune queries (+ tests)
5.  feat(web): add POST /api/analytics/active                         (+ route tests)
6.  feat(web): add POST /api/analytics/event with IP rate limiting     (+ route tests, hooks test)
7.  feat(web): report daily active users from the root layout
8.  feat(web): report local game funnel events
9.  feat(web): report online room and invite game funnel events
10. feat(web): report PWA installs
11. feat(web): count account registrations server-side
12. chore(web): spike scheduled handler wiring for the web Worker      (decision recorded in §15)
13. feat(web): add nightly analytics rollup and 400-day retention cron
14. feat(web): add admin allowlist helper and 403 error copy
15. feat(i18n): add Somali copy for the admin stats page
16. feat(web): add /admin/stats
17. feat(i18n): describe the anonymous usage counter on /legal
18. feat(web): add retention cohorts to /admin/stats                  (Should)
19. feat(web): add CSV export to /admin/stats                         (Should)
20. docs(ops): add X1 rollout runbook (secrets, migrations, cron check, 7-day verification)
```

Rollout (from the ops runbook in step 20):

1. Preview: `wrangler secret put ANALYTICS_SALT`, `ADMIN_USER_IDS`; apply
   migration; deploy; confirm a beacon row, a cron run (Cloudflare dashboard →
   Workers → Cron events), and `/admin/stats` renders.
2. Production: same, then watch for 7 days.
3. Add the rate-limit binding, cron, and the two secrets to
   `docs/ops/launch-runbook.md` and `docs/ops/billing-alerts.md`.

---

## 18. Done when

From the brief: `/admin/stats` shows real numbers from production for 7
consecutive days and the founder can quote MAU.

Additionally:

- `pnpm check` passes with the new Workers and route tests.
- A search of the codebase and D1 schema for raw guest ids, user ids, IPs, or
  user agents in analytics paths finds none (`test` in §14 enforces the route
  half; the reviewer checks the rest).
- `/legal` describes the counter and the new localStorage key.
- `docs/shaxda-v2.md` §4 marks X1 **shipped** with the merge date.
