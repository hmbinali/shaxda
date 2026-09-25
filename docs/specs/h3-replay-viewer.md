# H3 — Replay Viewer (Spec)

| Field | Value |
| --- | --- |
| Status | Draft, not started; implementation waits for H1 and H2 |
| Brief | `docs/shaxda-v2.md` §9 (H3), §7.3, §14 |
| Workspace | `h3-replay-viewer` |
| Depends on | H1's saved compact replay and H2's public `/match/<id>` page |
| Touches | `packages/db` (one read query), `packages/i18n`, `web/` |
| Does not touch | The game Worker, D1 writes or migrations, replay storage format, game rules, `/local`, `/online`, auth, or Turnstile |

This spec refines the H3 brief without expanding its Must scope. The rules in
`docs/shaxda_game.md` remain authoritative. Read `AGENTS.md`, the merged H1
and H2 contracts, and the H1 compact replay tests before implementing. H1,
H2, and this V2 brief are currently drafts in the working tree, so H3 must
reconcile against what actually merges. In particular, the later H1 draft
defines `match.replay`, `replay_v`, `starting_seat`, and `winner_seat`, while
H2's older §3 still names `replay_json`, `starting_player`, and `winner`.
Use the merged H1 schema; correct H2's read model explicitly before adding
the H3 read. Do not silently invent a second format or column mapping.

---

## 1. Goal and boundaries

**Goal.** Anyone who opens a saved match can watch its exact accepted actions
on the production board, move to any action, and share that position.

### Must

1. A public, read-only replay in H2's reserved slot between the match header
   and details. It works signed out; `/history` stays owner-only.
2. Client-side reconstruction from H1's `{ v: 1, s, a }` replay using the
   pure game engine. Keep the initial and every subsequent `GameState` in
   memory. Reject an invalid or mismatched replay without hiding H2's match
   details.
3. Play/pause; previous/next; start/end; `position / actionCount`; speeds
   0.5×, 1×, 2×; keyboard left/right when the viewer has focus.
4. A non-interactive board showing the phase, player due to act, last action,
   movement origin and destination, jare and capture cues, both initial
   removals, and the moment first advantage is decided.
5. The saved result at the final position, reduced-motion behavior, and an
   opt-in sound toggle that begins off on every viewer mount.
6. Shareable `/match/<id>?a=<index>` positions, including safe clamping of an
   invalid or out-of-range index.

### Should, outside the H3 completion gate

- A timeline scrubber with jare, capture, and phase-change markers.
- Previous/next jare or capture event jumps.

### Not in H3

Annotations, commentary, alternative moves, replay downloads, per-move D1
rows, guest/local-game persistence, a separate replay route, match editing,
new rules, or H4 statistics. H4 may add its panel after this viewer without
changing H3's position model.

---

## 2. Contracts and public read

H1's `CompactReplay` is the only replay wire/storage format. Version 1 has a
starting seat `s` and ordered action-code array `a`; `R:<seat>` names the
resigning seat, including claim-win's synthetic resignation. H3 reads but
does not change those codes, the decoder, or `GameState`. Do not use a
client-authored action list or infer the starting seat from player A.

Extend H2's match loader with a narrow `readMatchReplay(db, matchId)` query
against the `match` primary key. It reads only `replay_v` and `replay` after
H2's match-ID validation and found-match check. There is no new endpoint,
auth check, migration, or Worker read. Parse the stored JSON and validate it
with H1's shared compact-replay schema. Require the JSON `v` to agree with
`replay_v`. Return a discriminated page-data field:

```ts
type PublicReplay =
  | { kind: "ready"; value: CompactReplay }
  | { kind: "unavailable" };
```

Do not return malformed raw JSON to the browser. The ready value contains
only the replay codes and starting seat; page data must still contain no
`user_id`, email, room code, provider name, or identity ticket. H2 already
exposes the public match result and player labels. Keep its session-sensitive
page caching behavior and Open Graph URL without `?a=`. A bad replay affects
only the viewer: the public match header, details, profile links, and share
button still render. Log a structured replay-unavailable event with match ID,
stored version, and reason, never the replay body or private identity data.

If the merged H1 schema or API differs from this draft, reconcile this
section and H2's §3 in a visible contract change before implementation. H3
does not alter the frozen H1 format to accommodate an old H2 draft.

---

## 3. Reconstruction and event model

**Position** is the number of accepted actions already applied. Position `0`
is `createInitialState(replay.s)`. For `N = replay.a.length`, position `N` is
the final saved state. A deep link `?a=34` therefore displays the state and
highlight **after** action 34, with the counter `34 / N`. This agrees with
H4's `phaseTransitions[].afterAction` convention.

