# K2 — Queue Quality (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; specification only. K2 is not active or shipped. |
| Brief | `docs/shaxda-v2.md` §3, §6.4, §7, §11 (K1/K2), §14 |
| Depends on | Merged K1 queue and frozen queue protocol; H1 match lifecycle; R1 rating snapshots; R2 rated-play policy; X1 aggregate analytics |
| Workspace | `k2-queue-quality` |
| Touches when implemented | Queue DO, trusted MatchRoom/queue handoff, web Worker, `/online` and quick-game result UI, shared schemas/i18n, X1 reporting, Workers and browser tests |

This refines the K2 brief without activating it. K1 has no spec or queue
implementation in this checkout. Reconcile every proposed message, callback,
storage key, and route below with K1's merged contract before coding. Changes
to the frozen K1 protocol need an explicit contract-change commit and cached
PWA client compatibility tests. The V2 brief controls scope, the PRD controls
the stack, and `docs/shaxda_game.md` controls game rules.

---

## 1. Outcome and scope

A complete signed-in account can see that others are waiting, find a fair
opponent more readily as its wait grows, and enter another quick game from the
result. Repeated, verified abandonment before play begins temporarily blocks
new queue entries. The founder can measure the queue without collecting a
per-move or per-game analytics trail.

### Must

1. Widen the rating-gap window on a deterministic elapsed-time schedule, then
   allow any rating after two minutes. Apply the policy on joins and K1 alarms.
2. Show a cached, anonymous count of distinct waiting accounts on `/online`
   for signed-in accounts. The count is advisory, never a promise of
   an immediate pairing.
3. Offer an explicit re-queue action on a quick-game result. Obtain a fresh
   queue ticket and rating snapshot; do not silently enroll the player.
4. Enforce a short, account-scoped cooldown after repeated **verified**
   pre-action no-shows or abandonments. Keep invite and local play available.
5. Add queue joins, pairings, starts, wait-time distribution, and verified
   abandonment to X1's internal reporting, with clear denominators.
6. Preserve K1's single global hibernating queue, account-only entry, one
   waiting seat per account, pre-claimed rated rooms, no-show recovery, and
   guest invite play.

### Should

- While waiting, offer the existing invite flow so a player can share a link.
  Choosing it cancels the queue entry first; it never leaves an unseen queue
  socket active.

### Out of scope

- Regional or party queues, bots, guest or unrated quick play, rating-based
  rooms, async play, push notifications, and an AI opponent.
- Changes to Glicko-2, the R2 rating-cap policy, game rules, match result
  persistence, or automated account bans. A cooldown is a queue-entry rule,
  not a rating or leaderboard penalty.
- Public player identities or exact rating distribution in the presence API.

---

## 2. Pairing policy

Use the K1 server-verified rating snapshot on each waiting seat. An account
without a processed rating uses R1's initial 1500; RD is retained for K1's
contract but does not change this K2 gap rule. `joinedAt` is the time of the
accepted queue attempt, assigned by the queue DO's clock. A tab replacement
or automatic return after an opponent no-show preserves it; an explicit cancel
followed by a new join gets a new time.

| Elapsed wait for an account | Maximum absolute rating gap |
| --- | ---: |
| 0–29,999 ms | 100 |
| 30,000–59,999 ms | 200 |
| 60,000–89,999 ms | 300 |
| 90,000–119,999 ms | 400 |
| 120,000 ms or more | No gap limit |

For two candidates, use the **larger** of their two windows. This lets the
longer-waiting player receive the broad match promised by the brief, even if
the other just joined. Compare full-precision ratings; a gap exactly on a
boundary is eligible. Never pair the same permanent user id with itself.
Eligibility uses queue time, not client time or the rating as later recalculated
in D1. It does not promise that a pairing will occur when only one account is
waiting.

