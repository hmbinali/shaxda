# S1 — Sponsor Placements (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                               |
| Wave       | Pilot: starts only when the BRD is approved (Q5) and X1 has ≥ 30 days of production data; ships together with S2-min                                                                                                                                                                                                                                                                                         |
| Depends on | X1 (≥ 30 days of data), BRD (approved, Q5), S2-min (same release)                                                                                                                                                                                                                                                                                                                                            |
| Register   | F3, P14, Q2, Q5 ([register](README.md#decision-register))                                                                                                                                                                                                                                                                                                                                                    |
| Contracts  | Owns the sponsor tables, `GET /api/sponsor/active`, and the sponsor admin (§3). Consumes [§2.3](v2-contracts.md#23-public-match-id), [§6.5](v2-contracts.md#65-deploy-order), [§10.1](v2-contracts.md#101-one-cron-one-dispatcher), [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone), [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e), [§11](v2-contracts.md#11-migration-ownership) |
| Brief      | `docs/shaxda-v2.md` §6.3, §12 (S1), §15; [`docs/shaxda_brd.md`](../shaxda_brd.md) §3–§6                                                                                                                                                                                                                                                                                                                      |
| Touches    | `AGENTS.md`, `docs/shaxda_prd.md`, `packages/db`, `packages/shared`, `packages/i18n`, `web/` (component, routes, admin, `hooks.server.ts`), `web/wrangler*.jsonc`, e2e fixtures, `docs/ops/`                                                                                                                                                                                                                 |

S1 lets the founder vet a sponsor, freeze an approved creative version, and
book `lobby` or `result` for 7, 14, or 30 days; the placement then appears and
disappears by time. Views, clicks, `/go/<bookingId>`, and reports belong to
[S2](s2-sponsor-measurement-reports.md) (S2-min ships in the same release),
`/sponsor` to [S3](s3-sponsor-page.md), and policy, prices, fulfilment,
make-goods, and public claims to the [BRD](../shaxda_brd.md).

## 1. Outcome and non-goals

**Outcome.** After an off-platform payment the founder confirms a booking.
Every viewer of the slot sees it from `starts_at` until `ends_at` with a
Somali disclosure, and a cancellation leaves every response within 60 s, with
no deploy and no cache purge. If a placement conflicts with play, play wins.

### Must

1. Slots `lobby` and `result` as P14 and §4.3 define them; one confirmed
   booking per slot at any instant.
2. 7-, 14-, or 30-day periods (`ends_at = starts_at + N × 24 h`), half-open
   UTC intervals, overlapping confirmed bookings rejected by triggers.
3. Bookings reference an immutable creative version (§3.1) and serve it
   unless the founder explicitly switches them to another approved version.
4. Confirmation only while S2-min reporting is healthy for the booking (§3.6).
5. Allowlisted `/admin/sponsors` (sponsors, versions, logos, bookings,
   availability, preview) and public `GET /api/sponsor/active`, edge-cached
   ≤ 60 s and never past the next start or end, rendered by one `SponsorSlot`.
6. Placement safety (§4.3) and the visible disclosure `Waxaa kafaala qaaday`;
   no targeting, rotation, third-party script, pixel, or sponsor-hosted
   resource.
7. The first commit amends `AGENTS.md` and the PRD for V2 §6.3; `/legal`
   describes placements before the first live booking; kill switch
   `SPONSORS_ENABLED`.

### Should

Next available dates per slot, derived from confirmed bookings; a two-slot
preview at phone and desktop widths.

### Not in S1

`home` and `learn`, later inventory added only after the BRD §8 gates
(delivered bookings, player feedback, renewal interest), each with its own
migration and spec change; S2's measurement and `/go`; S3's `/sponsor`;
sponsor accounts, self-serve booking, in-app payment, invoices, and ad
networks; money handling (the agreed price is only a record).

## 2. Decisions and dependencies

| ID  | How S1 applies it                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| F3  | Pilot wave only, after the retention waves; no placement without S2-min measurement; a conflict with play is resolved for play.                       |
| P14 | Inventory, periods, the empty-slot rule, and the ≤ 60 s edge cache exactly as the register row states.                                                |
| Q2  | Open. S1 implements the recommendation (P14, local result included). An answer without local results removes only the `/local` wiring.                |
| Q5  | Open. Blocks the first paid booking, not the build: the content policy behind `SPONSOR_POLICY_V`, the quoted currency, and the `/legal` contact line. |

| Dependency | Provides                                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1         | X1a's `requireAdmin` and `ADMIN_USER_IDS` (permanent user ids, fail closed), the web entry wrapper, cron dispatcher, and `job_state`; ≥ 30 days of production audience data before selling (BRD §8). |
| S2-min     | `/go/<bookingId>`, the qualified-view observer inside `SponsorSlot`, the per-booking report, the 00:15 UTC rollup, and the reporting-health check (§3.6). Its migration runs after S1's.             |
| BRD        | Content policy and vetting checklist (§4), fulfilment (§5), make-goods (§6), prices (§7), public claims (§10). S1 builds the admin side of §4 and of §5 steps 2–3 and 6–8, and adds no policy.       |
| K1         | Its quick-match waiting screen, if shipped. S1 builds no quick-match UI.                                                                                                                             |

## 3. Contracts

S1 owns this section; S2 reads S1's tables and never writes them.

### 3.1 Schema

One hand-written migration (numbered at merge) with Drizzle definitions;
ids are 20 characters from the [§2.3](v2-contracts.md#23-public-match-id) generator.

```sql
CREATE TABLE sponsor (                          -- admin-only business record
  id TEXT PRIMARY KEY, label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  archived_at INTEGER, created_by TEXT NOT NULL, created_at INTEGER NOT NULL);

CREATE TABLE sponsor_creative (                 -- one version; immutable once approved
  id TEXT PRIMARY KEY, sponsor_id TEXT NOT NULL REFERENCES sponsor(id),
  version INTEGER NOT NULL CHECK (version >= 1),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  tagline TEXT NOT NULL CHECK (length(tagline) BETWEEN 1 AND 100),
  tagline_lang TEXT NOT NULL DEFAULT 'so', tagline_so TEXT,  -- BCP 47; Somali translation on file
  cta_url TEXT NOT NULL CHECK (cta_url LIKE 'https://%' AND length(cta_url) <= 2048),
  cta_host TEXT NOT NULL,                       -- vetted exact hostname
  logo_id TEXT,                                 -- R2 key sponsor-logo/<logo_id>; NULL = text only
  policy_v INTEGER, approved_by TEXT, approved_at INTEGER,    -- set together at approval
  created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE (sponsor_id, version), UNIQUE (id, sponsor_id),
  CHECK ((tagline_lang = 'so') = (tagline_so IS NULL)),
  CHECK ((approved_at IS NULL) = (approved_by IS NULL) AND (approved_at IS NULL) = (policy_v IS NULL)));

CREATE TABLE sponsor_booking (
  id TEXT PRIMARY KEY,                          -- public: response, /go, S2 reports
  sponsor_id TEXT NOT NULL REFERENCES sponsor(id), creative_id TEXT NOT NULL,  -- version served now
  slot TEXT NOT NULL CHECK (slot IN ('lobby','result')),
  period_days INTEGER NOT NULL CHECK (period_days IN (7,14,30)),
  starts_at INTEGER NOT NULL CHECK (starts_at % 3600000 = 0), ends_at INTEGER NOT NULL,  -- whole hours
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),      -- agreed off-platform; a record
  currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
  state TEXT NOT NULL CHECK (state IN ('draft','confirmed','cancelled')),
  created_by TEXT NOT NULL, created_at INTEGER NOT NULL, confirmed_by TEXT, confirmed_at INTEGER,
  cancelled_by TEXT, cancelled_at INTEGER, cancel_reason TEXT CHECK (length(cancel_reason) BETWEEN 1 AND 500),
  FOREIGN KEY (creative_id, sponsor_id) REFERENCES sponsor_creative (id, sponsor_id),
  CHECK (ends_at = starts_at + period_days * 86400000),
  CHECK ((state = 'draft') = (confirmed_at IS NULL) AND (confirmed_at IS NULL) = (confirmed_by IS NULL)),
  CHECK (confirmed_at IS NULL OR starts_at >= confirmed_at + 60000),  -- never backdated
  CHECK ((state = 'cancelled') = (cancelled_at IS NOT NULL) AND (cancelled_at IS NULL) = (cancelled_by IS NULL)
     AND (cancelled_at IS NULL) = (cancel_reason IS NULL)));

CREATE TABLE sponsor_booking_switch (           -- which version served when
  booking_id TEXT NOT NULL REFERENCES sponsor_booking(id), switched_at INTEGER NOT NULL,
  from_creative_id TEXT NOT NULL REFERENCES sponsor_creative(id), switched_by TEXT NOT NULL,
  to_creative_id TEXT NOT NULL REFERENCES sponsor_creative(id), PRIMARY KEY (booking_id, switched_at));

-- sponsor_booking_confirm_upd repeats this body as BEFORE UPDATE … WHEN NEW.state = 'confirmed'.
CREATE TRIGGER sponsor_booking_confirm_ins BEFORE INSERT ON sponsor_booking
WHEN NEW.state = 'confirmed' BEGIN
  SELECT RAISE(ABORT, 'sponsor_creative_not_approved') WHERE NOT EXISTS (SELECT 1 FROM sponsor_creative
    WHERE id = NEW.creative_id AND approved_at IS NOT NULL);
  SELECT RAISE(ABORT, 'sponsor_booking_overlap') WHERE EXISTS (SELECT 1 FROM sponsor_booking b
    WHERE b.slot = NEW.slot AND b.state = 'confirmed' AND b.id <> NEW.id
      AND b.ends_at > NEW.starts_at AND b.starts_at < NEW.ends_at);
END;

CREATE INDEX sponsor_booking_slot_idx ON sponsor_booking (slot, state, ends_at);  -- public read, overlap
CREATE INDEX sponsor_booking_sponsor_idx ON sponsor_booking (sponsor_id, starts_at);
CREATE INDEX sponsor_booking_start_idx ON sponsor_booking (starts_at);
CREATE INDEX sponsor_creative_logo_idx ON sponsor_creative (logo_id);
```

Two more trigger pairs (before update and delete) keep history fixed.
`sponsor_booking_frozen` rejects deleting a non-draft booking, any change to
one other than `creative_id` (a switch) or the move to `cancelled` with its
three fields, and any change at all once it is cancelled or past `ends_at` by
the database clock. `sponsor_creative_frozen` raises
`sponsor_creative_immutable` on any change to an approved version. D1 runs each statement with its triggers atomically, so
concurrent confirmations cannot both pass the overlap check; a switch writes
its log row and the new `creative_id` in one batch.

### 3.2 Public response

`GET /api/sponsor/active` returns `sponsorActiveResponseSchema`
(`packages/shared`): `{ v: 1, generatedAt, validUntil, slots: { lobby, result } }`.
`generatedAt` is the server time of the read, `validUntil = generatedAt + TTL`,
and each slot is `null` or `{ bookingId, name, tagline, taglineLang, ctaHost,
logoUrl, endsAt }`, where `logoUrl` is `/api/sponsor/logo/<logoId>` or `null`
and times are UTC milliseconds. Nothing else leaves the server: no price,
currency, sponsor or version id, label, translation, policy version, actor,
CTA URL, or start time. Clients `safeParse` and render nothing on failure; a
later slot is an additive key that cached clients strip.

### 3.3 Routes

| Route                                                                                    | Access                                      | Cache                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `GET /api/sponsor/active`                                                                | everyone, the same response                 | `public, max-age=0, s-maxage=<TTL>`; errors `no-store` |
| `GET /api/sponsor/logo/<logoId>`                                                         | everyone; approved versions only            | `public, max-age=86400`, `nosniff`; 404 `no-store`     |
| `/admin/sponsors`, `/admin/sponsors/<sponsorId>`, `/admin/sponsors/bookings/<bookingId>` | admin; signed out → login; not listed → 403 | `no-store`, `noindex`                                  |
| `POST /admin/sponsors/logo` (raw image body, returns `{ logoId }`)                       | admin                                       | `no-store`                                             |
| `GET /admin/sponsors/logo/<logoId>` (any stored logo, for draft previews)                | admin                                       | `private, no-store`                                    |

The public routes join `/local` and `/online` in `hooks.server.ts`'s
session-free route set: no Better Auth lookup, no cookie, the same bytes for
every viewer. Admin routes call X1a's `requireAdmin` on every load, action,
and request; check `Origin` against `canonicalAuthOrigin(env.AUTH_BASE_URL)`
on every mutation (SvelteKit's form check misses the raw upload); validate
payloads with Zod; take the actor from `locals.user.id`; stay out of the
sitemap and navigation; and answer 503 without `DB` or `SPONSOR_ASSETS`.

### 3.4 Creative rules

| Rule           | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Text           | Name and tagline are one trimmed line with no control or bidirectional-override characters, always rendered escaped.                                                                                                                                                                                                                                                                                                                                         |
| CTA            | `sponsorCtaUrlSchema` (`packages/shared`; S2's `/go` reuses it), checked at approval, confirmation, and switch: `https:`; no credentials or port; a dotted DNS hostname that is not an IP literal, `localhost`, or under `.localhost`, `.local`, `.internal`, `.test`, `.example`, `.invalid`, or `.home.arpa`; equal to `cta_host`; at most 2,048 characters.                                                                                               |
| Logo           | At most 256 KiB (from `Content-Length`, enforced while reading); `image/png`, `image/jpeg`, or `image/webp` matching its magic bytes; static (APNG `acTL` and animated WebP fail); 1–512 px per side from the header; SVG, GIF, HTML, and mismatches fail. The server picks `logoId`, stores `sponsor-logo/<logoId>` with the validated type, and ignores submitted names and keys. Cards show it in a 48 × 48 px box with `alt=""`, as the name is visible. |
| Policy version | `SPONSOR_POLICY_V` (`packages/shared`) is the BRD §4 policy version: 1 when Q5 approves the policy, bumped in the commit that changes BRD §4. Approval stores it; confirmation and switch require equality.                                                                                                                                                                                                                                                  |

### 3.5 Configuration

Per [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone), in
`App.Platform["env"]`: R2 `SPONSOR_ASSETS` (a bucket per environment);
`SPONSOR_RATE_LIMIT` (120 per 60 s per key, shared with S2) through X1's
limiter helper, which answers 503 in every built Worker whose binding is
missing (allowed only under `vite dev`), so the public read degrades to no
card, never a visible error; and the var `SPONSORS_ENABLED`, on only when
exactly `"true"`.

### 3.6 S2-min interface

- S2 reads `sponsor_booking` and the booking's current version; its migration
  references `sponsor_booking(id)`. S1's query module exports the live
  predicate (`state = 'confirmed' AND starts_at <= now < ends_at`) for S2's
  view and `/go` checks.
- **Reporting health.** S2's `sponsorReportingHealth(env, db, bookingId)`
  returns four results, and confirmation requires all four to pass: (a) S2's
  report for the booking loads (empty before it starts); (b) the `s2.nightly`
  job's `job_state.last_success_at` is under 26 hours old
  ([§10.1](v2-contracts.md#101-one-cron-one-dispatcher)); (c) `ANALYTICS_SALT`
  is present and long enough (at least 32 characters, X1); (d) the
  `SPONSOR_RATE_LIMIT` binding is present (or the Worker runs under
  `vite dev`). The booking page shows all four results; the check fails closed
  until S2-min lands. Later reporting failures never stop display; S2 records
  them as gaps.

## 4. Behaviour and failure handling

### 4.1 Booking lifecycle

Persisted states are `draft`, `confirmed`, and `cancelled`. Admin derives
`upcoming`, `live` (`starts_at <= now < ends_at`), and `ended` from the server
clock; no job changes a state.

| Action                       | Server preconditions                                                                                                                                           | Effect                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Edit sponsors and drafts     | Archiving needs no upcoming or live booking; draft bookings may overlap anything                                                                               | Drafts hold no inventory; archived sponsors leave the pickers                                     |
| Approve a version            | CTA valid; the five BRD §4 checklist items ticked                                                                                                              | `policy_v`, approver, time; immutable from then on                                                |
| Confirm ("payment received") | Approved version of this sponsor at the current policy; CTA valid; start a whole UTC hour ≥ 60 s ahead; no overlap; all four S2-min health results pass (§3.6) | `confirmed` with actor and time                                                                   |
| Switch version               | Confirmed, not ended; approved target of the same sponsor at the current policy; CTA valid                                                                     | Log row and new `creative_id` in one batch; public within 60 s                                    |
| Cancel                       | Confirmed, not ended; reason of 1–500 characters                                                                                                               | `cancelled` with actor, time, reason; interval freed; admin shows "gone by" `cancelled_at + 60 s` |

Admin shows UTC instants with local time beside them, whether
`SPONSORS_ENABLED` is on, and trigger errors as §7 messages. Preview renders
the real `SponsorSlot` with the version passed in, in lobby and result shells
at 360 px and 1,024 px. Make-goods (BRD §6) are recorded outside the app;
extra display time can only be booked as another 7-, 14-, or 30-day period.

### 4.2 Delivery, cache, and client

Server, with one `now` per request:

1. `SPONSORS_ENABLED` not `"true"` → empty slots, TTL 60 s, no D1 read. A
   query string → 400; over `SPONSOR_RATE_LIMIT` (key `active:` + IP) → 429;
   a missing binding in a built Worker → 503 (§3.5); all `no-store`, and
   clients render each as no card.
2. One read of confirmed bookings in both slots with `ends_at > now`, joined
   to their versions; a row is live when `starts_at <= now`.
3. TTL = `min(60, floor((nextBoundary − now) / 1000))` seconds, where
   `nextBoundary` is the earliest live end or upcoming start; 0 sends
   `no-store`. The adapter's worker keeps a cacheable reply in that data
   centre's `caches.default` and serves repeats without SvelteKit or D1.

So a cancellation, switch, or kill-switch change reaches every response
within 60 s, and starts and ends are exact: confirmation comes at least 60 s
before the start, and no TTL crosses a known boundary. The adapter skips the
cache for requests with `Cache-Control: no-cache`, which browsers send for the
`fetch` modes `no-store` and `reload`, so the client uses the default mode;
the limiter (misses only) bounds deliberate bypasses. The service worker
never caches the route.

Client: `SponsorSlot` (`web/src/lib/components/sponsor/`) gets a slot and an
`eligible` flag from its surface; S2 adds its visibility observer to it.

| Step  | Rule                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fetch | Default cache mode, `credentials: "omit"`, when the slot becomes eligible and `navigator.onLine` is not `false`. Game code never awaits it; an error renders nothing until the next refresh.                                                                                                                                                                                                      |
| Show  | `slots[slot]` while the device clock is before `endsAt`. While eligible and visible, refetch at `validUntil`, clamped to 5–60 s after the last response; an open page drops a cancelled card then.                                                                                                                                                                                                |
| Card  | Disclosure text first, then name, tagline with its `lang`, the vetted host, and the optional logo. One link to `/go/<bookingId>` with `target="_blank"`, `rel="sponsored noopener noreferrer"`, and preloading off, so a room or result is never lost; its accessible name has the sponsor name and the new-window note. No live region. A failed logo leaves the text-only card in the same box. |

### 4.3 Placement safety

| Surface  | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lobby`  | In the `/online` waiting section (`data-testid="online-lobby"`) below the room code and share controls, only while the room has not started, and on K1's waiting screen below the queue status. It never replaces the invite link or queue status.                                                                                                                                                                                                                                        |
| `result` | In `GameResultOverlay`'s panel below the result text and actions, online and on `/local` only while online. The panel exists only at `gameOver`, when the board takes no input, so the card never shows during play, a pending capture, or the blocked-player (space-making) prompt. The primary action keeps initial focus and comes first in tab order. The panel is top-anchored, so a late card never moves the text or actions; on short screens the overlay scrolls, actions first. |
| Both     | Offline or a failed fetch shows nothing, not an error. Nothing delays a move, the result, a rematch, or a new game.                                                                                                                                                                                                                                                                                                                                                                       |

### 4.4 Failures

| Failure                     | Behaviour                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 error on the public read | 503 `no-store`; clients show nothing and retry at their next refresh; logged without ids; the founder records an S2 `displayOutage` gap (BRD §6) |
| R2 error                    | Logo route 503 `no-store`; the card stays text-only                                                                                              |
| Trigger rejection           | Refused with the mapped Somali message; nothing written                                                                                          |
| Reporting unhealthy         | Confirm stays disabled and shows all four results, failing ones marked                                                                           |

## 5. Privacy and access

No [§5 access-matrix](v2-contracts.md#5-access-matrix) row applies: S1 reads
no match data and no account data beyond the admin session; access is the
§3.3 route table. The public endpoint takes no parameters, reads no session,
and sets no cookie, so no identity, account state, room, language, or
location can influence it, and it returns only §3.2's fields. Sponsor contacts
stay outside the app (BRD §5); actor ids appear only in admin; S1 logs no
viewer data; the browser loads nothing from a sponsor's host until a click.

## 6. Resource budget

| Item                               | Cost                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public read (D1)                   | At most one per data centre per TTL (≤ 60 s), plus `no-store` seconds before a boundary and rate-limited bypasses; rows: live and upcoming bookings with their versions                                                         |
| Worker requests                    | One per eligible surface shown plus one a minute while it stays open: about two per online room (waiting screen, result) and one per local game over                                                                            |
| Logos                              | One D1 lookup and one R2 read per data centre per logo per day; at most 256 KiB, cached a day by browsers                                                                                                                       |
| D1 writes and storage              | Admin only, about five writes per booking and none per view; a few rows per sponsor, version, and booking; at most 256 KiB of R2 per logo                                                                                       |
| Durable Objects, cron, game Worker | None                                                                                                                                                                                                                            |
| Query plans                        | Recorded by the migration test: the public read and overlap check use `sponsor_booking_slot_idx`, the logo check `sponsor_creative_logo_idx`, and the admin lists `sponsor_booking_sponsor_idx` and `sponsor_booking_start_idx` |

## 7. Somali copy

Keys live in `packages/i18n` behind `TODO(translation-review)` and reuse the
Q4 glossary drafts.

| Key                                                          | Draft                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `sponsor.label`                                              | Waxaa kafaala qaaday                                                                               |
| `sponsor.opensNewWindow`                                     | Wuxuu ku furmayaa daaqad cusub                                                                     |
| `adminSponsors.title`                                        | Maamulka kafaalada                                                                                 |
| `adminSponsors.renderingOff`                                 | Muujinta kafaalada waa damsan tahay.                                                               |
| `adminSponsors.states.{draft,upcoming,live,ended,cancelled}` | Qabyo · Soo socda · Hadda socda · Dhammaaday · La joojiyey                                         |
| `adminSponsors.actions.{approve,confirm,switch,cancel}`      | Ansixi nuqulkan · Lacagta waa la helay — xaqiiji · Beddel nuqulka · Jooji ballanta                 |
| `adminSponsors.errors.overlap`                               | Booskan waa la qabsaday muddadaas. Dooro waqti kale.                                               |
| `adminSponsors.errors.notApproved`                           | Nuqulkan weli lama ansixin.                                                                        |
| `adminSponsors.errors.frozen`                                | Ballan la xaqiijiyey ama nuqul la ansixiyey lama beddeli karo.                                     |
| `adminSponsors.errors.policyOutdated`                        | Nuqulkan waxaa lagu ansixiyey siyaasad hore. Ansixi nuqul cusub.                                   |
| `adminSponsors.errors.startTooSoon`                          | Bilowgu waa inuu noqdaa saacad buuxda oo mustaqbalka ah.                                           |
| `adminSponsors.errors.reportingUnhealthy`                    | Warbixinta kafaalada ma shaqaynayso; ballanta lama xaqiijin karo.                                  |
| `adminSponsors.errors.upload`                                | Sawirka lama aqbalin: PNG, JPEG ama WebP aan dhaqdhaqaaq lahayn, ugu badnaan 256 KB iyo 512 × 512. |
| `adminSponsors.previewNote`                                  | Muuqaal hore — dadweynaha lama tusin.                                                              |

`/legal` (slice 9, before the first live booking; S2 adds its own paragraph,
and the contact placeholder waits for Q5): in the `adeegyada` bullets,
replace the sentence ruling out advertising and commercial sponsorship with
"Shaxda ma iibiso xogta martida ama akoonka, mana isticmaasho shabakado
xayeysiis, lacag bixin gudaha adeegga, ama xiriir iib."; where the page lists
what D1 holds, add "Kaydka D1 wuxuu sidoo kale hayaa diiwaanka kafaalada, oo
aan lahayn xog ciyaartoy."; and add:

> Shaxda waxay muujin kartaa kaar kafaala oo ka yimid ganacsi ay hubisay,
> kaliya shaashadda sugitaanka ciyaarta khadka iyo shaashadda natiijada kadib
> ciyaar — marnaba inta ciyaartu socoto. Kaarku had iyo jeer wuxuu wataa
> "Waxaa kafaala qaaday", qof kasta oo arkana wuxuu arkaa isla
> kafaala-qaadaha; akoonkaaga iyo xog kale looma isticmaalo doorashadiisa.
> Sawirka iyo qoraalka waxaa kaydiya Shaxda; bogga kuma soo rarmo koodh, pixel
> raad-raac ah, ama sawir ka yimid kafaala-qaadaha.

## 8. Implementation slices

1. `docs: allow first-party sponsor placements under V2 §6.3` — AGENTS "No
   Monetization" and the PRD's monetization lines (§3, §6, §12, §26) allow
   direct-sold `lobby` and `result` placements under §1 Must 6, and R2 for
   sponsor logos only.
2. `test(db): cover sponsor overlap, freezing, and version immutability`
3. `feat(db): add sponsor tables, triggers, and queries`
4. `feat(shared): add sponsor schemas, CTA validator, and policy version`
5. `feat(web): add sponsor logo storage and routes`
6. `feat(web): add sponsor admin for vetting, booking, and preview` (the
   confirm gate fails closed until S2-min lands)
7. `feat(web): serve active sponsors with a 60 s edge cache`
8. `feat(web): show sponsor placements in the lobby and result panel`
9. `feat(i18n): describe sponsor placements on the legal page`
10. `test(e2e): cover booked, empty, and cancelled placements`
11. `docs(ops): add sponsor rollout, takedown, and kill-switch steps`

S2-min's slices land between 6 and 10 in the same release. Each code slice
runs `pnpm lint`, `typecheck`, `test`, `test:worker`, `build`, and `test:e2e`.

## 9. Acceptance tests

S1 shows, counts, rates, replays, and deletes no match, so the M1–M10 sample
table does not apply. Workers and D1 tests run on Miniflare, locally only.

| Level                                      | Must pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                                       | CTA: `https://dukaan.so/x` passes for host `dukaan.so`; `http:`, credentials, a port, IP literals, the §3.4 reserved names, another host, and 2,049 characters fail. TTL: 60 with no boundary within a minute, capped at the next start or end, 0 → `no-store`; live at `starts_at`, not at `ends_at`. Upload: PNG, JPEG, and WebP pass; SVG, GIF, HTML, a mismatched type, APNG, animated WebP, 256 KiB + 1 byte, and 513 px fail.                                                                                                                                                                                                                                                                |
| D1 intervals                               | Adjacent bookings (one `ends_at` equals the next `starts_at`) both confirm; every overlapping confirmed insert or update fails; two concurrent confirmations of overlapping drafts leave exactly one confirmed; drafts overlap freely; cancelling frees the interval; only 7-, 14-, and 30-day periods, whole-hour starts, and confirmations at least 60 s ahead pass.                                                                                                                                                                                                                                                                                                                             |
| D1 immutability                            | Every update or delete of an approved version fails; drafts edit and delete; a confirmed booking rejects an unapproved or foreign version, changed terms, and deletion; a cancelled or ended row never changes; a switch writes one log row and the next response serves the new version.                                                                                                                                                                                                                                                                                                                                                                                                          |
| Confirm gate                               | Refused while `sponsorReportingHealth` is not `ok` (each of its four checks failing in turn, or S2-min absent) or `policy_v` is stale; allowed when all pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Endpoint (injected `now`)                  | The right live row per slot; draft, cancelled, upcoming, and ended rows absent; exactly the §3.2 fields; `validUntil` and `Cache-Control` match the TTL; query string → 400; kill switch → empty with no D1 read; limit → 429; missing limiter binding in a built Worker → 503 and no card; D1 error → 503; no `Set-Cookie`; the plan uses `sponsor_booking_slot_idx`.                                                                                                                                                                                                                                                                                                                             |
| Cache path                                 | Built worker under local `wrangler dev` (the proof-E3 method): repeats within the TTL share `generatedAt` and a later request does not; a `Cache-Control: no-cache` request bypasses; a cancellation in local D1 is gone once the TTL passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Routes and admin                           | Approved logo → image with its stored type; draft, unknown, or malformed id → 404 `no-store`. Signed out → login and not listed → 403 on every admin page, action, upload, and logo; wrong `Origin` → 403; invalid payload → 400; a submitted actor is ignored; missing binding → 503.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Web                                        | Text-only and logo cards; a failed logo keeps the box; the disclosure stays visible at 320 px and 200 % text; link name, `target`, `rel`, and `lang` set. The result slot is absent during play, a pending capture, and the blocked-player prompt, and present at game over; the primary action keeps focus and position when the card arrives; `/local` makes no request and shows no card while offline. The lobby slot sits below the share controls only before the room starts. Refresh follows `validUntil` (5–60 s, paused while hidden); the card hides once the device clock passes `endsAt`; the fetch uses the default cache mode; the service worker precaches no `/api/sponsor/` URL. |
| E2E (Playwright, local D1 and R2 fixtures) | A seeded live booking appears on the `/online` waiting screen and the online and `/local` result panels; an unbooked slot renders nothing; a local game finished offline shows no card; the admin path (sponsor → logo → version → preview → approve → booking → confirm) works with a healthy S2 fixture and is blocked by an unhealthy one; a cancellation leaves an open result panel at its next refresh (`page.clock`); `pnpm check:e2e-isolation` stays green.                                                                                                                                                                                                                               |

## 10. Rollout and rollback

Bindings and flags are §3.5's. Deploy order
([§6.5](v2-contracts.md#65-deploy-order)): S1's migration, S2-min's migration,
then one web deploy. The migration is additive.

| Environment | D1                                                                    | `SPONSOR_ASSETS` (R2)           | `SPONSORS_ENABLED`                          | `SPONSOR_RATE_LIMIT`                                       | Verification                                                                                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------- | ------------------------------- | ------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev         | Miniflare, migrated by tests                                          | local                           | `"true"`, documented in `.dev.vars.example` | optional: only `vite dev` may run without it               | Unit, D1, web, and built-worker cache tests                                                                                                                                                                                                                                            |
| e2e         | shared local D1 ([§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)) | local, in the e2e state         | `"true"` in `wrangler.e2e.jsonc`            | bound, declared in `wrangler.e2e.jsonc` (local simulation) | Playwright (§9)                                                                                                                                                                                                                                                                        |
| preview     | `shaxda-db-preview`                                                   | `shaxda-sponsor-assets-preview` | `"true"`                                    | bound                                                      | Confirm a preview-only test booking, check both slots at phone and desktop widths, cancel it, and time its disappearance (≤ 60 s). If the `workers.dev` host does not cache, record that; the built-worker test stays the cache evidence.                                              |
| production  | `shaxda-db`                                                           | `shaxda-sponsor-assets`         | `"false"` until the first live booking      | bound                                                      | Before selling: `/legal` shipped, empty slots, and two reads within a minute share `generatedAt` while a later one does not. First sale per BRD §5: set the var to `"true"` before the start; the founder spot-checks the start on both slots, online and local, on phone and desktop. |

**Kill switch.** Any other `SPONSORS_ENABLED` value, set by a configuration
deploy, hides placements within 60 s; admin and bookings are untouched, and
the founder records the window as an S2 `displayOutage` gap on each live
booking (BRD §6). **Rollback.** Kill switch first, then a web Worker version
rollback if code is at fault (older versions have no endpoint, so clients
render nothing); the tables stay.

**Done when** the ops record shows a real, paid, approved booking displayed
on `lobby` and `result` (online, and local while online) in production for its
period and ended without a deploy, with the Somali disclosure, a working `/go`
link, and a working S2-min report; `/legal` describes placements; and the 60 s
takedown bound was verified on preview or locally. S1 claims no views or
clicks; audience figures in a sale come from X1, dated and rounded down
(BRD §10).
