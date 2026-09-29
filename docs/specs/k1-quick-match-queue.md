# K1 — Quick-Match Queue (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                  |
| Wave       | 3, then a community beta at scheduled play windows                                                                                                                                                                                                                                                                                                                                                              |
| Depends on | H1, R1, R2, X1b (P13 counters)                                                                                                                                                                                                                                                                                                                                                                                  |
| Register   | F1, F6, P1, P3, P13, P15                                                                                                                                                                                                                                                                                                                                                                                        |
| Contracts  | Owns the queue protocol of [§6.4](v2-contracts.md#64-quick-match-queue), defined in §3 below. Consumes [§3](v2-contracts.md#3-room-lifecycle), [§4.1](v2-contracts.md#41-which-endings-write-a-row), [§6.2](v2-contracts.md#62-server-to-client), [§6.3](v2-contracts.md#63-client-to-server), [§9](v2-contracts.md#9-metrics-dictionary), [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone) |
| Brief      | [`docs/shaxda-v2.md`](../shaxda-v2.md) §6.4, §11 (K1)                                                                                                                                                                                                                                                                                                                                                           |
| Touches    | `packages/shared`, `packages/i18n`, web identity route and `/online`, `worker/src` (new `matchmaking-queue.ts`, `queue-policy.ts`; `index.ts`, `room-coordinator.ts`, `match-room.ts`), `worker/wrangler*.toml`, `web/wrangler*.jsonc`, `scripts/check-hibernation.mjs`, `tests/e2e`                                                                                                                            |

K1 lets a complete account find an opponent without sharing a code: one
hibernating queue Durable Object pairs accounts under P15, hands each pair to
a pre-claimed rated quick room, recovers no-shows, and counts the funnel with
P13 counters. The room lifecycle, consent, and ledger stay with H1 and R2
([§3](v2-contracts.md#3-room-lifecycle)); ratings with R1; presence, re-queue,
and cooldowns with K2; analytics tables and the admin page with X1.

---

## 1. Outcome and non-goals

### Outcome

A complete account on `/online` reads that quick games are rated and public,
taps one action, and lands in a rated quick room with another account within
the P15 windows. It can cancel until then; if the opponent does not arrive
within 45 s, it is searching again with its original wait.

### Must

1. One global `MatchmakingQueue` Durable Object: `ctx.acceptWebSocket`, no
   `setInterval` or lifecycle `setTimeout`, alarms only while an entry waits
   or a handoff is unfinished (§4.4).
2. First-frame `queue` tickets with R1's rating snapshot, verified without
   D1 or auth reads, single-use; one entry per account with epoch takeover.
3. Deterministic P15 pairing, never an account with itself (§3.3).
4. An idempotent `pairId` handoff to a pre-claimed rated quick room, with
   `matched` only after init and entry by normal `join` tickets (§4.3).
5. Recovery from setup failure, dropped sockets, join races, and no-shows;
   capacity and join-rate limits; Zod on every frame and internal body.
6. The P13 queue counters (§3.6); `pnpm check:hibernation` extended.
7. The `/online` entry for complete accounts, with R2's disclosure, Somali
   copy, and the `QUICK_MATCH_ENABLED` kill switch.

### Should

Play the existing sound (per the saved preference) and show a visible banner
when matched in a background tab. No push notifications.

### Not in K1

Guest or friendly quick match, regional queues, bots, async play, ETA,
RD-aware pairing, waiting presence, re-queue from the result, cooldowns (K2,
P16), public queue numbers, new game rules, rating arithmetic.

---

## 2. Decisions and dependencies

| ID  | How K1 applies it ([register](README.md#decision-register))                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Quick is always rated: no friendly option, both consents recorded at init, every quick rematch vote rated (R2). The ledger enforces `mode = 'invite' OR rated = 1`.                     |
| F6  | After 120 s of its own wait every account, new and provisional included, admits any gap; the other player's window must admit it too (P15), so a wide pair forms once both have waited. |
| P1  | The room reports when play began (`queue_started`). Any ending before it, a no-show included, writes no row.                                                                            |
| P3  | Entering the queue is consent: `joinQueue` carries the `disclosureV` the player saw, and the room records it for that seat. Cached clients have no queue UI and cannot enter.           |
| P13 | The queue DO only increments the `queue_*` names of §3.6 and never reads D1.                                                                                                            |
| P15 | The pairing function (§3.3) and the 45 s no-show grace (§4.3).                                                                                                                          |

Also cited: F2 and P2 (quick games are public and the entry says so), F4 (a
no-show is not a loss), P7 (a quick game may be `skipped:pairCap`), P10 (no
cross-room registry), P11 (pending deletion stops tickets), Q3 (beta targets).

| Dependency | Provides                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1         | Room lifecycle ([§3](v2-contracts.md#3-room-lifecycle)), random first starting seat ([§3.4](v2-contracts.md#34-game-rules-inside-the-room)), room fields `mode`/`ratedRequest`/`consent`, quick ledger rows, game `DB`. |
| R2         | Consent rules ([§6.3](v2-contracts.md#63-client-to-server)), `RATED_DISCLOSURE_V` (`@shaxda/shared/rated-play`) and `RatedDisclosure.svelte`, `consentClosed`, `ratedOnlyRematch`, game var `RATED_PLAY_ENABLED`.       |
| R1         | `player_rating` and the pure effective-RD function in `packages/rating` ([§7.3](v2-contracts.md#73-arithmetic-and-reads)), used when the web Worker mints a `queue` ticket.                                             |
| X1b        | `incrementCounter` in `@shaxda/db/counters`, the `onlineCounterNameSchema` allowlist in `packages/shared`, game var `ANALYTICS_ENABLED`.                                                                                |

K1 unblocks K2, which uses P15 as defined here and does not redefine it.

---

## 3. Contracts

### 3.1 Queue ticket

- `ticketActionSchema` gains `queue`: no `roomCode`, plus `rating` (R1's
  full-precision rating; finite, absolute value below 10 000) and `rd`
  (effective RD at mint; finite, above 0, at most 350), which every other
  action forbids. Lifetime (90 s), skew, and secret rotation are unchanged.
- `POST /api/online/identity { action: "queue" }` keeps every existing check
  and `no-store`, answers `403 quick-match-disabled` unless the web var
  `QUICK_MATCH_ENABLED` is `"true"`, and reads `player_rating` by primary
  key. No row → 1500/350, a pairing input that is never shown.
- The longest possible `queue` ticket must fit the 1,024-character bound, or
  that commit raises it with tests. `GET /api/online/identity` gains optional
  `quickMatch: boolean`, so the prerendered `/online` learns the web var.

### 3.2 Queue socket protocol

`GET /queue/ws` on the game Worker answers 426 without an upgrade and 403
when `ALLOWED_ORIGIN` is set and `Origin` differs; only this path reaches the
DO, and `/internal/*` is never routed. Frames carry `v: 1` and `type`, are
at most 4,096 bytes, and never carry a user id, rating, RD, JTI, ticket, or
opponent identity.

| Direction      | Frame         | Fields and meaning                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client → queue | `joinQueue`   | `identityTicket` (`queue` action), `disclosureV: number`. Must be the first frame; creates the account's entry or takes it over.                                                                                                                                                                                                                                                                          |
| client → queue | `cancelQueue` | No fields. Leaves the queue if this socket's epoch owns the entry.                                                                                                                                                                                                                                                                                                                                        |
| client → queue | `ping`        | Exactly `{"v":1,"type":"ping"}` every 30 s, answered by `ctx.setWebSocketAutoResponse` with `{"v":1,"type":"pong"}` without waking the DO.                                                                                                                                                                                                                                                                |
| queue → client | `queueStatus` | `state: "waiting" \| "handoff" \| "settled" \| "cancelled"`; `joinedAt` (server ms) with `waiting`; optional `notice: "opponentNoShow" \| "handoffFailed"`.                                                                                                                                                                                                                                               |
| queue → client | `matched`     | `roomCode`, `pairId` (128 random bits, base64url). Sent only after the room is initialized.                                                                                                                                                                                                                                                                                                               |
| queue → client | `queueError`  | `code`: `invalidMessage` (malformed, oversize, unknown, or a first frame other than `joinQueue`), `identityInvalid`, `identityExpired`, `identityScope`, `identityReplayed`, `identityUnavailable`, `disclosureOutdated`, `queueDisabled`, `queueFull`, `rateLimited`, `replaced`, `matchExpired`, `handoffFailed`. The socket then closes with 4000; after `settled` or `cancelled` it closes with 1000. |

After the freeze only optional keys may be added: a new server `type` breaks
cached clients ([§6.2](v2-contracts.md#62-server-to-client)). `queueError.code`
is a string of at most 64 characters, and the client shows a generic message
for a code it does not know; `cooldown` with `retryAt` is reserved for K2 and
never sent by K1 ([§6.4](v2-contracts.md#64-quick-match-queue)).

### 3.3 Pairing (P15)

- `window(w)` for an entry's own wait `w` on the queue clock: 100 below
  30 s, 200 below 60 s, 300 below 90 s, 400 below 120 s, unbounded after.
- An entry is eligible when it is `waiting`, its current-epoch socket is
  open, and its `disclosureV` equals the current `RATED_DISCLOSURE_V`. Two
  eligible entries of different accounts pair when their full-precision
  rating gap is at most the smaller of their two windows, boundary
  inclusive: **both** windows must admit it.
- On every join, takeover, return, and alarm, repeatedly take the pair with
  the smallest `max(joinedAtA, joinedAtB)`, then the smaller gap, then the
  lexicographically smaller sorted pair of user ids. Seat A is the earlier
  `joinedAt`; the starting seat is random (H1).
- `joinedAt` is set at entry creation and survives takeover and every
  return. RD is stored with the entry; P15 does not use it.

### 3.4 Queue DO state

KV storage of the SQLite-backed class; each transition is one `put` before
any reply or outbound call.

| Key                   | Value                                                                                                                                                                                                   | Lifetime                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `entry:<userId>`      | `joinedAt`, `epoch`, `rating`, `rd`, `disclosureV`, `display` (username, avatar), `state: "waiting" \| "handoff" \| "returning"`, `pairId?`, `returnUntil?`                                             | Until cancel, close while waiting, settle, removal                              |
| `pair:<pairId>`       | `roomCode`, `seats { A, B }` (user ids), `stage` (`reserving` → `initializing` → `announced` → `settled` → `started` → `completed`, or `closed`), `setupDeadline`, `noShowDeadline?`, `resolveAttempts` | Ids dropped at settle; deleted when closed, at completion, or 24 h after settle |
| `jti:<jti>`           | The ticket's `exp`                                                                                                                                                                                      | `exp` + 5 s                                                                     |
| `joins:<userId>`      | Accepted join times (at most 10)                                                                                                                                                                        | 60 s                                                                            |
| `reserveBlockedUntil` | Timestamp                                                                                                                                                                                               | 10 s after a failed reservation                                                 |
| Socket attachment     | `acceptedAt`, `userId?`, `epoch?`, `frameTimes`; never a ticket, rating, or RD                                                                                                                          | The socket                                                                      |

### 3.5 Internal handoff paths

Reachable only through Durable Object stubs; every body is Zod-validated.

| Path (caller)                                       | Request → response                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /internal/coordinator/reserve`, quick (queue) | `{ roomCode, quickPairId }` → `{ ok: true }` or `{ ok: false, code: "capacityFull" \| "roomCodeTaken" }`. No IP and no per-IP limits; the unique-code and 500-room global checks stay; a repeat for the same pair answers `ok`.                                                                                                     |
| `POST /internal/rooms/init`, quick (queue)          | `{ roomCode, quick: { pairId, seats: { A, B } } }`, each seat `{ userId, username, avatarMode, imageUrl, disclosureV }` from its verified ticket and `joinQueue` → 200, also for a repeat with the same `pairId`; 409 for any other room. The public `POST /rooms` rejects these fields with 400 ([§6.1](v2-contracts.md#61-http)). |
| `POST /internal/rooms/quick-resolve` (queue)        | `{ pairId }` → `{ outcome: "settled" }` if both seats have connected; else the room cancels itself → `{ outcome: "cancelled", joined: { A, B } }`; a missing room → `{ outcome: "gone" }`.                                                                                                                                          |
| `POST /internal/queue/room-report` (room)           | `{ pairId, event: "seatsJoined" \| "started" \| "completed" }` → 204. Best effort; the room persists a flag with the transition and sends each event once.                                                                                                                                                                          |

### 3.6 Queue counters (P13)

These names join `onlineCounterNameSchema`, the P13 allowlist
([§9](v2-contracts.md#9-metrics-dictionary)); each adds 1 to `event_daily`
on the UTC day of its transition.

| Name                  | Adds 1 when                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `queue_joined`        | A `joinQueue` creates a new entry (not a takeover or a return).                                                                                                                                                  |
| `queue_paired`        | A pair is announced (`matched` sent after init).                                                                                                                                                                 |
| `queue_wait_<bucket>` | Once per player at announcement, for `announcedAt − joinedAt`. Buckets: `lt10s`, `lt20s`, `lt30s`, `lt60s`, `lt90s`, `lt120s`, `lt180s`, `lt300s` (each from the previous bound up to N s, exclusive), `ge300s`. |
| `queue_started`       | The room first reports that play began (P1).                                                                                                                                                                     |
| `queue_completed`     | The room first reports that a match in which play began reached game over.                                                                                                                                       |
| `queue_no_show`       | An announced pair is cancelled because a seat did not join within 45 s or cancelled after `matched`; one per pair.                                                                                               |

The queue persists the transition, then writes through the game Worker's
`DB` with `incrementCounters(db, names, day, now)`, which K1 adds to
`@shaxda/db/counters` (X1b's upsert per name, one `db.batch`). `queue_paired`
and its two buckets share a batch, so Σ `queue_wait_*` = 2 × `queue_paired`.
A crash between the steps loses that increment, never doubles it. Failures
are logged without ids and dropped; `ANALYTICS_ENABLED = "false"` skips them.

### 3.7 Quick-room additions

| Topic           | MatchRoom rule                                                                                                                                                                                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| State           | Gains `quick: { pairId, connected, reported }`; `MatchRoomEnv` gains `MATCH_QUEUE`. Init sets H1's `options` to `{ mode: "quick", ratedRequest: true }`, fills both slots with the two account seats and both `consent` slots with `{ accept: true, disclosureV }`, and draws the starting seat at random (H1); before play, `matchStatus` shows all of it. |
| Until both join | Until both seats have connected, actions get `waitingForOpponent` and no turn clock, nudge, or claim runs. A guest or third account gets `roomFull`; a `join` ticket claims only its own seat.                                                                                                                                                              |
| Consent         | `rateConsent` gets `consentClosed`; a friendly rematch vote gets `ratedOnlyRematch` (R2).                                                                                                                                                                                                                                                                   |
| Cancellation    | Sends `error { code: "quickCancelled" }`, closes sockets, releases the reservation, and deletes storage.                                                                                                                                                                                                                                                    |

---

## 4. Behaviour and failure handling

### 4.1 Entry lifecycle

```txt
joinQueue ─► waiting ─(pair)─► reserving ─► initializing ─► announced
announced ─(both seats connected)─► settled ─(play began)─► started ─► completed
announced ─(45 s, or cancel after matched)─► room cancelled:
           each connected seat returns, each never-connected seat is removed
setup failure ─► both return (handoffFailed)
waiting ─(cancelQueue, or its socket closes)─► removed
return: socket open ─► waiting (original joinedAt); closed ─► returning (30 s)
```

### 4.2 Join, takeover, cancel

| Event              | Behaviour                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `joinQueue`        | Checks in order: frame and schema, switches, secret, ticket, JTI (recorded once the ticket verifies), `disclosureV`, 10 joins per account per rolling 60 s (takeovers included), 200 entries for a new entry.    |
| Join with an entry | Takeover: epoch + 1, `joinedAt` kept; rating, RD, display, and `disclosureV` refreshed; `replaced` to the old socket; the current state, or the same `matched`, to the new one. Older epochs are ignored.        |
| `cancelQueue`      | While waiting, the entry is removed. During setup the canceller leaves when setup ends, a created room is cancelled, the other entry returns, and nothing is counted. After `matched`, §4.3 step 6 runs at once. |
| Socket close       | Removes a `waiting` entry; during a handoff the deadline decides.                                                                                                                                                |
| Abuse              | A socket without `joinQueue` after 10 s closes at the next wake; upgrades get 503 at 400 sockets; each socket may send 10 frames per 10 s, auto-answered pings excluded.                                         |

### 4.3 Handoff and no-show

| Step        | Rule                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Pair     | The pair record and both `handoff` entries are one `put` before any outbound call, so an interleaved event cannot reuse either account.                                                                                                                                                                                                                                                                                 |
| 2. Setup    | Reserve a fresh code, then initialize the room; on `roomCodeTaken` or 409, release it and try a new code, at most 5. After a crash, setup resumes at `setupDeadline` (pairing + 15 s); reserve and init are idempotent per `pairId`, so no second room appears.                                                                                                                                                         |
| 3. Failure  | Capacity, an init error, or five collisions: release the reservation, return both entries with `handoffFailed`, block reservations for 10 s.                                                                                                                                                                                                                                                                            |
| 4. Announce | Persist `noShowDeadline = announcedAt + 45 000`, send `matched` to each open socket, then write the counters.                                                                                                                                                                                                                                                                                                           |
| 5. Enter    | Clients keep the queue socket, mint `join` tickets, open the room like an invite link (`/online?room=<code>`), and claim their seats. `seatsJoined` settles the pair: `queueStatus settled`, sockets closed, entries deleted, user ids dropped.                                                                                                                                                                         |
| 6. Resolve  | At the deadline, or a cancel after `matched`, call quick-resolve. `settled` settles (room state wins the both-connect race). `cancelled` adds `queue_no_show`, returns each connected seat with `opponentNoShow`, and removes each never-connected seat with `matchExpired`. `gone` (an earlier answer was lost) returns both. A failed call retries every 5 s; after two minutes both entries go with `handoffFailed`. |
| Client      | If the queue socket drops before the room confirms the seat, reconnect with a fresh ticket (the takeover resends `matched`); afterwards ignore it. On `quickCancelled`, wait for `queueStatus` if the queue socket is open, else send `joinQueue` to take over the `returning` entry.                                                                                                                                   |

A cancelled room never began play: no outbox, no row, no loss (F4, P1,
[§4.1](v2-contracts.md#41-which-endings-write-a-row)). After settle the room
rules apply: a resign or claim before play began writes no row, and after it
is a loss in every phase.

### 4.4 Alarms

One `scheduleAlarm()` sets or deletes the alarm. It sets the earliest of each
unfinished pair's `setupDeadline`, `noShowDeadline`, or resolve retry; each
`returnUntil`; and, while two or more entries wait, the next window boundary
(`joinedAt` + 30, 60, 90, or 120 s) and `reserveBlockedUntil`. Otherwise it
deletes the alarm: an empty queue or a lone waiter has none. Settled pairs,
JTI markers, and join lists are pruned on wake only.

### 4.5 Hibernation, deploys, and switches

| Situation              | Behaviour                                                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hibernation            | State lives in storage and attachments, so any event rebuilds it.                                                                                                                                   |
| Restart or deploy      | Each wake removes `waiting` entries whose socket is not in `ctx.getWebSockets()`. A deploy drops every socket, so waiting players re-enter as new entries; handoffs finish through their deadlines. |
| Game switch off        | `QUICK_MATCH_ENABLED` or `RATED_PLAY_ENABLED` (F1) not `"true"`: joins get `queueDisabled`, waiting entries are cleared at the next wake, announced handoffs and rooms continue.                    |
| Web switch off         | `/online` hides the entry and `queue` tickets are refused.                                                                                                                                          |
| Disclosure bump        | Entries with an old `disclosureV` get `disclosureOutdated` at the next wake and the client reloads. A room keeps the version recorded at init as its consent.                                       |
| Pending deletion (P11) | No `queue` or `join` ticket is minted, so a paired entry of that account ends as a no-show for its seat.                                                                                            |

---

## 5. Privacy and access

- Quick games are rated, so they follow the rated rows of
  [§5](v2-contracts.md#5-access-matrix): `/match/<id>` with its replay,
  stats, and rating status is open to everyone, and the game is listed on
  `/u/<username>`. K1 adds no reader.
- The entry says so first (F2, P2) with R2's `RatedDisclosure.svelte` and
  K1's always-rated line; pressing the action is consent (P3).
- User ids, ratings, and RD stay in queue storage and go at settle, cancel,
  or removal. Rooms show only username and avatar, as invite rooms do.
- Tickets travel in the first frame, never in a URL. Logs carry `pairId`,
  stage, and codes, never tickets, user ids, IPs, or ratings.
- Counters are daily aggregates without identifiers (P12).

---

## 6. Resource budget

| Per quick game (happy path) | Cost                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Web identity `POST`         | 2 `queue` (one `player_rating` primary-key read each) and 2 `join`                                         |
| Queue DO wake-ups           | 2 joins and 3 room reports; up to 4 boundary alarms per entry while two or more wait; pings wake nothing   |
| Outbound queue calls        | 1 reserve and 1 init (+1 each per code collision; +1 quick-resolve on a no-show)                           |
| D1 by K1                    | 5 requests, 7 `event_daily` upserts, no reads; the ledger rows are H1's                                    |
| `event_daily` growth        | At most 14 rows per day for all K1 names                                                                   |
| Queue storage               | Under 1 KiB per entry (at most 200), under 0.5 KiB per pair (≤ 24 h after settle), ~100 B per JTI (≤ 95 s) |
| Idle                        | An empty queue or a lone waiter: no alarm, no wake-up; hibernated sockets bill no duration                 |

---

## 7. Somali copy

Keys are relative to `onlineGame.quickMatch` unless written in full, behind
`TODO(translation-review)`, using the README glossary. R2 owns the disclosure
(`ratedPlay.disclosure.*`); K1 reuses `onlineGame.errors.identity*`,
`errors.rateLimited`, `errors.disclosureOutdated`, `connection.replaced`,
`notices.reconnecting`, and the `identity` actions.

| Key                                | Somali draft                                                                                         | Meaning                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `title`                            | Kulan degdeg ah                                                                                      | Quick match                          |
| `start`                            | Raadi kulan degdeg ah                                                                                | Find a quick match                   |
| `alwaysRated`                      | Kulanka degdegga ah had iyo jeer waa Tartan.                                                         | Quick matches are always rated       |
| `accountNeeded`                    | Kulan degdeg ah wuxuu u baahan yahay akoon dhammaystiran.                                            | Needs a complete account             |
| `searching`                        | Ciyaaryahan ayaa laguu raadinayaa…                                                                   | Searching for a player               |
| `widening`                         | Inta aad sugayso, waxaa laguu keeni karaa ciyaaryahan darajadiisu kaa fog tahay.                     | The search widens while you wait     |
| `cancel`                           | Jooji raadinta                                                                                       | Stop searching                       |
| `matched`                          | Kulan ayaa la helay. Waxaad gelaysaa qolka…                                                          | Match found; entering the room       |
| `notices.opponentNoShow`           | Ciyaaryahankii kale ma iman. Raadintu way sii socotaa, waqtigaagii sugitaanka waa la xafiday.        | Opponent absent; wait time kept      |
| `notices.handoffFailed`            | Qolka lama diyaarin karin. Raadintu way sii socotaa.                                                 | Room not prepared; still searching   |
| `errors.queueFull`                 | Safku hadda wuu buuxaa; wax yar kadib isku day.                                                      | Queue full                           |
| `errors.queueDisabled`             | Kulanka degdegga ah hadda lama heli karo. Weli qol ayaad samayn kartaa oo saaxiib ku casuumi kartaa. | Unavailable; invite play still works |
| `errors.matchExpired`              | Qolka lama gelin waqtigii loogu talagalay, kulankiina wuu dhacay. Dib u raadi.                       | You did not join in time             |
| `errors.handoffFailed`             | Kulanka lama bilaabi karin. Dib u raadi.                                                             | Handoff could not be recovered       |
| `onlineGame.errors.quickCancelled` | Kulankan waa la joojiyay maadaama ciyaaryahan uusan iman.                                            | Room error after a no-show           |

---

## 8. Implementation slices

Each code slice carries its tests; slice 1 applies brief §6.4 first.

1. `docs: apply the V2 queue Durable Object rule to AGENTS and the PRD`
2. `feat(shared): add the queue ticket action and rating claims`
3. `feat(shared): add queue protocol schemas and counter names`
4. `feat(web): mint queue tickets with the pairing snapshot`
5. `feat(online): reserve quick rooms in the coordinator`
6. `feat(online): initialize and resolve pre-claimed quick rooms`
7. `feat(online): add the MatchmakingQueue Durable Object` (binding and `v3`
   migration in `worker/wrangler.toml`, membership, limits, pairing, alarms)
8. `chore(worker): extend the hibernation check to the queue` (the scan
   already covers `worker/src`; `matchmaking-queue.ts` must also call
   `ctx.acceptWebSocket(` and contain exactly one `setAlarm(` call)
9. `feat(online): hand quick pairs to rooms and recover no-shows`
10. `feat(online): count queue transitions`
11. `feat(i18n): add quick-match Somali copy`
12. `feat(web): add quick match to /online`
13. `test(e2e): cover quick match between two accounts`
14. `build: add quick-match bindings and flags for preview and production`

---

## 9. Acceptance tests

Workers tests run on Miniflare with an injected clock. The e2e file is
`tests/e2e/quick-match.spec.ts` on the shared local D1
([§10.4](v2-contracts.md#104-shared-local-d1-in-e2e)).

| Layer   | Area                | Cases                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit    | Ticket and frames   | `queue` requires `rating` and `rd` and forbids `roomCode`; other actions forbid the claims; NaN, infinities, and `rd` of 0 or above 350 fail; the worst-case ticket fits the bound; every frame parses; oversize and unknown frames fail.                                                                                                                |
| Unit    | Pairing             | Every window boundary for both players (29 999 and 30 000 ms through 119 999 and 120 000 ms; gaps of exactly 100–400 and 0.001 above): a new arrival never pairs beyond 100, even against a ten-minute waiter. Deterministic ties with three and four entries. Buckets at each bound.                                                                    |
| Workers | Tickets             | Expiry, tampering, `join` and `create` tickets, a `roomCode` in a queue ticket, the previous secret, no secret; a replayed JTI gets `identityReplayed`, also after cancel and takeover. The queue issues no D1 statement except counter upserts, and no auth call.                                                                                       |
| Workers | Takeover, limits    | Takeover while waiting, in setup, after `matched`, and from `returning` (which ends at exactly 30 s); an old socket's cancel or close is ignored. The 11th join in 60 s, the 201st entry (a takeover still works), the 401st socket, 11 frames in 10 s, a 4,097-byte frame, a wrong first frame; switches off; an old `disclosureV`.                     |
| Workers | Pairing, alarms     | A waited 100 s, B 0 s, gap 350: paired exactly when B reaches 90 s. Self-pairing is impossible; a join and an alarm together never put one account in two pairs; an empty queue and a lone waiter have no alarm; entries survive hibernation; socketless waiting entries go after a restart.                                                             |
| Workers | Handoff             | Repeated reserve and init for one `pairId` give one reservation and one room; crashes after reserve, init, or announce resume; collisions retry up to 5 codes; `capacityFull` returns both and counts no pair; the coordinator's active count returns to its prior value.                                                                                |
| Workers | Pre-claimed room    | Guest and third account get `roomFull`; each `join` ticket claims only its seat; `waitingForOpponent` before both connect; a never-connected seat is not claimable; consent shows before play; both starting seats occur; `rateConsent` → `consentClosed`; a friendly rematch vote → `ratedOnlyRematch`; public `POST /rooms` with quick fields → 400.   |
| Workers | No-show             | Nothing at 44 999 ms; at 45 000 ms `quickCancelled`, reservation released, storage deleted, the connected seat back with its original `joinedAt`, `matchExpired` to the other, `queue_no_show` + 1, no `match` row. A seat connecting as the deadline fires wins; the pair settles. Cancels in each state; two cancels count one no-show.                |
| Workers | Counters            | Once per transition across takeover, retried alarms, duplicate reports, and restarts; Σ `queue_wait_*` = 2 × `queue_paired`; a failing `DB` does not stop the queue; `ANALYTICS_ENABLED = "false"` writes none.                                                                                                                                          |
| Web     | Identity, `/online` | `queue` refused signed out (401), incomplete (409), flag off (403), cross-origin (403); rating row versus none (1500/350); an inactive account's RD grows; `no-store`; `GET` returns `quickMatch`. The entry shows only for complete accounts with `quickMatch`, disclosure first; every state has Somali copy.                                          |
| e2e     | Two accounts        | Separate contexts get one code and two seats, see rated consent, place a piece each, and one resigns; after `save.status = "saved"` a signed-out context opens `/match/<id>`. Closing one context after `matched` returns the other to searching after 45 s with no row. Cancel, invite creation, guest join, and `pnpm check:e2e-isolation` still pass. |

### Sample matches

Outcomes follow [§4.3](v2-contracts.md#43-canonical-sample-matches). Quick
rooms never produce M1, M6, or M9 (F1, account-only queue); M8 and M10 apply
to quick rows unchanged. Case labels QM1–QM6 are local to this table.

| Case | Setup                                  | Ending                            | Ledger                                                                            | Who can open          | Rating               | Queue counters             |
| ---- | -------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- | --------------------- | -------------------- | -------------------------- |
| QM1  | Both seats connected (like M7)         | Seat A resigns before any action  | none                                                                              | —                     | —                    | paired                     |
| QM2  | Quick game (like M2, M5)               | Win or draw after play began      | row, `mode = quick`, `rated = 1`, `consent_policy_v` = the entries' `disclosureV` | public                | `processed`          | paired, started, completed |
| QM3  | The pair's 4th rated game in 24 h (M4) | Normal win                        | row                                                                               | public, "not counted" | `skipped:pairCap`    | paired, started, completed |
| QM4  | B never connects                       | Cancelled at 45 s                 | none; not a loss                                                                  | —                     | —                    | paired, no_show            |
| QM5  | Play began (like M3)                   | Idle claim while A owes a capture | row, `resignation`, `idle`                                                        | public                | `processed`, A loses | paired, started, completed |
| QM6  | After QM2, a friendly rematch vote     | Refused: `ratedOnlyRematch` (M9)  | no new row                                                                        | —                     | —                    | none                       |

---

## 10. Rollout and rollback

| Environment | Game Worker config                                                           | Web Worker config                               | `QUICK_MATCH_ENABLED`        |
| ----------- | ---------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------- |
| Tests, dev  | `worker/wrangler.toml`: `MATCH_QUEUE`, migration `v3`                        | `web/wrangler.jsonc` (read by local `vite dev`) | game `"true"`, web `"false"` |
| e2e         | `worker/wrangler.toml` via `scripts/start-worker-e2e.mjs`                    | `web/wrangler.e2e.jsonc`                        | both `"true"`                |
| Preview     | `worker/wrangler.preview.toml`: binding, `v3`                                | `web/wrangler.preview.jsonc`                    | `"false"` until enabled      |
| Production  | `worker/wrangler.production.toml`: binding, `v3`, route `shaxda.app/queue/*` | `web/wrangler.jsonc`                            | `"false"` until the beta     |

| Step        | What happens                                                                                                                                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy      | Per [§6.5](v2-contracts.md#65-deploy-order): the game Worker deploy carries DO migration `v3` (`new_sqlite_classes`, class `MatchmakingQueue`), the binding, and the route; the web Worker follows. No D1 migration: counter names are a Zod enum.                                                                               |
| Preview     | Enable the game var, then the web var. On two real devices (not two tabs): find each other, start and finish a rated quick game that saves and opens publicly; one device leaves after `matched` and the other searches again; cancel works; counters appear in X1's admin view; the queue logs `queueAlarm deleted` once empty. |
| Production  | Set wait and completion targets from Q3, then enable at a scheduled community play window and run the beta, reading the `queue_*` counters as raw counts beside any rate.                                                                                                                                                        |
| Kill switch | Web var off first (entry hidden, `queue` tickets refused), then game var off (joins refused, waiting entries cleared). Running rooms and saved quick games are unaffected and stay public.                                                                                                                                       |
| Rollback    | Switch off. A code rollback keeps the `v3` migration and the exported class; deleting the class needs a `deleted_classes` migration and is not part of rollback.                                                                                                                                                                 |

**Done when** two complete accounts on separate preview devices find each
other and start and finish a rated quick game without sharing anything; the
no-show and cancel paths recover as specified; waits appear in the counters;
the empty queue holds no alarm; and §9 passes, including
`pnpm check:hibernation`. Production enablement and the beta are separate
operational steps recorded in the ops record.
