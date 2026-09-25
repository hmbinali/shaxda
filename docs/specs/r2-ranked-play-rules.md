# R2 — Ranked Play Rules (Spec)

| Field | Value |
| --- | --- |
| Status | Draft; policy and room UI are not implemented. Resolve the founder decisions in §10 before freezing the contract. |
| Brief | `docs/shaxda-v2.md` §10 (R2), §7.2, §14, §16 (D2), §17 |
| Depends on | H1 match ledger and room options; R1 rating event schema and processor |
| Workspace | `r1-rating-system` (R1 and R2 are activated together) |
| Unblocks | R3 leaderboard and K1 quick match |
| Touches | `packages/shared` policy/copy contracts, `packages/db` additive migration and queries, `worker/` room outcome, `web/` online lobby and rating processor, `packages/i18n`, `/learn` |

This spec defines **which persisted games change ratings**, not the Glicko-2
calculation. R1 owns the arithmetic, processor, rating event and rebuild. H1
owns the authoritative match result and replay. R2 must be reconciled with the
merged H1 and R1 contracts before the R1 migration or live ratings are enabled.
The H1 and R1 specs in this checkout are drafts; their names and columns below
are proposed interfaces, not proof that those migrations have shipped.

---

## 1. Outcome and scope

Players know whether an invite room requests rated play before they move. A
completed account-versus-account match changes both ratings only when its
server-recorded facts and the versioned R2 policy make it eligible. Repeating
games with one account cannot produce unlimited rated events.

### Must

1. Both seats are distinct complete accounts, the recorded room intent is
   `rated = true`, and mode is `invite` or `quick`. Guest-involved games remain
   unpersisted and unrated. Local games remain unrated.
2. The creator can choose a **friendly** invite room. Both players see its
   mode in the lobby before the first action; the server owns the setting. A
   room's setting cannot change after play starts.
3. Normal wins and draws count. Manual resignation counts as the resigning
   player's loss in any game phase, including resignation as the first action.
4. A claim-win counts only when the pre-claim phase is movement and **each
   seat has made at least one accepted, nonterminal player action**. An earlier
   claim is persisted as `aborted` and changes neither rating.
5. The first **3** eligible games between the same two account ids in a rolling
   24 hours count. A later game remains in history but is skipped with
   `pairCap`. The pair is unordered; rematches and different room codes share
   the cap.
6. R1 applies a deterministic, versioned policy to immutable ledger facts in
   its global `(ended_at, match.id)` order. Both ratings update or neither
   does. The UI distinguishes room intent, pending decision, confirmed rated
   result, and a friendly or skipped result.
7. Explain these rules in Somali on `/learn` and link to the explanation from
   the online lobby and result. Explain that a new/high-RD opponent moves an
   established rating less; do not promise a fixed point gain.

### Should

- A per-account **30 rated games per UTC day** safety cap. If enabled, either
  player's exhausted allowance skips the whole match with `dailyCap` (§5).
  This is a separate founder decision; it must not be silently enabled.

### Out of scope

- Glicko-2 arithmetic, rating storage and rebuild machinery (R1).
- Leaderboard ranking/exclusion (R3), matchmaking (K1), automated bans,
  suspicious-pattern detection and operator invalidation (R6).
- Guest ratings, guest ledger rows, local-game ratings, seasons or tiers.
- Changing game-engine rules for resignation, claims or draws. R2 classifies
  the authoritative online outcome; the engine still decides the winner.

---

## 2. Terms and immutable inputs

| Term | Meaning |
| --- | --- |
| Rated intent | H1 `match.rated = 1`, captured from server-owned room options when the match ends. This is a request, not proof that the rating changed. |
| Confirmed rated | R1 `rating_status = processed`: both seat events were committed. |
| Friendly | An invite room created with `rated = false`; its persisted result is skipped with `friendly`. A guest room also plays without ratings but writes no match. |
| Cap-skipped | A rated-intent match retained in the ledger with `rating_status = skipped` and `pairCap` or `dailyCap`. It has no rating event values and is labelled friendly/unrated, with the cap reason, in history/results. |
| Aborted | A claim-win that does not meet the movement and two-started-seats rule. The game engine's terminal state and replay stay intact, but competitive W/L/D and ratings exclude it. |
| Player action | An accepted `place`, `removeInitial`, `move`, or `capture` by that seat. A synthetic claim-win resignation and a manual resignation are terminal events, not evidence that the claimant or opponent started. |

