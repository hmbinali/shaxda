# S1 — Sponsor Placements (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; specification only. S1 implementation has not started. |
| Brief | `docs/shaxda-v2.md` §6.3, §7.1–7.2, §12 (S1), §14–17 |
| Workspace | `s1-sponsor-placements` |
| Depends on | X1 production audience numbers; `docs/shaxda_brd.md` created and approved before S1 implementation |
| Unblocks | S2 sponsor measurement and reports; S3 sponsor page and rate card |
| Touches when implemented | `AGENTS.md`, PRD, BRD, `packages/db`, `packages/i18n`, `web/`, web Wrangler configs, legal copy, tests |
| Does not touch | Game Worker, rules engine, room protocol, account identity, X1 analytics tables |

This spec refines the V2 brief. The brief controls V2 scope; the PRD controls
the stack and V1 architecture. S1 may start only after X1 provides production
numbers and the founder has created and approved the BRD from V2 §15. The BRD
owns pricing, sponsor policy, and sales operations. Any mismatch between this
draft and the approved BRD must be resolved before implementation.

---

## 1. Outcome and scope

**Outcome.** The founder can vet a business, upload an optional first-party
logo, book one of four fixed surfaces for a paid period, and preview it. Once
payment is confirmed off-platform, the placement appears automatically during
its booked period and disappears afterward, without a deployment. Every paid
placement carries a visible Somali sponsorship disclosure.

### Must

1. Four slots: `home`, `lobby`, `result`, and `learn`, with the exact surfaces in
   §2. A slot has at most one confirmed booking at any instant.
2. Seven-day, fourteen-day, and one-month booking choices (§3); half-open UTC
   intervals and database-enforced overlap rejection.
3. A text-first creative: vetted sponsor name, one-line tagline, approved HTTPS
   CTA destination, and optional logo stored in Shaxda's R2 bucket. Text-only
   creatives work on every slot.
4. `/admin/sponsors` for an allowlisted founder account: create/edit/archive
   sponsors, create/edit/delete drafts, confirm paid bookings, cancel confirmed
   bookings, inspect availability, and preview every slot before publishing.
5. Public `GET /api/sponsor/active` and one shared `SponsorSlot` rendering
   component; prerendered and client-only pages can fetch without auth.
6. No third-party script, pixel, hot-linked creative, identity targeting,
   rotation, or sponsor request from the game Worker.
7. Somali disclosure, stable layout, keyboard access, and a placement that
   never obstructs the board, controls, pending capture, or blocked-player
   prompt.
8. First implementation commit updates `AGENTS.md` and the PRD for V2 §6.3.
   The Somali `/legal` text must be revised before the first live booking: it
   currently says Shaxda has no sponsorships.

### Should

- Show the next available dates per slot in admin, derived from confirmed
  bookings rather than a second calendar table.
- Offer a compact four-surface preview at desktop and mobile widths before the
  founder confirms a booking.

### Outside S1

S2 owns impressions, clicks, `/go/<bookingId>`, sponsor reports, and any
`/api/sponsor/event` endpoint. S3 owns the public `/sponsor` page, contact path,
published prices, and rate card. S1 does not add sponsor logins, self-serve
booking, in-app payments, ad networks, targeting, rotating creatives, or
personalized delivery. Admin stores an agreed price and payment-confirmed
status, but no card details, invoice file, or payment transaction.

---

## 2. Slot and display contract

| Slot | Surface | Placement rule |
| --- | --- | --- |
| `home` | `/`, below the hero | One card after the primary play choices, outside the hero buttons. |
| `lobby` | `/online` waiting screen and K1 quick-match waiting screen when K1 exists | Below room/wait controls. Never replaces the invite link or queue status. K1 integration is conditional on that milestone existing; no quick-match UI is built in S1. |
| `result` | Game-over overlay on `/local` and `/online` | Below the result and its action buttons, inside the accessible dialog but outside the board hit area. No sponsor fetch blocks result display, rematch, or new game. |
| `learn` | `/learn` between content sections | One inline card between complete sections, never inside a rule explanation or diagram. |

Use the same booked creative for every visitor to a given slot at the same
instant. The endpoint does not accept user ids, account state, room codes, or
language/interest targeting parameters. The component reserves a compact
layout area only when it has a valid creative, avoids cumulative layout shift,
and remains usable at narrow mobile widths and large text sizes. The logo is
decorative when the sponsor name is already visible; the link has a clear
accessible name including the sponsor name. The disclosure remains visible in
all viewport sizes and is never only an icon or tooltip.