On every join and relevant alarm, consider waiting accounts in ascending
`joinedAt`, then stable attempt id. For the oldest account with an eligible
opponent, choose the eligible opponent with the smallest rating gap; ties go
to earlier `joinedAt`, then stable attempt id. Remove and reserve both seats
atomically before asking the K1 coordinator to create the pre-claimed room.
Repeat until no eligible pair remains. If room creation fails, restore both
attempts with their original `joinedAt` and report an operational error; do
not turn the failed reservation into a cooldown incident.

K1's alarm scheduler must wake for the earliest next threshold at which a
currently ineligible pair could become eligible, and for its normal cleanup
work. Recompute from persisted timestamps after a restart or hibernation; no
client timer decides eligibility. Do not add `setInterval`, a lifecycle
`setTimeout`, or an alarm when the queue has no waiting accounts. Extend
`pnpm check:hibernation` and the Worker tests for these paths.

---

## 3. Waiting presence and re-queue

The queue DO exposes a trusted **read-only count** of distinct, live waiting
accounts. Count one account once across tabs; exclude reserved/matched seats,
expired/disconnected entries, and cooldown records. Return only `{ count,
asOf }`, with a nonnegative integer count and server timestamp. The web
Worker checks for a signed-in session and serves a Zod-validated
`GET /api/queue/presence` response. Cache the count for at most 10 seconds
under a shared key containing no user or ticket data; use a private client
response and never cache a session-derived payload publicly. The page may
refresh at most every 30 seconds while visible, plus once on entry. A failed
read hides the count without preventing entry to the queue. The copy says
"currently waiting" and avoids implying that all of them are compatible or
online in the same region.

On the result overlay, show a "play another quick game" action only for a
completed quick room and a complete signed-in account. The action leaves the
old room through K1's established cleanup/navigation path, obtains a fresh
`queue` ticket from the web Worker, and joins as a new attempt. Disable the
button while the request is in flight; repeat taps and retries must not create
two attempts. A cooldown response shows its server-owned expiry and keeps the
result visible. A failed ticket or queue connection leaves the player on the
result with a retry action. Invite/rematch controls keep their existing
semantics; a quick result never auto-joins the queue. The button and waiting
copy may say the room requests rated play, but must not promise a rating
change: R2's pair or daily cap can still skip the result.

The waiting-screen invite link is a **Should** item. It should use the
existing guest-compatible invite path. Cancelling or leaving the queue must
be acknowledged, or the old socket closed and the DO state reconciled,
before creating an invite room. The queue never auto-fills that invite.

All player-facing strings live in `packages/i18n` and require founder review
of the Somali terms for quick match, waiting, cooldown, and re-queue before
release. No English placeholder appears in the visible UI.

---

## 4. Pre-action abandonment and cooldown

Only the server can report an incident. A trusted K1 no-show or MatchRoom
outcome reports the matched attempt id, private account id, room instance,
and reason to the queue DO. The queue accepts each `(room instance, account
id)` outcome once. The coordinator/room must identify which seat was
responsible; a client claim or disconnect event alone is not evidence.

An incident counts only when **all** of these are true:

- A K1-created quick room reserved that account's seat.
- The opponent connected or remained available to play.
- The account failed to connect within K1's grace period, or disconnected and
  its existing recovery grace expired before the first accepted game action.
- The room's server-owned action count is still zero. A manual resign or any
  accepted action is handled by H1/R2 and is not a K2 pre-action incident.

Do not count an unmatched queue cancel, tab replacement, normal reconnect
within grace, both players failing to connect, coordinator/Worker failure,
room cleanup race, or a network error that the server cannot attribute to
one seat. The opponent's K1 automatic return to the queue keeps its original
wait time and is never penalized. A late duplicate report has no effect.

Store only the private user id, incident timestamps, cooldown expiry, and
bounded deduplication keys in the queue DO's durable storage. Keep incident
timestamps for a rolling 24 hours; prune them and expired cooldown data on
access and while K1's normal non-empty-queue alarm runs. No D1 row, IP
fingerprint, device id, public warning, or permanent strike is added. A
queue attempt is refused before a waiting socket is accepted when `now <
cooldownUntil`. The response includes `retryAt` but no incident history.
The player can still use invite and local play.

