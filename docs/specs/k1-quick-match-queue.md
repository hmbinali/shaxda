# K1 — Quick Match Queue (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; specification only. H1 and R1/R2 contracts must be merged and reconciled before implementation. |
| Brief | `docs/shaxda-v2.md` §6.4, §7, §11 (K1), §14 |
| Depends on | H1 match persistence and quick-room fields; R1 rating state; R2 rated-play policy |
| Workspace | `k1-quick-match-queue` |
| Unblocks | K2 queue quality |
| Touches | `packages/shared` ticket and queue schemas, web Worker ticket endpoint and rating read, game Worker and Wrangler configs, new queue Durable Object, MatchRoom/RoomCoordinator, `/online`, `packages/i18n`, tests and hibernation check |
| Freeze point | Additive queue wire messages freeze when K1 merges; later changes require an explicit contract-change commit. |

The V2 brief controls scope. The PRD controls the stack and infrastructure; the
game rules document controls play. K1 finds two account players and hands them
to the existing server-authoritative room. It does not change legal moves or
calculate ratings. The current checkout has V1.1-A2 tickets and invite rooms;
H1/R1/R2 are still draft specs here. Names below are proposed interfaces to
reconcile against their merged contracts, not claims that those features ship.

---

## 1. Outcome and boundary

A complete, signed-in account selects quick match on `/online`, sees a waiting
state, and either cancels or enters a room with another account without sharing
a code. The room is `mode: "quick"` and `rated: true` from trusted server state.
R2 may still skip the final rating event (for example, a pair cap); the UI must
not promise rating points for every completed quick game.

### Must

1. One global `MatchmakingQueue` Durable Object per deployment, with hibernating
   WebSockets, waiting entries keyed by private `userId`, and alarms only while
   it has waiting players or an unfinished match handoff.
2. A web-Worker-minted, short-lived `queue` identity ticket carries a trusted
   rating and effective RD snapshot. The game Worker verifies it without
   reading D1, Better Auth, cookies, or sessions.
3. One queue entry per account. A second tab takes over the entry and closes
   the previous queue socket; the older socket cannot cancel or accept a match.
4. Deterministic skill pairing on join and on an alarm, with a basic widening
   window. A user is never paired with themself.
5. Reserve a room through `RoomCoordinator`, initialize `MatchRoom` as quick and
   rated, pre-claim A/B for the two account ids, and only then notify both
   clients. Both clients mint normal room-scoped `join` tickets to enter.
6. Recover from a room creation failure, a dropped queue socket, a room join
   race, and a player who never enters. A connected player is automatically
   returned to waiting after a no-show; an abandoned room is released.
7. Keep guest invite play and account invite play working. Validate every HTTP
   and WebSocket payload with Zod; keep protocol `v: 1` additive.
8. Extend `pnpm check:hibernation` and cover the queue and handoff with Workers
   tests and an authenticated two-account E2E test.

### Out of scope

K2 owns tuned widening and wait-quality policy, waiting-player counts,
result-overlay requeue, repeat-abandon cooldowns, and queue funnel metrics.
There is no guest queue, unrated quick mode, regional partition, bot, push
notification, async play, new rating formula, or new game rule in K1. The K1
entry button and waiting state need Somali copy, but a public queue count does
not appear yet.

---

## 2. Ticket and trust boundary

The existing same-origin `/api/online/identity` `POST` adds action `queue`.
Its request, response and signed payload stay Zod-validated. `queue` forbids
`roomCode`, like `create`; `join` and `reconnect` still require one. The web
Worker requires a valid session and confirmed username, reads the current R1
`player_rating` row, and signs the existing account display claims plus
`rating` and `rd` only for `queue`. The ticket has the existing random `jti`,
issue time, and expiry.

`rating` is R1's full-precision current rating; `rd` is effective RD at mint
time, including inactivity. For an account without a rating row, use R1's
initial 1500/350 values. This is a pairing snapshot, never a rating event or
leaderboard assertion. Add finite positive bounds to the queue-only claims
and reject malformed values; the browser cannot supply or edit them. Keep the
existing 90-second ticket lifetime, current/previous secret rotation, and
no-store response. Check the encoded ticket against the existing maximum
length and raise that bound only with tests if the claims require it.

