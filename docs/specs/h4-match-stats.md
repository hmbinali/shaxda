# H4 — Match Statistics Foundation (Spec)

| Field | Value |
| --- | --- |
| Status | Draft, not started |
| Brief | `docs/shaxda-v2.md` §9 (H4), §7.2–7.3, §14 |
| Workspace | `h4-match-stats` |
| Depends on | H1 for the replay and ledger; H2 for the match-page panel. The derivation and write path can be built while H2/H3 are in progress. |
| Unblocks | R4 profile statistics; R5 may reuse the same per-match values. |
| Touches | `packages/shared`, `packages/db`, `worker/`, `packages/i18n`, `web/`, a backfill script, and release documentation. |

This spec refines H4 without widening the V2 brief. `docs/shaxda_game.md` is
authoritative for game rules. The H1 replay and ledger contracts are frozen at
H1 merge; H4 consumes them and does not change action codes, game rules, or
the `match` / `match_player` keys. Before implementation, reconcile this draft
with the **merged** H1 and H2 contracts. Their current specs are drafts, and
the H2 draft still names several columns differently from the later H1 draft.
Use the merged schema and record any consequential difference in this spec
before coding. No H4 code should be built against those conflicting names.

---

## 1. Goal and boundaries

**Goal.** Derive the same Shaxda statistics from a saved replay every time,
store them once per match, backfill older saved matches, and show a compact
comparison on the public match page.

### Must

1. A pure derivation module in `packages/shared/src/stats` imports the public
   `@shaxda/game-engine` API. It accepts H1's decoded, validated replay and
   returns a versioned, seat-keyed stats object. It performs no I/O.
2. The MatchRoom derives stats from the validated in-memory log at game over,
   puts `stats_json` in the immutable H1 persist payload, and writes it with
   the existing `match` and two `match_player` rows. H1 retry and rematch
   idempotency remain intact.
3. A bounded, resumable backfill fills `stats_json` on pre-H4 rows from their
   saved replay. It never silently replaces non-null stats or repairs a bad
   replay by guessing.
4. H2's public `/match/<id>` page renders a small seat-by-seat panel showing
   captures, jare events, repeated jare events, movement turns, and a comeback
   badge for the winner when applicable. All visible copy is Somali.
5. The versioned schema and a narrow read API make the stored values reusable
   by R4. R4 owns player-level aggregates, profile presentation, and averages.

### Should

- Precompute player-level totals and averages for R4 only if H4's real query
  plan shows that summing the indexed match ledger is too costly. This is an
  optimization within H4, not a dependency of the match-page panel.

### Not in H4

Style labels, public analytics dashboards, rating or leaderboard changes,
new game rules, guest or local-game persistence, replay controls, per-move D1
rows, and changes to the H1 compact replay format.

---

## 2. Input and trust boundary

The sole input is H1's `{ v: 1, s, a }` compact replay, decoded through the
engine. Use each accepted action and its **before and after** `GameState`.
Reject a malformed code, illegal action, unsupported replay version, or a
replay whose final state differs from the state H1 intends to persist. H4
derivation runs only after H1 replay validation; the backfill performs that
validation itself. Neither path takes client-reported statistics.

The function's result depends only on the replay. It does not depend on user
ids, usernames, wall-clock time, match mode, rated status, or the online end
reason. Claim-win's synthetic `resign` remains a resignation action; the
online reason is not a statistic. An early resignation produces a valid
zero/`null` stats object. Guest-involved games continue to write no match row.

Use a dedicated `@shaxda/shared/stats` export so the game Worker imports only
the stats module rather than the shared package's broad entry point. The
module may depend on the engine and Zod; it must not import Svelte, D1,
Cloudflare, the web Worker, or auth code. The engine never imports shared.

---

## 3. Counting contract

All counters are nonnegative integers. A **jare event** is one accepted
`place` or `move` action that newly completes at least one of the 16 engine
`JARE_LINES`; completing two lines with one action is **one** event. A line
that stays intact is not a new event. Initial removals and captures are not
jare events. `repeatedJareEvents` is a subset of movement jare events: at
least one newly completed line in that move was previously completed by the
same seat in this replay, during placement or movement, and later broken.
Multiple repeated lines in one move still count once. Do not infer irmaan
from this counter: irmaan also has a protection condition the log does not
establish.

