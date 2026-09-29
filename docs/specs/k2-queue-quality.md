# K2 — Queue Quality (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Wave       | L — later in V2; ships only with evidence that it is needed (§10.1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Depends on | K1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Register   | P13, P15, P16                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Contracts  | Consumes [§1](v2-contracts.md#1-vocabulary), [§3.1](v2-contracts.md#31-states), [§4.1](v2-contracts.md#41-which-endings-write-a-row), [§5](v2-contracts.md#5-access-matrix), [§6.2](v2-contracts.md#62-server-to-client), [§6.4](v2-contracts.md#64-quick-match-queue), [§6.5](v2-contracts.md#65-deploy-order), [§9](v2-contracts.md#9-metrics-dictionary), [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone). Uses the K2 reservations in §6.4, §9, and §10.3 (§3.3). Owns the queue-internal contracts in §3.1–§3.2. |
| Brief      | `docs/shaxda-v2.md` §11 (K2), §6.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Touches    | `worker/src` (K1's queue DO, `match-room.ts`, `index.ts`), `worker/wrangler*.toml`, `web/wrangler*.jsonc`, `web/src/routes/api/queue/presence/`, `web/src/routes/online/`, `web/src/lib/online/`, `web/src/lib/components/game/`, `packages/shared`, `packages/i18n`, tests                                                                                                                                                                                                                                                                |

K2 adds three things to K1's quick-match queue: a waiting count for
signed-in accounts, an explicit "another quick match" action on a quick
result, and a short queue-entry cooldown after repeated verified abandonment
before play began (P16). Pairing (P15), the queue protocol and handoff, and
the queue funnel metrics stay with K1; K2 uses only the error code, counter
name, and binding the contracts reserve for it (§3.3).

## 1. Outcome and non-goals

**Outcome.** A signed-in account sees how many accounts are waiting, can
queue again from a quick result with one deliberate tap, and is kept out of
the queue for a few minutes after repeatedly leaving matched games before
play began. Invite and local play never depend on any of it.

### Must

1. **Presence** for signed-in accounts, cached, never fabricated (§4.6).
2. **Re-queue** from a quick result: explicit, fresh ticket, idempotent (§4.7).
3. **Cooldown (P16)** after verified pre-play abandonment only (§4.1–§4.4).
4. **Bounded storage:** 24 h rows in the queue DO, nothing in D1 (§4.5).
5. **No contract change:** the code, counter, and binding K2 needs are
   reserved in the frozen contracts (§3.3).
6. **Hibernation:** no timers; no alarm without queue or K2 work (§4.5).

**Should:** an invite link while waiting, cancelling the entry first (§4.8).

### Not in K2

- Pairing or widening changes (P15 is K1's) and queue funnel metrics (K1
  writes joins, pairs, starts, completions, no-shows, and waits under P13).
- ETAs, lists of waiting players, regional or party queues, bots, guest or
  unrated quick play, push notifications, async play, AI.
- Bans, permanent strikes, public warnings, rating or leaderboard penalties,
  and changes to R2's policy or the pair cap (P7); a cooldown gates entry.

## 2. Decisions and dependencies

### Register ([README](README.md#decision-register))

| ID  | How K2 applies it                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P13 | The queue DO increments one new allowlisted counter, `queue_cooldown_started`, through K1's P13 writer (§3.3). It reads nothing from D1 and never touches auth tables. K1's `queue_*` names are unchanged.                     |
| P15 | K2 does not touch pairing: both windows must admit, as K1 implements it. Presence ignores windows; a re-queue is a new attempt, so its window starts again; a cooldown only gates entry. The 45 s no-show grace ends source A. |
| P16 | The cooldown policy in §4.3: 5 minutes on the 2nd verified incident in a rolling 24 h, 30 minutes on the 3rd and later.                                                                                                        |

Also relied on through K1, with no new rule: F1, F4 and P1 (an ending
before play began is unrated and writes no row), P2 and P3 (entering the
queue, re-queue included, is consent to rated, public play), P10, and P11.

### Dependencies (K1 only; it brings H1, R1, R2, and X1b)

| From K1                                                                                                                                                                                              | K2 uses it for                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| One global SQLite-backed queue DO (`MATCH_QUEUE`), hibernating sockets, alarms only for queue work                                                                                                   | K2 tables, the presence count, one extra alarm deadline (§4.5)                       |
| First-frame `joinQueue` verification, one entry per account, epoch takeover                                                                                                                          | The cooldown check (§4.4); counting each account once (§4.6)                         |
| `pairId` handoff, pre-claimed seats, the 45 s no-show deadline, rollback of a pair whose notice was not sent                                                                                         | Incident source A (§4.2)                                                             |
| Quick-room state in MatchRoom (`mode`, `pairId`, seat accounts) and the play-began marker (P1)                                                                                                       | Incident source B (§4.2)                                                             |
| `queueError` ([§6.4](v2-contracts.md#64-quick-match-queue)), the P13 writer, `QUICK_MATCH_ENABLED`, the `queue` ticket, the rated-and-public disclosure, the `/online` entry card and waiting screen | The `cooldown` code, the counter, re-queue (§4.7), and where each K2 surface appears |

## 3. Contracts

### 3.1 Queue-internal state (owned by K2)

In the queue DO's own SQLite storage (`ctx.storage.sql`), created with
`IF NOT EXISTS` in K1's constructor `blockConcurrencyWhile`; never in D1.

```sql
CREATE TABLE IF NOT EXISTS abandon_incident (
  user_id TEXT    NOT NULL,   -- private account id; never leaves the DO
  pair_id TEXT    NOT NULL,   -- K1 pairId of the quick room; dedupe key
  at      INTEGER NOT NULL,   -- ms; when the abandonment was established
  PRIMARY KEY (user_id, pair_id)
);
CREATE INDEX IF NOT EXISTS abandon_incident_at_idx ON abandon_incident (at);
CREATE TABLE IF NOT EXISTS queue_cooldown (
  user_id  TEXT    PRIMARY KEY,
  retry_at INTEGER NOT NULL   -- ms; entry allowed when now >= retry_at
);
```

- `recordAbandonment { pairId, userId, occurredAt }`: the source B report,
  an internal room → queue call sent like K1's room reports, unreachable
  from any public route or socket and validated with Zod; `occurredAt` (ms)
  is when the room accepted the ending.
- K1's internal room-status answer at the handoff deadline gains
  `serverRefused: { A, B }`: the seat's join reached the room and was refused
  for a server-side reason, not for a bad, expired, or replayed ticket.
- Game Worker var `QUEUE_COOLDOWN_ENABLED`: `"true"` enables recording and
  enforcement; any other value disables both (§10.3).

### 3.2 Presence (owned by K2)

| Piece                  | Contract                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue DO method        | `presence()` returns `{ count, asOf }`: `count` per §4.6, `asOf` the DO clock in ms. Read-only.                                                                                                                                                                                                                            |
| Game Worker entrypoint | `QueuePresenceEntrypoint`, a named `WorkerEntrypoint` exported from `worker/src/index.ts` with only `presence()`; web binding `QUEUE_PRESENCE` (§3.3). No route reaches it.                                                                                                                                                |
| Web route              | `GET /api/queue/presence`, `prerender = false`, no CORS. 401 signed out; 503 when quick match is off, the binding is missing, or the call fails or is invalid; else 200 `{ count, asOf }`, `private, no-store`. The DO answer is cached 10 s in the Cache API under one constant key with no user, cookie, or ticket data. |
| Schema                 | `queuePresenceSchema` (`packages/shared`): `count` an integer ≥ 0 bounded by K1's waiting capacity; `asOf` a positive integer.                                                                                                                                                                                             |

### 3.3 Contracts reserved at the freeze

The frozen contracts already carry what K2 adds, so K2 changes no contract:

- [§6.4](v2-contracts.md#64-quick-match-queue): `queueError` code `cooldown`
  with `retryAt` (ms, server clock), present only with that code. K1 never
  sends it, and K1's client shows a generic message for an unknown code.
- [§9](v2-contracts.md#9-metrics-dictionary): `queue_cooldown_started` in the
  P13 allowlist, +1 whenever an incident sets or lengthens an account's
  `retry_at`; it stays at zero until K2 ships.
- [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone): the
  K2 row (web `QUEUE_PRESENCE` binding, game var `QUEUE_COOLDOWN_ENABLED`,
  queue alarms only, rollout game → web).

Zod strips the unknown `retryAt` for cached clients (§6.2). A test parses a
`cooldown` frame with K1's merged client schema.

## 4. Behaviour and failure handling

### 4.1 What counts as an incident

All four, established by the server: K1 pre-claimed the account's seat in a
quick room and the ending concerns its first match; the opponent was
connected when the absence was established; the account did not connect
within K1's 45 s no-show grace (P15), or it connected and its 45 s recovery
grace (`DISCONNECT_GRACE_MS`, `worker/src/match-room.ts`) expired while the
opponent was connected; and play never began (P1).

| Situation                                                                                                                                                                          | Incident                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| K1 resolves the handoff with exactly one seat joined                                                                                                                               | Yes: the seat that never joined                                           |
| Both joined; the match ends before play began because X's grace expired while Y was connected (§4.2)                                                                               | Yes: X                                                                    |
| Unmatched cancel, tab replacement (K1 epoch takeover or a second room tab), or reconnect within grace                                                                              | No                                                                        |
| Both absent: neither joined, or nobody was connected to claim                                                                                                                      | No                                                                        |
| Server failure (reservation, room init, a pair K1 rolls back, a failed status read, `serverRefused`, a cleanup race), or a network failure the server cannot attribute to one seat | No                                                                        |
| Resign or idle claim before play began (the account was connected; P16 counts connection failures only)                                                                            | No                                                                        |
| Any ending after play began, or a rematch (match number ≥ 2) in a quick room                                                                                                       | No                                                                        |
| The opponent K1 returns to waiting after a no-show                                                                                                                                 | Never; it keeps its `joinedAt`                                            |
| A failure the room never sees (a failed ticket mint, a lost signal)                                                                                                                | Looks like a no-show; one incident starts no cooldown, so it costs little |

### 4.2 How incidents reach the queue

- **Source A — K1 no-show.** When K1 resolves a handoff with exactly one
  seat joined and `serverRefused` false for the other, the queue records the
  absent account's incident after K1's resolution commits, in the same event.
  K1 never depends on K2, and it rolls back a pair whose notice was not sent.
- **Source B — departure before play.** When a quick room's first match
  ends before play began because X's recovery grace expired while Y was
  connected (Y's accepted `opponentAbandoned` claim, or a K1 release of the
  unstarted room attributed to X's grace), the room stores `abandonReported`
  with its terminal write, then calls `recordAbandonment` once after the
  broadcast; a failure is logged without ids and dropped, never retried into
  the game path. An expired grace alone is not reported: play may still begin.

### 4.3 Recording and cooldown (P16)

One storage transaction per incident (`ctx.storage.transactionSync`), with
the window and durations in a pure policy module beside the queue DO:

1. Ignore a report with `occurredAt ≤ now − 24 h`; else
   `at = min(occurredAt, now)`.
2. `INSERT OR IGNORE` the `(user_id, pair_id)` row; a duplicate stops here.
3. Delete incident rows with `at ≤ now − 24 h`.
4. `n` = the account's rows with `at > now − 24 h`, a half-open window like
   the pair cap's ([§4.2](v2-contracts.md#42-rating-decision)).
5. `n = 2` → 5 min; `n ≥ 3` → 30 min; then
   `retry_at = max(retry_at, now + duration)`: a cooldown never shortens.

Any error rolls back every step, logs `queueIncidentRecordFailed` without
ids, and sets no cooldown. After the commit the alarm is re-armed (§4.5);
when `retry_at` moved later, the account's waiting entry, if any, is removed
(§4.4) and `queue_cooldown_started` is incremented (best effort, P13).

### 4.4 Entry during a cooldown

- After K1's ticket checks, a join that would create or revive a waiting
  entry gets `queueError` `cooldown` with `retryAt` while `now < retry_at`,
  then K1's close; from `now ≥ retry_at` it is K1's normal join.
- A cooling-down account never waits: a waiting entry, or one K1 returns to
  waiting, is removed with the same error. A pending handoff is never cut
  short (that would create a false no-show). Invite rooms (`POST /rooms`),
  guest play, and `/local` never consult the queue.

### 4.5 Storage, pruning, and alarms

K2 rows are pruned on every access and at every queue alarm. K2 adds one
deadline to K1's alarm schedule, the earliest expiry among its rows
(`at + 24 h`, or `retry_at`); the alarm prunes, runs K1's work, and re-arms,
and with no waiting entry, no handoff, and no K2 row it is deleted. Rows
and the alarm survive restarts and hibernation.

### 4.6 Presence

- The queue DO counts K1's waiting entries with a live socket after K1's
  wake reconciliation: one per account (a second tab replaces the first),
  never handoff entries; an account returned after a no-show counts again.
- `/online` fetches it when K1's entry card renders for a complete account,
  then every 30 s while visible; only that card shows it, since the waiting
  screen would count the viewer. Failures hide it; 0 uses `presence.nobody`.
- The copy never implies a fit with the viewer's window (P15) or a wait
  time; it counts accounts, not people, up to 10 s old. Where the Cache API
  does not store (`workers.dev`), the 30 s refresh bounds DO calls.

### 4.7 Re-queue from a quick result

- Shown in the result overlay when `matchStatus.mode` is `quick`, the match
  is over (game over or an accepted claim), the viewer is a complete
  account, and quick match is on; beside the unchanged rematch action, with
  K1's one-line rated-and-public disclosure (P2, P3).
- On tap: disable it; mint a fresh `queue` ticket; leave the room through
  `leave()` (`web/src/lib/online/onlineGame.svelte.ts`); send `joinQueue`
  with K1's current `disclosureV`. One attempt at a time; a retry mints a
  new ticket; a join from another tab is K1's takeover (first `joinedAt`).
- A failed mint leaves the player in the room; a failed connection keeps
  the result with a retry; `cooldown` shows the local time of `retryAt` and
  the alternatives. The snapshot is what `player_rating` holds at mint time;
  no rating change is promised (P7). Nothing joins without this tap.

### 4.8 Invite link while waiting (Should)

"Create a room and share the link" sends `cancelQueue` and starts the
existing invite flow (`POST /rooms`, friendly by default, F1) only after K1
acknowledges the cancel or the socket closes: an unmatched cancel, never an
incident. If K1 answers with `matched`, K1's rules for a cancel after
`matched` apply and no invite is created.

## 5. Privacy and access

- [Access matrix](v2-contracts.md#5-access-matrix): K2 shows no match,
  history, profile, or leaderboard, so it adds no row, and it keeps the
  closing rule: no K2 response or frame carries a user id, email, room code,
  ticket, or incident history. Presence returns two integers; the cooldown
  error returns only the account's own `retryAt`.
- "Pending/deleted account" row: pending deletion stops tickets (P11), so
  the account cannot join or re-queue and is never counted; A3's pending
  guard also refuses the presence route.
- The queue DO keeps a private user id, `pairId`, and time for ≤ 24 h, and a
  cooldown row until `retry_at`: no D1 row, IP, device id, username, public
  warning, or strike. Nothing reaches the opponent; logs carry codes and
  counts only. Rows expire inside A3's seven-day grace, so deletion has
  nothing to scrub. `/legal` gains one bullet (§7).

## 6. Resource budget

| Item               | Cost                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| D1                 | No table and no read. One `event_daily` upsert per cooldown set or lengthened (P13, best effort).                            |
| Presence request   | One web request with the existing session lookup (`web/src/hooks.server.ts`); ≤ 1 queue-DO call per 10 s per cache location. |
| Presence refresh   | On render, then every 30 s while visible: ≤ 2 requests a minute per signed-in viewer of the entry card.                      |
| Incident, source A | No extra wake (inside K1's deadline alarm): one insert, one delete, one count, at most one upsert.                           |
| Incident, source B | One room → queue call, waking the queue DO once.                                                                             |
| Cooldown check     | One primary-key read per `joinQueue`; no wake beyond K1's.                                                                   |
| Alarms             | ≤ 1 wake per K2 row expiry while the queue is otherwise idle; none without rows.                                             |
| DO storage         | About 200 bytes per incident row, gone within 24 h: 100 incidents a day ≈ 20 KB.                                             |
| Re-queue           | One ticket mint and one queue socket, as a K1 join.                                                                          |

## 7. Somali copy

Keys go in K1's quick-match namespace in `packages/i18n` (`quickMatch.*`)
plus one `/legal` bullet, all behind `// TODO(translation-review)` until the
Q4 review. Reused: `onlineGame.form.busy`, `onlineGame.identity.retry`, and
K1's disclosure line. `{time}` is the local `HH:MM` of `retryAt`.

| Key                                | Draft                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quickMatch.presence.waiting`      | Hadda {count} ciyaaryahan ayaa sugaya.                                                                                                                                                                                                                                                       |
| `quickMatch.presence.nobody`       | Hadda qofna ma sugayo.                                                                                                                                                                                                                                                                       |
| `quickMatch.requeue.action`        | Kulan degdeg ah oo kale                                                                                                                                                                                                                                                                      |
| `quickMatch.requeue.failed`        | Kulan cusub lama raadin karo hadda; dib u tijaabi.                                                                                                                                                                                                                                           |
| `quickMatch.cooldown.title`        | Kulan degdeg ah waa laguu hakiyay                                                                                                                                                                                                                                                            |
| `quickMatch.cooldown.body`         | Waxaad ka baxday kulamo aan weli bilaabmin. Mar kale waad geli kartaa marka saacaddu tahay {time}.                                                                                                                                                                                           |
| `quickMatch.cooldown.alternatives` | Weli waad samayn kartaa qol cusub oo aad saaxiib ku casuunto, ama waad ku ciyaari kartaa qalabkan.                                                                                                                                                                                           |
| `quickMatch.inviteInstead.action`  | Samee qol oo wadaag xiriiriyaha                                                                                                                                                                                                                                                              |
| `quickMatch.inviteInstead.note`    | Tani waxay joojinaysaa raadinta kulanka degdegga ah.                                                                                                                                                                                                                                         |
| `/legal` bullet (section `xogta`)  | Kulanka degdegga ah: haddii aad ka baxdo kulan laguu helay intaanu bilaabmin, server-ku wuxuu 24 saacadood hayaa aqoonsiga akoonkaaga iyo waqtigaas si uu u dabaqo hakin gaaban (5 ama 30 daqiiqo). Xogtaas cid kale looma muujiyo, D1 laguma kaydiyo, 24 saacadood kadibna waa la tirtiraa. |

## 8. Implementation slices

1. `test(shared): cover the queue cooldown frame and presence schema`
2. `feat(shared): add the queue cooldown error, presence schema, and counter`
3. `test(worker): cover abandonment attribution and cooldown windows`
4. `feat(worker): record verified pre-play abandonment in the queue`
5. `feat(worker): report departures before play from quick rooms`
6. `feat(worker): refuse queue entry during a cooldown`
7. `feat(worker): prune queue incident rows on access and by alarm`
8. `feat(worker): expose the waiting count through a presence entrypoint`
9. `feat(i18n): add quick-match presence, re-queue, and cooldown copy`
10. `feat(web): serve the cached queue presence count`
11. `feat(web): show waiting presence on /online`
12. `feat(web): offer another quick match from a quick result`
13. `feat(web): explain a queue cooldown with its retry time`
14. `feat(web): share an invite link while waiting` (Should)
15. `test(e2e): cover presence, re-queue, and a cooldown`

## 9. Acceptance tests

**Unit:** the policy (`n` ≤ 1 → none, 2 → 300,000 ms, ≥ 3 → 1,800,000
ms, never earlier); the schemas; and K1's client schema as merged parses
the cooldown frame into its generic failure.

**Workers** (`pnpm test:worker`, Miniflare):

- Attribution: one test per §4.1 row, for both sources. A duplicate
  `(pairId, userId)`, a 24 h old report, or a future `occurredAt` (clamped)
  adds no incident; a throwing transaction leaves no row and no cooldown
  while K1's handoff still resolves.
- Rolling 24 h and expiry: incidents at T and T + 24 h − 1 ms → 5 min; at T
  and exactly T + 24 h → none; a third within 24 h → 30 min, never shorter.
  `joinQueue` at `retryAt − 1` gets `cooldown` and no entry; at `retryAt` it
  joins. A cooldown removes a waiting entry and leaves a handoff intact.
- Presence across tabs and handoffs: two tabs count once; handoff entries
  never count; closed sockets stop counting; a no-show return counts again;
  only `count` and `asOf` leave the DO. Re-queue idempotence: a double tap,
  a retry, or a second tab leaves one entry with the first `joinedAt`.
- Durability and alarms: rows, cooldowns, and the alarm survive a restart
  and hibernation with waiting sockets. No waiting entry, handoff, or K2 row
  → no alarm; K2 rows alone → the earliest expiry; the last prune deletes it.
- Switch off: nothing recorded or refused, rows gone at the next wake.
  Counter: +1 per cooldown set or lengthened, never for a duplicate.

**Web** (Vitest):

- Route: 401 signed out; 200 with exactly `count` and `asOf`, marked
  `private, no-store`; one binding call for two requests within 10 s; 503
  when quick match is off, the binding is missing, or the call throws.
- `/online` shows the count only to complete accounts with quick match on,
  hides it on failure, and stops refreshing when hidden or waiting. The
  overlay action appears only for a finished quick room; a double tap makes
  one mint and one join; a failed mint keeps the room. The invite action
  never posts `/rooms` before the cancel is acknowledged.

**End to end** (`pnpm test:e2e`, two complete accounts): B's `/online`
shows A waiting within 10 s, a guest sees none; after a quick game both tap
"another quick match" and pair again; B no-shows twice (tagged slow, about
2 × 45 s), then sees the cooldown with a time and can still create an
invite room, while A returns to waiting with its wait kept.

**Sample matches** ([§4.3](v2-contracts.md#43-canonical-sample-matches)):
M1 and M8 have no K2 effect. M2–M5 as quick games: play began, so never an
incident; the result offers re-queue and promises no rating change (M4 is
`pairCap`). M6 and M9 cannot occur in a quick room (account-only,
rated-only, [§6.3](v2-contracts.md#63-client-to-server)). M7 as a quick
game: no row (F4, P1), no incident. M10: pending B gets no tickets (P11),
cannot re-queue, is not counted, and B's rows expire within 24 h.

## 10. Rollout and rollback

### 10.1 Activation evidence

Wave L ships only with evidence ([README](README.md#spec-index)), judged by
the founder from K1's P13 counters (raw counts beside rates) and beta
feedback. After slices 1, 2, and 9, each part ships alone: the cooldown (3–7, 13) once `queue_no_show` is a material share of `queue_paired` and
players report repeat no-shows; presence (8, 10, 11) once players cannot
tell whether anyone is around; re-queue (12) once players often queue again.

### 10.2 Environments

| Environment | Game Worker (`QUEUE_COOLDOWN_ENABLED`)                    | Web Worker                                                                                                                                                                |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev         | `wrangler dev` (`worker/wrangler.toml`); the var `"true"` | `vite dev`; `QUEUE_PRESENCE` → the local `shaxda-worker` through Wrangler's dev registry                                                                                  |
| e2e         | Same config, state under `test-results/wrangler-e2e`      | Same binding in `web/wrangler.e2e.jsonc`; `pnpm check:e2e-isolation` stays green. Slice 10 proves it (proof E3 covered the reverse direction); else e2e expects no count. |
| preview     | `shaxda-worker-preview`; the var `"true"`                 | `shaxda-web-preview`; binding → `shaxda-worker-preview`                                                                                                                   |
| production  | `shaxda-worker`; the var `"false"` until preview passes   | `shaxda-web`; binding → `shaxda-worker`                                                                                                                                   |

### 10.3 Deploy order, kill switch, rollback

- Order ([§6.5](v2-contracts.md#65-deploy-order)): no migration; game Worker
  (queue DO, room report, entrypoint, var), then web Worker (binding, route,
  UI). A web Worker deployed first only gets 503s and hides the count.
- `QUEUE_COOLDOWN_ENABLED` off stops recording and refusals at once and
  deletes all K2 rows at the queue's next wake. Presence and re-queue follow
  `QUICK_MATCH_ENABLED`; removing the binding alone hides presence. Local,
  guest, and invite play survive every switch.
- Code rollback: switch the cooldown off, wait 24 h, then redeploy the
  previous web and game versions, web first.

### 10.4 Done when

- On preview, two complete accounts on separate devices show presence
  (within 10 s; hidden for guests and on failure), re-queue (paired again
  only after both tap), and a cooldown (two no-shows → five minutes with the
  right time; invite and `/local` still work; entry at `retryAt`; the other
  account keeps its wait); X1's admin view shows `queue_cooldown_started`.
- `pnpm lint`, `typecheck`, `test`, `test:worker`, `build`,
  `check:hibernation`, and `test:e2e` pass.
- Turning the switch on in production is an operational step in the ops
  record; `shipped@<date>` comes only after production verification.