The policy reads `match.id`, `ended_at`, `mode`, `rated`, `winner_seat`,
`end_reason`, `online_end_reason`, `replay`, `replay_v`, `competition_status`,
and the two `match_player.user_id`/seat/result rows. It must not use a browser
assertion, username, avatar, IP address, room code, current session, or current
profile state to decide a historical match. Deleted accounts retain opaque
ledger ids for reproducible cap decisions; public views never expose them.

The replay before its final `R:<seat>` supplies the pre-claim phase and the
accepted actions by seat. A pure classifier shared by the game Worker and web
Worker must replay with the engine and verify `competition_status`; a mismatch
is an invalid ledger event that stops the R1 processor and alerts an operator.
The game Worker records this status at termination; it does **not** query prior
matches, read ratings, or calculate a cap.

---

## 3. Result policy

Evaluate these rows in order. A malformed ledger row is an error, never a
friendly game. `competition_status` is independent of rating eligibility:
an aborted friendly match is still aborted.

| Authoritative end | Stored competitive result | Rating decision if both accounts and rated intent | Notes |
| --- | --- | --- | --- |
| Engine win by pieces, or engine draw | Engine W/L/D | Candidate; apply caps | The engine is the authority for the outcome. |
| Manual `resign` (`online_end_reason = NULL`) | Winner/loser | Candidate; apply caps | Counts in placement, initial removal or movement, even as the first action. |
| Claim-win, pre-claim movement, each seat has acted | Winner/loser | Candidate; apply caps | Covers abandonment and idle claims; losing seat is the absent/idle seat. |
| Claim-win in placement or initial removal | `aborted` | Skip `aborted` | Save the replay and terminal engine outcome for audit; do not count a competitive win/loss. |
| Claim-win in movement before either seat's first action | `aborted` | Skip `aborted` | Defensive rule for legacy or malformed rooms. |
| Cleanup with no terminal result | No match row | No rating event | An expired lobby or abandoned room is not a draw. |

If `rated = false`, a non-aborted completed match is `friendly` before caps
are considered. A valid `quick` match must have `rated = true`; the future K1
creator has no friendly toggle. A persisted `quick` row with `rated = false`
is a contract error, not a quietly rated game. Two rows with the same user id,
missing seats, contradictory winner/results or unsupported replay version are
also contract errors. R1's pending queue must halt on these cases.

The **rating skip-reason enum** for policy version 1 is `friendly`, `aborted`,
`pairCap`, and optionally `dailyCap`. The processor's priority is:
`aborted` → `friendly` → `pairCap` → `dailyCap` → `processed`. This gives one
stable, explainable reason when several exclusions apply. H1's DO-only
`guestSeat`, `noActions`, and `logIncomplete` reasons are **not** R1 skip
reasons: those paths produce no ledger row, except the R2 contract changes in
§4 for completed early endings.

---

## 4. H1/R1 contract changes before implementation

H1 currently skips a claim made with no preceding player action and skips a
manual resignation that is the first action. That conflicts with §3 and the
R2 brief's early-claim record. Resolve this before rating activation:

1. For two account seats, persist **every terminal game** with a valid replay,
   including an immediate manual resignation and an early claim. Keep the
   H1 idempotent `(room_code, room_created_at, match_number)` write, two player
   rows, and replay-equals-final-state check. Guest-involved endings still
   write nothing. A room cleaned without `gameOver` still writes nothing.
2. Set `started_at` to the first accepted player action. If an early claim
   occurs before any player action, use the accepted claim time, equal to
   `ended_at`; `action_count` includes the synthetic resignation. This is an
   explicitly documented exception to H1's current start-time definition.
3. Add an immutable `match.competition_status` with values `completed` and
   `aborted`, set by the Match DO from the preterminal phase and per-seat
   action counts. Validate it by replay in the R1 processor. Keep
   `winner_seat`, `end_reason`, `online_end_reason`, seat results and replay as
   the actual game outcome; never rewrite them to fabricate a draw or loss.
4. R1's additive migration adds/uses `rating_status`, `rating_skip_reason`,
   `rating_policy_v` and the seat rating event columns described in its spec.
   `competition_status` belongs to the ledger and is written by the DO;
   `rating_*` fields are rebuildable projections written by the web Worker.
5. H2 history, match detail, summary and filters use `competition_status =
   aborted` as an aborted outcome, exclude it from competitive W/L/D and win
   rate, and show confirmed rating status rather than treating `match.rated`
   alone as confirmation. R4/R5 must follow the same semantics. An early
   claim may still show which seat the engine declared winner in the replay
   detail, with an explicit aborted label.