| Field | Per-seat definition |
| --- | --- |
| `capturesMade` | Number of accepted movement-phase `capture` actions by this seat. Excludes `removeInitial`. Must equal H1 `match_player.captured` and final engine `players[seat].captured`. |
| `capturesSuffered` | Opponent's `capturesMade`; initial removal excluded. |
| `jareEvents` | Newly formed placement and movement jare action events, counted as above. |
| `repeatedJareEvents` | Movement jare events that reform a previously completed exact line, counted as above. |
| `firstPlacementJare` | `true` only for the seat that makes the first placement jare in the replay. Both `false` if placement ends without one or the game ends earlier. A simultaneous double-line placement still awards one seat. This agrees with H1's `first_advantage_by = placementJare` and `first_advantage_seat`. |
| `movementTurns` | Number of accepted `move` actions by this seat during movement, including space-making moves. A `move` followed by a `capture` is one turn, not two. |
| `turnsBeforeFirstCapture` | This seat's completed movement turns before its first capture turn, including space-making turns. Exclude the move that formed the first capture's jare. `null` if this seat never captures. |
| `maxPieceAdvantage` | Maximum of `0` and `(own on-board pieces − opponent on-board pieces)` over states from completion of both initial removals through game end. Placement and half-completed initial removal are excluded. `0` if that boundary is never reached. |
| `blockedPlayerEvents` | Number of distinct blocked episodes for this seat after movement begins: the seat is due to move but has no legal movement action. Count an episode once when entered, including one that immediately ends in a blocked draw; another episode counts only after the seat had at least one legal move in between. |
| `spaceMakingTurns` | This seat's accepted `move` actions when the other seat was the blocked current player in the before-state. This is a subset of `movementTurns`; use the engine's blocked/space-making rule, not board-shape heuristics. |
| `comeback` | `true` only for the match winner if, at an action boundary after movement begins, the winner had made at least two fewer captures than the opponent. Otherwise `false`; both seats are `false` for a draw. This is a deliberately narrow capture-deficit definition, not a claim about positional advantage. |

For `blockedPlayerEvents`, inspect the movement board and the player due to
move after each accepted action, including the last initial removal. If the
engine terminates with `bothBlocked` or `forcedJareSpaceMaking`, inspect the
resulting board under movement rules before recording the terminal boundary.
Do not count a blocked seat on every subsequent opponent space-making action.
This rule is testable with H1's blocked-space-making conformance fixtures and
a complete replay that reaches a blocked draw.

### Per-match fields

| Field | Definition |
| --- | --- |
| `phaseTransitions` | Ordered `{ afterAction, from, to }` records for a change of engine phase. `afterAction` is the count of accepted actions already applied: first action = `1`, matching H3's action-position model. Include transitions to `capture` and `gameOver`; a capture followed by return to `movement` is another transition. |
| `longestNoCaptureRun` | Maximum `draw.turnsSinceCapture` seen across replayed states after movement begins, including the final state. This is completed movement turns, not raw move/capture action count. A capture resets the engine clock. `0` for a game that never reaches movement. |

The derivation must also assert `capturesSuffered[A] === capturesMade[B]` and
vice versa; `repeatedJareEvents <= jareEvents`;
`spaceMakingTurns <= movementTurns`; and `turnsBeforeFirstCapture` is `null`
iff no capture was made. Contradictions fail derivation rather than being
written as valid stats.

---

## 4. Stored contract

H1 already reserves nullable `match.stats_json` (text). No H4 migration is
needed if the merged H1 schema contains it. If H1 merged without the column,
add one hand-written `ALTER TABLE` migration and update Drizzle metadata in
H4; do not alter the H1 ledger migration after it has shipped.

```ts
type MatchStatsV1 = {
  v: 1;                 // stats schema version
  replayV: 1;           // source replay format version
  players: Record<"A" | "B", {
    capturesMade: number;
    capturesSuffered: number;
    jareEvents: number;
    repeatedJareEvents: number;
    firstPlacementJare: boolean;
    movementTurns: number;
    turnsBeforeFirstCapture: number | null;
    maxPieceAdvantage: number;
    blockedPlayerEvents: number;
    spaceMakingTurns: number;
    comeback: boolean;
  }>;
  match: {
    phaseTransitions: Array<{
      afterAction: number;
      from: "placement" | "initialRemoval" | "movement" | "capture";
      to: "initialRemoval" | "movement" | "capture" | "gameOver";
    }>;
    longestNoCaptureRun: number;
  };
};
```

The Zod schema lives beside the pure derivation and validates both the value
before serialization and JSON parsed from D1. Serialize with a stable field
order and no user-identifying values. `v` versions the stats semantics;
`replayV` records the source format. A future replay decoder may still derive
`MatchStatsV1` if the meanings stay the same. If a counting definition changes,
create `v: 2` with a migration/backfill plan; never silently reinterpret
stored `v: 1` rows. Unknown versions fail closed in reads and are reported for
repair rather than displayed as zero.

