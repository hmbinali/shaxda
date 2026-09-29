# H3 — Replay Viewer (Spec)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `revised` (see [README](README.md#spec-index))                                                                                                                                                                                                                                                                                                                                                          |
| Wave       | 4 in the index; may start any time after wave 1                                                                                                                                                                                                                                                                                                                                                         |
| Depends on | H1 (compact replay, `replay_v`, `rules_v`), H2 (match page and loader)                                                                                                                                                                                                                                                                                                                                  |
| Register   | F2, P2                                                                                                                                                                                                                                                                                                                                                                                                  |
| Contracts  | Consumes [§2.1](v2-contracts.md#21-h1-tables), [§2.4](v2-contracts.md#24-compact-replay), [§4.3](v2-contracts.md#43-canonical-sample-matches), [§5](v2-contracts.md#5-access-matrix), [§6.5](v2-contracts.md#65-deploy-order), [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e), [§12 E4](v2-contracts.md#12-evidence). Owns only the page-data, adapter, position, URL, and board-mode rules in §3. |
| Brief      | `docs/shaxda-v2.md` §9 (H3), §7.3                                                                                                                                                                                                                                                                                                                                                                       |
| Touches    | `packages/db` (one read query), `packages/shared` (test fixtures), `packages/i18n`, `web/`, `tests/e2e/`, `docs/ops/` (device-gate record)                                                                                                                                                                                                                                                              |

H3 mounts a read-only replay viewer on H2's match page: the browser rebuilds
every position of a saved match from H1's compact replay with the real engine
and shows it on the production board, with controls, stable cues, and
shareable positions, to viewers H2's access check admits. H3 writes nothing
and changes no contract. The replay format and ledger are H1's; the page,
access decision, names, result copy, and sharing are H2's; statistics are
H4's; rating labels are H2's with R1. `docs/shaxda_game.md` governs rules.

## 1. Outcome and non-goals

**Outcome.** Anyone allowed to open a saved match — everyone for a rated
match, its two players for a friendly one — can watch its exact accepted
actions on the production board, move to any position, and share it.

### Must

1. The viewer fills H2's slot between the header and the details for every
   viewer H2 admits. Replay data is served only after the
   [§5](v2-contracts.md#5-access-matrix) check, so a friendly match's page and
   `__data.json` give everyone but its two players the unknown-id 404.
2. The adapter is chosen by `(rules_v, replay_v)`; only `(1, 1)` exists. Any
   other pair shows "replay unavailable" beside intact match details.
3. All `N + 1` positions are built once in the browser, kept in memory, and
   checked against the ledger; a failure disables only the viewer.
4. A read-only board without hints shows the phase, actor, last action, move
   origin and destination, jare and capture cues, both initial removals, and
   the first-advantage moment; a result overlay appears at `N`.
5. Play/pause, previous/next, start/end, counter `p / N`, 0.5×/1×/2×, and
   arrow keys inside the viewer, on one timer that pauses on a hidden tab.
6. `?a=<p>` opens position `p`, clamped (never a 404); the URL follows the
   position without history entries; "share this position" shares it.
7. Opt-in sound, off on every mount; reduced motion; Somali accessible names.
8. A full replay passes on a physical entry-level Android phone (§9.5).

### Should (outside the completion gate)

A timeline scrubber with jare, capture, and phase markers; jumps to the
previous or next jare or capture.

### Not in H3

Annotations, commentary, alternative moves, downloads, a replay route or API,
per-move rows, guest or `/local` persistence, editing, rule changes, stats
(H4), rating labels (H2 with R1), server-side engine runs, and Web Workers.

## 2. Decisions and dependencies

| ID  | How H3 applies it                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F2  | Rated replays are public; a friendly replay is visible only to the match's two players. H3 adds no visibility rule of its own.                                          |
| P2  | Visibility follows the stored `rated` flag through H2's access check. A pair-capped or invalidated rated match (M4, M8) stays public and replayable; its label is H2's. |

Consumed through H2, not decided here: P5 (current names; the neutral label
for a pending or deleted account) and F8 (guest games have no row).

| Dependency                                          | Provides to H3                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1                                                  | The compact replay with `R:<seat>` ([§2.4](v2-contracts.md#24-compact-replay)); `replay`, `replay_v`, `rules_v`, and the ledger facts ([§2.1](v2-contracts.md#21-h1-tables)); the pure decoder in `packages/game-engine`; the Zod schema and its limits (≤ 1,403 actions, ≤ 16,384 bytes) in `packages/shared`; the engine's `RULES_VERSION`; validation before every write; a random starting seat. |
| H2                                                  | `/match/[id]` and its loader: id validation, `readMatchForViewer` (the whole §5 access rule, with its unknown-id 404), friendly headers and OG, names and the neutral label, result and online-reason copy, the `ShareLink` share action, the replay slot, and a loader that ignores `?a=`.                                                                                                          |
| E4 ([§12](v2-contracts.md#12-evidence))             | Worst legal game: 1,403 actions, 1,404 frames, ≈ 1.1 MB of heap, ≈ 14 ms per build pass (Node 24, Apple Silicon); typical games p50 152 and p95 286 actions. Sets the frame strategy and §6.                                                                                                                                                                                                         |
| [§10.4](v2-contracts.md#104-shared-local-d1-in-e2e) | One local D1 shared by the game and web Workers in e2e, for the real-game test.                                                                                                                                                                                                                                                                                                                      |
| H4 (sibling)                                        | `phaseTransitions[].afterAction` uses H3's position numbering; H4's panel mounts after H3's slot. Neither changes the other's model.                                                                                                                                                                                                                                                                 |

## 3. Contracts

### 3.1 Page data and the replay read

H2's `/match/[id]` load gains one field, computed only after H2 admits the
viewer; `CompactReplay` is H1's `{ v, s, a }`:

```ts
type MatchReplayData =
  | { kind: "ready"; rulesV: number; replayV: number; replay: CompactReplay }
  | { kind: "unavailable" };
```

`ready` requires, without running the engine: a supported pair (§3.2); JSON
that passes H1's schema and its limits; `replay.v === replay_v`;
`replay.s === starting_seat`; and `replay.a.length === action_count`.
Otherwise the field is `unavailable` and the server logs it (§4.6). The page
data never carries the stored text, a user id, the room code, or a ticket.
`readMatchReplay(db, matchId)`, beside H2's `readMatchForViewer` in
`packages/db/src/queries/`, runs only after that returns `found`:
`SELECT rules_v, replay_v, replay FROM match WHERE id = ?1`, one row through
the unique `id` index.

### 3.2 Adapter registry

`getReplayAdapter(rulesV, replayV)` in `web/src/lib/replay/adapters.ts`
serves the loader's support check and the viewer's build. It lists pairs
explicitly: `(1, 1)` is H1's decoder with the current engine; every other
pair returns `null` and never falls through to the current engine. A test
pins `RULES_VERSION === 1`, so a rules change must add an adapter.

### 3.3 Positions and frames

- Position `p` counts the accepted actions applied: `0..N` with
  `N = replay.a.length`. Position 0 is `createInitialState(replay.s)`;
  `?a=34` shows the state and cue **after** action 34, counter `34 / N`.
  H4's `afterAction` uses the same numbering.
- `frames[0..N]` and one cue per action (its kind, the points it touched,
  the jare lines it newly completed, any first-advantage award and origin,
  the phase it entered) are built once per mount on the main thread, outside
  Svelte's deep reactivity (`$state.raw` or a plain constant). Only the
  position is reactive. Frames are never serialized, cloned, stored, or sent
  to another thread: a JSON round trip turns ≈ 1.1 MB into ≈ 6.7 MB (E4).

### 3.4 URL

`a` is read as base-10 digits only (leading zeros allowed): a safe integer
up to `N` is that position and one above `N` is `N`; a missing or empty `a`,
or anything else (sign, decimal point, exponent, letters, an unsafe
integer), means position 0. The first `a` wins when it repeats. The server
never reads or rejects `a`; the canonical URL and `og:url` stay
`/match/<id>`.

### 3.5 Board replay mode

`Board.svelte` gains `mode?: "live" | "replay"` (default `"live"`) and a
`cue` input. Replay mode attaches no point handlers or tab stops, skips
`legalActions`, and shows no legal-move, capture-target, removal-target, or
space-making hint. It draws the cue with the live piece, jare-line, and
capture styling, without the live `lastAction` nonce and its 1,400 ms timer.
Live, local, and online boards are unchanged.

## 4. Behaviour and failure handling

### 4.1 Build and check

1. SSR renders a board-sized loading shell; the server never builds frames.
2. On mount: the adapter for the pair (none: unavailable), H1's decoder, then
   each action applied to the previous frame, stopping at a rejection.
3. The last frame must match the ledger: `serialize()` equals the decoder's
   final state; `N = action_count`; the winner, end reason, starting seat,
   first-advantage seat and origin, and each seat's on-board count and
   captures equal `winner_seat`, `end_reason`, `starting_seat`,
   `first_advantage_seat`, `first_advantage_by`, `pieces_left`, and
   `captured` from H2's page data. The origin is `placementJare` when the
   awarding action newly completed a jare, else `noJareFallback`.
4. Only then does the board appear, at the URL's position (§4.4). The build
   is measured as `shaxda:replay-build` (`performance.measure`).

### 4.2 Cues

| Action or change                                                                         | Cue at that position                                                                                                                     |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `place` / `move`                                                                         | The placed point, or `from`, `to`, and the moved piece.                                                                                  |
| `removeInitial`                                                                          | The emptied point, labelled initial removal, never capture.                                                                              |
| `capture`                                                                                | The emptied point with the live capture visual.                                                                                          |
| Jare: `formsNewJare(before.board, after.board, point, player)` after a `place` or `move` | The newly completed line(s); two lines from one action are one event.                                                                    |
| First advantage: `before.firstAdvantage === null` and `after.firstAdvantage !== null`    | The seat and the origin.                                                                                                                 |
| Phase change: `before.phase !== after.phase`                                             | The entered phase, including `capture` and `gameOver`.                                                                                   |
| `R:<seat>`                                                                               | No board change. Names the resigning seat or, when `online_end_reason` is set, shows H2's `abandoned`/`idle` text instead of "resigned". |

Cues come only from the replay and adjacent frames — never from timers,
animation events, or server state — and persist while paused or scrubbed;
position 0 has none. Descriptions reuse `web/src/lib/game/announce.ts`. The
status line uses `buildGameStatus`, so a space-making turn names the actual
actor, and at `gameOver` it shows the result. Result copy covers all six
engine end reasons, although E4 shows legal games reach only four.

### 4.3 Board, overlay, and controls

Fixed orientation, whoever views: seat A's rail above the board, seat B's
below. Names come from H2's page data (current username or neutral label);
the viewer never says "you". At `N` a result overlay over the final board
uses H2's public result and online-reason copy; a draw names no winner.
Unlike the live `GameResultOverlay` it is not modal: no focus trap, the
controls stay usable, and it disappears when the position moves back.

| Control         | Behaviour                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play / pause    | Plays from the current position (from `N`, restarts at 0); the first advance comes after one interval; reaching `N` pauses and shows the overlay. Pause holds the position. |
| Previous / next | Pause, then move one position within `0..N`; disabled at the bounds.                                                                                                        |
| Start / end     | Pause, then jump to 0 or `N`.                                                                                                                                               |
| Speed           | 1× on every mount; one step per 2,000 / 1,000 / 500 ms at 0.5× / 1× / 2×; a change restarts the pending interval.                                                           |
| Arrow keys      | Left/right step while focus is inside the viewer and not in a text field or range control; Home/End are optional.                                                           |

One cancellable timer, cleared on pause, seek, navigation, destroy, and
`visibilitychange` to hidden; a returning tab stays paused. Deep links and
seeks never autoplay. The Should scrubber and jumps use the same seek path;
a jump targets the nearest strictly earlier or later jare or capture.

### 4.4 URL and sharing

- Position changes update the address bar with SvelteKit's shallow
  `replaceState` (`$app/navigation`): no navigation, load, `__data.json`
  request, or history entry; position 0 drops `a`. Writes are
  trailing-debounced by 300 ms because browsers rate-limit history updates.
- The viewer reads `a` from `location` on mount and after each real
  navigation (shallow routing leaves `page.url` at the original URL), pauses
  first, and normalizes an invalid value through the same debounced write.
- "Share this position" reuses H2's `ShareLink` with H2's title and text and
  a URL built from the current position, not from the address bar. It
  appears exactly where H2's match share action appears.

### 4.5 Sound, motion, and accessibility

- Sound starts off on every mount, even when the live preference
  (`shaxda:sound-enabled:v1`) is on, which the viewer never reads or writes.
  A user gesture turns it on and unlocks the existing `SoundPlayer`;
  `classifyActionFeedback` cues play on forward playback and Next only, never
  on load, deep links, backward steps, jumps, or scrubbing. A sound failure
  never blocks playback; sound is never the only signal.
- `prefers-reduced-motion: reduce`: positions change instantly (no piece
  travel, fades, jare pulses, or overlay transitions); highlights, text, and
  timing remain.
- Native buttons with Somali names and visible focus; the counter is plain
  text; a polite status announces manual position changes and the result at
  `N`, never autoplay ticks; points are not buttons; touch targets stay
  usable with no horizontal overflow at the match page's smallest width.

### 4.6 Failures

| Failure                                              | Detected by | Viewer                                                     | Log                                              |
| ---------------------------------------------------- | ----------- | ---------------------------------------------------------- | ------------------------------------------------ |
| Friendly match, viewer not a player                  | H2's check  | not rendered: unknown-id 404 on the page and `__data.json` | none from H3                                     |
| Unsupported `(rules_v, replay_v)`                    | loader      | unavailable                                                | server `replayUnavailable`, `unsupportedVersion` |
| Replay read fails or finds no row                    | loader      | unavailable                                                | server, `readFailed`                             |
| JSON, schema, limit, `v`, `s`, or length check fails | loader      | unavailable                                                | server, `invalid`                                |
| No adapter in the browser bundle                     | browser     | unavailable                                                | `console.warn`, `unsupportedVersion`             |
| Decoder or engine rejects an action                  | browser     | unavailable                                                | `console.warn`, `illegalAction` and position     |
| Last frame disagrees with the ledger                 | browser     | unavailable                                                | `console.warn`, `ledgerMismatch` and field       |

"Unavailable" replaces only the viewer; the header, details, and sharing
stay. Logs carry the match id, versions, reason, and position — never the
replay text, a user id, or the viewer's identity.

## 5. Privacy and access

| [§5](v2-contracts.md#5-access-matrix) row                       | Signed out / unrelated    | Participant | H3's part                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/match/<id>`, its replay data, stats, rating status — rated    | full                      | full        | A `ready` replay for everyone; canonical and OG stay without `?a=`.                                                                                                                                                                                  |
| `/match/<id>`, its replay data, stats, rating status — friendly | same 404 as an unknown id | full        | H3 runs only after H2 admits the viewer: a denied request never reads, parses, or logs the replay, and its page and `__data.json` equal the unknown-id responses. The response carrying the replay keeps H2's `no-store`, `noindex`, and generic OG. |

- H2 decides participation on the server; H3 never sees a user id. The page
  data holds only `{ v, s, a }` and the two versions: §5's "validated replay
  that H3 needs" exception.
- No endpoint of its own: the page and its `__data.json` are the only data
  paths. Nothing reaches device storage or the service worker, and SvelteKit
  sends `__data.json` as `private, no-store`.
- A position link to a friendly match opens only for its two players.

## 6. Resource budget

| Per match-page view                               | Admitted viewer                                         | Denied or unknown id |
| ------------------------------------------------- | ------------------------------------------------------- | -------------------- |
| D1 rows read                                      | H2's + 1 (`match` by the unique `id` index)             | H2's + 0             |
| D1 rows written, DO wake-ups, storage, migrations | 0                                                       | 0                    |
| Extra requests                                    | 0; stepping and playback request nothing                | 0                    |
| Page data                                         | the replay, ≤ 16,384 bytes (p50 ≈ 1.4 KB, p95 ≈ 2.8 KB) | 0                    |
| Worker CPU                                        | JSON parse and schema check; no engine run              | 0                    |

| Browser (E4: Node 24, Apple Silicon) | Worst game (1,403 actions)                     | Typical (p95, 286) | Budget                   |
| ------------------------------------ | ---------------------------------------------- | ------------------ | ------------------------ |
| Frames kept                          | 1,404                                          | 287                | all                      |
| Heap for frames                      | ≈ 1.1 MB (≈ 762 B each)                        | ≈ 0.2 MB           | recorded on the phone    |
| Build                                | ≈ 14 ms per pass; two passes (decoder, frames) | ≈ 3 ms per pass    | CI ≤ 500 ms; phone ≤ 1 s |
| Seek                                 | an array lookup, no engine work                | same               | CI: 1,000 seeks ≤ 500 ms |

If the phone needs more than 1 s for the maximal game, or the tab crashes,
H3 does not ship; another frame strategy is a spec change.

## 7. Somali copy

New keys go under `messages.so.matchReplay` in `packages/i18n`, behind
`TODO(translation-review)`. "Dib u daawo" is the Q4 glossary draft
([README](README.md#somali-glossary-drafts-q4)).

| Key                                                   | Draft                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `title`                                               | Dib u daawo                                                                     |
| `regionLabel`                                         | Dib u daawashada ciyaarta                                                       |
| `loading`                                             | Dib u daawashada waa la diyaarinayaa…                                           |
| `unavailable`                                         | Dib u daawashada ciyaartan lama heli karo.                                      |
| `controls.{play,pause,previous,next,start,end,speed}` | Ciyaar, Hakad, Tallaabadii hore, Tallaabada xigta, Bilowga, Dhammaadka, Xawaare |
| `counter` (accessible text)                           | Tallaabo {position} ee {total}                                                  |
| `startPosition`                                       | Ciyaartu weli ma bilaabmin.                                                     |
| `sharePosition`                                       | La wadaag tallaabadan                                                           |
| `firstAdvantage.placementJare`                        | {name} ayaa helay horraynta: jare ayuu sameeyay xilligii dhigista.              |
| `firstAdvantage.noJareFallback`                       | Jare lama samayn xilligii dhigista; {name} ayaa helay horraynta.                |
| `phaseEntered`                                        | Waji cusub: {phase}.                                                            |
| `keyboardHelp`                                        | Falaarta bidix iyo midig ku soco tallaabo tallaabo.                             |

Reused without new keys: `localGame.phases`, `localGame.announce` (placed,
moved, jare, captured, initial removal, resigned, winner, draw),
`localGame.result`, `localGame.controls.soundOn` and `soundOff`, and H2's
result, online-reason, neutral-label, and share-status copy. No English
fallback ships.

## 8. Implementation slices

1. `test(shared): add complete-game replay fixtures for the sample matches`
2. `test(web): cover replay frames, cues, and version selection`
3. `feat(web): build replay frames and cues from a compact replay`
4. `feat(db): add readMatchReplay`
5. `feat(web): serve the validated replay from the match loader`
6. `feat(web): add a read-only replay mode with stable cues to the board`
7. `feat(i18n): add Somali replay viewer copy`
8. `feat(web): mount the replay viewer with controls and URL positions`
9. `feat(web): add replay position sharing, opt-in sound, and reduced motion`
10. `test(e2e): replay saved matches as visitor, participant, and on mobile`
11. `docs(ops): record the H3 physical-device gate`

Should, only after the gate is green: `feat(web): add replay timeline markers
and event jumps`, with no change to the position contract.

## 9. Acceptance tests

### 9.1 Fixtures

Complete games from `createInitialState(s)`, built with the engine, stored
as compact replays beside the canonical fixtures in `packages/shared`, and
proven legal in their own tests (reuse an H1 or H4 fixture of the same
game): M1 (A wins by pieces), M2 (three placements, then `R:B`), M3 (A's
jare move, then `R:A`), M5 (80 quiet movement turns), and **maximal**, a
seeded E4-style search (17 cycles of 79 quiet turns, a jare move, and a
clock-resetting capture) run in the test or checked in, asserted to have
1,403 actions, 13,922 bytes of canonical JSON, and `opponentBelowThree`.
The mid-game `a2ConformanceActionScripts` are not compact replays (they skip
the initial state); they test cue derivation directly.

### 9.2 Unit and Workers

- Every fixture and `fullGameActionScripts` script: `N + 1` frames, each
  `serialize()`-equal to replaying its prefix; §4.2 cues for seat B starting,
  a placement jare, a two-line jare as one event, both first-advantage
  origins, both initial removals, a capture, blocked space-making, and a
  resignation with no board change.
- Maximal game: build ≤ 500 ms with each action applied once in the frame
  pass; then 1,000 random seeks and a full sweep each way apply nothing and
  take ≤ 500 ms (counted through the adapter).
- Unavailable, never partial: a malformed code, an unsupported pair, a
  truncated or illegal action, and each ledger mismatch in §4.1.
- Only `(1, 1)` resolves and `RULES_VERSION === 1`; every §3.4 case,
  including a repeated `a`, parses as specified.
- `packages/db` (Workers pool): `readMatchReplay` returns only the three
  replay columns (no rating state, M8), nothing for an unknown id, and a
  plan on the unique `id` index.

### 9.3 Loader (seeded rows)

- Rated, signed out: `ready` with only `{ v, s, a }` and the versions; no
  user id, room code, or stored text in the serialized data.
- Friendly, signed out and as an unrelated account: the page and
  `__data.json` equal the unknown-id responses once the id is substituted
  (SvelteKit answers the data request with HTTP 200 and a 404 error node);
  `readMatchReplay` is never called.
- Friendly, as A and as B: `ready`, `cache-control` containing `no-store` on
  both responses. A rated and a friendly row from one room (M9) keep their
  own visibility.
- Unsupported pairs (2/1, 1/2) and every loader failure in §4.6:
  `unavailable`, H2's fields present, page 200, one log line without the
  replay text. No `?a=` value changes the status or the data.

### 9.4 Component

- Controls per §4.3 under fake timers: bounds, restart from `N`, the first
  advance after one interval, the three speeds, one timer under rapid
  play/pause, pause on a hidden tab, cleanup on destroy; arrows only inside
  the viewer.
- URL: debounced shallow writes, `a` dropped at 0, normalization, `a`
  re-read from `location` after navigation; share URL from the position.
- Overlay at `N` (M3: idle text, B wins; M5: draw, no winner), not modal,
  gone after stepping back. M10: every string names B with the neutral label.
- Sound off on mount while the live preference is stored as on, and that
  preference never written; cues only on forward playback and Next. Reduced
  motion: no transitions, static cues kept.
- Replay board: no handlers, point tab stops, or hint classes, and
  `legalActions` never runs; the live `Board` tests pass unchanged.

### 9.5 End to end and the device gate

`tests/e2e/match-replay.spec.ts`, with rows seeded in the shared local D1:

- Rated, signed out: `?a=0`, an interior index, one above `N`, and invalid
  values all return 200 at the clamped position; step and play to `N`; a
  copied position link reopens that position in a fresh context; arrow keys;
  `emulateMedia` reduced motion; no `__data.json` request while stepping or
  playing.
- Friendly: 404 on the page and `__data.json` signed out; a player replays
  to `N`. Mobile: a replay case in `mobile-smoke.spec.ts` (the
  `mobile-chromium` project, Pixel 5) with no horizontal overflow.
- Real game: two accounts finish a game, wait for
  `matchStatus.save.status = "saved"`, and a player replays
  `/match/<matchId>` to the room's final state.

**Physical-device gate**, before H3 ships, on Chrome on a real entry-level
Android phone (an emulator does not count): replay one real saved game on
preview from start to result using every control, and open the maximal
fixture from a local build through USB port forwarding (`chrome://inspect`),
so no remote data is written. Record model, chipset, RAM, Android and Chrome
versions, match or fixture, action count, `shaxda:replay-build` duration,
and heap after the build. Pass: maximal build ≤ 1 s, no crash or reload,
and controls, cues, overlay, silent start, reduced motion (Android's "Remove
animations"), and portrait layout all pass. The ops record under `docs/ops/`
holds the result.

### 9.6 Sample matches

Answers for [§4.3](v2-contracts.md#43-canonical-sample-matches):

| ID     | Ledger and access                              | H3 behaviour                                                                                                                                                                           | Tests                     |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| M1     | Friendly; A wins by pieces; A and B only       | A and B replay to `opponentBelowThree` with A the winner. Signed-out and unrelated viewers get the unknown-id 404 on the page and `__data.json`; the replay is never read for them.    | §9.3, §9.5                |
| M2     | Rated; B resigns in placement after 3 actions  | Public. `N = 4`, five frames; position 4 keeps position 3's board, says B resigned, and has no first-advantage cue. Overlay: A wins by resignation.                                    | §9.2, §9.4                |
| M3     | Rated; idle claim while A owes a capture       | Public. Position `N − 1` is A's jare move in the capture phase; the final `R:A` moves no piece, clears the pending capture, and shows H2's idle text, not "resigned". Overlay: B wins. | §9.2, §9.4                |
| M4     | Rated; pair cap                                | Public and replayable; the "not counted" label is H2's.                                                                                                                                | §9.3 (rated rows)         |
| M5     | Rated; draw after 80 quiet movement turns      | Public. The last action is the 80th quiet move; the overlay shows a draw with no winner and the `drawTermination` copy.                                                                | §9.2, §9.4                |
| M6, M7 | Guest vs account, or a pre-play cancel; no row | Nothing to replay: the unknown-id 404.                                                                                                                                                 | H2                        |
| M8     | Rated, later invalidated                       | Public; the correction leaves the replay unchanged. The "rating removed" label is H2's with R1; the viewer reads no rating status.                                                     | §9.2 (columns read), §9.3 |
| M9     | Friendly rematch row in a rated room           | Participants only, as M1; the room's rated first game stays public.                                                                                                                    | §9.3                      |
| M10    | B deleted after M2                             | Public; every viewer string names B with the neutral label, with no link or avatar; the replay is unchanged.                                                                           | §9.4                      |

## 10. Rollout and rollback

| Environment | Needs                                               | Check                                                                                |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| dev         | Seeded rated and friendly rows in the local D1      | Unit and component tests; a manual replay                                            |
| e2e         | The shared local D1, seeded rows, one real-game row | `pnpm test:e2e`                                                                      |
| preview     | H1 and H2 live                                      | Replay a saved game as a player; a friendly id signed out gives 404; the device gate |
| production  | H1 and H2 live                                      | The same smoke checks, recorded in the ops record                                    |

- Deploy order: web Worker only ([§6.5](v2-contracts.md#65-deploy-order)).
  No migration, game-Worker change, binding, variable, secret, or cron;
  [§10.3](v2-contracts.md#103-bindings-flags-and-rollout-by-milestone) has
  no H3 row.
- Kill switch: none. Roll back by redeploying the previous web Worker
  version; H3 writes nothing, and match pages fall back to H2's layout.
- Until R2 ships (wave 2) every saved game is friendly, so production
  replays are participant-only; seeded rated rows prove the signed-out paths.

**Done when** the players of a friendly match and any visitor of a rated
match can replay it to the ledger's final state; everyone else gets the
unknown-id 404 on the page and its data request; deep links, controls,
sharing, the sound default, and reduced motion work; `pnpm check` and
`pnpm test:e2e` pass with every Must test; and the physical-device gate is
recorded as passed.