If H1/H2 have already merged, make these as explicit additive contract-change
commits and migrations. If still draft, reconcile their specs before freeze.
Do not edit historical `winner_seat` or replay to achieve R2 behaviour.

For pre-R2 rows, the migration/backfill must derive `competition_status` from
the replay and online end reason in bounded chunks. A row whose replay is
missing or cannot establish the pre-claim phase stays pending with an operator
error; it is never presumed eligible. Record `rating_policy_v = 1` for every
processed or skipped event. R1's rebuild must produce the same decisions from
the full ledger, including this backfill cohort.

---

## 5. Pair and optional daily caps

The R1 processor evaluates caps in the same total order as ratings:
`(ended_at ASC, match.id ASC)`. Count only **earlier `processed` events** under
the active policy, not rated intent, pending, friendly, aborted or cap-skipped
matches. The pair key is the two permanent user ids sorted bytewise. For a
candidate ending at `t`, count prior rated matches for that pair with
`prior.ended_at > t - 86_400_000` and ordered before the candidate; exactly
24 hours old is outside the window. If the count is already 3, skip the
candidate as `pairCap`. A skipped event does not consume a slot.

If the founder enables the daily cap, define a day as
`floor(ended_at / 86_400_000)` in UTC. Count prior processed events that day
for **each** account; if either already has 30, skip both players together as
`dailyCap`. It does not reset at a player's local midnight. The pair cap takes
precedence when both would apply. The optional cap is part of policy version
1 only if enabled before activation; changing it later needs a new policy
version and a reviewed rebuild, never an in-place constant change.

The processor can maintain pair/day counts while replaying the globally
ordered ledger; online incremental processing may use indexed D1 queries or
bounded state with the **same** boundary rules. The dry-run rebuild is the
oracle. A late ledger event or policy change uses R1's guarded rebuild path;
processing it at the tail would corrupt later pair counts and ratings.

Caps limit rated outcomes, not the ability to play. A fourth rematch is still
playable and saved; its result overlay and history show it as friendly/unrated
and say why it did not change ratings. Quick games likewise always **request**
rated play, but a cap can skip their rating. K1 should explain this before
queue entry and must not promise that every completed quick game awards rating
points.

---

## 6. Invite-room control and player experience

The `/online` creator chooses rated or friendly **before creating** an invite
room. Send a Zod-validated boolean through H1's `POST /rooms` `options.rated`;
the Match DO stores it as room-level intent. Only the creator can choose it.
No browser message can change it after creation; choosing another mode means
creating a new room. This simple room-level rule also covers rematches: they
inherit the same intent and the lobby/result shows it again. A guest creator
or a guest in either seat always sees friendly/unrated play, irrespective of
the stored request.

The room status message must expose server-owned `mode` and `rated` (or a
single equivalent room-settings object) to **both** seats on join, reconnect
and rematch. Render the setting before either can make the first move. Keep
protocol `v: 1` additive for cached PWA clients; old clients ignore new
fields, and the server still enforces the chosen setting. The game Worker
never trusts a client-sent "rated" badge. A quick room is always created with
`mode: quick`, `rated: true` by K1's trusted queue flow; `/online` cannot
create one by passing a forged mode.

Use Somali copy in `packages/i18n` for the create choice, lobby badge, short
rules link, pending rating decision, confirmed delta, aborted outcome, and
friendly/pair-cap/daily-cap explanations. The founder must approve final
Somali terms (§10); avoid putting English placeholders in the UI. The rated
choice explains that both seats must be accounts and that pair/daily limits
can make a game unrated after it ends. The lobby shows **requested mode**;
the result and history show **confirmed mode** from `rating_status`. While
the R1 event is pending, say that eligibility is being checked, without a
confirmed delta. Aborted games are labelled aborted even while rating
processing is pending.

On `/learn`, explain in plain Somali: which invite and quick games can count,
how friendly works, what resignation and claim-win do, the rolling pair limit,
the daily cap if enabled, and why new/high-RD accounts give an established
player less rating movement. Link from the lobby and result; no leaderboard
page is required for R2.

---

## 7. Authority, privacy and cost

- The Match DO applies every online move through `game-engine`, records room
  intent and the terminal replay, and writes only H1 `match` and
  `match_player`. It may classify `competition_status` from its own room/log.
  It never reads rating tables or user/auth tables.
- The web Worker processor makes the final cap and rating decision from D1.
  One event changes both players atomically or is skipped for both. A room
  cannot award rating through a client claim, socket replay or forged flag.