The result slot renders only after authoritative or local game state is
`gameOver`. It is absent while `pendingCapture` exists, while a blocked-player
prompt is active, and during active play. It does not take initial modal focus
from the primary result action. On a short screen, the dialog may scroll
internally; the primary actions remain reachable before the sponsor card.

An unbooked slot renders **nothing** in S1. There is no link to `/sponsor`
until S3 actually creates that page. S3 may add a clearly separate house card
on eligible empty surfaces. When the network is unavailable or the endpoint
fails, hide the placement and let local/offline gameplay continue.

### Somali copy

The visible disclosure is `Waxaa kafaala qaaday` until the founder approves a
different Somali phrase. Copy for the disclosure and admin lives in
`packages/i18n`, not inline in components. The sponsor's own-language tagline
is allowed after vetting; Shaxda's surrounding UI remains Somali. No English
label or language toggle is added. The BRD records the approved wording and
content policy before launch.

---

## 3. Booking and state rules

All stored instants are UTC milliseconds. A booking covers `[starts_at,
ends_at)`: it is active at the start instant and inactive at the end instant.
The server clock decides public eligibility; browser time is used only to
avoid displaying a response after its included `endsAt`. The admin UI shows
the stored UTC interval and a local-time explanation before confirmation.

| Choice | Duration rule |
| --- | --- |
| `7d` | `ends_at = starts_at + 7 × 24 hours`. |
| `14d` | `ends_at = starts_at + 14 × 24 hours`. |
| `month` | One calendar month: starts at 00:00 UTC on the first day and ends at 00:00 UTC on the first day of the next month. |

The founder may book future time, never backdate a new confirmation. A draft
may overlap other drafts or confirmed bookings; the confirmation action must
recheck availability. Adjacent periods where one `ends_at` equals the next
`starts_at` are allowed. Editing a confirmed booking's slot, period, sponsor,
price, or creative is not allowed; cancel and create a new booking so a paid
commitment cannot silently change. Cancellation stops public display, records
the actor/time/reason, and frees the remaining interval. Deleting a confirmed
booking is forbidden.

The approved sponsor name, tagline, CTA, and logo are locked while that
sponsor has a future or live confirmed booking. A proposed creative edit must
be vetted again, then applied only after the affected bookings are cancelled
and rebooked. This prevents an approved destination from being replaced
behind an already confirmed placement.

The persisted booking states are `draft`, `confirmed`, and `cancelled`.
`live` and `ended` in the V2 overview are **derived admin display states**:
`confirmed` plus `now ∈ [starts_at, ends_at)` is live; `confirmed` plus
`now ≥ ends_at` is ended. This avoids a scheduler and keeps time as the source
of truth. A booking becomes confirmed only through the founder's explicit
“payment received” action, with the actor and confirmation time saved. The
app never charges a sponsor. Confirmation requires an approved sponsor,
approved creative, valid CTA URL, nonempty price/currency, and no overlap.

---

## 4. Data and database invariants

Use a hand-written migration after the migrations that have actually merged
when S1 starts, with matching Drizzle definitions. Do not reserve a migration
number from the draft specs in this checkout. Keep auth tables unchanged.

| Record | Required fields |
| --- | --- |
| `sponsor` | Opaque id; display name; one-line tagline; approved CTA URL and destination host; nullable R2 logo key; `draft`/`approved`/`archived` vetting status; vetting policy version and founder approval actor/time; created/updated actor/time. No email or contact person in public DTOs. |
| `sponsor_booking` | Opaque id; sponsor id; slot enum; period enum; `starts_at`, `ends_at`; agreed price in integer minor units and ISO currency; `draft`/`confirmed`/`cancelled` state; created/updated actor/time; payment-confirmed actor/time; nullable cancellation actor/time/reason. |

Required constraints: nonblank bounded text; known slot/period/status;
`starts_at < ends_at`; nonnegative agreed price; supported currency; approved
CTA must be HTTPS; booking sponsor FK; no confirmed overlapping intervals for
the same slot. The CTA URL is validated in application code and revalidated on
approval; database constraints cover what SQL can prove. Store a vetted exact
destination hostname and prohibit a different hostname without new approval.
Soft-archive approved sponsors instead of deleting one referenced by a
booking. A draft sponsor or booking with no references may be deleted.

SQLite `UNIQUE` does not enforce time-range exclusion. Add `BEFORE INSERT` and
`BEFORE UPDATE` triggers that abort when a proposed `confirmed` booking has
another confirmed booking in the same slot satisfying
`existing.starts_at < new.ends_at AND new.starts_at < existing.ends_at`.
Exclude the row itself on update. This makes concurrent confirmation attempts
safe at the database write boundary, including direct SQL or a future admin
path. Map the trigger error to an actionable Somali availability message.
Index confirmed lookup by `(slot, status, starts_at, ends_at)` and admin
bookings by `(starts_at DESC, id)` and `(sponsor_id, starts_at DESC)`; verify
`EXPLAIN QUERY PLAN` for active and availability queries.

