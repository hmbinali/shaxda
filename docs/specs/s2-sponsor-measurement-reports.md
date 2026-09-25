# S2 — Sponsor Measurement and Reports (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; specification only. S2 is not active or shipped. |
| Brief | `docs/shaxda-v2.md` §6.3, §7.2, §12 (S1/S2), §14–§16 |
| Depends on | S1 live bookings, four slot renderers, vetted HTTPS destinations and admin access; X1 anonymous browser id, rate limiting, and daily job |
| Workspace | `s2-sponsor-reports` |
| Touches when implemented | Web Worker routes and slot component; `packages/shared` validation; `packages/db` migration/queries; admin report and Somali copy; tests and operations docs |

This spec refines S2 without activating it. The V2 brief wins on scope and
order; the PRD governs the stack and infrastructure. S1 and X1 have not been
implemented in this checkout. Reconcile the proposed interfaces below with
their merged contracts before coding, and keep any change to those contracts
explicit. S2 does not change slot placement, booking policy, prices, or the
content policy owned by S1 and the BRD.

---

## 1. Outcome and scope

The founder can give a sponsor a reproducible report for one booking: measured
viewable impressions, estimated unique devices, outbound clicks, and click-
through rate (CTR), with a UTC daily breakdown. Every counted click goes
through Shaxda's first-party redirect. The report states exactly what was
measured and what could be missed or inflated.

### Must

1. Observe the creative in each S1 slot. A view qualifies after at least 50%
   of that slot is visible for a continuous 1,000 ms. Count at most once per
   anonymous browser id, slot, and rolling 30 minutes. Check that the booking
   is live on the server at receipt time.
2. Route the CTA through `GET /go/<bookingId>`. Count a navigation without
   JavaScript and redirect only to that booking's currently vetted HTTPS URL.
3. Validate and rate-limit `POST /api/sponsor/event`. Keep raw browser ids,
   account ids, IPs, and user agents out of sponsor tables and reports.
4. Maintain `sponsor_stat_daily` by booking and UTC day. Re-running a daily
   impression rollup must produce the same result.
5. Give allowlisted admins a per-booking, printable report and a CSV export.
   Include the slot, booking period, daily and total metrics, definitions,
   report cutoff, and missing-data caveats.
6. Cover dedupe, booking boundaries, redirect safety, rollup idempotence,
   admin access, and browser visibility with tests.

### Should

- A read-only report link with a random, unguessable token can be added after
  the admin report is reliable. A sponsor sees only that booking's report;
  the token is revocable and never grants admin access.

### Out of scope

Sponsor accounts, login, live dashboards, third-party measurement or scripts,
tracking pixels, targeting, programmatic ads, self-serve booking, payments,
new placements, and counting guest or local game actions. S2 measures a slot
only when S1 actually renders a live sponsored creative.

---

## 2. Metric contract

| Metric | Definition and display rule |
| --- | --- |
| Viewable impression | One accepted visibility event after the 50%/1-second test, subject to the rolling 30-minute gate for the same browser id, booking, and slot. Server receipt time assigns the UTC day. |
| Estimated unique devices, daily | Distinct accepted browser ids for that booking and day. The same browser on two days counts once on each day. |
| Estimated unique devices, booking | Distinct accepted browser ids across the entire booking. **Do not sum daily unique counts** to obtain this number. |
| Click | One eligible navigation request to `/go/<bookingId>` that the server counts before redirecting. Repeated genuine navigations can count again; no JavaScript or impression is required. |
| CTR | `clicks / viewable impressions × 100`, rounded only for display. When impressions are zero, show `—`, not 0%. Clicks may exceed impressions, so CTR may exceed 100%. |

Each S1 booking owns one slot, so a booking report labels that slot; an admin
comparison across bookings groups by slot. The `result` surface offers a view
after each completed game, but the 30-minute gate can suppress additional
*counted* impressions from the same browser. Do not claim one billable
impression per completed game or use raw game completions as sponsor reach.

Counts are first-party estimates, not proof of human attention. Private
browsing, disabled storage or JavaScript, blockers, failed requests, and
network outages can reduce them. Cleared storage or scripted requests can
inflate them. A signed-in player's multiple browsers count separately under
the proposed device definition. The report labels all such reach figures
"estimated unique devices" and never calls them people or accounts.

### Anonymous browser key