The game Worker routes `GET /queue/ws` upgrades to the single DO named
`global`. Reject a missing/invalid upgrade, disallowed origin, invalid
ticket, wrong action, expiry, or unavailable secret before adding a waiting
entry. The DO accepts the socket with `ctx.acceptWebSocket(...)`, verifies the
ticket, and stores only queue state and an attachment needed for hibernation.
Never persist the raw ticket or send `userId`, rating, RD, JTI, email, or
provider data in a queue or room message. Reuse the account ticket's public
display snapshot only after the room handoff. Queue tickets have single-use
JTIs; replays are rejected even after cancel until expiry, with lazily pruned,
bounded markers. The account id is the ownership key, not a username or IP.

The existing `join`/`reconnect` ticket verifier remains the sole way to claim
a quick-room socket. A supplied bad ticket cannot fall back to guest play.
Quick-room initialization is an internal Worker/DO operation, unavailable via
the public `POST /rooms` or a browser WebSocket. A client-sent `mode: "quick"`,
`rated: true`, or pre-claim list is ignored/rejected at public boundaries.

---

## 3. Queue state, pairing, and alarms

Persist a compact waiting record per user: rating, RD, original `joinedAt`,
socket epoch, and public display snapshot. The socket attachment carries the
user key and epoch so a hibernated instance can authorize messages. On wake,
reconcile records with live accepted sockets; do not pair a stale entry. An
account's second accepted socket replaces the first, keeps its original
waiting time, refreshes its rating/RD snapshot, increments its epoch, and
closes the prior socket. A late close/cancel from an older epoch is a no-op.
During a pending handoff, takeover attaches the new socket to the same
`pairId` and resends that room assignment; it cannot create another room.
An explicit cancel removes the entry immediately and acknowledges it. A socket
close/error removes a waiting entry; a client reload may enter again with a
fresh ticket.

**K1 pairing baseline.** For a waiting player aged less than 30 seconds, the
maximum rating gap is 100; from 30 to 89 seconds, 300; from 90 seconds, any
gap. Both players must admit the pair under their own current window.
Effective RD is carried and tested; in K1 it identifies an uncertain player
for UI explanation and future K2 tuning rather than overriding the widening
rule. Thus a new/provisional account can meet any waiting account after a
short wait, as the founder chose. K2 may tune thresholds and RD-aware matching
without changing the queue protocol. Never use rounded display ratings.

At every join, replacement, cancel, and alarm, consider all eligible pairs.
Choose the pair with the earliest `max(joinedAtA, joinedAtB)` (the first time
both were waiting); break ties by smaller absolute rating gap, then sorted
user ids. Mark both entries as a pending handoff before awaiting coordinator
or room calls so a reentrant event cannot assign either account twice. Set
the next alarm to the earliest waiting player's next window boundary or an
unfinished handoff deadline; if no future boundary exists, a bounded
stale-entry check can be scheduled while someone waits. Delete the alarm when
both waiting and handoff sets are empty. No periodic timer, `setInterval`,
lifecycle `setTimeout`, or normal socket `accept()` is permitted. A pending
handoff counts as non-empty queue work until confirmed or rolled back, so its
deadline alarm obeys §6.4.

Cap waiting sockets at a documented operational limit and return a Somali
retry state at capacity. Keep a basic queue-join rate limit keyed by account
(for example, 10 joins per rolling minute); tab takeover is allowed within
that budget. Apply existing edge/IP protections where available, without
making public IP the identity key. A capacity/rate rejection must not create
a room. K2 may add stronger abuse cooldowns later.

---

## 4. Idempotent room handoff

Use a random opaque `pairId` for each pending pair. The queue is the only
component allowed to request a quick reservation. Extend the coordinator's
internal reservation path to accept a trusted quick source with an idempotent
`pairId`; it still enforces unique room codes and the global active-room cap.
Quick creation does not consume the guest per-IP Turnstile/create quota, but
queue join has its own account quota. A failed reservation leaves the two
entries waiting with their original `joinedAt` and a recoverable error.