An active response contains only `slot`, opaque `bookingId` (for S2), vetted
display name, tagline, approved CTA URL, same-origin logo URL if any,
`startsAt`, and `endsAt`. It contains no price, private account id, payment
details, or admin notes. S2 can add reporting tables without changing the S1
booking identity.

---

## 5. Public delivery, cache, and time boundaries

`GET /api/sponsor/active` is a public, same-origin, versioned JSON response
containing at most one active booking per slot. A single indexed D1 read uses
one server-captured `now`. Invalid, archived, cancelled, unpaid, or expired
bookings never appear. The route is independent of the Better Auth session and
never sets cookies. Unknown methods return 405. Validate the response shape
with the shared sponsor schema. No public mutation route ships in S1.

Cache the public response at the edge for **at most five minutes**. Cap the TTL
at the next confirmed start or end boundary, so a cached empty response
cannot delay a booking that was already scheduled when the response was
generated and a cached live response cannot outlive its booked end. At an
exact boundary use a fresh query. Include `serverNow` and `nextTransitionAt`
with each booking interval in the response. A client uses `serverNow` to
account for device-clock skew, refetches at the next transition, and refreshes
at most five minutes after the previous successful read while visible, even
when no transition was known. It never shows a booking outside its interval.
Keep browser caching off; the five-minute bound is for the edge only. A newly
confirmed or cancelled booking may take up to five minutes to propagate
through a previously cached response.
The admin must show this bound and recheck the public endpoint after it passes;
an urgent takedown requires clearing the relevant edge cache. Tests exercise
the actual caching path, not only `Cache-Control` headers.

The endpoint is small and text-first. It must not be part of the PWA precache
or an offline cached response. `/local` and `/online` remain prerendered,
client-only gameplay routes. A sponsor fetch is optional UI work on mount or
result display; it does not call the game Worker or delay a local action.

### CTA behavior

In S1 the CTA is a direct HTTPS link to the founder-approved destination with
`rel="sponsored noopener noreferrer"` and no referrer. Reject credentials in
URLs, nonstandard schemes, localhost/private destinations, and unapproved
hosts. Do not insert arbitrary HTML from the sponsor. S2 may replace the href
with the same-origin `/go/<bookingId>` redirect after its tracking and safety
checks are ready. A confirmed booking cannot bypass URL vetting through a
sponsor edit.

---

## 6. Logo storage and safety

Add an R2 binding to the **web Worker only**, with separate local, preview,
and production buckets/configuration. Local development and tests use local
R2/Miniflare; no test or local preview writes to production R2. Admin upload
requires the X1 permanent-user-id allowlist, a valid session, same-origin
mutation protection, a bounded body, and server-side file validation. Accept
PNG, JPEG, or WebP only; reject SVG, GIF, HTML, and mismatched MIME/magic
bytes. Limit file size and dimensions in the implementation contract (suggest
512 KiB and 1024 × 1024); reject oversized input rather than serving it.
Generate an opaque, immutable R2 object key. Do not trust a submitted key or
filename as a path.

An unapproved draft logo can be previewed from the upload response in the
admin session. Its public route becomes available only after sponsor approval.

Serve logos through a same-origin web-Worker route using only keys attached to
approved sponsor creatives. Set a correct image content type,
`X-Content-Type-Options: nosniff`, and bounded public cache headers; never
return an R2 write URL or raw bucket key to the browser. HTML and sponsor
slots load no sponsor-hosted resources. The sponsor component accepts only its
own same-origin logo route, so existing avatar and Turnstile policies need not
be weakened. Unused logo objects can be cleaned up manually after confirming
no booking references them; cleanup is not part of public rendering.

---

## 7. Admin and vetting flow

Reuse X1's `ADMIN_USER_IDS` Worker secret and `requireAdmin` helper. The
allowlist uses permanent server-session user ids; no username or browser-sent
id grants access. Every `/admin/sponsors` page load and mutation fails closed:
signed-out users go to login, signed-in non-admins get 403. Admin pages are SSR,
`no-store`, `noindex`, excluded from sitemap and public navigation. Actions
validate every payload with Zod, check origin/CSRF protection, and derive the
actor from `locals.user`. A missing environment binding fails closed.

Admin flow:

1. Create the sponsor and enter name, tagline, exact CTA, and optional logo.
2. Apply the BRD policy checklist. Record a policy version and the founder's
   approval; a disallowed sponsor cannot be confirmed or rendered.
