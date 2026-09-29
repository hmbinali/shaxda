# S3 — Sponsor Page (Spec)

| Field      | Value                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                |
| Wave       | Pilot: S3a once S1 and S2-min are live; S3b after a first booking is delivered and reported ([BRD §8](../shaxda_brd.md#8-evidence-gates)). The PDF is Later.                                                  |
| Depends on | S1, S2-min; S3b after a delivered report                                                                                                                                                                      |
| Register   | F3, P14, Q3, Q5 ([register](README.md#decision-register))                                                                                                                                                     |
| Contracts  | Owns the `/sponsor` route and its config (§3). Consumes the [metrics dictionary](v2-contracts.md#9-metrics-dictionary) for S3b claims. No [access-matrix](v2-contracts.md#5-access-matrix) row; no migration. |
| Brief      | `docs/shaxda-v2.md` §6.3, §12 (S3); [BRD](../shaxda_brd.md) §3–§8, §10                                                                                                                                        |
| Touches    | `web/` (`/sponsor` route and config, top bar, footer, PWA precache list), `packages/shared` (config schema), `packages/i18n` (Somali copy), tests; Later: a PDF script                                        |

S3 gives a Somali business one public page to learn about the sponsor pilot
and write to the founder. **S3a** is the pilot contact page, with no prices and
no numbers. **S3b** adds a dated rate card and, only when the founder approves
them, measured claims. S1 owns slots, bookings, creatives, and the admin; S2
owns measurement and reports; the [BRD](../shaxda_brd.md) owns prices, policy,
fulfilment, and the truthful-claims rule. S3 reads no database, adds no
endpoint, and stores nothing.

## 1. Outcome and non-goals

### Outcome

A business opens `/sponsor`, learns what Shaxda is, where a sponsor appears,
how play is protected, what the policy excludes, and how a booking works, then
writes to the founder by email or WhatsApp. Nothing on the page reserves a
slot. After a first delivered report, S3b adds dated list prices and approved
measured numbers with their definitions.

### Must — S3a pilot contact page

1. Public, Somali-only, prerendered `/sponsor`: no server load, action,
   endpoint, or D1 read; the same HTML for every visitor (§3.1).
2. The §3.3 content, with fictional, labelled mockups of `lobby` and `result`,
   and no audience or delivery number, price, or currency anywhere.
3. Contact only through the Q5-approved email and/or WhatsApp, as plain links
   showing the address as text; no form, endpoint, or lead storage (§3.5).
4. Navigation and footer links apart from every play action; `PageMeta` with
   the first-party `/og-image.png` (§3.6).
5. Semantic headings, visible focus, text alternatives, existing contrast
   tokens, no horizontal scroll at 320 px, no animation, a print stylesheet,
   and no resource from another origin.
6. One validated config: an invalid or placeholder value fails the build, so it
   cannot publish (§3.2).

### Must — S3b rate card

7. A dated rate card from the same config: every live slot × 7, 14, and 30
   days, with the ISO currency code beside every amount (§3.7).
8. Founder-approved measured claims only: X1 active browsers or active
   accounts over 30 days, and S2 qualified views for a named slot and UTC
   dates, each rounded down, dated, and defined. No other number.

### Should

- A printable PDF made from the page's print view, and so from the same
  config (Later wave, after S3b). Never edited by hand.

### Not in S3

- Booking, availability, checkout, payment, invoices, quotes, or sponsor
  accounts (V2 brief §5); a house card in an empty slot (P14); `home` or
  `learn` slots or mockups ([BRD §3](../shaxda_brd.md#3-pilot-inventory), §8).
- Enquiry forms, storage, or analytics events; changes to S1 placement or
  booking rules or to S2 measurement; English copy (F8).
- Any modelled, projected, or founder-estimated figure (the BRD §2 planning inputs and Q3 inputs included); fair-rate, market-rate, cost-per-thousand, or
  guaranteed-view claims; customer lists or testimonials
  ([BRD §10](../shaxda_brd.md#10-truthful-claims)).

## 2. Decisions and dependencies

### Register

| ID  | How S3 applies it                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F3  | The pilot page ships first and makes no numeric claim; prices wait for a delivered booking; every later number is measured.                                                                            |
| P14 | Two slots, `lobby` and `result` (a local result only while online); periods of 7, 14, and 30 days; an empty slot renders nothing, so only navigation leads to `/sponsor`. S1 owns the ≤ 60 s takedown. |
| Q3  | Founder inputs (weekly players and games, play times, budget) are planning inputs and never appear on `/sponsor`, in its metadata, or in the PDF.                                                      |
| Q5  | The contact channel and content-policy list gate S3a publication; prices and currency gate S3b. Until S3b, the page says to get in touch for prices.                                                   |

### Dependencies

| Dependency                                                    | Provides                                                                                                                                                        | Needed by            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| [S1](s1-sponsor-placements.md), live in production            | The live inventory (P14, as Q2 confirms it), the disclosure string, the presentational sponsor card, placement rules, and `/legal` text that allows sponsorship | S3a                  |
| [S2](s2-sponsor-measurement-reports.md)-min, live             | The report the process copy promises; the qualified-view term and definition                                                                                    | S3a copy, S3b claims |
| [BRD](../shaxda_brd.md) approved (Q5)                         | Policy and vetting (§4), fulfilment (§5), the per-period basis (§6), the contact channel; prices and currency (§7) for S3b                                      | S3a, S3b             |
| A first booking delivered and reported (BRD §8)               | The S3b publication gate                                                                                                                                        | S3b                  |
| [X1](x1-product-analytics.md), through S1 (≥ 30 days of data) | The 30-day active-browser and active-account gauges on `/admin/stats` ([metrics dictionary](v2-contracts.md#9-metrics-dictionary))                              | S3b claims           |

## 3. Contracts

### 3.1 Route

- `web/src/routes/sponsor/+page.ts` exports `prerender = true`; the folder has
  no `+page.server.ts`, `+server.ts`, or form action. The page imports the
  validated config (§3.2), so prerendering fails on an invalid file.
- The HTML and its `__data.json` are static assets served before the web Worker
  runs (`web/wrangler.jsonc` has no `run_worker_first`): no session lookup.
- Excluded from the service-worker precache (`workbox.globIgnores` in
  `web/vite.config.ts`), so a contact or price change reaches every visitor on
  the next load, as for the server-rendered `/learn` and `/legal`.
- Indexable: S3 adds no `noindex` and no robots rule.

### 3.2 Config

Data file `web/src/lib/sponsor/sponsor-page.json` (values only; copy stays in
`packages/i18n`); `sponsorPageConfigSchema` and `roundDownForClaim` in
`packages/shared/src/sponsor/page-config.ts`. Every object is strict, so an
unknown key (a summed total, a free-form URL) fails.

| Field              | Rule                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `version`          | Positive integer, +1 on every change.                                                                                                                              |
| `contact.email`    | Optional. A valid address whose domain is not `example.*`, `*.invalid`, `*.test`, `*.local`, or `localhost`.                                                       |
| `contact.whatsapp` | Optional. Digits only, 8–15, no leading `0`; the page builds the link, so the file holds no URL. At least one channel is present (Q5).                             |
| `rateCard`         | S3b only: `validFrom` (UTC date the prices take effect); `currency`, an ISO 4217 code known to `Intl.supportedValuesOf("currency")` (review checks the BRD's, Q5). |
| `rateCard.prices`  | `{ <slot>: { "7d", "14d", "30d" } }` for every live slot of S1's slot enum; positive integers in minor units. Equal prices are written twice.                      |
| `claims`           | S3b only, a list. Audience: `kind` `activeBrowsers30d` or `activeAccounts30d`, `value`, `windowEnd` (last UTC day of the 30-day window).                           |
| `claims` (views)   | `kind: "qualifiedViews"`, `slot`, `value`, `from`, `to`: the UTC days of one S2 booking report, at most 31.                                                        |
| `value`            | At least 10, and `roundDownForClaim(value) === value`.                                                                                                             |
| Every date         | Valid `YYYY-MM-DD`, not after the build date; `from ≤ to`.                                                                                                         |
| Every string       | No `[`, `]`, `TODO`, `TBD`, `pending`, `placeholder`, `example`, or `xxx` (any case), so the repository's `[EMAIL XIRIIRKA]` style cannot publish.                 |

`roundDownForClaim(n)` uses a unit of 10 below 1,000, 100 below 10,000, and
1,000 from 10,000, and returns `floor(n / unit) × unit`. Counts under 10 are
not published.

### 3.3 Page content and order

| #   | Section `id` | Content                                                                                                                                                                                      | Source                  |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | `intro`      | Heading, what Shaxda is, an in-page link to `#contact`                                                                                                                                       | Copy                    |
| 2   | `placements` | Each live slot: its Somali name, the surface, a mockup (§3.4)                                                                                                                                | S1 as deployed; P14     |
| 3   | `play`       | Never covers the board or controls; never during play, a pending capture, or a blocked player; never slows a move; labelled; same sponsor for all; first-party creative; empty shows nothing | S1; BRD §1, §3, §4      |
| 4   | `policy`     | Priority for Somali businesses, the exclusions, the vetting summary                                                                                                                          | BRD §4 as approved (Q5) |
| 5   | `process`    | Enquiry, vetting, preview, written agreement, off-platform payment, display by time, report; periods of 7, 14, 30 days; a price buys a period, not views                                     | BRD §5, §6; P14         |
| 6   | `price`      | S3a: "get in touch for prices". S3b: the rate card (§3.7)                                                                                                                                    | BRD §7                  |
| 7   | `claims`     | S3b only, when the config holds approved claims (§3.7)                                                                                                                                       | X1, S2                  |
| 8   | `contact`    | The links (§3.5) and "a message books nothing"                                                                                                                                               | Config (Q5)             |

### 3.4 Mockups

- One `<figure>` per live slot, never `home` or `learn`: a static sketch of the
  surface (waiting-screen buttons; a finished game's heading and buttons) with
  S1's presentational sponsor card where S1 places it, showing the fictional
  creative from copy, no logo or destination, and S1's disclosure string. If
  S1 ships the card and its fetch as one component, S3a splits them first.
- The frame is `inert` and `aria-hidden` (nothing focusable, no fetch, no S2
  observer, no `/go` link); the `<figcaption>` holds `mockup.caption` and the
  slot's text alternative. No number, date, or reach wording on a mockup, and
  never a pending capture or blocked prompt.

### 3.5 Contact links

- Email: `mailto:<email>?subject=<subject>&body=<message>`, each part through
  `encodeURIComponent`; the link text is the address. WhatsApp:
  `https://wa.me/<digits>?text=<message>` with `rel="noopener noreferrer"` and
  `referrerpolicy="no-referrer"`; the link text is `+<digits>`.
- Email comes first when both exist, each after a Somali label. Plain anchors:
  no JavaScript handler, `target`, or tracking parameter; the message is fixed
  copy with no visitor, device, or page data.

### 3.6 Navigation and metadata

- `contentPagesGroup()` in `web/src/lib/shell/topBarConfig.ts` is
  `pagesGroup()` plus the legal and sponsor links; `defaultTopBar()` uses it.
  `pagesGroup()`, reused in the `/local` and `/online` game menus, is unchanged.
- `/sponsor` registers a top bar with one menu action opening
  `contentPagesGroup()` and no account panel: prerendered layout data carries
  the build-time signed-out state (`+layout.server.ts` returns `account: null`
  while building).
- A new `SiteFooter` with one sponsor link ends `/`, `/learn`, and `/legal`
  (after the hero on `/`, apart from its play buttons). It is not in the root
  layout, so game, account, profile, and admin pages never show it. No slot,
  board, lobby control, result panel, or dialog links to `/sponsor`.
- `PageMeta` with `path: "/sponsor"`: canonical URL and Open Graph/Twitter tags
  with the first-party `/og-image.png`; no sponsor creative or mockup image,
  and no number or price in the description.

### 3.7 S3b: rate card and claims

- **Rate card.** A row per live slot (Somali name), a column per period; each
  cell is the amount formatted by `Intl.NumberFormat` for the currency's minor
  digits, then the ISO code, never a bare symbol. The heading shows
  `validFrom`; narrow screens show cards. It replaces the S3a price text.
- List prices only: the written agreement and S1's stored booking price govern
  each booking, and a config change never rewrites a booking or sent quote. No
  discount, tax, conversion, or bundle statement unless the BRD approves it.
- **Claims.** One line each: "about" the value, its dates, its definition (§7).
  Browsers and accounts stay separate, never combined or called people.
  Qualified views name the slot and UTC dates, never the sponsor. One "rounded
  down" note covers the section.
- **Sources.** Audience values are copied by hand from the X1 admin view for a
  complete 30-day window; views from one finalized S2 booking report with no
  recorded gap. No public request reads X1 or S2 data. The commit changing a
  claim records the exact source count, where it was read, and when.

## 4. Behaviour and failure handling

| Situation                                        | Behaviour                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Config invalid or holding a placeholder          | Prerendering throws and `pnpm build` fails; nothing deploys.                                                  |
| No mail app or no WhatsApp on the device         | The visible address or number lets the visitor write by hand; `wa.me` falls back to WhatsApp's own page.      |
| JavaScript disabled or failed                    | Everything renders and every link works: static HTML, plain anchors.                                          |
| Offline                                          | Not precached, so the browser shows its offline page; `/local` is unaffected.                                 |
| S1 kill switch `SPONSORS_ENABLED` off            | `/sponsor` is unchanged; the founder confirms no start date until placements run again.                       |
| S1's inventory changes (Q2)                      | Copy and mockups change in the same release as S1; the page never describes a slot S1 does not serve.         |
| Rate change (S3b)                                | New `version` and `validFrom` in one reviewed commit with the BRD; bookings and sent quotes keep their price. |
| Claim older than 45 days                         | It stays dated; the founder, who reviews claims at least every 30 days, refreshes or removes it.              |
| A published number proves wrong                  | Corrected or removed in the next deploy; the commit says why (BRD §10 rule 5).                                |
| S2 report with a gap, or an incomplete X1 window | Not used for a claim.                                                                                         |

## 5. Privacy and access

- No [access-matrix](v2-contracts.md#5-access-matrix) row applies: S3 reads no
  match, rating, profile, or account data. Every visitor gets the same static
  HTML: no session read, cookie, browser storage, endpoint, or analytics event.
- An enquiry leaves through the visitor's own mail or WhatsApp app; Shaxda
  stores nothing (BRD §5). Contact URLs carry only the fixed message; the
  WhatsApp link sends no referrer; the address is public by design (Q5).
- S3 adds no resource from another origin. The site-wide Cloudflare Web
  Analytics beacon (root layout, when `PUBLIC_CF_BEACON_TOKEN` is set) is not
  S3's; the copy claims only that placements load no outside ad or tracker.
- Mockups show a fictional business, never a real sponsor; a claim never names
  the sponsor behind it. Audience claims are pseudonymous aggregates, never
  people, demographic, or geographic (BRD §10 rule 2).

## 6. Resource budget

| Resource                            | S3a                                                                           | S3b                              |
| ----------------------------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| D1 rows read / written              | 0 / 0                                                                         | 0 / 0                            |
| Durable Object wake-ups             | 0                                                                             | 0                                |
| Web Worker invocations for the page | 0: static assets (§3.1)                                                       | 0                                |
| Storage                             | A config under 1 KB and one copy module; no image assets (mockups are markup) | Config grows by under 1 KB       |
| Outbound requests                   | None from Shaxda; contact links open the visitor's own apps                   | None                             |
| PDF (Later)                         | —                                                                             | A local script; no deployed cost |

## 7. Somali copy

Keys live in `packages/i18n/src/content/sponsor.so.ts` as
`siteContent.so.pages.sponsor` (relative below) plus `nav.sponsor`. Every line
is a draft behind `TODO(translation-review)` until the one native review (Q4),
reusing the [glossary drafts](README.md#somali-glossary-drafts-q4) and keeping
`shaxda`, `jare`, and `irmaan`. S1's disclosure string, S2's
`sponsorReport.metric.views` and `sponsorReport.def.views`, and X1's activity
labels are imported, never copied.

| Key                                   | Somali draft                                                                                                                                                                                                                                                                                                                                                                        | Meaning                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `nav.sponsor`, `title`                | Noqo kafaala-qaade                                                                                                                                                                                                                                                                                                                                                                  | Become a sponsor                                                                        |
| `description`                         | Sida ganacsigaagu uga muuqan karo Shaxda: meelaha, xeerarka, iyo sida nalooga soo xiriiro.                                                                                                                                                                                                                                                                                          | Metadata description                                                                    |
| `hero.heading` / `.contactLink`       | Kafaala-qaad Shaxda / U gudub xiriirka                                                                                                                                                                                                                                                                                                                                              | Sponsor Shaxda; jump to contact                                                         |
| `hero.intro`                          | Shaxda waa ciyaar dhaqameed Soomaali ah oo bilaash ah: waa lagu bartaa, hal qalab ayaa lagu wada ciyaaraa, ama saaxiib ayaa xiriiriye loogu diraa.                                                                                                                                                                                                                                  | What Shaxda is                                                                          |
| `placements.heading`                  | Halka ganacsigaagu ka muuqdo                                                                                                                                                                                                                                                                                                                                                        | Where your business appears                                                             |
| `placements.lobby.title` / `.body`    | Shaashadda sugitaanka / Inta ciyaaryahanku sugayo ciyaaryahanka kale ee khadka, hoosta badhamada.                                                                                                                                                                                                                                                                                   | Waiting screen, below the buttons                                                       |
| `placements.result.title` / `.body`   | Dhammaadka ciyaarta / Ciyaarta kadib, hoosta natiijada iyo badhamadeeda. Ciyaarta qalabkan waxay ka muuqataa marka qalabku khadka ku jiro oo keliya.                                                                                                                                                                                                                                | End of game; local only while online                                                    |
| `mockup.caption`                      | Tusaale keliya: ganacsigan ma jiro, tusaaluhuna ma aha taariikh bannaan.                                                                                                                                                                                                                                                                                                            | Example only; not an available date                                                     |
| `mockup.name` / `.tagline`            | Dukaanka Tusaale / Ganacsi mala-awaal ah                                                                                                                                                                                                                                                                                                                                            | Fictional name and tagline                                                              |
| `mockup.resultHeading`                | Ciyaartu way dhammaatay                                                                                                                                                                                                                                                                                                                                                             | Finished-game heading                                                                   |
| `mockup.lobbyAlt` / `.resultAlt`      | Tusaale: kaarka kafaala-qaadaha oo ka hooseeya badhamada shaashadda sugitaanka. / Tusaale: kaarka kafaala-qaadaha oo ka hooseeya natiijada ciyaarta iyo badhamadeeda.                                                                                                                                                                                                               | Text alternatives                                                                       |
| `play.heading`                        | Ciyaarta ayaa mudnaanta leh                                                                                                                                                                                                                                                                                                                                                         | Play comes first                                                                        |
| `play.items` (1–4)                    | Kaarku marnaba ma daboolo looxa ama badhamada ciyaarta. · Ma muuqdo inta ciyaartu socoto, inta qabasho la sugayo, ama marka ciyaaryahan xanniban yahay. · Kaarku dhaqdhaqaaqa ciyaarta ma gaabiyo. · Kaar kasta wuxuu wataa calaamadda {label}.                                                                                                                                     | Covers nothing; never during play, a capture, or a block; never slows; labelled         |
| `play.items` (5–7)                    | Qof kasta oo meel arkaa wuxuu arkaa isla kafaala-qaadaha; qofna looma bartilmaameedsado magaciisa ama akoonkiisa. · Magaca iyo astaanta waxaa martigeliya Shaxda; kaarku ma soo raro qoraal xayeysiis ama raadraac oo dibadda ah. · Meel aan la ballansan waxba kuma muuqdaan.                                                                                                      | Same sponsor for all, no targeting; first-party, no outside script; empty shows nothing |
| `policy.heading` / `.priority`        | Ganacsiyada aan aqbalno / Mudnaanta waxaa leh ganacsiyada ay Soomaalidu leedahay ama u adeega. Ma aqbalno:                                                                                                                                                                                                                                                                          | Priority; "we do not accept:"                                                           |
| `policy.items` (BRD §4 as approved)   | khamaar iyo sharad · olole siyaasadeed ama xisbi · waxyaabo dadka waaweyn keliya loogu talagalay · qorshayaal lacageed oo khiyaano ama shati la'aan ah · qaad, tubaako, ama sigaar koronto · sheegasho marin-habaabin ah                                                                                                                                                            | The six BRD exclusions                                                                  |
| `policy.vetting`                      | Kaar kasta ka hor, waxaan hubinaa in ganacsigu jiro, in bartiisa internetku ammaan tahay (HTTPS) oo isaga leeyahay, iyo in magaca, sharaxaadda, iyo astaantu xeerkan buuxiyaan.                                                                                                                                                                                                     | Vetting summary                                                                         |
| `process.heading` / `.periods`        | Sida ay u shaqayso / Muddooyinka: 7, 14, ama 30 maalmood.                                                                                                                                                                                                                                                                                                                           | How it works; periods (P14)                                                             |
| `process.steps` (ordered)             | Nala soo xiriir. · Waxaan hubinaa ganacsiga iyo kaarka. · Waxaad kaarka ku aragtaa taleefan iyo kombiyuutar. · Heshiis qoraal ah: meesha, muddada, taariikhaha, iyo qiimaha. · Lacagta waxaa la bixiyaa meel ka baxsan Shaxda. · Kaarku wuxuu bilaabmaa oo dhammaadaa waqtiga heshiiska. · Muddada kadib waxaad heshaa warbixin: muuqaallada la tiriyay, gujisyada, iyo macnahooda. | BRD §5 from the buyer's side                                                            |
| `price.heading` / `.body`             | Qiimaha / Qiimaha nala soo xiriir. Qiimuhu waa muddo go'an, ma aha tiro muuqaallo; tiro muuqaallo lama ballan qaado.                                                                                                                                                                                                                                                                | Ask for prices; no views promised                                                       |
| `contact.heading` / labels            | Nala soo xiriir / Iimayl / WhatsApp                                                                                                                                                                                                                                                                                                                                                 | Contact; link labels                                                                    |
| `contact.subject` / `.message`        | Kafaala-qaadka Shaxda / Salaan, waxaan jeclaan lahaa inaan wax ka ogaado kafaala-qaadka Shaxda.                                                                                                                                                                                                                                                                                     | Prefilled subject and message                                                           |
| `contact.note`                        | Fariintu ma ballansato meel ama taariikh; heshiiska qoraalka ah ayaa ballansada.                                                                                                                                                                                                                                                                                                    | A message books nothing                                                                 |
| S3b `rateCard.heading` / `.periods`   | Qiimaha, laga bilaabo {date} / 7 maalmood · 14 maalmood · 30 maalmood                                                                                                                                                                                                                                                                                                               | Prices from {date}; column labels                                                       |
| S3b `rateCard.note`                   | Qiime kasta waa hal meel iyo hal muddo oo maalmo buuxa ah, lacagta {currency}. Heshiiska qoraalka ah ayaa go'aamiya qiimaha.                                                                                                                                                                                                                                                        | One slot, one period of full days                                                       |
| S3b `claims.heading` / `.roundedNote` | Tirooyin la cabbiray / Tirooyinka hoos ayaa loo soo koobay.                                                                                                                                                                                                                                                                                                                         | Measured numbers; rounded down                                                          |
| S3b `claims.audience`                 | {label}, 30-ka maalmood ee ku dhammaaday {date}: qiyaastii {n}. Kuwani ma aha tirada dadka; labada lama isku darin.                                                                                                                                                                                                                                                                 | X1's label; not people; never added                                                     |
| S3b `claims.views`                    | {label}, {placement}, {from} ilaa {to}: qiyaastii {n}. {definition}                                                                                                                                                                                                                                                                                                                 | S2's label and definition                                                               |

## 8. Implementation slices

S3a, after S1 and S2-min are live and Q5 is approved:

1. `test(shared): cover the sponsor page contact config`, then
   `feat(shared): add the sponsor page config schema`.
2. `feat(i18n): add Somali sponsor page copy`.
3. `refactor(web): separate the presentational sponsor card from its slot`
   (only if S1 did not).
4. `feat(web): add the prerendered /sponsor page` (route, config, mockups,
   links, metadata, top bar, print styles, precache exclusion).
5. `feat(web): link /sponsor from content-page navigation and footer`.
6. `test(e2e): cover /sponsor without JavaScript, on a phone, and in print`.

S3b, after the BRD §8 gate:

7. `test(shared): cover rate card and claim validation`, then
   `feat(shared): validate the dated rate card and measured claims`.
8. `feat(i18n): add rate card and claim copy`.
9. `feat(web): render the dated rate card and measured claims`.
10. `chore(web): publish the approved rate card`: values only; the message
    records the BRD approval and each claim's exact source count and date.

Later: `feat(web): generate the printable rate card PDF from /sponsor`, a
`pnpm sponsor:pdf` script printing the built page through Playwright into an
ignored folder. Every slice runs `pnpm lint`, `pnpm typecheck`, `pnpm test`,
and `pnpm build`; slices 4–6 and 9 add `pnpm test:e2e`.

## 9. Acceptance tests

S3 adds no Worker, Durable Object, or D1 code, so it has no Workers tests. It
shows, counts, rates, replays, and deletes no match, so M1–M10 have no S3
effect, and S3b publishes no game count.

### Unit — `packages/shared` and `packages/i18n`

- Contact: accepts email only, WhatsApp only, and both; rejects neither, a
  malformed email, `[EMAIL XIRIIRKA]`, `TODO`, `pending`, `example.com`,
  `.invalid`, `.test`, WhatsApp with `+`, spaces, a leading `0`, or outside
  8–15 digits, a URL, an unknown key, and `version < 1`.
- Rate card and claims: reject a missing slot or period, a non-positive or
  fractional amount, an unknown currency, a future date, `value < 10` or
  unrounded, a views claim without a slot, with `from > to`, or over 31 days,
  an unknown `kind`, and any total key.
- `roundDownForClaim`: 9 → none; 987 → 980; 1,000 → 1,000; 9,999 → 9,900;
  10,000 → 10,000; 12,345 → 12,000.
- Copy: no `[...]` placeholder; S1, S2, and X1 strings imported by identity;
  the policy list pinned to the approved BRD list; no S3a digit outside
  `process.periods`.

### Web — route and components

- `+page.ts` exports `prerender = true`; `web/src/routes/sponsor/` has no
  `+page.server.ts`, `+server.ts`, or action; the committed config parses.
- **No numbers, no prices (S3a):** outside `#contact` and `process.periods` the
  visible text has no digit, and nowhere is there a currency symbol or code.
- Sections in §3.3 order; one figure per live slot, none for `home` or
  `learn`; mockup frames `inert` and `aria-hidden`, with no link or focusable
  element, and the example caption.
- Contact anchors match §3.5 and show the address as text. With the beacon
  token unset, no `script`, `link`, `img`, or `iframe` has another origin; the
  only other-origin anchors are `mailto:` and `https://wa.me/`.
- **Navigation separation:** `pagesGroup()` lacks `/sponsor`; the default top
  bar's pages panel has it; the `/sponsor` top bar has no account panel;
  `/local` and `/online` render no `/sponsor` link; `SiteFooter` appears on
  `/`, `/learn`, and `/legal` only, outside the home play buttons.
- **Metadata:** title `Noqo kafaala-qaade | Shaxda`, canonical
  `<origin>/sponsor`, `og:image` `<origin>/og-image.png`, and a description
  with no digit or currency; the built precache list has no `sponsor` entry.
- **S3b** (fixture configs): every slot × period cell with its ISO code and
  `validFrom`; claims only with their dates and definition; browsers and
  accounts apart, never summed; views with slot and dates and no sponsor;
  without `rateCard` the S3a price text returns.

### End to end — Playwright

- JavaScript disabled: every section renders and the contact hrefs are
  correct. At 320 px: no horizontal scroll (the S3b table included); the
  keyboard reaches the contact jump link, the contact links, and the menu with
  visible focus.
- Print media hides the top bar and footer and prints the contact address and
  the S3b rate card. The home footer link opens `/sponsor`; the `/local` and
  `/online` menus have no sponsor link.

### Truthful-claims review

Before S3a publishes and before every S3b config change, the founder and a
second reader check the rendered preview against
[BRD §10](../shaxda_brd.md#10-truthful-claims): every number sourced, dated,
rounded down, and defined; no people count, demographic, geographic, modelled,
or Q3 figure; no fair-rate, market-rate, cost-per-thousand, or guaranteed-view
claim. Placement statements match S1 as deployed, the policy matches BRD §4,
and prices match BRD §7 and S1's admin currency. Each contact destination gets
a test message sent from the page.

## 10. Rollout and rollback

| Environment | S3a                                                                  | S3b                                     |
| ----------- | -------------------------------------------------------------------- | --------------------------------------- |
| dev         | `vite dev` with the committed config                                 | Fixture configs in tests                |
| e2e         | Tracked build; no remote resource; `pnpm check:e2e-isolation` passes | Same                                    |
| preview     | Truthful-claims review; phone, print, and contact-link checks        | Same, with the rate card and claims     |
| production  | After S1 and S2-min are live and `/legal` allows sponsorship         | After the BRD §8 gate and the Q5 prices |

- **Deploy order:** the web Worker only; no migration, no game Worker change.
- **Kill switch:** none. The page does no runtime work, reads no data, and
  takes no action; S1's `SPONSORS_ENABLED` does not affect it.
- **Rollback:** revert and redeploy the web Worker. Reverting S3a removes the
  route and its links; removing `rateCard` and `claims` from the config returns
  the page to the S3a price text.

### Done when

- **S3a:** Q5's contact channel and policy list are approved; the Somali copy
  has had its native review; S1 and S2-min are live; `/legal` allows
  sponsorship; the §9 checks pass; the founder's production check (page, links
  reaching the founder, sharing preview, phone, print, JavaScript off) is
  recorded in the ops release record.
- **S3b:** a first booking has been delivered and reported; Q5's prices and
  currency are approved and match S1's admin; every claim is approved and
  sourced; the §9 checks pass; the production check is recorded.
- The README status becomes `shipped@<date>` only in the shipping commit.