Reuse X1's existing browser-local guest id on all four surfaces, including
when the viewer is signed in. For S2, derive
`HMAC-SHA-256(ANALYTICS_SALT, "sponsor:" + bookingId + ":" + guestId)`
server-side. The booking-specific prefix prevents joining a viewer across
sponsors or against X1's active-user table. Do not transmit or store a user id,
username, session token, or X1 account anon id with an impression. The raw
guest id exists only in the validated request and must not be logged. Missing
storage means no impression beacon; the CTA still works. Salt rotation
changes dedupe and reach, so record the date in operations and annotate
affected reports.

---

## 3. Browser behavior

Extend S1's single `SponsorSlot` component rather than creating a tracker per
page. It knows the booking id and slot from the active-booking response; it
does not accept a caller-supplied destination URL for tracking.

- Observe the **creative container**, excluding empty space. Use
  `IntersectionObserver` with threshold `0.5`. Start a 1,000 ms timer only
  while intersection ratio is at least 0.5 and the document is visible.
  Cancel it when visibility or intersection drops, the booking changes, or
  the component unmounts. A later view starts a fresh continuous second.
- After the timer completes, send one small same-origin JSON POST with
  `{ v: 1, bookingId, slot, guestId }`, credentials `same-origin`, and no
  tracking query parameters. A page-local guard prevents repeated requests
  for the same booking/slot while mounted; the server is the dedupe authority
  across tabs, reloads, and devices. A nonessential beacon never delays game
  controls, a pending capture, a blocked prompt, or navigation.
- The `result` panel is observed only after game over. Its hidden or covered
  state cannot earn an impression. S1's rule against showing the panel during
  a pending capture or blocked prompt still applies.
- The CTA is an ordinary first-party anchor to `/go/<bookingId>`, with
  SvelteKit preloading disabled and a visible sponsored label. Do not replace
  it with `onclick` tracking. Do not prefetch the redirect route.

The server may reject a beacon for an expired booking after a cached S1
response. Such a rejection is silent in gameplay; it is not a counted view.

---

## 4. Server boundaries

### `POST /api/sponsor/event`

Dynamic web-Worker route, `Cache-Control: no-store`, JSON only, bounded body
(at most 1 KB), with a Zod schema in `packages/shared`. Accept the single
event type `impression` or name the route explicitly for impressions; do not
open a generic client-controlled event catalogue. Required order:

1. Require the configured environment, exact same-origin `Origin`, JSON
   content type, valid bounded body, and the S2 rate-limit binding. Return
   `403`, `415`, `400`, or `429` respectively on failure. Tests inject a
   limiter; local development may use the X1 local fallback. Production
   reports must flag any period when the limiter was unavailable.
2. Require the analytics HMAC secret, then load the booking and its S1 sponsor
   by indexed id. Require `confirmed`/`live` according to S1's final status
   model and `starts_at <= serverNow < ends_at`. Match the supplied slot to
   the booking's slot. Reject missing, cancelled, unpaid, or out-of-period
   bookings with no count. Never trust a client-supplied day or price.
3. Derive the booking-specific browser hash and apply the rolling gate in
   §5. Accepted and deduped valid events return `204`; do not reveal whether
   this browser was previously seen.

Use X1's IP-based limiter for the request flood floor, plus a conservative
per-browser/booking cap on accepted events (for example, 48 per UTC day; the
30-minute gate already imposes that ceiling). A configurable starting limit
of 60 sponsor event requests per minute per IP, shared across bookings,
protects D1 from invalid flood traffic; tune only with observed false
positives. Do not persist IPs or user agents. Same-origin and limits reduce
casual abuse but cannot certify that a client really viewed the creative.

### `GET /go/<bookingId>`

Dynamic web-Worker route, `Cache-Control: no-store`, with `HEAD` and any
non-navigation probe returning no counted click. Resolve the booking and
destination from S1's stored, founder-vetted data; never take a URL from the
path, query, or request body. At request time require the booking to be live,
the sponsor active, and the destination to pass S1's HTTPS/host allowlist and
URL safety checks again. Reject an invalid or ended booking with a Somali
ended/unavailable page. A disallowed or non-HTTPS destination must never be
returned as a `Location` header.

For an eligible browser navigation, atomically increment that booking/day's
click counter and return a temporary redirect (`302`) to the vetted URL with
`Referrer-Policy: no-referrer`. Guard this route with its own rate limit
(initially 20 counted navigations per minute per IP), but do not strand a
human on an error page when the counter or limiter is unavailable: redirect
to the vetted URL without counting and record an operational error. The
report must disclose any such measurement outage. Never cache redirects or
count bots' HEAD requests. An internal link prefetch must not count as a
click; test the actual SvelteKit/browser behavior.

Both endpoints run in the web Worker, never the game Worker. They perform no
Better Auth lookup. All routes and admin reads use S1's established database
binding; no third-party endpoint receives a viewing event.