3. Choose a slot and period. Show existing confirmed bookings and next
   available dates. Enter the agreed flat price and currency from the
   off-platform agreement. Save a draft without reserving inventory.
4. Preview the draft in `home`, `lobby`, `result`, and `learn` component shells,
   at phone and desktop widths, showing the real disclosure and text-only
   fallback. Preview never makes it public.
5. After checking off-platform payment, explicitly confirm. Revalidate the
   sponsor, creative, interval, and overlap in the same write path. The public
   query begins serving it only when `starts_at` arrives.
6. To stop a placement, cancel with a reason. Preserve the booking row and
   actor/time. Verify the public response after cache invalidation.

The BRD checklist is authoritative. Proposed defaults until it is approved:
reject gambling, political campaigns, adult content, financial schemes,
khat/tobacco, and misleading claims; prioritize Somali-serving businesses.
Vetting is a human decision, not a keyword filter. A policy exception or policy
change requires the founder to update the BRD and reapprove affected creative.

---

## 8. Integration, release, and acceptance

### Implementation order

1. Confirm X1 has real production MAU/DAU and its admin allowlist has merged.
   Create and approve `docs/shaxda_brd.md` from V2 §15. Resolve the founder
   choices in §9.
2. In the first S1 implementation commit, apply V2 §6.3 to `AGENTS.md` and the
   PRD. Reconcile existing migrations, admin helper, and route/component names.
3. Add the hand-written D1 migration, Drizzle model/queries, trigger tests,
   and the web Worker R2 binding for each environment.
4. Add admin vetting, upload, preview, and booking flow; then the public read
   endpoint and shared component on the four surfaces.
5. Update Somali content and `/legal` before enabling a live booking. Test
   preview with local D1/R2; deploy migration and R2 bucket/binding to preview,
   then production using the existing operational runbook. No local test
   touches remote resources.

### Required verification

- Database/Workers tests: adjacent intervals succeed; every overlapping
  `confirmed` insert/update fails even from concurrent writes; draft overlap
  is allowed; cancellation frees time; start/end equality works; expired,
  unapproved, and cancelled rows never appear; active query uses its index.
- Route tests: signed-out/non-admin mutation denial; wrong origin/invalid
  payload denial; admin actor is server-derived; preview cannot publish;
  upload rejects SVG, MIME mismatch, oversize, and arbitrary keys; public DTO
  excludes private fields; cached response expires at start/end boundaries
  and is invalidated on admin change.
- Component tests: text-only creative, logo fallback, Somali disclosure,
  missing/offline response, keyboard focus, narrow screen, and no board or
  control obstruction. Result slot is absent during pending capture or blocked
  prompt and does not take focus from the primary result action.
- Playwright: a booked placement appears on all four surfaces for its period,
  disappears at its end without a deploy, and an unbooked slot is empty;
  repeat with local and online result flows. Use a controlled clock and local
  D1/R2 fixtures. Keep `pnpm check:e2e-isolation` passing.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:worker`,
  `pnpm build`, and `pnpm test:e2e` for the implementation. Documentation-only
  authoring of this spec does not claim those implementation checks passed.

### Release gate

The founder inspects a real, paid, approved booking in production on each
slot, including local and online game-over; confirms the Somali disclosure,
CTA, and optional first-party logo; and verifies that it disappears after the
booked period without deployment. Record the actual X1 audience figure used
in the sale. Do not report S1 viewable impressions or clicks as measured
numbers; S2 adds those definitions and instrumentation.

---

## 9. Founder decisions to lock before implementation

| Decision | Draft choice | Why it matters |
| --- | --- | --- |
| S1-D1 | Show `result` after both local and online games. | V2 §15 models the result slot on both modes; confirm the experience is acceptable. |
| S1-D2 | Put `home` below the hero. | Matches the S1 slot table in the brief. |
| S1-D3 | `month` means a UTC calendar month. | Removes ambiguity at month boundaries. |
| S1-D4 | Use the suggested BRD content exclusions in §7. | Founder must approve the actual policy. |
| S1-D5 | Label paid placements `Waxaa kafaala qaaday`. | Somali wording needs founder/language review. |
| S1-D6 | Render nothing in an unbooked slot until S3 adds `/sponsor`. | Avoids a broken sales link or an S3 page built early. |
| S1-D7 | Persist only `draft`/`confirmed`/`cancelled`; derive `live`/`ended`. | Scheduled delivery needs no cron and cannot drift from the clock. |

The first five choices are pending founder confirmation. Until then they are
explicit draft assumptions, not launch approval.