**Proposed default, pending founder choice:** the second incident within a
rolling 24 hours starts a 5-minute cooldown; the third and later incident
within that window starts a 30-minute cooldown. An incident while already
cooling down is impossible because the account cannot enter the queue. At
exactly `retryAt`, entry is allowed. A server error in incident recording
must fail safely for the player: do not invent or lengthen a cooldown; log
the operational failure for repair.

---

## 5. Queue metrics in X1

Record authoritative aggregate transitions in the queue DO, then expose
bounded daily snapshots through a trusted web-Worker read. X1's scheduled
rollup upserts the snapshots into `event_daily` as **gauges** (replace with
the latest value, never increment on a retry). This keeps the game Worker
from writing analytics D1 tables, avoids a row per queue attempt or game,
and makes a repeated rollup idempotent. Read back the current and prior two
UTC days in the normal run. Also keep a bounded, paginated list of days changed
since the last successful X1 snapshot, so a long-waiting attempt or delayed
room outcome can correct an older join day. Daily queue aggregates contain
only counters and buckets and can be retained indefinitely, like X1's
`event_daily`; an explicit catch-up drains missed pages. If K1's final
service-binding layout differs, preserve these data semantics and the
game-Worker D1 write boundary.

| Measure | Definition |
| --- | --- |
| `queue_joins` | Accepted **new** queue attempts, grouped by server UTC join day. Tab replacement and automatic no-show return are not new joins. |
| `queue_pairs` | Successfully pre-claimed room pairs, grouped by server UTC pair day. A failed room creation is not a pair. |
| `queue_starts` | Queue attempts whose quick room reached the first accepted game action, grouped by the original join day; each game contributes two starts. |
| `queue_abandons` | Verified pre-action incidents, grouped by pair day; each responsible account contributes at most one per room. |
| Wait distribution | One sample per player in a successful pair: `pairedAt - joinedAt` in nonnegative milliseconds, grouped by pair day. |

The internal `/admin/stats` view shows joins, pairs, median wait, abandon
rate, and the share of queue joins that reach a started game. A daily join
cohort remains marked **preliminary** while any of its attempts is still
waiting or awaiting a room outcome. The start share is `queue_starts /
queue_joins` for settled cohorts, not `pairs / joins`. Abandon rate is
`queue_abandons / (2 × queue_pairs)` for pair-day cohorts; show the numerator
and denominator, and show no rate when there are zero pairs.

Use a fixed bounded wait histogram with these upper bounds in seconds:
`<10`, `<20`, `<30`, `<60`, `<90`, `<120`, `<180`, `<300`, and `>=300`.
The displayed median is the upper bound of the bucket containing the middle
sample, labelled **estimated median**; the last bucket displays `≥300 s`
instead of a false exact number. Do not store raw per-player wait times in
D1. K1's queue DO may retain only the short-lived attempt state needed for
the room handoff. Metrics are internal aggregate information, not a public
presence endpoint.

An accepted attempt gets one stable id. Count each transition once across
socket replacement, retries, DO restarts, and delayed room callbacks. The
queue persists its aggregate update with the corresponding state transition
before acknowledging it. A stale or duplicate callback cannot raise counts.
X1's Zod event/gauge catalogue and admin report are extended in an explicit
contract-change commit; public analytics routes never accept these server
gauges. Document in the report when a backfill is incomplete so the numbers
are not presented as exact.

---

## 6. Authority, compatibility, and failure handling

- Better Auth session validation and ticket minting stay in the web Worker.
  The game Worker verifies a short-lived signed `queue` ticket and never
  reads auth or rating tables. A forged, expired, guest, or incomplete-account
  ticket fails closed; it never becomes a guest queue entry.
- The queue DO owns matching, incident counting, and cooldown expiry. Room
  outcomes come only through the existing trusted Worker/DO path, with a
  room-instance id and stable attempt ids. Browsers cannot submit incidents
  or choose a rating, `joinedAt`, or `retryAt`.
