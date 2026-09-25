# S3 — Sponsor Page and Rate Card (Spec)

| Field                    | Value                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                   | Draft; specification only. S3 implementation follows S1, with S2 measurements used when verified.                                                   |
| Brief                    | `docs/shaxda-v2.md` §6.3, §12 (S1–S3), §14–§15, §18                                                                                                 |
| Workspace                | `s3-sponsor-page`                                                                                                                                   |
| Depends on               | X1 measured audience, S1 live placements and approved policy/prices in `docs/shaxda_brd.md`; S2 verified placement numbers for any impression claim |
| Touches when implemented | `web/` public route and navigation, `packages/i18n` Somali copy, one rate-card config, metadata, relevant tests; optional PDF generator             |

This spec refines the V2 S3 brief. It does not start S3, mark it shipped, or
authorize publishing provisional numbers, prices, or contact details. Before
implementation, reconcile it with the merged S1/S2 contracts and the business
document. `docs/shaxda-v2.md` wins for V2 scope, the PRD for stack and route
architecture, and `docs/shaxda_brd.md` for sponsor policy and commercial
terms once that document exists. The BRD is absent in this checkout; it must
be created and approved before S1 as the V2 brief requires.

---

## 1. Outcome and boundaries

A Somali business can open `/sponsor`, see what Shaxda offers and a truthful
audience snapshot, compare the four placement surfaces and the three prices,
read the content policy, then contact the founder directly. A contact action
opens the visitor's email app or WhatsApp. It does not reserve a slot.

### Must