---

## 5. Storage, aggregation, and retention

Add a hand-written D1 migration and matching Drizzle schema/exports, using
the next migration number at implementation time. Keep S1's `sponsor` and
`sponsor_booking` as the source for booked period, slot, and destination.
Proposed S2 data shape:

| Table | Key and fields | Purpose / index |
| --- | --- | --- |
| `sponsor_viewer_day` | PK `(booking_id, slot, day, viewer_hash)`; `last_counted_at`, `impressions` | One row per browser/booking/slot/UTC day that had an accepted impression. Indexed by `(booking_id, day)` for rollup and `(booking_id, viewer_hash)` for booking reach. No raw event log. |
| `sponsor_stat_daily` | PK `(booking_id, day)`; `impressions`, `unique_devices`, `clicks`, `updated_at` | Aggregate report row. Daily impressions and unique devices are **replaced** by rollup; clicks are atomically incremented at redirect and preserved by rollup. Index the booking/day range. |
| `sponsor_report_final` | PK `booking_id`; `unique_devices`, `finalized_at` | Frozen booking-wide distinct reach after the booking closes; keeps old reports accurate after pseudonymous rows are pruned. |

No per-page-view row, sponsor cookie, raw IP, full URL, or user table join.
All common reads begin with `booking_id` and a bounded day range; use
`EXPLAIN QUERY PLAN` on merged schema. Validate foreign keys, nonnegative
counters, UTC day text, and sensible timestamps in the migration and queries.

### Rolling gate

For `(booking, slot, viewer_hash)`, accept the first qualifying impression,
then accept another only when at least 1,800,000 ms have elapsed since the
last **accepted** one. Crossing UTC midnight does not reset the gate: check
the previous day's row when creating today's first row. A rejected event
does not move `last_counted_at`. Concurrent requests for the same key must
produce one accepted increment; implement the predicate and upsert
atomically in D1, and prove the behavior with a Workers/D1 concurrency test.
`sponsor_viewer_day.impressions` is the source for aggregate impressions.

X1's nightly web-Worker job rolls up the previous UTC day after it closes.
Enumerate live or recently ended bookings by indexed period and write a row
for every booked UTC day, including zero-view days. For each booking/day,
compute `SUM(impressions)` and
`COUNT(DISTINCT viewer_hash)` from `sponsor_viewer_day`, then upsert those two
values into `sponsor_stat_daily`; do not add them to the old values. Preserve
the click column in that upsert. Re-running the job yields identical
impression and unique counts. A bounded admin catch-up can rebuild missing
days before export; if catch-up fails, display an incomplete report rather
than zeroes. Label today's values as incomplete or omit them from the
printable/exported report; the default report cutoff is the end of yesterday
UTC. Do not create a second unbounded cron scan.

After the final booking day has closed and been rolled up, freeze booking-wide
reach as `COUNT(DISTINCT viewer_hash)` over that booking's viewer-day rows.
This finalization is idempotent, checks for every booked day, and stores the
cutoff and time. A later correction must explicitly recompute both daily
rollups and the final reach. Keep `sponsor_viewer_day` only through the
booking's close plus 60 days for reconciliation, then prune it; keep daily
aggregates and final reports for historical reporting. The 60-day limit and
anonymous counting are stated on `/legal` in Somali. If a deletion/prune job
fails, alert the founder and retry; do not silently retain viewer hashes.

---

## 6. Admin report and export

Place the report under S1's allowlisted `/admin/sponsors` area, at a
booking-specific URL. Derive admin access from the server session and S1's
user-id allowlist on **every** HTML and CSV request. Return `403` to others;
never pass admin data into a public layout load or shared cache.

The page shows booking dates in UTC, slot, sponsor display name, report cutoff,
daily rows, totals, estimated booking-wide reach when finalized, CTR, and a
plain Somali explanation of the viewability gate, repeat-click behavior, and
the limits in §2. Before finalization, show the booking-wide reach as
provisional from currently retained viewer rows, with its cutoff. Distinguish
zero from unavailable data. A cancelled or never-live booking may show an
empty report with that status; it must not be portrayed as a zero-performing
campaign.

Offer a print stylesheet and `GET` CSV export for the same authorized
booking and cutoff. The CSV includes a schema/version header or columns for
`booking_id`, `slot`, `day_utc`, `impressions`, `unique_devices_daily`,
`clicks`, `ctr_percent`, and a totals row whose reach comes from distinct
booking viewers, not summed daily reach. Escape CSV delimiters and leading
spreadsheet formula characters in sponsor-controlled text. Set
`Content-Disposition: attachment` and `Cache-Control: private, no-store`.
Numbers in HTML and CSV must come from the same query/rounding helper.