On the client, run H1's `decodeCompactReplay` first. If it fails, display
the unavailable state. Then build a `frames` array of length `N + 1` by
applying each decoded action to the preceding frame with
`applyActionLog(previousState, [action])`. Stop on any engine rejection.
Check that the last frame serializes identically to the decoder's final
state. Also check `N` against the match's `action_count` and compare the
last frame's winner, engine end reason, starting seat, first advantage, and
per-seat captured/on-board counts with H2's public match fields. A mismatch
shows the unavailable state and logs a non-sensitive diagnostic; the viewer
must never display an invented or partially reconstructed game. H1 already
validates before writing; this read check catches corruption or contract
drift. Preserve the saved online end reason for result copy: a claim-win's
engine action is a synthetic resignation, but H2's `abandoned` or `idle`
reason is what the viewer shows at the end.

Store `{ before, action, after, events }` for each position `1..N` alongside
the frames. Derive events from accepted actions and adjacent states, never
from timers, CSS animation completion, or mutable server state:

| Event | Rule | Position cue |
| --- | --- | --- |
| Placement | `place` | Mark the placed point and piece. |
| Movement | `move` | Mark `from`, `to`, and the moved piece at `to`. |
| Initial removal | `removeInitial` | Mark the now-empty removed point; label it as initial removal, not a capture. |
| Capture | `capture` | Mark the now-empty captured point with the live capture visual. |
| Jare | A `place` or `move` newly completes at least one line according to `formsNewJare(before.board, after.board, destination, action.player)` | Highlight the newly completed line(s); multiple lines from one action are one event. |
| First advantage | `before.firstAdvantage === null` and `after.firstAdvantage !== null` | Name the awarded seat and use H1's `first_advantage_by` to distinguish placement jare from the no-jare fallback. |
| Phase change | `before.phase !== after.phase` | Announce the entered phase; includes capture and game over. |

At position `0`, there is no last action or event cue. At other positions,
event cues persist while paused or scrubbed; they are not the live board's
1.4-second transient feedback. A resignation has no fictitious board move.
Use the engine's `getActingPlayer` or existing `buildGameStatus` so a blocked
player's space-making turn names the actual actor. At `gameOver`, show the
result instead of presenting another turn.

---

## 4. Board and controls

Mount the existing `Board.svelte` renderer with a replay/read-only mode. It
must not dispatch actions, focus board points as controls, or display legal
move, capture-target, or removal-target hints. Today `interactive={false}`
removes point handlers but `buildBoardView` still derives some live target
hints; the replay mode must suppress them. Add a replay cue input to the
board/view model for stable highlights while reusing the live board's piece,
jare-line, and capture styling. Do not drive replay highlights through the
live `lastAction` timeout. Keep live/local/online behavior unchanged.

The match page retains H2's player header and shows a neutral board
orientation with seat A consistently above seat B, independent of the
viewer's identity. The replay section contains the board, phase/actor text,
one concise action/event description, and the control group. Names use H2's
current public username or deleted-member label. There is no claim of who
"you" are when signed out. At position `N`, show a result overlay over the
still-visible final board; it uses H2's public result and online-reason copy
and disappears when the position moves back. A draw has no winner.

| Control | Behavior |
| --- | --- |
| Play | Starts from the current position; from `N`, resets to `0` and starts. First advance occurs after one interval. |
| Pause | Stops the timer at the current position. |
| Previous / next | Pauses and moves exactly one position, clamped to `0..N`. |
| Start / end | Pauses and jumps to `0` or `N`. |
| Speed | Defaults to 1×. One action every 2,000 ms at 0.5×, 1,000 ms at 1×, or 500 ms at 2×. A change restarts the next interval at the new speed. |
| End reached | Pauses, shows the final result, and leaves the board at `N`. |

Use one cancellable client timer, cleared on pause, seek, navigation away,
component destruction, and page visibility becoming hidden. A hidden page
pauses rather than advancing unseen or playing audio. Manual seeking and
opening a deep link never autoplay. The optional scrubber and event jumps,
if built, pause and seek to an action position using the same path as the
required controls. Event jumps target the nearest strictly earlier/later
position containing jare or capture, and disable at the boundary.

The sound toggle is local to this replay viewer, starts **off even when the
live-game sound preference is on**, and is not written to that preference.
Only an explicit user gesture turns it on and unlocks the existing Web Audio
player. Reuse the game's action feedback classification for forward playback
and manual Next. Do not play cues on initial load, deep-link positioning,
backward steps, start/end jumps, or optional scrubbing. Sound failure never
blocks replay. Sound is not the only signal for any event.

---

## 5. URL and accessibility behavior

Read `a` as a base-10 nonnegative safe integer. Missing, empty, negative,
non-numeric, or unsafe values resolve to `0`; values above `N` resolve to
`N`. Use the same rule for first load, in-app navigation, and browser
back/forward. Pause before applying a newly navigated position. The server
does not reject `?a=` or query D1 by action index.

After a position change, use URL replacement rather than a new history entry:
remove `a` at position `0`, otherwise set it to the decimal position. Keep
the match path and unrelated query parameters. This makes the address bar a
shareable position without filling browser history during playback. H2's
normal share button continues to share the match root; add a separate
"share this position" action using the existing `ShareLink` behavior and
the canonical `?a=` URL.