1. Public, Somali-only `/sponsor` page, accessible without an account and
   rendered as ordinary HTML (prerendered by default; SSR is acceptable if
   S1's merged route architecture requires it). No D1 request is needed to
   render the rate card.
2. Explain Shaxda in business-facing language: traditional Somali board game,
   free web/PWA play, local and online use, and who the audience figures count.
   Avoid unmeasured demographic, geography, or conversion claims.
3. Display an X1-sourced, founder-approved audience snapshot, rounded and
   dated as in §3. Do not publish V2 §15 traffic targets as observed users.
4. Show `home`, `lobby`, `result`, and `learn` as four distinct placements,
   each with a labelled, representative mockup, surface description, and the
   S1 rules relevant to a buyer. State that a mockup does not indicate a
   current booking or available inventory.
5. Show the S1-approved 7-day, 14-day, and one-calendar-month periods and the
   public price **per slot** for each. S1's draft defines a month as the first
   day of one UTC month through the first day of the next; confirm S1-D3 before
   publication. Do not offer a second calendar interpretation. Put
   public price values in one versioned config file (§4).
6. Summarize the BRD's approved vetting/content policy, first-party creative,
   clearly marked sponsored placement, and off-platform payment/approval
   process. Link to the applicable legal page if its copy covers this process.
7. Provide at least one working, explicit contact link (email or WhatsApp),
   with a prefilled inquiry that names the slot and period only when the
   visitor selected them. A generic contact path remains available without
   making a selection. No contact form or lead database.
8. Add a `/sponsor` link in the public pages navigation and a footer link on
   public content pages. Keep it visually separate from play actions and out
   of the game board/control area. S1's house cards may link here.
9. Set canonical, description, and Open Graph metadata through the existing
   `PageMeta` pattern. Use a first-party 1200 × 630 image that accurately
   represents Shaxda and the sponsorship page; never use a sponsor's creative
   as the page's default sharing image.

### Should

- Generate a one-page, printable PDF rate card from the **same config** and
  approved audience snapshot as the page. The PDF must carry the same date,
  prices, period definition, contact, and policy summary; no hand-maintained
  duplicate prices.

### Out of scope

- Online booking, live availability calendar, checkout, payment collection,
  invoices, automatic quote negotiation, or sponsor accounts/dashboard.
- New placement slots, targeting, rotation, ad networks, third-party scripts,
  tracking pixels, or sponsor creative uploads (S1 owns creatives).
- New analytics or event tracking (X1/S2 own measurement). A sponsor inquiry
  link is not a booked or paid placement.
- Rewriting S1's booking prices, terms, policy, or S2's measurement definition.

---

## 2. Page contract and content order

The page is a focused sales document, not a game screen. Keep it readable on a
narrow phone and useful when printed or shared without JavaScript.

| Section    | Required content                                                                                                            | Source                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Intro      | What Shaxda is, where a sponsor appears, primary contact action                                                             | V2 §2, §12; approved Somali copy           |
| Audience   | Rounded MAU and WAU with measurement window and as-of date; optional verified S2 viewable impressions when available        | X1 snapshot; S2 only for impression claims |
| Placements | Four S1 slots, labelled mockups, surface, and unobtrusive placement promise                                                 | S1 merged UI and V2 §6.3                   |
| Rate card  | One slot at a time; 7 days, 14 days, S1's calendar-month definition; currency and flat prices                               | BRD and §4 config                          |
| Process    | Inquiry → founder vetting/creative review → off-platform payment → founder confirms booking → scheduled display → S2 report | S1/S2 approved operations                  |
| Policy     | Short allowed/rejected-content summary and first-party creative/disclosure rules                                            | BRD approved checklist                     |
| Contact    | Public email and/or WhatsApp with a plain explanation that sending an inquiry creates no reservation                        | Founder-approved contact config            |

Mockups must use a clearly fictional example brand or neutral sample creative
that cannot be mistaken for a real customer endorsement. Show placement in
context: below the home hero, the online/quick-match waiting area, the result
overlay, and between learn sections. The result mockup must preserve the
completed-game state and show no ad during a pending capture or blocked
prompt. Label each illustration as an example in Somali and provide useful
text alternatives. Do not show impressions or a promise of reach on a mockup.

The page should explain that all viewers of one slot see the same booked
sponsor for its period, no personal identity is used to target placement, and
every placement has a Somali sponsored label. Do not imply an available date
until the founder checks S1's admin booking view.

Visible copy belongs in `packages/i18n`, following the existing structured
`siteContent.so.pages` pattern. Draft terms such as sponsor/sponsored need a
fluent Somali review before release, including the CTA, policy, period labels,
and mockup captions. Keep `shaxda`, `jare`, and `irmaan` unchanged where used.

---

## 3. Audience claim and update process

The public page displays a **snapshot**, not a live counter. The founder
reviews X1 `/admin/stats` once a month, records the extraction date in UTC,
the ending date of the measured window, the exact source counts, and the
rounded public counts. A second reviewer or the founder checks the rendered
page against the admin source before deployment. Publish only counts the X1
production data actually supports.

| Claim                                  | Proposed definition and display                                                                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monthly active                         | X1 MAU: distinct anonymous devices/accounts active in the trailing 30 UTC days ending on the recorded date. Label as an estimate of active devices/accounts, **not distinct people**.   |
| Weekly active                          | X1 WAU: the same distinct-id measure over the trailing 7 UTC days ending on the recorded date.                                                                                          |
| Viewable sponsor impressions, if shown | S2's ≥50% visible for ≥1 second measure, from completed daily reports for a specified slot and date range. Do not substitute page views, X1 game events, or V2 §15 modeled impressions. |

For positive counts, round down to a conservative significant unit: nearest
10 below 1,000; nearest 100 from 1,000 through 9,999; nearest 1,000 above
that. State “about” in Somali. Keep exact counts only in the internal update
record, not in public HTML. If the count is below the rounding unit, show
the exact count or a nonnumeric “audience growing” message approved by the
founder; never display zero for a positive measured count. Store the source
window and as-of date beside the snapshot so reviewers can reproduce it.

If X1 has not completed a trustworthy 30-day production window, the page can
be drafted and previewed with a clearly marked internal placeholder, but
production S3 waits for a founder-approved measured claim. If a monthly
refresh is missed, retain the last measured count with its visible as-of date;
do not silently label it as current. A release checklist flags snapshots older
than 45 days for founder review. Never inject arbitrary live numbers from
`/admin/stats` into a public response.

The V2 §15 model (~7,000 MAU, ~$10 effective CPM, three impressions per DAU,
and $1,000 monthly revenue) is planning context only. None becomes public
factual copy without separate measurement and approval.

---

## 4. Rate-card source and consistency

Use a single data-only config, provisionally
`web/src/lib/sponsor/rate-card.json`, consumed by the page and the optional
PDF generator. If S1 already establishes a suitable shared config, reuse it
instead of creating a second price source. All public amount, currency,
period, and contact values originate here; the BRD records the approved
business policy and must match it. Somali labels and explanatory copy stay in
`packages/i18n`.

Proposed shape (values are **draft anchors** from V2 §15, not approved public
prices):

```json
{
  "version": 1,
  "currency": "USD",
  "pricesPerSlotMinor": {
    "7d": 8000,
    "14d": 14000,
    "month": 25000
  },
  "monthDefinition": "S1-approved definition pending",
  "contact": {
    "email": "founder-approved address pending",
    "whatsappUrl": null
  }
}
```

S1 may approve distinct prices by slot. If so, represent all twelve
slot-period prices in this **same file**, and render a labelled 4 × 3 table
without hiding differences. Do not code a flat price while S1/admin sells a
different one. The public values are list prices, not an automatic quote or
booking amount. Historical S1 `sponsor_booking.price` remains the agreed
price for that booking; changing the public config never rewrites history.

Validate config at build time: positive integer minor units, supported
currency, all four slots and three periods, one unambiguous month definition,
and at least one valid public contact target. Do not publish a placeholder
value. Show the currency beside every price; do not imply currency conversion
or tax treatment not approved in the BRD. A rate change is a reviewable config
and BRD update plus page/PDF regeneration. The founder sets its effective
publication date and checks existing quotes/bookings before the new card goes
live.

---

## 5. Contact, navigation, metadata, and privacy

Contact is a direct link. A `mailto:` link may prefill a Somali subject/body;
a WhatsApp link uses a founder-supplied `https://wa.me/...` target and a
URL-encoded message. Use ordinary anchors so they work without JavaScript.
The page must show the address/number as accessible text, not an icon alone.
Do not collect inquiries in D1, browser storage, a Worker endpoint, or a
third-party embedded widget. The visitor chooses to leave Shaxda for their
mail or WhatsApp app. No automatic message is sent.

Put the sponsor link in the existing public `pagesGroup()` or an equivalent
clearly labelled public-pages group, away from Local/Online game actions.
Provide a quiet footer link on `/`, `/learn`, `/legal`, and `/sponsor` so a
reader can find it without opening the nav menu. Avoid a persistent sponsor
CTA in the game shell. S1's unbooked house cards can use the same canonical
`/sponsor` route; the result slot may continue to render nothing if S1 chose
that behavior.

Reuse `PageMeta` for title, description, canonical `/sponsor`, Open Graph,
and Twitter metadata. A page-specific image is optional only if the existing
first-party Shaxda image accurately fits the page; otherwise create one.
Metadata must contain no illustrative reach claims or stale price text. The
route should remain indexable unless the founder decides to hold publication.
Use semantic headings, keyboard-visible focus, text alternatives, mobile
tables/cards that do not force horizontal scrolling, adequate contrast, and
reduced-motion behavior. No external scripts, fonts, pixels, or creative hot
links.

---

## 6. Verification and implementation plan

### Tests and review

- Config validation fails on a missing slot/period, placeholder contact,
  invalid currency/price, or undefined month length. Page and optional PDF
  tests read the same config and compare all displayed prices/periods.
- Route test confirms a signed-out visitor gets HTML with four named slots,
  three periods, approved prices, a dated X1 snapshot, policy, and contact.
  There is no POST action, booking mutation, or public D1 analytics read.
- Navigation tests find `/sponsor` in public pages navigation and public
  content footers, but no intrusive play action or board overlay.
- Metadata test checks canonical URL and first-party Open Graph tags. A
  narrow-phone browser check covers mockups, rate table, contact links,
  keyboard focus, text alternatives, and printing. Check that the page works
  with JavaScript disabled.
- Editorial review checks every number against its source snapshot, every
  price against the BRD and S1 admin values, and the Somali copy against the
  approved terminology. Link targets must open the intended founder contact.
- Preview checks verify the page, navigation, contact, metadata, and PDF if
  included. Production verification repeats those checks after deployment.

Implementation sequence, once dependencies are merged and founder decisions
in §7 are settled:

1. Reconcile S1 period semantics, public price model, booking policy, and S2
   report terminology with the BRD. Record any differences here.
2. Approve one contact path, prices, policy summary, and current X1 snapshot;
   create the config and snapshot record with validation.
3. Add Somali structured copy, four representative labelled mockups, and the
   public route using existing page/metadata components.
4. Add separate navigation and footer links; connect S1 house cards to the
   canonical route if S1 has not already done so.
5. Add route/config/navigation/accessibility checks; generate the PDF only if
   the Must path is complete and the same config can drive it.
6. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and relevant
   `pnpm test:e2e` cases. Use preview for editorial and contact-link review;
   production publication follows the normal deployment process.

For this **spec-only** edit, formatting, links, and consistency checks are
sufficient; it does not claim application tests or a deployment.

### Done when

The public page has approved Somali copy; a truthful dated X1 audience
snapshot; four accurate S1 mockups; BRD-consistent prices for all three
periods; an approved contact link; visible public navigation; correct sharing
metadata; and passing relevant checks. The founder verifies the rendered
production page and contact destination. S3 is then marked shipped in V2 §4
with the merge date. A saved draft alone is not shipment.

---

## 7. Founder decisions before implementation/publication

| ID    | Decision                                                                       | Draft treatment                                                                                                                    |
| ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| S3-D1 | Public per-slot prices and currency for 7 days, 14 days, and S1's month period | V2 §15's $80 / $140 / $250 USD are illustrative anchors only. Await founder approval or replacements.                              |
| S3-D2 | Exact public email and/or WhatsApp destination                                 | Pending. At least one must be approved and tested before publishing.                                                               |
| S3-D3 | Audience publication rule                                                      | Draft: manually approved monthly X1 snapshot; no modeled figures. Confirm whether page may launch before a 30-day measured window. |
| S3-D4 | S1 month definition and whether rates vary by slot                             | S1 draft uses UTC calendar months; confirm S1-D3 and the BRD. Inherit any approved per-slot pricing model.                         |
| S3-D5 | Somali terminology and BRD content-policy summary                              | Fluent review and founder approval before publishing.                                                                              |

These decisions refine S3 copy and values. They do not add booking, payment,
availability, or sponsor self-service to V2.
