# X1 — Product Analytics (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Wave       | X1a: 1. X1b: 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Depends on | X1a: none (its ledger step needs H1's migration). X1b: H1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Register   | P12, P13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Contracts  | Owns [§9](v2-contracts.md#9-metrics-dictionary), [§10.2](v2-contracts.md#102-web-worker-entry-wrapper), the dispatcher and job lease of [§10.1](v2-contracts.md#101-one-cron-one-dispatcher), and the X1 tables of [§11](v2-contracts.md#11-migration-ownership). Consumes [§2.1](v2-contracts.md#21-h1-tables), [§5](v2-contracts.md#5-access-matrix), [§7.2](v2-contracts.md#72-the-fence), [§8](v2-contracts.md#8-deletion), [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone), [§12](v2-contracts.md#12-evidence) (E1, E3). |
| Brief      | `docs/shaxda-v2.md` §8 (X1), §6.1 (amended by X1b), §7.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Touches    | X1a: `packages/shared`, `packages/db`, `packages/i18n`, `web/`, `scripts/check-production-bundle.mjs`, `docs/ops/`. X1b: `worker/`, `packages/shared`, `packages/db`, `packages/i18n`, `web/`, `docs/shaxda-v2.md`, `docs/shaxda_prd.md`, `AGENTS.md`                                                                                                                                                                                                                                                                                              |

X1 measures use of Shaxda without storing raw identifiers. **X1a** (web
Worker only) adds the daily beacon, local game counts, nightly gauges,
`/admin/stats`, the `/legal` text, and the cron wrapper and dispatcher later
jobs reuse. **X1b** lets the game Worker count online play (P13) once H1 has
given it D1. Sponsor (S2), queue (K1), and public audience (S3) figures are
theirs.

## 1. Outcome and non-goals

**Outcome.** One private page shows every dictionary metric with raw counts
beside percentages, recording start, freshness, and cohort maturity, while
analytics storage holds no raw guest or account id, IP, or user agent.

**Must.**

- **X1a, web Worker only:** the per-identity beacon and local game events
  (§3.4, §4.1); the migration and job lease (§3.2, §3.5); the entry wrapper,
  `* * * * *` cron, dispatcher, and 00:15 UTC nightly job with the 90-day
  prune (§3.5, §4.3); ledger gauges once H1's tables are on `main`;
  `/admin/stats` (§3.6, §4.4); the `/legal` text (§7); a kill switch.
- **X1b, game Worker:** a first commit applying the brief's §6.1 P13
  amendment to the brief, `AGENTS.md`, and the PRD; allowlisted best-effort
  counters (§3.7, §4.2); their admin block and `/legal` line; a kill switch.

**Should.** Catch-up-on-read and CSV export on `/admin/stats` (§4.4); a
"returned within 7 days" row separate from exact-day D7.

**Not in X1.** Workers Analytics Engine, per-move or per-page events,
third-party analytics, charts, alerts (brief); client-reported online events;
a browser-to-account ratio, a total of people, or any guest-to-account link;
PWA-install counts (not in the dictionary); public figures (P8; S3 publishes
founder-approved snapshots); a consent banner (no cookies are set).

## 2. Decisions and dependencies

| ID  | How X1 applies it                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P12 | The nightly prune deletes `active_user_day` rows 90 days after their day and runs even with the kill switch off; `event_daily` aggregates are kept indefinitely; `/legal` states both. |
| P13 | X1b only. The game Worker upserts `+1` for allowlisted names after broadcasting, reads nothing but its write result, and never touches auth tables.                                    |

