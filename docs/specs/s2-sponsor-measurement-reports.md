# S2 — Sponsor Measurement and Reports (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                                          |
| Wave       | Pilot: S2-min, in the same release as S1. L: S2 token links                                                                                                                                                                                                                                                                                                                                                                                             |
| Depends on | S1 (same release as S2-min), X1 (X1a suffices)                                                                                                                                                                                                                                                                                                                                                                                                          |
| Register   | F3, P12, P14 ([register](README.md#decision-register))                                                                                                                                                                                                                                                                                                                                                                                                  |
| Contracts  | Owns §3 below (sponsor measurement). Consumes [§5](v2-contracts.md#5-access-matrix) (principles; no row applies), [§8](v2-contracts.md#8-deletion), [§10.1](v2-contracts.md#101-one-cron-one-dispatcher), [§10.2](v2-contracts.md#102-web-worker-entry-wrapper), [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone) (S1 + S2 row), [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e), [§11](v2-contracts.md#11-migration-ownership) |
| Brief      | `docs/shaxda-v2.md` §6.3, §12 (S2); BRD [§5](../shaxda_brd.md#5-fulfilment-workflow), [§6](../shaxda_brd.md#6-make-goods), [§10](../shaxda_brd.md#10-truthful-claims)                                                                                                                                                                                                                                                                                   |
| Touches    | `packages/shared`, `packages/db`, `packages/i18n`, `web/` (sponsor routes, `SponsorSlot`, admin report, nightly job, `hooks.server.ts`, `static/robots.txt`), `docs/ops/`                                                                                                                                                                                                                                                                               |

S2 turns [S1](s1-sponsor-placements.md)'s placements into numbers a sponsor
can check: qualified views observed in the browser and gated in D1, clicks
counted by a first-party redirect, a nightly rollup, and a per-booking report
with definitions, a cutoff, raw counts, and every known gap. **S2-min** ships
in S1's release, and S1 cannot confirm a booking while S2-min reports it
unhealthy. **S2 token links** follow in wave L. S1 owns slots, bookings,
creatives, caching, and the `SponsorSlot` card; [X1](x1-product-analytics.md)
owns the salt, the admin allowlist, and the cron dispatcher;
[S3](s3-sponsor-page.md) owns public numbers and prices; the BRD owns pricing,
make-goods, and claims.

## 1. Outcome and non-goals

### Outcome

For every pilot booking the founder can print or export a report that states,
per UTC day and in total, the qualified views and clicks Shaxda measured, how
many distinct browsers saw the creative, what those words mean, where the data
stops, and when measurement or display failed. No third-party code, cookie,
or stored personal identifier is involved.

### Must (S2-min)

1. Qualified views (§3.1) observed in S1's `SponsorSlot` and sent to
   `POST /api/sponsor/event` (§3.3), keyed by a booking-scoped pseudonymous
   browser key (§3.2) and gated atomically in D1 (§3.5).
2. `GET /go/<bookingId>` (§3.4) counts clicks without JavaScript. A failed
   lookup shows a Somali unavailable page; a failed counter still redirects
   and records a gap.
3. The nightly job (§3.6) rolls up closed days, freezes booking-wide reach,
   and deletes pseudonymous rows (P12).
4. The admin report, print view, and CSV (§3.7) with definitions, cutoff, raw
   counts, and gaps, plus manual gap notes for failures S2 cannot record.
5. The reporting-health check (§3.8) that S1's confirm action requires.
6. Somali copy (§7), including the `/legal` text, before the first live
   booking.

### Should (wave L)

- S2 token links (§3.9): a read-only, revocable, unguessable link to one
  booking's report, built only when a sponsor needs to check numbers without
  the founder. The printed page or CSV covers the pilot.

### Not in S2

Sponsor accounts or login; live dashboards; third-party measurement, scripts,
pixels, or cookies; targeting; any count of people or accounts; attention,
viewability certification, or occlusion tracking; game actions or the match
ledger; public numbers (S3b); PDF export. `home` and `learn` are later
inventory (BRD §8 gates); when S1 adds them, this contract measures them with
no change beyond S1's slot enum.

## 2. Decisions and dependencies

| ID  | How S2 applies it                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F3  | Sponsorship is a measured pilot: S1 cannot confirm a booking while the health check fails (§3.8), and every report carries its definitions and gaps.                                                                                                                                      |
| P12 | Pseudonymous rows (`sponsor_viewer`, `sponsor_viewer_day`) are deleted once the booking's reach is frozen and are never older than 90 days. Aggregates, final reach, and gaps are kept indefinitely.                                                                                      |
| P14 | Measured slots are `lobby` and `result` (local result included when the device is online). Bookings of 7, 14, or 30 days starting on a whole UTC hour touch at most 31 UTC days. The ≤ 60 s edge cache lets a client show a just-ended booking, so the server checks liveness at receipt. |

Q2 and Q5 block S1 and the first sale, not this contract; Q4 reviews the
Somali drafts in §7 before release.

| Dependency    | Provides                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1            | `sponsor_booking` (`state`, `slot`, half-open `[starts_at, ends_at)`, `cancelled_at`, current `creative_id`) and the live predicate its query module exports; `sponsor_creative` (`cta_url`, `cta_host`, `display_name`) and `sponsorCtaUrlSchema`; `SponsorSlot`, whose card links to `/go/<bookingId>` in a new window with preloading off; `/admin/sponsors/bookings/<bookingId>`; the confirm action; the booking id format (v2-contracts §2.3); `SPONSOR_RATE_LIMIT` and `SPONSORS_ENABLED`; the session-free route set in `hooks.server.ts`. |
| X1 (X1a)      | `analyticsHash` and `ANALYTICS_SALT` (fails closed when missing or short); `ADMIN_USER_IDS` and `requireAdmin`; the limiter helper, whose missing binding answers `503` in every built Worker and is allowed only under `vite dev`; the entry wrapper and dispatcher (`jobs` entries with `due` and `testCron`), the lease, `job_state` (`last_success_at`, `last_error`), and `job_fence` ([§10.1](v2-contracts.md#101-one-cron-one-dispatcher), [§10.2](v2-contracts.md#102-web-worker-entry-wrapper)).                                          |
| Existing code | `getOrCreateGuestId` (`web/src/lib/online/guestIdentity.ts`, key `shaxda:guest-id:v1`) returns a fresh random id when storage fails, so S2 adds a variant that returns `null`: no persisted id, no beacon. `guestIdSchema` allows 8–128 characters.                                                                                                                                                                                                                                                                                                |

## 3. Contracts

S2 owns everything in this section and never writes S1's tables. Its
migration runs after S1's and gets its number at merge
([§11](v2-contracts.md#11-migration-ownership)). Constants in
`packages/shared`: `VISIBLE_RATIO = 0.5`, `VISIBLE_MS = 1000`,
`VIEW_GATE_MS = 1800000`.

### 3.1 Metrics

| Metric                             | Definition                                                                                                                                                                                                                                                                                                                                                      | Shown as                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Qualified view                     | The creative container is at least 50 % inside the viewport for a continuous 1,000 ms while the document is visible, and the server accepts the report while the booking is live. At most one per browser, booking, and slot per rolling 30 minutes, measured from the last accepted view; the gate crosses UTC midnight. Server receipt time sets the UTC day. | "qualified views (≥ 50 % visible for 1 s, at most one per browser per 30 min)" |
| Estimated unique browsers, day     | Distinct browser keys with a qualified view on that UTC day.                                                                                                                                                                                                                                                                                                    | per day                                                                        |
| Estimated unique browsers, booking | Distinct browser keys with a qualified view in the booking up to the cutoff, frozen at finalization. Never a sum of daily values.                                                                                                                                                                                                                               | total; "provisional" until frozen                                              |
| Click                              | One `GET /go/<bookingId>` navigation the server counts before redirecting, while the booking is live. Repeats count again; no JavaScript or earlier view is needed.                                                                                                                                                                                             | raw clicks                                                                     |
| CTR                                | Clicks ÷ qualified views × 100 over the same days.                                                                                                                                                                                                                                                                                                              | one decimal, rounded down; `—` at zero views; may exceed 100 %                 |

A booking has one slot, so the gate is keyed by booking and browser. Views
are never labelled attention, impressions, or guaranteed, and reach is never
people, players, or accounts (BRD §10). Every report prints what moves the
numbers. Undercount: blockers, disabled JavaScript or storage, private windows
that refuse storage, offline devices, failed requests, recorded gaps.
Overcount: cleared storage, one person with several browsers, scripted
requests or link-preview fetchers that pass the limiter. IntersectionObserver
measures geometry, not eyes: a covered creative can still qualify.

### 3.2 Browser key

`viewer_key = base64url(HMAC-SHA-256(ANALYTICS_SALT, "sponsor:" + bookingId + ":" + guestId))`,
43 characters, computed in the web Worker as X1's
`analyticsHash(ANALYTICS_SALT, "sponsor", bookingId + ":" + guestId)`. The
booking in the message makes keys unjoinable across bookings and with X1's
anon ids. The raw guest id lives only inside the request and is never
stored, logged, or echoed. Rotating the salt during a live booking resets the
gate and splits reach: record a `measurementGap` on each affected booking.

### 3.3 `POST /api/sponsor/event`

Body `sponsorViewEventSchema` (Zod, `.strict()`, `packages/shared`):
`{ v: 1, bookingId, slot, guestId }` with S1's id and slot schemas and
`guestIdSchema`. No event-type field: the route counts qualified views only.
Guards run in order; the first failure answers.

| #   | Check                                                                               | On failure                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `platform.env` present; `SPONSORS_ENABLED` is `"true"`                              | `503`; `204` with nothing written. No D1 access                                                                                               |
| 2   | `Origin` present and equal to `canonicalAuthOrigin(AUTH_BASE_URL)`                  | `403`                                                                                                                                         |
| 3   | `Content-Type` starts with `application/json`                                       | `415`                                                                                                                                         |
| 4   | `Content-Length` and body ≤ 1,024 bytes; valid JSON and schema                      | `413`; `400`                                                                                                                                  |
| 5   | `SPONSOR_RATE_LIMIT` through X1's limiter helper, key `event:` + `cf-connecting-ip` | `429`. A missing binding answers `503` with no D1 access in every built Worker and is allowed only under `vite dev`; unit tests inject a fake |
| 6   | S1's live predicate: `state = 'confirmed'` and `starts_at ≤ now < ends_at`          | `404`; D1 error `503`                                                                                                                         |
| 7   | Body `slot` equals the booking's slot                                               | `400`                                                                                                                                         |
| 8   | `ANALYTICS_SALT` valid (X1: at least 32 characters)                                 | `503` and a `viewsNotCounted` gap                                                                                                             |
| 9   | Gate batch (§3.5)                                                                   | D1 error: `503`, a best-effort `viewsNotCounted` gap, log                                                                                     |

Success is `204` whether the gate accepted or suppressed the view, so no
response says whether this browser was seen before. Responses are
`Cache-Control: no-store`; the route is session-free and sets no cookie.
`now` is read once; its UTC date is the view's day.

### 3.4 `GET /go/<bookingId>`

`web/src/routes/go/[bookingId]/+server.ts` exports `GET` and `HEAD`, because
SvelteKit otherwise runs `GET` for `HEAD`. It is session-free. The
destination never comes from the path, query, or body. Every response has
`Cache-Control: no-store` and `X-Robots-Tag: noindex`; `static/robots.txt`
gains `Disallow: /go/`.

| #   | Step                                                                                  | Outcome                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `HEAD`                                                                                | `405`, `Allow: GET`; nothing read or counted                                                                                                                             |
| 2   | `Sec-Purpose` or `Purpose` contains `prefetch`                                        | empty `503`, not counted, so the real navigation reaches the server                                                                                                      |
| 3   | `platform.env` missing; `SPONSORS_ENABLED` off; malformed id                          | unavailable page `503`; `404`; `404`. No D1 access                                                                                                                       |
| 4   | One indexed read: the booking and its current `sponsor_creative`; S1's live predicate | D1 error: unavailable page `503`. Unknown or not live: `404`. Without a lookup there is no authority to redirect                                                         |
| 5   | `cta_url` passes `sponsorCtaUrlSchema` for `cta_host` again                           | unavailable page `404`, log `sponsorDestinationRejected`                                                                                                                 |
| 6   | `SPONSOR_RATE_LIMIT` through X1's helper, key `go:` + IP                              | Over the limit: redirect uncounted. Missing binding: counted only under `vite dev`; a built Worker redirects uncounted, logs `sponsorLimiterMissing`, and writes nothing |
| 7   | Click upsert (§3.5), awaited                                                          | Failure: redirect anyway, best-effort `clicksNotCounted` gap, log `sponsorClickNotCounted`                                                                               |
| 8   | Redirect                                                                              | `302`, `Location` = `cta_url`, `Referrer-Policy: no-referrer`                                                                                                            |

The unavailable page is server-built Somali HTML from `packages/i18n`: no
client script, no sponsor name, one link home. No page links to a sponsor
directly; S1's card is the only CTA. The service worker never answers these
paths: its navigation fallback allowlist is `/local` only
(`web/vite.config.ts`), and neither path is precached.

### 3.5 Tables and statements

```sql
-- Pseudonymous (P12). Every day column is UTC 'YYYY-MM-DD':
--   CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]').
CREATE TABLE sponsor_viewer (                        -- gate and booking-wide reach
  booking_id    TEXT    NOT NULL REFERENCES sponsor_booking(id),
  viewer_key    TEXT    NOT NULL CHECK (length(viewer_key) = 43),
  first_view_at INTEGER NOT NULL,
  last_view_at  INTEGER NOT NULL CHECK (last_view_at >= first_view_at),  -- last ACCEPTED view, ms
  last_view_id  TEXT    NOT NULL,                    -- random per request: which request won
  PRIMARY KEY (booking_id, viewer_key));
CREATE TABLE sponsor_viewer_day (                    -- daily views and daily reach
  booking_id TEXT    NOT NULL REFERENCES sponsor_booking(id),
  day        TEXT    NOT NULL,
  viewer_key TEXT    NOT NULL CHECK (length(viewer_key) = 43),
  views      INTEGER NOT NULL CHECK (views BETWEEN 1 AND 48),   -- the gate allows ≤ 48 a day
  PRIMARY KEY (booking_id, day, viewer_key));
-- Kept indefinitely; no identifiers.
CREATE TABLE sponsor_stat_daily (
  booking_id      TEXT    NOT NULL REFERENCES sponsor_booking(id),
  day             TEXT    NOT NULL,
  qualified_views INTEGER CHECK (qualified_views >= 0),                 -- NULL until rolled up
  unique_browsers INTEGER CHECK (unique_browsers BETWEEN 0 AND qualified_views),
  clicks          INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  rolled_up_at    INTEGER,
  PRIMARY KEY (booking_id, day),
  CHECK ((rolled_up_at IS NULL) = (qualified_views IS NULL)),
  CHECK ((qualified_views IS NULL) = (unique_browsers IS NULL)));
CREATE TABLE sponsor_report_final (
  booking_id      TEXT    PRIMARY KEY REFERENCES sponsor_booking(id),
  unique_browsers INTEGER CHECK (unique_browsers >= 0),   -- NULL: pruned before freezing
  last_day        TEXT    NOT NULL,
  finalized_at    INTEGER NOT NULL);
CREATE TABLE sponsor_gap (
  id          INTEGER PRIMARY KEY,
  booking_id  TEXT    NOT NULL REFERENCES sponsor_booking(id),
  kind        TEXT    NOT NULL CHECK (kind IN ('viewsNotCounted','clicksNotCounted',  -- automatic
                                               'measurementGap','displayOutage')),   -- manual
  day         TEXT    NOT NULL,                      -- UTC day of first_at
  first_at    INTEGER NOT NULL,
  last_at     INTEGER NOT NULL CHECK (last_at >= first_at),
  events      INTEGER CHECK (events >= 1),           -- automatic rows only
  note        TEXT    CHECK (length(note) BETWEEN 1 AND 500),
  recorded_by TEXT,                                  -- admin user id; manual rows only
  CHECK ((kind IN ('measurementGap','displayOutage')) = (events IS NULL)),
  CHECK ((kind IN ('measurementGap','displayOutage'))
         = (note IS NOT NULL AND recorded_by IS NOT NULL)));
CREATE UNIQUE INDEX sponsor_gap_auto_idx ON sponsor_gap (booking_id, day, kind)
  WHERE kind IN ('viewsNotCounted','clicksNotCounted');
CREATE INDEX sponsor_gap_booking_idx ON sponsor_gap (booking_id, first_at);

-- Gate: one D1 batch per beacon. ?1 booking, ?2 viewer_key, ?3 now,
-- ?4 random request id, ?5 UTC day of ?3.
INSERT INTO sponsor_viewer (booking_id, viewer_key, first_view_at, last_view_at, last_view_id)
VALUES (?1, ?2, ?3, ?3, ?4)
ON CONFLICT (booking_id, viewer_key) DO UPDATE
  SET last_view_at = excluded.last_view_at, last_view_id = excluded.last_view_id
  WHERE excluded.last_view_at >= sponsor_viewer.last_view_at + 1800000;
INSERT INTO sponsor_viewer_day (booking_id, day, viewer_key, views)
SELECT ?1, ?5, ?2, 1 FROM sponsor_viewer
 WHERE booking_id = ?1 AND viewer_key = ?2 AND last_view_id = ?4
ON CONFLICT (booking_id, day, viewer_key) DO UPDATE SET views = views + 1;
-- Click, awaited before the redirect.
INSERT INTO sponsor_stat_daily (booking_id, day, clicks) VALUES (?1, ?2, 1)
ON CONFLICT (booking_id, day) DO UPDATE SET clicks = clicks + 1;
-- Rollup of one closed day: replaces views and browsers, never touches clicks.
INSERT INTO sponsor_stat_daily (booking_id, day, qualified_views, unique_browsers, rolled_up_at)
SELECT ?1, ?2, coalesce(sum(views), 0), count(*), ?3
  FROM sponsor_viewer_day WHERE booking_id = ?1 AND day = ?2
ON CONFLICT (booking_id, day) DO UPDATE SET qualified_views = excluded.qualified_views,
  unique_browsers = excluded.unique_browsers, rolled_up_at = excluded.rolled_up_at;
```

- D1 runs a batch as one transaction, one at a time, so concurrent beacons for
  one key yield one accepted view: the second statement counts only the
  request whose id the first stored. A suppressed view writes nothing.
- An automatic gap upserts on `sponsor_gap_auto_idx` (`events + 1`, latest
  `last_at`). Finalization inserts `count(*)` of the booking's
  `sponsor_viewer` rows with `ON CONFLICT DO NOTHING`, then deletes the
  booking's rows from both pseudonymous tables in fenced chunks of 5,000
  (`rowid IN (SELECT … LIMIT 5000)`), as X1's prune does.
- Every statement starts from `booking_id` on a primary key or listed index;
  the migration test records `EXPLAIN QUERY PLAN` for each.

### 3.6 Nightly job

The dispatcher entry `s2.nightly` is due 00:15–00:19 UTC (test cron
`15 0 * * *`) and runs under X1's lease: a `job_state` row of that name, the
`job_fence` guard on every write batch
([§10.1](v2-contracts.md#101-one-cron-one-dispatcher)), `last_success_at` on
release, and `last_error` on failure. It ignores the kill switch. `D` is
yesterday (UTC). A booking's measured interval is
`[starts_at, min(ends_at, cancelled_at))` for a confirmed or cancelled
booking, and its booked days are the UTC days it touches; an empty interval
means never live, and the job skips it.

1. **Roll up** every booked day ≤ `D` of each unfinalized booking whose stat
   row is missing or not rolled up. Zero-view days get zeros.
2. **Finalize** a booking once its last booked day ≤ `D` and every booked day
   is rolled up: freeze reach, then delete its pseudonymous rows.
3. **P12 backstop.** A booking that started more than 89 days before the run
   and still has pseudonymous rows first gets a final row with
   `unique_browsers = NULL` if it has none, then loses its rows. With a run
   each night, no row reaches 90 days.
4. Every step is idempotent. A failure logs `sponsorJobFailed` (step, booking
   id); a retry inside the window or the next night catches up, and a missed
   night fails the health check (§3.8). A finalized booking is never
   recomputed; a later correction is a gap note plus a message to the sponsor
   (BRD §10).

### 3.7 Report and CSV

`/admin/sponsors/bookings/[bookingId]/report` (HTML, print stylesheet, form
action `recordGap`) and `/admin/sponsors/bookings/[bookingId]/report.csv`
share one loader that builds one `SponsorReport`, so their numbers cannot
differ.

| Part    | Rule                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Booking | Reference (booking id), the current version's display name, slot, UTC period, measured end, and S1's state (`draft`, `upcoming`, `live`, `ended`, `cancelled`).                                                                                                                 |
| Cutoff  | `min(yesterday UTC, last booked day)`; nothing later is shown. A draft, an upcoming booking, a booking cancelled before its start ("never live"), or one with no closed day shows its state and no table: an empty report, never an error and never a zero-performing campaign. |
| Days    | Every booked day up to the cutoff. A missing or not-rolled-up row shows "not available", never 0; a zero shows 0.                                                                                                                                                               |
| Totals  | Sums over available days, marked incomplete when any day is unavailable; CTR from the §3.1 helper.                                                                                                                                                                              |
| Reach   | `final` from `sponsor_report_final`; `provisional` counts `sponsor_viewer` rows with `first_view_at` before the end of the cutoff day; `unavailable` when the backstop froze `NULL`.                                                                                            |
| Gaps    | Every `sponsor_gap` row. `displayOutage` is lost display time (BRD §6); the other kinds mean counts are incomplete.                                                                                                                                                             |
| Always  | Definitions, limits (§7), and the generation time.                                                                                                                                                                                                                              |

The print stylesheet hides navigation, admin controls, and the gap form. The
CSV is UTF-8 with a BOM and CRLF, `text/csv; charset=utf-8`, attachment
`shaxda-sponsor-<bookingId>-<cutoff>.csv`, and
`Cache-Control: private, no-store`. Its sections, separated by blank lines
and labelled from `packages/i18n`, are: title, format version `v1`, and
booking fields; definitions and limits; one row per day (day, views,
browsers, clicks, CTR, note) and a total row with reach and its state; gaps
(kind, from, to, events, note). Cells use RFC 4180 quoting; a text cell
starting with `=`, `+`, `-`, `@`, tab, or CR gets a leading `'`; numeric
cells are digits or empty.

The gap form records `measurementGap` or `displayOutage`, a UTC window, and a
note of at most 500 characters. Rows are append-only; the actor comes from the
session.

### 3.8 Reporting health for S1

`sponsorReportingHealth(env, db, bookingId)` returns each check's result and
`ok` when all pass: (a) the booking's report loads, empty for a draft or
upcoming booking; (b) the `s2.nightly` row's `last_success_at` is within the
last 26 hours; (c) `ANALYTICS_SALT` is valid; (d) `SPONSOR_RATE_LIMIT` is
bound, or the Worker runs under `vite dev`. S1's booking page shows the
results, and its confirm action refuses unless `ok` (S1 §3.6). It runs only
in admin, never on a public path. After confirmation a failure never stops
display; it becomes a gap.

### 3.9 Token links (wave L)

A separate migration adds `sponsor_report_link`: `token_hash` (primary key,
SHA-256 hex), `booking_id` (references `sponsor_booking`, indexed),
`created_at`, `created_by` (admin user id), and `revoked_at`. The admin
creates a link from the report; the token is 32 random bytes in base64url,
shown once, and only its hash is stored. `/sponsor-report/[token]` checks the
format, looks up the hash, and renders the same `SponsorReport`, print view,
and CSV without admin controls or the gap form. Unknown and revoked tokens
get the same `404`. Headers: `private, no-store`, `noindex`,
`Referrer-Policy: no-referrer`; limiter key `report:` + IP; session-free.
Tokens appear in Shaxda's own request logs, so log access counts as admin
access.

## 4. Behaviour and failure handling

### Browser (`SponsorSlot`)

- Observe the creative container, not the reserved space, with an
  IntersectionObserver (default root, thresholds `[0, 0.5]`) and
  `visibilitychange`. Start a 1,000 ms timer when `intersectionRatio ≥ 0.5`
  and the document is visible; clear it when either stops holding, the
  booking changes, or the card unmounts (S1 removes it after `endsAt`). If
  both still hold when it fires, send.
- One beacon per mount per booking and slot. The `result` overlay mounts once
  per game over, so a later game may send again; the server gate decides.
- The beacon is a `fetch` POST with `keepalive: true` and
  `credentials: "omit"`. Nothing awaits it and its errors are swallowed; no
  move, capture, prompt, rematch, or navigation waits for it. No persisted
  guest id means no beacon.
- The card renders only when S1 renders it; S1's placement safety (pending
  capture, blocked prompt, empty slot, focus) is unchanged.

### Server

| Situation                           | Beacon                        | Click                                | Report                                                      |
| ----------------------------------- | ----------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Live booking, healthy               | `204`, accepted or suppressed | counted, `302`                       | counts                                                      |
| Upcoming, ended, cancelled, unknown | `404`, nothing written        | unavailable page `404`               | —                                                           |
| `SPONSORS_ENABLED` off              | `204`, nothing written, no D1 | unavailable page `404`, no D1        | `displayOutage` note if a booking was live                  |
| D1 read fails                       | `503`, log                    | unavailable page `503`               | manual `measurementGap` from logs                           |
| D1 write fails after the lookup     | `503`, `viewsNotCounted` gap  | `302` anyway, `clicksNotCounted` gap | gap row                                                     |
| `ANALYTICS_SALT` missing            | `503`, `viewsNotCounted` gap  | unaffected                           | gap row                                                     |
| Over the rate limit                 | `429`                         | `302`, not counted                   | nothing: flood control                                      |
| Limiter missing in a built Worker   | `503`, no D1, log             | `302`, not counted, no D1 write, log | manual `measurementGap`                                     |
| Nightly job fails                   | —                             | —                                    | days "not available"; reach stays provisional; health fails |

Gap rows are best effort: when D1 itself fails they may not be written, and
the log line is the record. Before sending a report (BRD §5 step 9), the
founder reviews the S2 log lines for the period and records every window
without a row as a manual gap. Log lines carry an event name and a booking id
only.

## 5. Privacy and access

No [§5](v2-contracts.md#5-access-matrix) row applies: S2 reads no match,
profile, or account data. It keeps §5's rules: server-side checks, `no-store`
for anything private, `noindex` everywhere.

| Surface                                                  | Who                          | Checks                                                                                                                              |
| -------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/sponsor/event`                                | any same-origin browser      | §3.3; session-free                                                                                                                  |
| `GET /go/<bookingId>`                                    | anyone                       | §3.4; session-free; disallowed in `robots.txt`                                                                                      |
| `/admin/sponsors/bookings/<id>/report`, `.csv`, gap form | `ADMIN_USER_IDS`             | `requireAdmin` on every request (signed out → login, others → `403`); `private, no-store`, `noindex`; never in a public layout load |
| `/sponsor-report/<token>` (wave L)                       | holder of an unrevoked token | §3.9                                                                                                                                |

- **Stored:** booking-scoped keys, view times, per-day counts, aggregates,
  gaps, and admin actor ids on manual gaps and links.
- **Never stored or logged:** raw guest ids, viewer user ids, IP addresses
  (the limiter key only), user agents, referrers, cookies.
- **Retention (P12):** pseudonymous rows go at finalization, normally the
  night after the booking ends, and never reach 90 days. Aggregates, final
  reach, and gaps stay. Sponsors only ever see aggregates.
- **Deletion ([§8](v2-contracts.md#8-deletion)):** no key links to an account,
  so A3 deletes nothing here.
- **`/legal`** gains S2's paragraph after S1's (§7): first-party counting,
  the pseudonymous key, what is never stored, and the deletion rule.

## 6. Resource budget

| Unit                                   | Requests | D1 rows read                        | D1 rows written                          |
| -------------------------------------- | -------- | ----------------------------------- | ---------------------------------------- |
| Accepted view                          | 1 POST   | ≤ 5                                 | 2–4 (an insert writes a row and its key) |
| Suppressed view                        | 1 POST   | ≤ 4                                 | 0                                        |
| Beacon rejected before the lookup      | 1 POST   | 0                                   | 0                                        |
| Click                                  | 1 GET    | ≤ 3                                 | 1–2                                      |
| Job, per unfinalized booking and night | —        | that day's viewer-day rows          | 1 per rolled-up day                      |
| Finalization                           | —        | the booking's `sponsor_viewer` rows | 1, plus every pseudonymous row deleted   |
| Admin report or health check           | 1        | ≤ 40 plus provisional reach rows    | 0                                        |

Slice 3 records exact `meta` counts. With the BRD §2 planning inputs, which
are hypotheses, not measurements (1,500 active browsers a day, 3 qualified
views each), S2 writes about 13,500 rows a day: roughly 14 % of the free
plan's daily write allowance and under 1 % of the paid plan's monthly one. A
30-day booking seen by 1,000 browsers a day holds about 31,000 viewer-day
rows (≈ 3 MB) until finalization. No Durable Object wakes, the game Worker is
untouched, and the cron gains a step, not a trigger.

## 7. Somali copy

Keys live in `packages/i18n`; every string stays behind
`TODO(translation-review)` until the Q4 review. Slot names, state names
(`adminSponsors.states.*`), the sponsored label, and the confirm refusal
(`adminSponsors.errors.reportingUnhealthy`) come from S1; the glossary gives
Kafaala-qaade for sponsor.

| Key                          | Draft Somali                                                                                                                                                                                                                                                                                                                                                                                                              | Use                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `sponsorReport.title`        | Warbixinta kafaalada                                                                                                                                                                                                                                                                                                                                                                                                      | Heading, CSV title                             |
| `sponsorReport.metric.*`     | Muuqaallo la tiriyay (≥ 50 % oo muuqda 1 ilbiriqsi; ugu badnaan mid browser kasta 30-kii daqiiqoba) · Qiyaasta browser-yada kala duwan · Gujisyo · Heerka gujiska (%)                                                                                                                                                                                                                                                     | views · browsers · clicks · CTR                |
| `sponsorReport.def.views`    | Muuqaal waa la tiriyaa marka ugu yaraan kala badh kaarka kafaaladu shaashadda ka muuqdo hal ilbiriqsi oo aan kala go'in, boggana la furan yahay. Browser kasta waxaa laga tiriyaa ugu badnaan hal muuqaal 30-kii daqiiqoba.                                                                                                                                                                                               | Definitions                                    |
| `sponsorReport.def.browsers` | Waa qiyaas: tirada browser-yada kala duwan ee muuqaal laga tiriyay. Ma aha tirada dadka ama akoonnada.                                                                                                                                                                                                                                                                                                                    | Definitions                                    |
| `sponsorReport.def.clicks`   | Gujis waa mar kasta oo xiriirka kafaalada la furo oo server-ka Shaxda tiriyo ka hor inta aan loo gudbin bogga kafaala-qaadaha.                                                                                                                                                                                                                                                                                            | Definitions                                    |
| `sponsorReport.def.ctr`      | Gujisyada ÷ muuqaallada × 100. Way dhaafi kartaa 100 %; marka muuqaal la'aan tahay waxaa la qoraa —.                                                                                                                                                                                                                                                                                                                      | Definitions                                    |
| `sponsorReport.limits`       | Tirooyinkani waa cabbir, ma aha caddeyn in qof daawaday. Way ka yaraan karaan (xannibe, browser gaar ah, khad go'ay) ama way ka badan karaan (xog la tirtiray, qof browser-yo badan leh, codsiyo aan qof ahayn).                                                                                                                                                                                                          | Every report                                   |
| `sponsorReport.cutoff`       | Xogtu waxay ku egtahay dhammaadka {day} (UTC)                                                                                                                                                                                                                                                                                                                                                                             | Cutoff                                         |
| `sponsorReport.values.*`     | Lama hayo · Kama dambays · Ku meel gaar · Weligeed ma socon                                                                                                                                                                                                                                                                                                                                                               | unavailable · final · provisional · never live |
| `sponsorReport.gaps.*`       | Hakadyada · Muuqaallo aan la tirin · Gujisyo aan la tirin · Cabbir maqan · Kaarka lama muujin                                                                                                                                                                                                                                                                                                                             | title · the four kinds                         |
| `sponsorReport.gapForm.*`    | Diiwaangeli hakad · Laga bilaabo (UTC) · Ilaa (UTC) · Sababta · Kaydi                                                                                                                                                                                                                                                                                                                                                     | Gap form                                       |
| `sponsorReport.health.*`     | Warbixintu way furantaa · Isu-geynta maalinlaha ah waa cusub · Furaha cabbirka waa diyaar · Xadka codsiyada waa diyaar                                                                                                                                                                                                                                                                                                    | the four checks on S1's booking page           |
| `sponsorGo.unavailable.*`    | Xiriirkan lama heli karo · Kafaaladii xiriirkani u socday way dhammaatay ama hadda lama heli karo. · Ku noqo Shaxda                                                                                                                                                                                                                                                                                                       | `/go` page                                     |
| `legal.sponsorMeasurement`   | Shaxda waxay tirisaa marka kaarka kafaaladu muuqdo iyo marka la gujiyo, iyadoo aan la isticmaalin cookie, script ama pixel dhinac saddexaad ah. Tirintu waxay isticmaashaa fure qarsoon oo laga sameeyay aqoonsiga random-ka ah ee browser-kaaga iyo ballanta; magacaaga, akoonkaaga, IP-gaaga iyo browser-kaaga lama kaydiyo. Furayaashaas waa la tirtiraa marka warbixinta ballanta la xiro, mana dhaafaan 90 maalmood. | `/legal`                                       |

## 8. Implementation slices

S2-min lands between S1's slices 6 and 10 in S1's release; tests land with
or before each change.

1. `feat(shared): add the sponsor view beacon schema and measurement constants`
2. `feat(i18n): add Somali sponsor measurement copy and legal text`
3. `feat(db): add sponsor measurement tables with gate and click queries`
4. `feat(db): add sponsor rollup, finalization, and prune queries`
5. `feat(web): accept qualified views at /api/sponsor/event`
6. `feat(web): count sponsor clicks through /go/<bookingId>`
7. `feat(web): observe qualified views in SponsorSlot`
8. `feat(web): run the sponsor nightly job in the dispatcher`
9. `feat(web): add the admin sponsor report, print view, CSV, and gap notes`
10. `feat(web): expose sponsor reporting health to booking confirmation`
11. `test(e2e): cover a counted view, a JavaScript-free click, and the CSV`
12. `docs(ops): add the sponsor measurement runbook` (preview checklist, log
    review before each report, gaps, salt rotation)

S2 token links (wave L):

13. `feat(db): add revocable sponsor report links`
14. `feat(web): serve read-only sponsor reports by token`

## 9. Acceptance tests

**Unit** (Vitest; fake IntersectionObserver, visibility, and timers):

- 49 % visible for any time: no beacon. 50 % for 1,000 ms: one beacon.
- Interrupted second (999 ms, a drop below 50 %, then a full second): one
  beacon, after the second full second. Hidden tab at 600 ms cancels; visible
  again needs a full second. Unmount or booking swap at 900 ms: no beacon.
- One beacon per mount; a remounted `result` overlay may send again. No
  persisted guest id: no beacon, and the CTA works. No game action awaits the
  beacon; a rejected fetch surfaces nothing.
- CTR: 0 views → `—`; 3 clicks / 2 views → `150.0`; 2 / 3 → `66.6`. CSV
  escaping of `=`, `+`, `-`, `@`, tab, CR, commas, quotes, and newlines.
- The schema rejects unknown keys, a wrong `v`, an unknown slot, an oversize
  id.

**Workers and D1** (Miniflare, local only):

- Gate: first view accepted; +29:59.999 suppressed; +30:00.000 accepted.
  Across midnight: 23:50 accepted on day d; 00:10 suppressed; 00:20 accepted
  on day d + 1; daily rows split and booking reach counts the browser once.
- 20 concurrent identical beacons: one accepted view. 50 concurrent clicks:
  `clicks = 50`. Two local games inside 30 minutes: at most one view for the
  same `result` booking and browser. One guest id gets a different key and
  gate per booking.
- Rollup twice: identical views and browsers, clicks kept; a zero-view day
  rolls up to 0; an unrolled day stays `NULL`.
- Finalization waits for every booked day, freezes distinct reach across
  days (not the sum of daily values), deletes pseudonymous rows, leaves every
  report total unchanged, and is a no-op when rerun. Backstop: an unfinalized
  booking that started 90 days ago gets `NULL` reach and loses its rows.
- Repeated failures on a day make one automatic gap row counting `events`.
- Each statement's `EXPLAIN QUERY PLAN` uses a primary key or listed index.

**Routes** (web):

- Beacon: bad `Origin` `403`; non-JSON `415`; oversize `413`; invalid,
  unknown key, or wrong slot `400`; over the limit `429`; expired,
  cancelled, upcoming, or unknown booking `404` with no rows; missing salt
  `503` and a gap; sponsors disabled `204` with no D1 call.
- Limiter fail-closed: a built Worker with the production configuration and
  no binding answers the beacon `503` without D1, redirects `/go`
  uncounted, and fails health check (d); under `vite dev` both count.
- `/go`: a live booking gives one counted `302` to exactly the vetted HTTPS
  `cta_url`, with `no-store` and `no-referrer`. A stored URL with another
  host, `http:`, credentials, or a private host: unavailable page, no
  `Location`. Unknown, ended, or cancelled `404` and lookup failure `503`,
  both the unavailable page. Counter failure still redirects and records
  `clicksNotCounted`, or logs when that write fails too. `HEAD` and prefetch
  count nothing; over the limit redirects uncounted; the built service worker
  never answers `/go/*`.
- After the suite, no S2 row or captured log line holds a raw guest id, IP
  address, or user agent.
- Admin: signed out → login; not allowlisted → `403` for HTML, CSV, and the
  gap form; `private, no-store`; no other booking's rows. HTML and CSV match
  for a seeded booking; a sponsor named `=HYPERLINK("x")` is escaped;
  unavailable days, zeros, `—`, never-live bookings, and provisional or final
  reach are labelled as §3.7 says.
- Health: a report that fails to load, `last_success_at` older than 26
  hours, a missing salt, or a missing limiter in a built Worker each fail
  the check with that check named; a draft booking passes (a).

**End to end** (Playwright, shared local D1): a `lobby` card visible for 1 s
sends one beacon, and after a controlled day change and job run the report
shows 1 qualified view; with JavaScript disabled the CTA passes through `/go`
and is counted; the downloaded CSV totals match the page;
`pnpm check:e2e-isolation` passes.

**Token links** (wave L): booking A's token cannot read booking B; revoked
and unknown tokens get the same `404`; only the hash is stored; responses
carry `no-store`, `noindex`, and `no-referrer`; no admin control or price.

**Sample matches:** S2 neither shows nor counts matches, and no match id or
result reaches it. M1–M10 have no S2 effect; the `result` card behaves the
same after guest, friendly, rated, local, and online games.

## 10. Rollout and rollback

- **Environments:** S2 adds no binding. It uses S1's `SPONSORS_ENABLED` and
  `SPONSOR_RATE_LIMIT` (one binding, which S1 keys `active:`) and X1a's salt,
  wrapper, and dispatcher. The limiter is `120` per 60 s per key with its own
  `namespace_id`. Only `vite dev` may run without it; the e2e build declares
  it (local simulation), as X1 does for its own limiter, because a built
  Worker fails closed. Run the job locally with
  `wrangler dev --test-scheduled`.
- **Order:** S1's migration, S2's migration, then one web deploy
  ([§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone)).
  Deploys and remote migrations are explicit operations, never a side effect
  of local checks.
- **Preview checklist** (results go in the ops record): on `lobby`, and on
  `result` after local and online games, one counted view after continuous
  visibility; a repeat suppressed for 30 minutes; a JavaScript-free click;
  the 00:15 rollup; finalization and deletion the night after cancelling
  the test booking (S1 allows no period under 7 days); print and CSV parity;
  the health check failing once the salt is removed.
- **Kill switch:** `SPONSORS_ENABLED` off hides every card (S1), answers the
  beacon `204` without writing, and shows the unavailable page on `/go`; the
  job and reports keep working. Record the window as a `displayOutage` on
  each live booking.
- **Rollback:** the CTA points at `/go`, so S2 cannot be rolled back alone
  while a booking is live. Kill switch first, then roll back code. Tables are
  additive and stay; a schema fix is a new migration.
- **Monitoring:** `sponsorViewNotCounted`, `sponsorClickNotCounted`,
  `sponsorLimiterMissing`, `sponsorDestinationRejected`, `sponsorJobFailed`,
  and rate-limit drops, reviewed before every report.
- **Done when (S2-min):** a real completed pilot booking has a finalized
  report (daily rows, totals, final reach, definitions, cutoff, and gaps)
  that the founder can print or export and explain, and S1's confirm refuses
  whenever the health check fails. Only the ops record states what was
  verified in production.
- **Done when (token links):** a sponsor opens their own report by link, and
  revoking it returns `404`.