`stats_json` remains on `match`, one small document per game. R4 may join
`match_player` to `match` by primary key and aggregate the seat-specific
values; the H1 `(user_id, ended_at)` index bounds a player's list. H4 adds no
public account id to the stats schema and no per-player stats table by
default.

---

## 5. Write path and backfill

### New matches

After H1's decode/replay/final-state comparison succeeds, derive the stats
from the same action log and store `JSON.stringify(stats)` in H1's pending
payload **before** the first D1 write. A retry reuses those exact bytes. The
existing three-row D1 batch contains the populated `stats_json` column on its
`match` insert; no second write follows. A derivation failure prevents the
ledger write, is logged with room instance and match number but no PII or
replay body, and retains the room for the same manual-inspection path as an
H1 replay mismatch. It must not silently write `NULL` after H4 is enabled.

On an idempotent H1 retry that finds an existing row, do not overwrite that
row's replay or stats. If the existing row predates H4 and has `NULL` stats,
the backfill owns it. The worker never reads auth tables or computes ratings.

### Pre-H4 matches

Implement a reusable backfill core against `D1Database` and a local CLI
wrapper. The CLI defaults to local D1; preview/production require explicit
environment and write flags. The script must not apply migrations or deploy.

1. Select a bounded page (for example 100) of `match` rows with
   `stats_json IS NULL`, ordered by `(ended_at, id)` for stable progress. It
   reads `id`, `replay_v`, `replay`, and the H1 final-result fields needed to
   verify the decoded terminal state; never selects auth tables.
2. For each row, decode and replay from the initial state. Verify action
   count, winner/end reason, final capture counts, and any other final-state
   values H1 stores. Derive and Zod-validate stats only on a full match.
3. `UPDATE match SET stats_json = ? WHERE id = ? AND stats_json IS NULL AND
   replay_v = ? AND replay = ?`. A zero-row update due to a concurrent fill is
   a harmless skip. Do not rewrite a non-null value, even if its version is
   old; report it separately.
4. Continue until no eligible rows remain. Save/report a cursor or last id,
   totals filled/skipped/failed, and failure ids. Avoid looping forever on
   invalid rows: move past them for that run and exit nonzero with their ids.
   A rerun is safe and fills rows fixed since the prior attempt.

Invalid or mismatched replays stay `NULL` for investigation. The backfill does
not turn an incomplete replay into invented zeros, mutate the ledger's
result/replay, or expose user ids in logs. Keep transactions short; never
materialize the whole match table in memory. Verify preview counts before
production; production backfill is an explicit release operation, not a
side effect of local tests or a deploy.

---

## 6. Public match panel and R4 handoff

H4 adds the stats panel **after H3's replay slot and before H2's details**.
If H3 has not merged, it uses H2's documented insertion point and H3 later
mounts above it. Load `stats_json` only for the requested match id; parse it
server-side and send only the public stats DTO to the page. The DTO has seat
labels and the five selected values, never `user_id`, email, room code, or
the replay. Keep H2's session-sensitive page caching behavior.

The panel compares A and B with existing seat colors and player labels. It
shows captures, jare events, repeated jare events, and movement turns as
numbers, plus a comeback badge only when `comeback` is true. Explain in a
short Somali help line that the badge means winning after falling behind by
two captures. Reuse H2's existing capture count display or move it into the
panel so the page does not show contradictory duplicate numbers. If a valid
older match has not yet been backfilled, omit the panel and show a modest
Somali "statistics unavailable" line; never display zeros for missing data.
An invalid/unknown stats version takes the same visible path and emits a
server-side diagnostic. Public copy for jare preserves the Somali term.

R4 receives the schema and a read helper that returns typed `MatchStatsV1`
for a match plus a seat. It can calculate total captures, average captures,
jare/repeated-jare counts, comeback wins, and other §10 R4 measures from
the ledger. Duration and draw type remain H1 match fields. H4 does not
publish profile aggregates or a leaderboard. The helper should reject
missing/unsupported stats explicitly so R4 cannot treat them as zero.

---

## 7. Tests and verification

### Pure stats (Vitest)

- Golden expected stats for **every shared full-game fixture**. Add complete
  action logs that exercise placement jare, multi-line placement (one event),
  repeated exact-line jare, a movement capture, a blocked episode plus
  space-making, a blocked draw, an 80-turn draw, a two-capture comeback, and
  early resignation. Existing mid-game conformance fixtures are useful for
  focused state transitions but are not substitutes for full replay tests.