Before sending `matched`, initialize MatchRoom with immutable
`mode: "quick"`, `rated: true`, `pairId`, and two distinct pre-claimed account
seats. Randomize the starting seat using H1's rule. A and B are assigned
without relying on who connects first. Store the private user ids and
username/avatar snapshots only in room state. Neither guest identity nor a
third account can occupy these seats, even if they guess the room code. A
valid room-scoped `join` ticket can attach only to its matching pre-claimed
seat; reconnect continues to use the existing account epoch/JTI rules.
Return the existing room status and game state only to authorized players.
The room does not start or record a match until both seats connect. A quick
room cannot be created through the public invite endpoint by forging options.

The queue persists `pairId`, room code, both user ids, reservation/init stage,
and the handoff deadline. Coordinator reserve and room init are idempotent for
that `pairId`; a retry may read the same room but cannot create a second one.
Only after successful init does each live queue socket receive
`matched { roomCode, pairId }`. Clients keep the queue connection during
handoff, mint fresh room-scoped `join` tickets, and open the room socket.
If one queue socket was lost before notification, revalidate socket presence
and roll back the pair or let the handoff deadline recover it. On errors,
release a reserved room safely and return eligible live players to waiting.
Never disclose a room code before both seats are reserved.

The no-show deadline is **45 seconds after room initialization and attempted
delivery of both `matched` notices** (pending founder confirmation in §7).
At the deadline, the queue asks MatchRoom for
the authoritative connected/pre-claim state. If both have joined, finalize
the handoff and close the queue sockets. The room may notify the queue as
soon as its second seat joins; the alarm is the recovery backstop. If only
one joined, abort the unstarted room through an idempotent internal operation,
release its coordinator reservation, and restore the present account to
waiting with its original `joinedAt`; notify its client to leave the dead room
and resume searching. If its queue socket was lost, the room sends a
recoverable no-show status and the client obtains a new queue ticket to
re-enter automatically. Discard the absent account's entry. If neither
joined, abort and remove both. If both joined just as the alarm fires, room
state wins and the room must not be aborted. Once any game action is accepted,
abort is forbidden; normal room disconnect/claim-win rules take over.
No-show before the first action is not a game result or a rated loss and
writes no match ledger row.

Room cleanup and reservation release must be retryable after a DO restart or
partial failure. Keep a pending handoff until it is resolved; a retried alarm
uses `pairId` and room status rather than issuing duplicate `matched` rooms.
The coordinator's active-room count returns to its prior value after an
aborted handoff. Do not use D1 for queue membership or per-move records.

---

## 5. Protocol and `/online` experience

Add queue-specific Zod schemas beside the existing `v: 1` room protocol;
do not change existing invite message meanings. Suggested messages:

| Direction | Message | Meaning |
| --- | --- | --- |
| Client to queue | `joinQueue { v: 1, identityTicket }` | Authenticate and enter once; ticket action must be `queue`. |
| Client to queue | `cancelQueue { v: 1 }` | Remove this socket's current entry, if its epoch still owns it. |
| Queue to client | `queueStatus { v: 1, state: "waiting" \| "handoff", joinedAt }` | Authoritative status after join/reconnect and rollback. |
| Queue to client | `matched { v: 1, roomCode, pairId }` | Both seats are already reserved. |
| Queue to client | `queueError { v: 1, code }` | Typed authentication, capacity, rate, or retryable handoff failure. |

Bound every message and reject unknown/malformed variants without mutating
membership. No queue message carries another player's private id, rating, or
ticket. A stale `matched` notice is ignored when `pairId` differs from the
client's active handoff.