Also applied: P1 (an online game starts when play began), F8 (only account
games reach the ledger), P4 (`match.seq` exposes late saves), P17 (saves can
land 72 h late or later), P8 (public numbers are never X1's).

| Dependency                                          | Provides                                                                | For                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| H1 migration ([§2.1](v2-contracts.md#21-h1-tables)) | `match`, `match_player`, their indexes                                  | X1a ledger slice, which merges after it (both wave 1) |
| H1 game Worker `DB`, room `mode`, play-began marker | write path and counter inputs                                           | X1b                                                   |
| X1a                                                 | tables, name catalogue, admin page                                      | X1b                                                   |
| E1, E3 (both pass)                                  | fence semantics of [§7.2](v2-contracts.md#72-the-fence); wrapper design | X1a; X1's migration test repeats E1's fence cases     |

## 3. Contracts

### 3.1 Metric storage

Definitions: [v2-contracts §9](v2-contracts.md#9-metrics-dictionary). Every
metric is stored in `event_daily`:

| Dictionary row            | `event` names                                                         | `day`                | Written by                                                                                                          |
| ------------------------- | --------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Active browsers, accounts | `active_browsers_{1d,7d,30d}`, `active_accounts_{1d,7d,30d}`          | window end           | nightly: `COUNT(DISTINCT anon_id)` per kind over 1, 7, 30 days                                                      |
| Registrations             | `registrations`                                                       | claim day            | nightly: users with a claim in [d, d + 1) and none earlier                                                          |
| Online games              | the P13 names of [§9](v2-contracts.md#9-metrics-dictionary)           | event day            | X1b counter (§4.2)                                                                                                  |
| Local games               | `local_started`, `local_completed`                                    | receipt day          | client event (§4.1)                                                                                                 |
| Saved account games       | `saved_rated`, `saved_friendly`                                       | `ended_at` day       | nightly: `match` rows by `rated`                                                                                    |
| Weekly returning players  | `week_players`, `week_returning`                                      | Monday of ISO week w | nightly: accounts with a saved game in w; of those, with one in w + 1                                               |
| D7 / D30 return           | `cohort_size`, `cohort_d7`, `cohort_d30`, `cohort_within_7d` (Should) | cohort day d         | nightly: accounts whose first saved game is on d; of those, one on d + 7 / d + 30 exactly, or any in [d + 1, d + 8) |
| Quick-match funnel        | `queue_*`                                                             | —                    | K1                                                                                                                  |

- Names are Zod enums in `packages/shared/src/analytics/events.ts`:
  `clientEventNames` (all the public route accepts), `gaugeNames`, and
  `onlineCounterNames` (K1 extends it); `event` has no SQL `CHECK`.
- `active_browsers_*` counts `guest` rows, one per browser that sent the
  beacon, signed in or not; `active_accounts_*` counts `account` rows. The two
  are never summed.
- `online_room_created_*` takes the creator's kind; other P13 names say
  `account` only when both seats are. `saved_*` splits by `match.rated`.
- Counters are `+1` upserts; gauges are replace-writes made only once their
  window is complete, so a missing gauge means immature or not computed.

### 3.2 Tables

One hand-written migration, numbered at merge, with a journal entry and
Drizzle definitions in `packages/db/src/schema.ts` for typed reads.

```sql
CREATE TABLE active_user_day (                         -- pseudonymous, 90 days (P12)
  day     TEXT NOT NULL CHECK (length(day) = 10),      -- UTC YYYY-MM-DD, server clock
  anon_id TEXT NOT NULL CHECK (length(anon_id) = 43),  -- §3.3
  kind    TEXT NOT NULL CHECK (kind IN ('guest','account')),
  PRIMARY KEY (day, anon_id)) WITHOUT ROWID;              -- no storage order (§5)
CREATE TABLE event_daily (                             -- aggregates, kept indefinitely
  day        TEXT    NOT NULL CHECK (length(day) = 10),
  event      TEXT    NOT NULL CHECK (length(event) BETWEEN 1 AND 64),
  count      INTEGER NOT NULL CHECK (count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (day, event));
CREATE INDEX event_daily_event_day_idx ON event_daily (event, day);   -- "recorded since"
CREATE TABLE job_state (
  name TEXT PRIMARY KEY CHECK (length(name) BETWEEN 1 AND 64),
  lease_token TEXT, lease_expires_at INTEGER,
  cursor TEXT,                                         -- job-defined JSON
  last_success_at INTEGER, last_error TEXT,            -- error code only
  updated_at INTEGER NOT NULL,
  CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL)));
CREATE TABLE job_fence (ok INTEGER NOT NULL CONSTRAINT job_fence_guard CHECK (ok = 1));
CREATE INDEX username_claim_claimed_at_idx ON username_claim (claimed_at);
```

Activity, prune, and trend reads are key ranges on `day`; registrations use
the claim-day index, then `username_claim_user_released_idx`; ledger reads use
H1's `match_rated_ended_idx`, `match_player` key, and `match_player_owner_idx`.
The migration test records each query plan.

### 3.3 Keyed hash

`analyticsHash(salt, domain, value)` in `packages/shared/src/analytics/hash.ts`
is `base64url(HMAC-SHA-256(key = ANALYTICS_SALT, message = "<domain>:<value>"))`,
43 characters, using WebCrypto as `identity/ticket.ts` does. X1's domains are
`guest` (guest id) and `account` (user id); other specs use their own (S2:
`sponsor`). `ANALYTICS_SALT` is a secret of at least 32 characters; a missing
or short salt fails closed. Rotating it starts new pseudonyms, so windows
spanning the rotation overcount; the runbook records rotation dates.

### 3.4 Routes

Both routes: `prerender = false`, `cache-control: no-store`, JSON only.
Guards, in order: (1) no `platform.env` → `503`; (2) `ANALYTICS_ENABLED`
not `"true"` → `204`, nothing written; (3) `Origin` missing or not
`canonicalAuthOrigin(AUTH_BASE_URL)` → `403`; (4) not JSON → `415`, body over
1 KiB → `413`, invalid → `400`; (5) `ANALYTICS_RATE_LIMIT` keyed by
`cf-connecting-ip`, 120 per 60 s across both routes, over → `429`; a missing
binding → `503` in every built Worker, allowed only when `dev` (`vite dev`);
(6) active route: bad salt → `503`. The limiter helper takes its binding as
a parameter (S2 reuses it); unit tests inject a fake.

| Route                        | Request                                          | Server                                                                                                                                                                | Response                                                                                                |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `POST /api/analytics/active` | `{ v: 1, guestId }` (`guestIdSchema`)            | A `guest` row hashing `guestId`; a session (complete or not) adds an `account` row hashing `locals.user.id`. One batch of `INSERT OR IGNORE` for the server's UTC day | `200 { day, identity }`, `identity` being `guest`, `account:<username>`, or `account` (no username yet) |
| `POST /api/analytics/event`  | `{ v: 1, event }`, `event` in `clientEventNames` | `+1` upsert for the server's UTC day; sessionless in `hooks.server.ts`                                                                                                | `204`                                                                                                   |

### 3.5 Scheduled work

**Wrapper** ([§10.2](v2-contracts.md#102-web-worker-entry-wrapper), E3).
`web/scripts/wrap-worker.mjs` runs after `vite build` in the web `build`,
`deploy`, and `deploy:preview` scripts: it renames the adapter's `_worker.js`
to `_kit_worker.js`, writes a generated `_worker.js` exporting `fetch`
(unchanged), `scheduled`, and later milestones' `WorkerEntrypoint` classes,
and appends `_kit_worker.js` to `.assetsignore` after a newline, failing
unless both files are listed. Reruns are no-ops; `main` is unchanged; the e2e
build stays unwrapped because `vite preview` never runs its worker.

**Dispatcher.** `web/src/worker/scheduled.ts`, bundled by Wrangler (workspace
imports only, no `$lib`), holds `jobs: { name, testCron, due(time),
run(env, now) }[]`. A job runs when `due(scheduledTime)` holds or
`controller.cron` equals its `testCron` (only `wrangler dev --test-scheduled`
sends one), inside `ctx.waitUntil`, with errors in `job_state.last_error`;
idle minutes do no I/O. X1's entry: `x1.nightly`, due 00:15–00:19 UTC, test
cron `15 0 * * *`, running `runAnalyticsNightly(env.DB, now)` from
`@shaxda/db/analytics`. R1, H4, A3, S2, and R6 append theirs; §10.2's
internal SvelteKit request waits for a job that needs it.

**Lease** (`packages/db/src/jobs/lease.ts`). A run inserts its `job_state`
row if missing, takes a 5-minute lease with a compare-and-set `UPDATE` that
wins only when `meta.changes = 1`, and fences every write batch:

```sql
INSERT INTO job_fence (ok) VALUES (
  (SELECT lease_token = ?2 AND lease_expires_at > ?3 FROM job_state WHERE name = ?1));
-- … the job's writes, then UPDATE job_state SET cursor = ?4 … WHERE name = ?1;
DELETE FROM job_fence;
```

As in [§7.2](v2-contracts.md#72-the-fence), a false guard fails the `CHECK`
and a missing row or any `NULL` fails `NOT NULL`, stopping the whole batch;
aborts are classified by `job_fence_guard` or `job_fence.ok`, never by text.

### 3.6 Admin allowlist

`web/src/lib/server/admin.ts`: `isAdminUser(env, userId)` matches the
comma-separated `ADMIN_USER_IDS` secret exactly; `requireAdmin(locals, env,
url)` sends signed-out users to `/login?returnTo=<path>` (`303`), answers
`403` to anyone not listed, and returns the user otherwise. The id comes only
from the session; `+error.svelte` gains a `forbidden` variant. S1 and S2
reuse both helpers.

### 3.7 X1b counter write

`@shaxda/db/counters`, a raw-statement subpath without Drizzle or the auth
schema, exports `incrementCounter(db, name, day, now)`. It parses `name` with
`onlineCounterNameSchema`, so an unknown name throws before any SQL:

```sql
INSERT INTO event_daily (day, event, count, updated_at) VALUES (?1, ?2, 1, ?3)
ON CONFLICT (day, event) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at;
```

The game Worker's `recordOnlineCounter(env, ctx, name)` does nothing unless
`ANALYTICS_ENABLED` is `"true"` and `DB` is bound, runs the write in
`ctx.waitUntil` (never awaited on the game path), and logs any error as
`analyticsCounterFailed` with the name and error class only.

## 4. Behaviour and failure handling

### 4.1 Client beacons

`ActiveBeacon.svelte` (root layout) runs on mount and on becoming visible,
never in SSR. localStorage `shaxda:analytics-active:v1` maps each identity to
the UTC day last recorded, keeping only the newest day's entries (at most 8).

| Page                                                      | Identity checked     | Sends when                            |
| --------------------------------------------------------- | -------------------- | ------------------------------------- |
| SSR, complete account                                     | `account:<username>` | its day is not the client's UTC today |
| SSR, incomplete account                                   | `account`            | same                                  |
| SSR, signed out                                           | `guest`              | same                                  |
| `/local`, `/online` (prerendered; the session is unknown) | any                  | no entry has today's day              |

Nothing is sent offline (dropped, not queued; PRD §13) or after a failed try
on the same page load; the `keepalive` POST is never awaited on an interaction
path, and on `200` the client stores the returned `identity → day`. So guest then sign-in on one day gives one `guest` and one `account` row, a
second account on the browser only its own `account` row, and a later
signed-out visit or a skewed clock at most one no-op request per page load.

Local events: `LocalGameController` gets an injected `report(name)`; `apply()`
reports `local_started` after a fresh game's first action and
`local_completed` on `gameOver`, never again on resume. Sending is
fire-and-forget (`keepalive`, no retry, nothing offline); the engine is
unchanged.

### 4.2 Online counters (X1b)

| Name                             | Recorded, after any broadcast, in                                               | Once because                |
| -------------------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| `online_room_created_{kind}`     | `POST /rooms` after a successful init; `account` iff a verified `create` ticket | one per created room        |
| `online_room_joined_{kind}`      | `handleJoin` when the second seat is filled for the first time                  | reconnects fill no new seat |
| `online_started_{mode}_{kind}`   | `handleGameAction` on the action where play begins (P1)                         | once per match number       |
| `online_completed_{mode}_{kind}` | the terminal action or valid claim of a match whose play began                  | `gameOver` is terminal      |

`mode` comes from room state (`invite` until K1). A pre-play ending counts
neither; a rematch counts started and completed again, never created or
joined.

### 4.3 Nightly job

`runAnalyticsNightly(db, now)` in `packages/db/src/jobs/analyticsNightly.ts`
has cursor `{ day, ledgerSeq }`; N is the run's UTC date and Y = N − 1.

1. Take the lease; a loser exits.
2. For each day after `cursor.day` through Y, at most 35 (older gaps stay
   visible), write the activity gauges and `registrations` in one fenced
   batch per day. Each day is written once, so a later rename-back, which
   deletes the original claim row, cannot move a registration.
3. Ledger (after H1): L is the earliest `ended_at` day among matches with
   `seq > cursor.ledgerSeq`, else Y. Recompute `saved_*` for [L, Y], cohorts
   for d in [L − 30, Y], and weeks overlapping [L − 7, Y], writing numerators
   only when mature (d + 7 ≤ Y, d + 30 ≤ Y, week w + 1 ended). Late saves of
   any age therefore count the next night.
4. Prune `active_user_day` rows with `day < N − 90` in fenced chunks of 5,000
   (`(day, anon_id) IN (SELECT day, anon_id … LIMIT 5000)`) until a chunk is
   short.
5. Release while the token still matches, setting `last_success_at`.

Writes are replaces or bounded deletes, so duplicate or resumed runs change
nothing. The job ignores the kill switch: the prune is a promise.

### 4.4 `/admin/stats`

SSR, `requireAdmin`, `cache-control: no-store`, `noindex`, unlinked, in no
sitemap or PWA precache. It reads 35 days of `event_daily`, `job_state`,
today's `active_user_day` counts by kind, and `MIN(day)` per name.

| Block                      | Shows                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Freshness                  | last successful run, last complete day, a warning when yesterday is missing                          |
| Activity                   | browsers and accounts for 1, 7, 30 days, 30-day table, today so far; "not people; never add the two" |
| Registrations, local games | per day for 30 days; local completion over 7 and 30 days                                             |
| Online (X1b)               | P13 names by mode and kind; "not recorded yet" before X1b                                            |
| Saved games                | rated and friendly per day, once H1 is live                                                          |
| Weekly returning (primary) | last 8 weeks; the open week labelled immature; "judge only after two complete weeks" until two exist |
| D7 / D30                   | last 8 cohorts each; immature cohorts labelled, never shown as 0 %                                   |

Every percentage sits beside its raw counts (`n / d`) and every block shows
"recorded since"; plain tables, mobile first, no chart library. Should: when
yesterday is missing, start the nightly job in `platform.context.waitUntil`
(same lease) and note it; `GET /admin/stats.csv?from=&to=` (≤ 366 days, one
column per name, `requireAdmin`, `no-store`, attachment).

### 4.5 Failure handling

| Condition                                | Behaviour                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 error in a route                      | `503`; the client stores nothing and does not retry on that page load                                                                               |
| Scripted requests with a forged `Origin` | can inflate beacon and local counts within the rate limit; both are labelled approximate                                                            |
| Cron minute skipped                      | due each minute 00:15–00:19; otherwise the next night resumes from the cursor                                                                       |
| Overlapping or failed runs               | one lease wins and a stale holder's batch fails the fence; a failed run's lease expires after 5 min and the next due minute resumes from the cursor |
| X1b write fails, `DB` unbound            | `analyticsCounterFailed` logged and dropped; state, broadcasts, and H1's outbox are untouched                                                       |
| D1 slow during an X1b write              | the room stays awake until the call settles; use the kill switch; P13's revisit trigger applies                                                     |

## 5. Privacy and access

- A beacon stores `day`, `anon_id`, `kind`, nothing else. A signed-in
  beacon's `guest` and `account` rows share only the day: the table is
  `WITHOUT ROWID` and has no time column, so nothing stored links them. Analytics paths
  never store or log a raw guest or user id, IP address (the limiter only
  receives it as a key), user agent, URL, room code, session token, or
  request body. The username appears only in the browser's own marker and
  the response to its own request.
- Pseudonymous: an identity keeps its `anon_id` while the salt is unchanged,
  so its days link, and no copy says otherwise. Retention per P12; on deletion
  ([§8](v2-contracts.md#8-deletion)) rows age out, aggregates remain, and A3
  needs no X1 step.
- Access: `/admin/stats` and its CSV only through `requireAdmin`; the loader
  returns integers and dates, never a user id, username, room code, or match
  id ([§5](v2-contracts.md#5-access-matrix) loader rule). Friendly games
  enter only as daily counts; X1 implements no public row of §5. X1b writes
  `event_daily` only and no auth table. Web Analytics is unchanged.

## 6. Resource budget

Sizing assumption, not a forecast (Q3 is open): 1,500 identities, 500 local
games, 300 online games (100 saved account games), 10 admin loads per day.

| Item                       | Per day                                                  | Notes                                                      |
| -------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Beacons                    | ~1,500 rows written, ~4,500 read                         | one row per identity-day plus the session lookup           |
| Local events; X1b counters | ~1,000; ~1,200 upserts                                   | two per local game; about four per online game             |
| Nightly job                | ~80k rows read; ~150 upserts, ~1,500 deletes             | the 30-day activity window dominates                       |
| Admin page                 | ~3k rows read per load                                   | 35 days of `event_daily` plus today's rows                 |
| Storage                    | `active_user_day` ≈ 15 MB; `event_daily` ≈ 2 MB per year | 91 days × 1,500 rows × ~100 B                              |
| Requests; DO wake-ups      | +2,500 web, +1,440 scheduled invocations; no wake-ups    | idle minutes do no I/O; X1b writes inside running handlers |

All far inside Workers Free (100k requests; D1 5M rows read, 100k written,
500 MB per database). Revisit near 10k identities a day: move activity to
Analytics Engine.

## 7. Somali copy

Drafts behind `TODO(translation-review)`; "rated" and "friendly" reuse the
[glossary](README.md#somali-glossary-drafts-q4). `/legal` must say
pseudonymous (a stable code that links days). H1 edits the same `adeegyada`
bullet; the later merge keeps both facts.

| Key                                                  | Draft                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `legal` `cabbiraadda` heading                        | Tirakoobka isticmaalka                                                                                                                                                                                                                                                                                                                                                                                                  |
| `cabbiraadda` new paragraph 1                        | Shaxda waxay maalin kasta tirisaa inta biraawsar iyo akoon ee adeegga isticmaala. Maalintii hal mar, biraawsarkaagu wuxuu server-ka u diraa calaamad muujinaysa inuu firfircoon yahay.                                                                                                                                                                                                                                  |
| paragraph 2                                          | Server-ku wuxuu isticmaalaa aqoonsiga martida ee biraawsarka; haddii aad gashay akoonkaaga, wuxuu sidoo kale isticmaalaa aqoonsiga gudaha ee akoonka. Aqoon kasta wuxuu u beddelaa summad lagu sameeyey fure sir ah, kadibna wuxuu kaydiyaa summadda, taariikhda (UTC), iyo in ay tahay biraawsar ama akoon; labada summadood lama isku xiro. Aqoonsiga ceeriin, cinwaanka IP-ga, iyo magaca dadweynaha laguma kaydiyo. |
| paragraph 3                                          | Summaddu waa magac-beddel: ma muujiso magacaaga, laakiin maalin kasta way isku mid tahay, sidaas darteed maalmaha isticmaalka waa la isku xiri karaa. Safafka summadaha waxaa la tirtiraa 90 maalmood kadib; tirooyinka maalinlaha ah ee la isku geeyey waa la sii hayaa.                                                                                                                                               |
| paragraph 4                                          | Waxaa kale oo la tiriyaa ciyaaraha maxalliga ah ee la bilaabay iyo kuwa la dhammeeyey. Tirooyinkan maalinlaha ah aqoonsi ma xambaaraan, lamana diro marka qalabku khadka ka maqan yahay.                                                                                                                                                                                                                                |
| paragraph 5 (X1b)                                    | Server-ka ciyaarta khadka wuxuu tiriyaa qolalka la sameeyey ama la galay iyo ciyaaraha la bilaabay ama la dhammeeyey. Wuxuu kaydiyaa tirooyin maalinle ah oo keliya, aqoonsi, koodh qol, ama magac la'aan.                                                                                                                                                                                                              |
| `kaydka-qalabka` detail `shaxda:analytics-active:v1` | Taariikhda (UTC) ee biraawsarku ugu dambeysay u sheegay server-ka inuu firfircoon yahay, loo kala saaray marti iyo magaca dadweynaha akoon kasta. Taariikhaha maanta oo keliya ayaa lagu hayaa.                                                                                                                                                                                                                         |
| `xogta` new bullet                                   | Xogta tirakoobka: summad magac-beddel ah oo maalinle ah (90 maalmood) iyo tirooyin maalinle ah oo la isku geeyey.                                                                                                                                                                                                                                                                                                       |
| `adeegyada` D1 bullet (replaces "account data only") | Kaydka D1 wuxuu hayaa xogta akoonka, summadaha tirakoobka (90 maalmood), iyo tirooyin maalinle ah. Aqoonsiga martida ee ceeriin laguma hayo.                                                                                                                                                                                                                                                                            |
| `errorPage.forbidden`                                | Boggan waa xiran yahay / Akoonkaagu ma laha ogolaansho uu ku furo boggan.                                                                                                                                                                                                                                                                                                                                               |
| `adminStats` headings                                | Tirakoobka gudaha / Xisaabintii ugu dambeysay / Biraawsarro firfircoon / Akoonno firfircoon / Diiwaangelin cusub / Ciyaaraha maxalliga ah (qiyaas) / Ciyaaraha khadka / Ciyaaraha akoonka ee la kaydiyey / Ciyaartoyda soo laabatay toddobaadka xiga / Soo laabashada maalinta 7aad iyo 30aad                                                                                                                           |
| `adminStats` labels                                  | La bilaabay / La dhammeeyey / Heerka dhammaystirka / Tartan / Saaxiibtinimo / Weli ma dhammaystirna / Weli lama diiwaangelin. / La diiwaangeliyey laga bilaabo / Maanta ilaa hadda / Soo deji CSV                                                                                                                                                                                                                       |
| `adminStats` notes                                   | Tirooyinka shalay weli lama xisaabin. / Kuwani ma aha tirada dadka; labada lama isku darin. / Ha go'aamin ka hor laba toddobaad oo dhammaystiran.                                                                                                                                                                                                                                                                       |

## 8. Implementation slices

```txt
X1a (slice 9 waits for H1's migration on main)
1.  feat(shared): add analytics names, beacon schemas, and keyed hashing
2.  feat(db): add analytics tables, the job lease, and the claim-day index
3.  feat(db): add analytics record, increment, gauge, and prune queries
4.  feat(web): record daily activity per identity (route, limiter, beacon)
5.  feat(web): count local game starts and completions (route and hook)
6.  build(web): wrap the adapter worker and dispatch the minute cron
7.  feat(db): add the nightly activity, registration, and 90-day prune job
8.  feat(web): add the admin allowlist, forbidden copy, and /admin/stats
9.  feat(db): add ledger gauges and show them on /admin/stats
10. feat(i18n): describe pseudonymous usage counting on /legal
11. feat(web): add catch-up-on-read and CSV export to /admin/stats  (Should)
12. docs(ops): add the X1a runbook (secrets, migration, cron, manual prune)

X1b
1.  docs: allow game-Worker analytics counters (brief §6.1, AGENTS.md, PRD)
2.  feat(shared): add the P13 online counter allowlist
3.  feat(db): add the counter increment subpath for the game Worker
4.  feat(worker): count room creation, joins, game starts, and completions
5.  feat(web): show the online funnel on /admin/stats
6.  feat(i18n): describe online daily totals on /legal
7.  docs(ops): add X1b rollout and kill-switch steps
```

## 9. Acceptance tests

| Layer                                               | Cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared (Vitest)                                     | `analyticsHash` is 43-character base64url, stable for the same salt and input, different for another salt or domain, and throws on a short salt. Schemas reject a wrong `v`, a bad guest id, extra keys, and gauge or P13 names on the event route. X1b: `onlineCounterNameSchema` rejects unknown names and matches the §9 list.                                                                                                                                                                                                                                    |
| D1 schema and lease (Workers pool, real migrations) | Migration applies after existing ones; `CHECK`s reject bad day, kind, `anon_id` length, negative count; each read plan uses its index. A false guard, a missing `job_state` row, and a `NULL` token each stop the whole batch (E1's cases); of two acquirers one wins; a stale holder writes nothing.                                                                                                                                                                                                                                                                |
| D1 beacon and counters                              | Same identity twice → one row; a signed-in beacon → one `guest` and one `account` row, and a signed-out one later that day → none; a second account on one browser → only its `account` row; no analytics column contains a raw guest id or user id; 50 concurrent increments → 50.                                                                                                                                                                                                                                                                                  |
| D1 nightly job                                      | 30 identities over 100 days match hand counts per kind; a second run or a cursor reset changes no count; a missed night is caught up (35-day cap); the prune on day N keeps N − 90, deletes N − 91, and runs with the kill switch off; a first claim counts one registration on its day, a rename counts none, and a later rename-back leaves the stored gauge unchanged.                                                                                                                                                                                            |
| D1 ledger (after H1)                                | The sample matches over six weeks give hand-computed `saved_*`, `week_*`, and cohort gauges; immature cohorts and the open week have no numerator; a late save (higher `seq`, older `ended_at`) counts on the next run.                                                                                                                                                                                                                                                                                                                                              |
| Web routes and config                               | Every §3.4 guard, including a missing `Origin` and a missing limiter in a non-dev build (`503`); guest, account, and incomplete identities; bound values never hold a raw id; `no-store`. `wrangler.jsonc` and `wrangler.preview.jsonc` declare `ANALYTICS_RATE_LIMIT`, set `ANALYTICS_ENABLED`, and declare only the `* * * * *` cron. The event route accepts client names only and skips `getSession`.                                                                                                                                                            |
| Web client                                          | Each row of the §4.1 table; offline; one try per page load; a `500` stores nothing; visible after UTC midnight sends. Local controller: started once, not on resume; completed once; a new game fires again.                                                                                                                                                                                                                                                                                                                                                         |
| Web admin and build                                 | Signed out → `303`; not listed → `403` with forbidden copy; listed → `200`, `no-store`, `noindex`; immature cohorts labelled; raw counts beside every percentage. Wrap script on a fixture output: rename, generated exports, `_redirects` and `_kit_worker.js` on separate `.assetsignore` lines, second run unchanged. Dispatcher: due only 00:15–00:19 UTC or on its test cron; errors recorded. Runbook smoke: after a build, `wrangler dev --test-scheduled` with `cron=15+0+*+*+*` sets `last_success_at`, and `/_worker.js` and `/_kit_worker.js` return 404. |
| Game Worker (X1b, Miniflare)                        | Creation counts `created_guest` or `created_account`; the second seat counts `joined` once, not on reconnect; the first placement counts `started`; win, resignation, or claim counts `completed` once; a pre-play resignation counts neither; a rematch counts both again. With `DB.prepare` throwing, state, broadcasts, and H1's outbox equal a run without X1b, one `analyticsCounterFailed` is logged, nothing retries. Kill switch off → no rows. `pnpm check:hibernation` passes.                                                                             |
| E2E (existing harness)                              | `/` sends one active beacon and a reload none; finishing a local game sends one `local_completed`; `/admin/stats` is `403` for the signed-in fixture.                                                                                                                                                                                                                                                                                                                                                                                                                |

**Sample matches** ([§4.3](v2-contracts.md#43-canonical-sample-matches);
mode `invite` throughout, since quick needs K1):

| ID  | X1b counters                                                            | Ledger gauges                                                                    |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| M1  | `started`, `completed` with `invite_account`                            | `saved_friendly` +1 on its `ended_at` day; both players in week and cohort reads |
| M2  | `started` at the first placement, `completed`                           | `saved_rated` +1                                                                 |
| M3  | `started`, then `completed` by the claim                                | `saved_rated` +1                                                                 |
| M4  | `started`, `completed`                                                  | `saved_rated` +1; the cap skip does not change `rated`                           |
| M5  | `started`, `completed`                                                  | `saved_rated` +1                                                                 |
| M6  | `started`, `completed` with the `guest` suffix                          | nothing (no row)                                                                 |
| M7  | `created` and `joined` only                                             | nothing                                                                          |
| M8  | `started`, `completed`                                                  | `saved_rated` +1, unchanged after invalidation                                   |
| M9  | the rematch counts `started`, `completed`; no new `created` or `joined` | `saved_friendly` +1                                                              |
| M10 | —                                                                       | M2 still counted; B's `active_user_day` rows age out (P12)                       |

## 10. Rollout and rollback

| Item                                    | dev                                                    | e2e                                                                                   | preview                                    | production               |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| `ANALYTICS_SALT`                        | `.dev.vars.example` placeholder                        | committed test value in `wrangler.e2e.jsonc`, listed in `check-production-bundle.mjs` | secret                                     | secret                   |
| `ADMIN_USER_IDS`                        | empty                                                  | empty                                                                                 | secret                                     | secret                   |
| `ANALYTICS_RATE_LIMIT`                  | from `wrangler.jsonc`; open under `vite dev` if absent | declared (local simulation)                                                           | `ratelimits`, 120/60 s, own `namespace_id` | same, own `namespace_id` |
| `ANALYTICS_ENABLED` (web; game for X1b) | `"true"`                                               | `"true"`                                                                              | `"true"`                                   | `"true"`                 |
| Cron `* * * * *`                        | `--test-scheduled` only                                | none                                                                                  | `triggers.crons`                           | `triggers.crons`         |

**Order** ([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)):
X1a is migration → web; X1b is game only, after X1a's migration. Secrets and
migrations follow [`v11a-accounts-runbook.md`](../ops/v11a-accounts-runbook.md).
Production waits for preview checks: rows per identity, a cron run advancing
`last_success_at`, both worker files 404, `/admin/stats` `403`/`200`, and a
prune that removes only rows past 90 days.

**Kill switch and rollback.** `ANALYTICS_ENABLED` per Worker, changed by a
config deploy, stops beacon, event, and counter writes; the nightly job keeps
computing and pruning, and local and guest play never depend on X1. To remove
X1a code, redeploy the previous web build and drop the cron trigger in the
same deploy; the additive tables stay. While the cron is off, run the
runbook's manual prune daily so no pseudonymous row outlives 90 days. X1b
rolls back by redeploying the previous game Worker.

**Done when.** X1a: `pnpm check` and the preview checks pass; production
shows fresh gauges for 7 consecutive days and the founder can quote 30-day
active browsers and accounts with their definitions; no `active_user_day` row
is older than 90 days; `/legal` is live; ledger gauges appear once H1 saves
games in production. X1b: online counters for 7 production days, each day's
`online_completed_*_account` equal to its saved games except pending or
stalled saves and logged counter failures, and a kill-switch rehearsal on
preview. The README says `shipped@<date>` only in the shipping commit, citing
the ops record of what production verified.