- Assert both starting seats produce the appropriate seat-keyed stats; the
  same replay twice produces byte-identical JSON; decode/encode round trips
  preserve stats; an illegal or truncated replay fails.
- Assert the engine final capture counts match `capturesMade`; initial
  removals never increment captures; `longestNoCaptureRun` matches the
  engine clock (including a reset after capture); phase indices align with
  H3 action positions; multi-line moves count one jare event.
- For the comeback case, a winner who was down exactly one capture gets
  `false`, down two gets `true`, and a draw gives both seats `false`.

### Worker/D1 (Workers Vitest pool)

- A completed account match writes non-null valid stats in the same H1 batch.
  Reconnect/retry leaves one row and identical stats; rematch writes separate
  stats; guest-involved game writes no row; claim-win has no fabricated
  capture.
- Derivation failure writes no match row and follows H1's retained-room
  failure behavior; `pnpm check:hibernation` still passes.
- Seed pre-H4 rows with `NULL` stats. Backfill fills each once; a second run
  changes zero rows. A bad replay is reported and remains `NULL`; a non-null
  existing version is unchanged; a concurrent fill is skipped. Assert query
  plans use the match index/primary key or a bounded scan appropriate to the
  one-time backfill, and no per-move rows are created.

### Web (Vitest and Playwright)

- Match loader returns a public DTO only, parses supported stats, and handles
  `NULL`/unsupported stats without false zeros or PII. The panel shows the
  five selected values for both seats, labels a comeback only for its winner,
  and remains readable on a narrow mobile viewport with keyboard/screen
  reader labels.
- One saved-account-match E2E confirms both the stored JSON and public panel;
  an older seeded `NULL` match confirms the unavailable state, then the
  backfill makes the panel appear. Reuse H2's match route fixtures.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:worker`,
`pnpm build`, `pnpm check:hibernation`, and relevant `pnpm test:e2e` cases.
No remote D1 operation is part of those commands.

---

## 8. Implementation and rollout

Use focused Conventional Commits in this order:

1. Reconcile merged H1/H2 contracts and freeze the H4 counting examples.
2. Add golden complete replays and failing stats derivation tests.
3. Implement the pure module, schema, and narrow package export.
4. Add the populated `stats_json` field to the H1 persist payload and worker
   tests; preserve the existing idempotent batch and alarms.
5. Add bounded backfill core, CLI, dry run/reporting, and D1 tests.
6. Add Somali copy, match loader DTO, and public panel tests/UI.
7. Add the H4 release and verification steps to the V2 operations runbook.

Release order: deploy the H4 writer and reader together to preview; finish
real account matches and verify non-null stats and rendered values; dry-run
then execute the preview backfill; repeat in production after confirming the
H1/H2 schema and migration state. Query counts of `NULL` and unsupported
stats before and after. If the backfill reports failures, investigate and
rerun only after the underlying replay problem is fixed. Do not mark H4
shipped while stored matches are still missing valid stats.

---

## 9. Decisions and open questions

| ID | Decision | Reason |
| --- | --- | --- |
| H4-D1 | A comeback requires the eventual winner to have trailed by at least two movement captures. | Founder choice. A strict, reproducible flag avoids claiming every narrow win was a comeback. |
| H4-D2 | The public panel shows captures, jare, repeated jare, movement turns, and comeback. | Founder choice. Other fields remain stored for R4 without crowding the match page. |
| H4-D3 | Count jare by accepted action event, not completed line. | The game awards one capture for a multi-line move and one first advantage for a multi-line placement. |
| H4-D4 | Keep stats in versioned `match.stats_json`; no default aggregate table. | H1 has the column, and R4 can derive player totals from the indexed ledger. |
| H4-D5 | Backfill only `NULL` rows with compare-and-set updates. | Safe to resume; no silent replacement of historical data. |

No founder decision is required to start implementation. If real-match
review reveals that a stored metric is misleading, change the counting
contract and version deliberately before shipping, rather than editing the
meaning of `v: 1` silently.

---

## 10. Done when

- Every stored H1 match has a valid `MatchStatsV1` (new and backfilled), with
  zero unexplained `NULL` or unsupported `stats_json` values.
- Every newly completed account match persists stats with its ledger row;
  idempotent retries do not change them.
- The public match page shows the selected seat-by-seat stats and labels a
  comeback only under H4-D1.
- Golden fixture, worker, backfill, web, and relevant E2E checks pass; H1
  replay validation and DO hibernation checks remain green.
- The merged H1/H2 contracts have been reconciled, the release runbook has
  preview/production verification, and `docs/shaxda-v2.md` §4 marks H4
  **shipped** with the merge date only after these conditions are met.