On `/online`, show quick match only for `identity.status === "complete"`.
Signed-out and incomplete users get a sign-in/finish-registration path and
retain the invite/guest flow. The waiting state shows cancel, connection
status, and a short explanation that skill pairing widens with wait time.
On match, reuse the existing room UI and online game controller with a fresh
`join` ticket; keep the queue socket until the handoff is confirmed. Cancel
while waiting removes the entry. Cancel after `matched` but before both have
joined is treated as a no-show and returns the other player to waiting; the
client does not get to change a started game's result. Navigation and reload
must not leave a hidden duplicate queue entry. Keep `/online` prerendered and
client-rendered for gameplay.

Place all visible copy in `packages/i18n` in Somali, including the action,
waiting, cancel, match found, connection failure, no-show return, queue full,
and rating-intent explanation. Reuse the founder-approved R2 terms once
settled. While R2 policy can skip rating later, show quick mode as **rated
intent** in the lobby and only confirmed rating change after processing.
As optional polish, play the existing sound preference and show a visible
match-found banner when the tab is backgrounded; do not add push alerts.

---

## 6. Verification and rollout

Workers/Miniflare tests must cover:

- queue ticket session/username gate, missing rating fallback, effective-RD
  snapshot, expiry, action/room scope, tampering, JTI replay, and secret
  rotation; no auth/D1 read in the game Worker;
- two distinct accounts pairing at each window boundary, exact boundary
  times, deterministic tie breaking, provisional/new account broadening,
  self-pair prevention, and no pairing with a stale socket;
- second-tab takeover with epoch protection against an old cancel/close,
  capacity and join-rate limits, and concurrent join/alarm events;
- coordinator reservation and room init retries, code collisions, global
  capacity failure, both seats pre-claimed, guest/third-account rejection,
  randomized first seat, and rated quick status visible before play;
- both players connecting, one/no player connecting, last-moment join race,
  cancel during handoff, no-show requeue, failed cleanup retry, and no ledger
  row for a pre-action no-show;
- alarm exists only while waiting or handoff work exists, is removed when
  empty, and queue sockets survive a DO hibernation/reconstruction cycle.

Extend `pnpm check:hibernation` to cover the new DO source. E2E uses two real
complete accounts in separate browser contexts: both enter from `/online`,
receive the same room code, occupy different pre-claimed seats, and start a
quick room with rated intent. Add a cancel/no-show path and check that invite
creation and guest join still work. Use local Miniflare data and tracked E2E
fixtures; preserve `pnpm check:e2e-isolation`. During implementation run
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:worker`,
`pnpm build`, `pnpm check:hibernation`, and relevant `pnpm test:e2e` cases.
A spec-only edit needs document consistency checks, not an application build.

Roll out after H1 and R1/R2 have landed. Reconcile their actual mode, seat,
rating, and result contracts first; make any frozen-contract change explicit.
Deploy the new DO binding and migration in local, preview, then production
config; add the production `/queue*` route. Keep the entry action hidden
until preview verifies two devices, a rated quick-room start, and no-show
recovery. A feature flag or removal of the entry action can stop new joins
without interrupting active rooms. Observe queue joins/matches/failures and
DO alarm activity through bounded operational logs; K2/X1 owns the product
metrics contract. Do not log raw tickets, ids, or IPs.

**Done when** two complete accounts on separate preview devices enter the
queue, automatically reach the same pre-claimed quick room, and start a game
without sharing a link; the tests above pass, no-show recovery works, and
the hibernation guard covers the queue. Production enablement is a separate
operational decision.

---

## 7. Decisions and contract checks

| ID | Decision | Treatment |
| --- | --- | --- |
| K1-D1 | Broaden new/provisional pairing after a short wait? | **Founder answered yes.** K1 uses the 30/90-second basic window above; K2 tunes it. |
| K1-D2 | No-show grace after `matched`? | **Pending founder answer.** 45 seconds is the spec default until confirmed. |
| K1-D3 | H1/R1/R2 merged field and message names | Reconcile before coding. Do not assume the current drafts are deployed. |
| K1-D4 | Final Somali wording for quick match/rated intent | Reuse R2's approved terms; do not ship English placeholders. |

The queue protocol freezes at K1 merge. Threshold changes in K2 can be
configuration/policy changes if the wire shape stays intact; message-shape
changes need the V2 explicit contract-change process.
