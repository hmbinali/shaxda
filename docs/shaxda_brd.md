# Shaxda — Business Requirements Document

| Field    | Value                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | Draft for founder approval (register Q5). Nothing here is sold or published until the founder approves it.                                               |
| Date     | 2026-09-29                                                                                                                                               |
| Owner    | Founder                                                                                                                                                  |
| Governs  | Business strategy, sponsor policy, pricing, and sponsor operations (`docs/shaxda_prd.md` §27)                                                            |
| Limits   | Cannot add product scope that the PRD or `docs/shaxda-v2.md` excludes                                                                                    |
| Register | F3, P14, Q2, Q3, Q5 ([`docs/specs/README.md`](specs/README.md#decision-register))                                                                        |
| Specs    | [S1](specs/s1-sponsor-placements.md), [S2](specs/s2-sponsor-measurement-reports.md), [S3](specs/s3-sponsor-page.md), [X1](specs/x1-product-analytics.md) |

## 1. Stance

Shaxda is a free game first. Retention comes before revenue (F3): players
need a reason to return — saved games, a meaningful rating, a leaderboard,
and quick matches — before a sponsor placement can be sold honestly.

Sponsorship runs as a **measured pilot**: a small number of direct-sold,
first-party placements whose delivery is reported with published
definitions. The pilot must never slow a move, cover the board or its
controls, appear during a pending capture or a blocked-player prompt, or
track a player (V2 brief §6.3). If a placement ever conflicts with play,
play wins.

What this document leaves open, each tied to the release it blocks:

| ID  | Open item                                                                         | Blocks                                       |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| Q2  | Pilot surfaces, and whether `result` appears after local games                    | S1                                           |
| Q3  | Current weekly players and games, community play times, monthly Cloudflare budget | Cost alerts; quick-match beta targets        |
| Q5  | Prices, currency, contact channel, content policy; the `/legal` contact address   | First paid booking; S3 publication; `/legal` |

## 2. Audience hypothesis

Hypothesis, not measurement: Shaxda's players are Somali speakers — in the
Horn of Africa and in the diaspora — who know the game from family or want to
learn it, play with friends by invite link, and share results in WhatsApp
groups and social media. Somali-owned and Somali-serving businesses want to
reach them.

Until X1 reports production numbers, every audience figure is a planning
input. The planning inputs used in this document (about 1,500 active
browsers a day, 3 qualified sponsor views per active browser per day, 75 %
slot fill) are **hypotheses to test**, not facts to quote.

| Hypothesis                                  | Tested by                                                     |
| ------------------------------------------- | ------------------------------------------------------------- |
| Players return week to week                 | X1 weekly returning players (primary metric), from the ledger |
| New accounts come back within a week        | X1 D7 return, reported only once cohorts are mature           |
| A completed game yields a sponsor view      | S2 qualified views on `result` per completed game             |
| Waiting in a lobby yields a sponsor view    | S2 qualified views on `lobby`                                 |
| Businesses will pay a flat price per period | First bookings and renewals                                   |

Active browsers and active accounts are approximations of devices and
accounts, not people (X1). They are never added together or presented as a
count of players.

## 3. Pilot inventory

The pilot sells what the register fixes (P14; Q2 confirms it):

| Slot     | Surface                                                     | Notes                                               |
| -------- | ----------------------------------------------------------- | --------------------------------------------------- |
| `lobby`  | `/online` waiting screen and the quick-match waiting screen | Below the room or queue controls                    |
| `result` | Game-over panel, online and local (local only while online) | Below the result and its actions; never during play |

- Periods: 7, 14, and 30 days. One sponsor per slot at any instant; every
  viewer of a slot sees the same sponsor. No rotation, no targeting.
- An unbooked slot renders nothing.
- Takedown: the public sponsor response is cached for at most 60 seconds, so
  no page loaded more than a minute after a cancellation shows the booking; a
  card already on screen goes at its next refresh (about two minutes at
  most). No cache purge is needed.
- `home` and `learn` are **not** in the pilot. They are added only after the
  evidence gates in §8.

## 4. Sponsor policy and vetting

Placement rules (V2 brief §6.3): direct-sold only; a placement loads no ad
network, programmatic ad, tracking pixel, or third-party script, and its
creative is hosted by Shaxda; a visible Somali "sponsored" label (draft:
`Waxaa kafaala qaaday`); payment off-platform. The app takes no payment and
stores no payment details, only the agreed price and currency as a note on
the booking. The site's existing Cloudflare Web Analytics beacon, disclosed
on `/legal`, is not part of sponsorship and is unchanged.

Content policy — **proposed defaults for founder approval (Q5)**:

- no gambling or betting;
- no political campaigns or parties;
- no adult content;
- no financial schemes (pyramid, "get rich", unlicensed investment);
- no khat, tobacco, or vaping;
- no misleading claims.

Priority: Somali-owned and Somali-serving businesses.

This is **sponsor policy version 1** (`SPONSOR_POLICY_V`), in force once Q5
approves it. A change to this section raises the version in the same commit;
S1 stores the version with every approval.

Vetting checklist, recorded with the policy version in admin (S1):

1. The business is real and reachable (a named contact, a working channel).
2. The destination is HTTPS, belongs to the business, and matches the
   vetted host; no login or payment page is the landing page.
3. The name, one-line tagline, and optional logo pass the content policy;
   the tagline is reviewed in Somali (or in the sponsor's language when it is
   not Somali, with a translation on file).
4. The sponsor has the right to use the logo and name.
5. The creative is stored as an immutable version; any change is a new
   version that is vetted again before it can serve.

## 5. Fulfilment workflow

| Step | What happens                                                                                           | Owner   | Evidence                       |
| ---- | ------------------------------------------------------------------------------------------------------ | ------- | ------------------------------ |
| 1    | Inquiry through the S3a contact link (channel decided in Q5)                                           | Founder | Message thread                 |
| 2    | Vetting against §4                                                                                     | Founder | Policy version in admin        |
| 3    | Creative entered and previewed on both slots, phone and desktop                                        | Founder | Creative version, preview      |
| 4    | Quote and written agreement: slot, period, dates (UTC), price, make-good terms (§6)                    | Founder | Agreement                      |
| 5    | Payment off-platform                                                                                   | Founder | Payment record outside the app |
| 6    | Booking confirmed in admin — **blocked unless S2-min reporting works** (S1 rule)                       | Founder | Confirmed booking              |
| 7    | Display starts and ends by time, with no deploy; founder spot-checks the start                         | App     | Public response, spot check    |
| 8    | Takedown if a policy problem appears: cancel with a reason; new page loads stop showing it within 60 s | Founder | Cancellation record            |
| 9    | Report sent after the period closes: qualified views, clicks, CTR, definitions, and any outages        | Founder | S2 report or CSV               |
| 10   | Make-good if owed (§6)                                                                                 | Founder | Agreement note                 |
| 11   | Renewal conversation                                                                                   | Founder | —                              |

## 6. Make-goods

The pilot sells a flat price per period, **not** a number of views. A
make-good is owed only for display time Shaxda lost: a display outage the
founder records in S2's gap log, a takedown that was not the sponsor's fault,
or a start that slipped. The gap log also lists measurement gaps S2 records
automatically; those change what the report can show, not the display time
owed. The agreement states the remedy: a pro-rata refund for the lost hours,
or a free booking of the shortest period (7, 14, or 30 days) that covers the
lost time, at the founder's choice. Low measured views alone are not a
make-good; they are a pricing signal (§7).

## 7. Pricing hypotheses

| Period  | Price per slot | Status     |
| ------- | -------------- | ---------- |
| 7 days  | $80            | Hypothesis |
| 14 days | $140           | Hypothesis |
| 30 days | $250           | Hypothesis |

Currency, final prices, and whether prices differ by slot are Q5. No price is
published until S3b, which follows a first delivered report; the S3a pilot
page says to get in touch for prices. Re-price when measured qualified views
per slot move by about 30 %.

Internally, the founder may compute an **implied cost per 1,000 qualified
views** for a completed booking (`price ÷ (qualified views ÷ 1,000)`) to
compare slots and periods. It is internal arithmetic from measured data,
never a market rate, and never shown to a sponsor as a claim about other
advertisers.

### Revenue arithmetic

```txt
monthly revenue = Σ over slots (monthly-equivalent price × sold fraction) − make-goods
monthly-equivalent price of a 30-day booking = its price
```

| Scenario                       | Slots | Price / 30 days | Sold  | Monthly revenue |
| ------------------------------ | ----- | --------------- | ----- | --------------- |
| Pilot, typical fill            | 2     | $250            | 75 %  | $375            |
| Pilot, fully sold              | 2     | $250            | 100 % | $500            |
| Four slots, typical fill       | 4     | $250            | 75 %  | $750            |
| Four slots, fully sold         | 4     | $250            | 100 % | $1,000          |
| Four slots at the price needed | 4     | ≈ $333          | 75 %  | ≈ $1,000        |

Consequences: the two-slot pilot cannot reach the V2 goal of $1,000 a month
at these prices; the goal needs more inventory (after the §8 gates) or
higher prices justified by measured delivery. Short bookings sold back to
back earn more per month than a 30-day booking ($80 × 30⁄7 ≈ $343), but only
if they are actually sold back to back; the scenarios above assume 30-day
bookings. Exposure differs by slot, so equal prices across `lobby` and
`result` are a starting point, not a rule.

## 8. Evidence gates

| Decision                        | Gate                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Start selling                   | This BRD approved (Q5); X1 has ≥ 30 days of production data; S1 and S2-min live in production |
| Publish a rate card (S3b)       | A first booking delivered and reported                                                        |
| Add `home` or `learn` inventory | Delivered bookings, player feedback that placements do not bother play, and renewal interest  |
| Judge early return play         | Two complete weekly cohorts, with raw counts beside percentages                               |
| Set quick-match wait targets    | Q3 inputs (current players and community play times)                                          |

## 9. Cost model

Costs are measured monthly in the Cloudflare dashboard; this model only
shows what drives them. Prices below are from Cloudflare's pricing page
(updated 2026-08-28, read 2026-09-29) and must be rechecked before they are
relied on.

| Service                 | Free plan                   | Paid plan ($5/month base)                                             |
| ----------------------- | --------------------------- | --------------------------------------------------------------------- |
| Workers requests        | 100,000/day, 10 ms CPU each | 10 M/month included, then $0.30/M; 30 M CPU-ms included, then $0.02/M |
| Durable Object requests | 100,000/day                 | 1 M/month included, then $0.15/M                                      |
| Durable Object duration | 13,000 GB-s/day             | 400,000 GB-s/month included, then $12.50/M GB-s                       |
| D1 rows read / written  | 5 M/day / 100,000/day       | 25 B / 50 M per month included, then $0.001/M / $1.00/M               |
| D1 storage              | 5 GB total                  | 5 GB included, then $0.75/GB-month                                    |
| Cron triggers           | no separate charge          | no separate charge                                                    |

What V2 adds per unit (from the specs):

| Unit                    | Adds                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completed account game  | 3 ledger rows; ≈ 8 rating rows per decision once R1 runs; ≈ 4 counter upserts (P13; about 9 for a quick game with K1's queue counters); one D1 round trip at game over |
| Active identity per day | 1 pseudonymous beacon row per browser, plus 1 per signed-in account (kept 90 days, P12)                                                                                |
| Sponsor qualified view  | 2–4 row writes at most once per browser, booking, and slot per 30 minutes; a suppressed beacon writes nothing (S2)                                                     |
| Idle room               | nothing while hibernating; alarms only for deadlines and unsaved matches                                                                                               |

At the §2 planning inputs (about 1,500 active browsers a day), D1 writes stay far inside the free daily allowance. Billing alerts are set from
the Q3 budget, and the "Cloudflare bill per 1,000 completed online games"
metric in the V2 brief is computed from the dashboard, not estimated.

## 10. Truthful claims

1. Public numbers come only from measurement: X1 for audience, S2 for
   sponsor delivery. They are dated, rounded **down**, and carry their
   definition ("active browsers", "qualified views: at least half the
   placement visible for one second, at most one per browser every 30
   minutes").
2. No count of people, no demographic or geographic claim without
   measurement, and no modelled figure (including the §2 planning inputs) in public copy or a sponsor conversation.
3. Reports show raw counts beside percentages, the measurement window, and
   any outage. A zero is shown as zero; missing data is shown as missing.
4. No "fair CPM", "market rate", or "guaranteed impressions" claims.
5. When a number is wrong, the report is corrected and the sponsor told.

## 11. Owners

| Area                                          | Owner                               |
| --------------------------------------------- | ----------------------------------- |
| Q2, Q3, Q5 decisions; sales; vetting; reports | Founder                             |
| S1, S2, S3, X1 implementation per their specs | Engineering (following `AGENTS.md`) |
| Somali copy and glossary (Q4)                 | A native Somali reviewer, once      |
| Monthly cost check and billing alerts         | Founder                             |