The Should token link, if built, stores only a hash of a cryptographically
random token, is scoped to one booking, can be revoked, and uses `no-store`,
`noindex`, and a no-referrer policy. Its report DTO omits admin controls,
internal IDs other than the booking reference, and other sponsors' data.
The founder can instead send the printable page or CSV directly; token access
is not needed for S2 completion.

---

## 7. Implementation order

1. Confirm S1's booking statuses, period boundaries, destination validator,
   slot component, and admin guard, plus X1's anonymous-id helper, limiter,
   nightly job, and local D1 harness. Settle S2-D1 with the founder before
   freezing the report label or schema.
2. Add the migration and D1 query tests for the rolling gate, daily rollup,
   final reach, click increment, and prune. Keep the gate and daily totals in
   one query module so admin and route code cannot diverge.
3. Add the validated impression endpoint and same-origin redirect, with route
   tests and an operational error signal for uncounted redirects.
4. Add visibility observation to S1's slot component, then the guarded admin
   report, print styling, CSV, and Somali metric/privacy copy.
5. Wire the bounded nightly rollup/finalization/prune into X1's job; document
   migration, deployment, outage annotation, and report reconciliation.

One logical change per commit. Do not deploy or apply a remote migration as
a side effect of local checks.

---

## 8. Tests and release evidence

### Unit and integration

- Visibility timer: 49% visible, interrupted one-second exposure, hidden tab,
  unmount, result overlay hidden/covered, active-booking swap, and qualifying
  view. Assert no gameplay action waits for a beacon.
- Rolling gate: first event, 29:59 rejection, 30:00 acceptance, UTC midnight,
  two tabs/concurrent requests, repeat POST, and separate bookings. Confirm
  two completed local games inside 30 minutes yield at most one counted view
  for the same result booking/browser.
- Server guards: invalid JSON, oversized body, wrong Origin, wrong slot,
  expired/cancelled/unpaid booking, absent HMAC key, limiter threshold, and
  missing storage. Verify no raw ids, IPs, or user agents enter tables or logs.
- Redirect: JS disabled, direct GET, HEAD, prefetch, expired booking,
  malicious/changed destination, non-HTTPS or unallowlisted host, and D1
  failure. Only a vetted live destination may appear in `Location`.
- D1: click increments under concurrency; same day rollup twice leaves
  impressions/unique counts unchanged and preserves clicks; distinct reach
  across days; finalization and prune retain historical report totals.
- Admin: signed-out/non-allowlisted `403`, row ownership, HTML/CSV parity,
  CSV formula escaping, missing-day warning, zero-impression CTR, and no
  shared-cache leak. If token links ship, test isolation and revocation.

### Verification and rollout

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and relevant
`pnpm test:e2e`; run `pnpm test:worker` if the shared Workers/D1 harness is
changed. Keep `pnpm check:e2e-isolation` passing. Use local Miniflare D1 for
development. Add preview/production migration and rollback steps to the
operations runbook; deployment is a separate explicit operation, not a local
test side effect.

On preview, book a short test window, verify each of the four surfaces, one
counted view after continuous visibility, a repeat view suppressed for 30
minutes, a JavaScript-free click, midnight rollup, and admin print/CSV parity.
In production, monitor count errors, rate-limit drops, rollup failures,
counter outages, and prune failures. Record outage windows on affected
reports. S2 is done when a real completed booking has a reconciled daily and
total report the founder can print or export and explain to the sponsor.

---

## 9. Decisions to confirm before implementation

| ID | Proposed decision | Why it matters |
| --- | --- | --- |
| S2-D1 | Reach uses a browser-local anonymous id for every visitor and is labelled **estimated unique devices**. | X1's account anon id merges multiple devices and cannot support that label. |
| S2-D2 | A 30-minute **rolling** gate uses the last accepted impression; it crosses UTC midnight. | Fixed half-hour buckets can count two views seconds apart. |
| S2-D3 | Daily reports close at UTC midnight; finalized reach is snapshotted before viewer hashes expire. | Makes re-runs and historical exports consistent without retaining identifiers forever. |
| S2-D4 | `/go` counts only eligible navigation requests, then redirects even when measurement fails. | Sponsor navigation remains usable; failures are disclosed. |

S1's open product choices, including whether the `result` slot appears in
local games, remain S1 decisions. If a S1 slot is absent, S2 neither invents
it nor estimates its missing traffic.