- K1's frozen protocol remains `v: 1`. Add optional fields or new messages
  only with a compatibility plan: old cached clients must not crash when they
  receive them. Prefer an existing error shape for cooldown if it is suitable;
  otherwise add and test a new Zod-validated code. Never expose private ids,
  tickets, or incident timestamps to the opponent or presence readers.
- A failed presence read or metrics rollup does not block queueing. A failed
  room creation restores the pair. A stale room callback cannot penalize a
  new attempt. No change lets a client bypass the MatchRoom's engine-based
  move validation or change R2's post-game rating decision.

---

## 7. Verification and release gate

### Worker and contract tests

- Boundary tests at 29,999/30,000/59,999/60,000/89,999/90,000/119,999/
  120,000 ms; exact rating gaps; long-waiter versus new entrant; deterministic
  oldest-first and nearest-opponent ties; self-pair prevention.
- Hibernation/restart tests: persisted `joinedAt` survives, the next threshold
  alarm is scheduled only when useful, and an empty queue has no alarm.
- Presence: distinct-account count across tab replacement and reservation,
  10-second cache, signed-in gate, stale cleanup, unavailable fallback, and
  absence of user or rating data in the response.
- Incident cases: credited and excluded cases in §4, duplicate/stale room
  callback, rolling-24-hour edge, cooldown expiry, DO restart, and invite/local
  access during cooldown. A server outage does not punish either player.
- Metric snapshots: one count per transition, midnight attribution,
  idempotent X1 upsert and catch-up, wait buckets, preliminary cohorts,
  zero-denominator handling, and privacy of public routes.
- Compatibility: old `v: 1` PWA clients ignore optional queue additions or
  receive a supported error; malformed API/WebSocket payloads fail Zod.

### Browser and preview checks

- Two complete accounts at different ratings enter from separate devices:
  initial gap holds, widened gap pairs at the expected threshold, both reach
  the same pre-claimed rated room, and the result offers a working re-queue.
- A real no-show returns the available player with its wait preserved. After
  the chosen threshold of attributable incidents, the abandoning account
  sees a timed queue block but can still create or join an invite room.
- `/online` shows a plausible waiting count to signed-in accounts, hides it
  from guests, and keeps the queue usable when the count service is down.
- Internal X1 metrics reconcile with the controlled queue attempts and room
  outcomes. Verify `pnpm check:hibernation`, `pnpm test:worker`,
  `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` before declaring K2 shipped.

K2 is done when these checks pass on the merged K1 contract and preview
demonstrates widening, presence, re-queue, cooldown, and measured queue
outcomes. Mark K2 shipped in `docs/shaxda-v2.md` only after that verification.

---

## 8. Decisions and open choice

| ID | Draft decision | Reason |
| --- | --- | --- |
| K2-D1 | Window grows by 100 rating points every 30 seconds to ±400, then becomes unbounded at 120 seconds. | Makes the brief's example deterministic and ensures the longest waiter can eventually pair. |
| K2-D2 | The older account's wider window is sufficient for a pair. | Gives the long waiter a real benefit when new players arrive. |
| K2-D3 | Presence is a 10-second cached count, visible only to signed-in accounts. | Small, anonymous, low-cost signal; never a live roster. |
| K2-D4 | Re-queue is an explicit new attempt with a fresh ticket. | Avoids surprising automatic entry and stale rating snapshots. |
| K2-D5 | Only attributable no-action room failures count as incidents. | Normal cancellation and uncertain outages should not punish players. |
| K2-D6 | Queue metrics are server-owned daily aggregates; median is a labelled histogram estimate. | Avoids raw per-game analytics rows and makes repeated X1 rollups safe. |

The founder's cooldown severity choice is pending. The conservative 5/30
minute schedule in §4 is the default for implementation planning until that
choice is resolved; change it here before K2 activation if directed.