Every control has a visible focus indicator, an accessible Somali name, and
native button semantics. Left/right arrows step only when focus is within
the replay viewer, not in a range control or editable field; they do not
steal keys from the rest of the page. Home/End are optional keyboard
shortcuts, while the visible start/end buttons are required. Expose the
counter as text, not as a rapidly announced live region. Announce a manual
position change and its action description through a polite status; do not
announce every autoplay tick. Board descriptions identify the current
phase, actor, and last action without treating read-only points as buttons.

For `prefers-reduced-motion: reduce`, state changes are immediate: suppress
piece movement, fades, jare pulses, and overlay transitions while retaining
static highlights and text. Playback timing and controls still work. Respect
mobile touch targets and avoid horizontal overflow at the match page's
smallest supported width.

All visible copy lives in `packages/i18n` and is Somali-only. Reuse H2's
phase, player, result, and reason terms where present. Add keys for replay
title, loading/unavailable states, play/pause, previous/next, start/end,
speed, sound on/off, position sharing, initial removal, first advantage,
jare, capture, and keyboard help. Proposed short labels are "Dib u daawo",
"Ciyaar", "Hakad", "Tallaabadii hore", "Tallaabada xigta", "Bilowga",
"Dhammaadka", and "La wadaag tallaabadan". Put new wording through the
repository's native/fluent Somali translation review before release; do not
ship English fallback text.

---

## 6. Tests and acceptance

**Pure model tests:** Run every H1 `fullGameActionScripts` and
`a2ConformanceActionScripts` fixture through the compact encoder, decoder,
and H3 frame builder. Assert `frames.length === actions.length + 1`, each
frame equals engine application of its prefix, and the final serialized
frame and public ledger facts match the stored result. Cover seat B starting,
early resignation, claim-win's `R:<seat>`, placement jare, no-jare first
advantage, both initial removals, movement jare/capture, blocked
space-making, and draws. Assert a malformed code, unsupported version,
truncated or illegal action, or result mismatch makes the viewer unavailable.

**Route and component tests:** A public match page reads the replay by match
ID only and never serializes account IDs, room codes, or bad raw JSON. An
unknown match remains H2's 404. A bad replay leaves match details and share
available. Test all button boundaries, playback intervals/speeds, pause on
hidden tab, destruction cleanup, keyboard focus scoping, URL parsing and
clamping, browser navigation, final overlay and claim-win reason, sound off
on mount despite a live-game preference of on, and reduced-motion static
cues. Assert replay mode has no board-point action handlers or live legal
hints.

**Playwright:** With a seeded saved match, open as a signed-out viewer;
follow `?a=0`, an interior index, an index above `N`, and invalid values;
step and play to `N`; copy a position link and open it in a fresh page; use
keyboard arrows within the viewer; check mobile layout and reduced-motion
rendering. Once H1/H2's real-game e2e fixture exists, use a persisted
account-vs-account game as an end-to-end replay source. `pnpm check` and
`pnpm test:e2e` must pass when H3 is implemented.

**Physical-device gate:** Before marking H3 shipped, replay one full saved
game from start to result in Chrome on a real entry-level Android phone.
Record device model, RAM, Android/Chrome versions, match ID or fixture,
action count, and pass/fail for controls, highlights, result, sound-off
default, reduced motion, portrait layout, and absence of stalls or crashes.
An emulator is useful during development but does not satisfy this gate.

H3 is done when both signed-in and signed-out visitors can replay the same
saved game to the same final state, deep links and controls work, all Must
tests pass, and the physical-device gate passes. The optional scrubber and
event jumps may remain unimplemented without blocking H3.

---

## 7. Implementation order and decisions

Build one reviewable slice at a time:

1. Reconcile H1/H2 contracts and add the public replay read/page-data shape.
2. Add pure frame/event construction with fixtures and mismatch tests.
3. Add stable replay cues and hint suppression to the production board.
4. Mount the viewer with Somali copy, required controls, URL handling,
   accessibility, reduced motion, and opt-in audio.
5. Add route/component/e2e coverage, then perform the physical-device pass.
6. Add the Should timeline and event jumps only if time remains after the
   Must gate is green; they do not change the position contract.

| ID | Decision | Reason |
| --- | --- | --- |
| H3-D1 | Position is the number of actions applied, from `0..N`. | It makes initial/final states and H4 event positions unambiguous. |
| H3-D2 | The public H2 loader adds one primary-key replay read; no new endpoint. | The match is already public and the compact payload is small. |
| H3-D3 | Invalid replay disables only the viewer. | Match metadata and sharing remain useful; invented playback is unacceptable. |
| H3-D4 | Board cues are stable replay inputs, separate from live transient feedback. | Pausing and deep links must preserve the highlighted event. |
| H3-D5 | URL updates replace history entries; autoplay starts only on command. | Links remain shareable without a browser-history entry per action or surprise playback. |
| H3-D6 | Replay audio is opt-in and independent of live-game preference. | The H3 default is silent, even for players who enabled game audio. |
| H3-D7 | Scrubber and event jumps remain Should. | The V2 brief makes the required controls the completion gate. |
| H3-D8 | A real entry-level Android phone is required for final acceptance. | The brief's low-end phone criterion needs physical proof. |