- Validate create options and every WebSocket/API payload with Zod. Private
  user ids and identity tickets are never broadcast; public match views use
  confirmed username/avatar snapshots and existing privacy rules.
- Do not write one D1 row per move or keep a DO awake for rating processing.
  Existing WebSocket hibernation and alarm rules remain in force. The game
  result is playable even if the rating processor is delayed.

---

## 8. Verification

### Policy table: parameterised Workers/D1 tests

| Case | Expected |
| --- | --- |
| Two accounts, invite rated, normal win/draw | `processed` for both, subject to caps |
| Two accounts, invite friendly | `skipped:friendly`; no rating event values |
| Account plus guest, local game, or uncompleted room | No ledger rating event |
| Manual resign in each phase, including first action | Persisted, candidate for rating; resigning seat loses |
| Claim in placement or initial removal, zero or one seat started | Persisted `aborted`, `skipped:aborted`, no competitive W/L/D |
| Claim in movement, both seats started | Candidate for rating; absent/idle seat loses |
| Claim in movement with a missing first action | `aborted` and skipped, even if a legacy row says game over |
| Same pair's fourth candidate within 24 hours | `skipped:pairCap`; fifth also skips until a slot expires |
| First candidate exactly 24 hours after oldest counted game | Counts again |
| Same accounts with A/B swapped, new room, or rematch | Same unordered pair cap |
| Two matches with equal `ended_at` | `match.id` determines cap winner and rebuild order |
| Cap-skipped match followed by a new candidate | Skipped match consumes no cap slot |
| Daily cap enabled: 31st game for either account on UTC day | Both players skipped; next UTC day resets |
| Malformed seats, replay, `competition_status`, or quick `rated=false` | Processor stops with operator error; no partial rating update |

Also test room creation defaults and creator choice, guest fallback, server
immutability across join/reconnect/rematch, legacy cached protocol parsing,
both lobby badges before the first move, confirmed/pending/skipped result copy,
H2 aborted summary/filter behaviour, and R1 rebuild parity after late-row
recovery. Test cap windows across calendar-day boundaries, not only within a
single day. R1's dry-run fixture must report zero drift for every policy row.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:worker`, `pnpm build`,
and relevant `pnpm test:e2e` cases when implementing. Keep
`pnpm check:hibernation` and `pnpm check:e2e-isolation` green. A spec-only
edit needs link/consistency checks, not an application build. Preview and
production migration/backfill are explicit release operations, never test
side effects.

---

## 9. Rollout and done

1. Reconcile H1/H2/R1 drafts and the founder choices in §10. If H1 is already
   merged, record the necessary ledger/protocol change in an explicit
   contract-change commit. Freeze `rating_policy_v = 1` and the skip enum.
2. Ship the additive schema and room/UI changes with rating processing still
   disabled. Backfill existing H1 rows in bounded chunks; inspect counts and
   sampled early claims. Do not rate rows that cannot be classified.
3. In preview, use two real accounts to verify rated invite, friendly invite,
   early claim, resignation, cap-skipped rematch, and delayed processor paths.
   Rebuild/diff must show zero drift, including cap decisions.
4. Activate R1 and R2 together. Monitor pending age, skipped-reason counts,
   aborted count, malformed rows, cap hits and rebuild drift. Disabling the
   processor/display on rollback leaves the immutable match ledger intact.

R2 is done when the policy table is enforced by Workers tests, the mode is
visible to both players in the lobby, actual rating eligibility is visible
after the match, and the preview checks above pass. This document alone does
not mark R2 shipped.

---

## 10. Founder decisions and specification defaults

| ID | Decision | Current treatment |
| --- | --- | --- |
| R2-D1 | Invite rooms rated by default or friendly by default? | **Pending founder answer.** H1 and V2 currently propose rated by default. Do not freeze the creation default until confirmed. Explicit creator choice is required either way. |
| R2-D2 | Pair cap of 3 rated games per unordered pair in rolling 24 hours? | Proposed by V2; used in this spec pending founder confirmation. |
| R2-D3 | Enable the Should daily cap of 30 rated games per account per UTC day? | Pending founder answer. If declined, omit `dailyCap` from active policy v1 and copy. |
| R2-D4 | Somali terms for rated, friendly, quick match and leaderboard? | Pending founder wording; implementation must use approved Somali copy. |

The first three decisions affect policy, onboarding copy or replayable
backfills and must be recorded before production activation. Any later change
gets a new policy version and a reviewed rebuild; historical rating decisions
are not silently reinterpreted.
