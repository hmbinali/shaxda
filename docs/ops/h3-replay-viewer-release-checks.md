# H3 replay viewer release checks

H3 uses the existing match ledger and access check. It deploys with the web
Worker. The game Worker, D1 schema, bindings, and scheduled jobs require no
changes.

## Local verification

On 2026-11-14, the four focused Vitest files passed all 71 tests, including
the 1,403-action fixture and its seek budget. Eight focused Playwright cases
passed across two runs on local Workers and D1. They covered a signed-out
rated replay, position sharing, friendly replay privacy, saved-room board
parity, history, and the Pixel 5 viewport.

## Preview

On 2026-11-14 the [preview app manifest](https://shaxda-web-preview.shaxda.workers.dev/_app/immutable/entry/app.CRQ3R4qL.js)
mapped `/match/[id]` to `nodes/12.DlPzhi60.js`. That route rendered the H2
match details and match-level share action. The H3 viewer and position
sharing were absent. The H3 preview smoke checks are open.

1. After preview deployment is authorized, coordinate the window with
   [Wave 2 verification](../specs/README.md#wave-2-verification) and record
   the active preview web Worker version for rollback. From the approved
   [PR #50](https://github.com/hmbinali/shaxda/pull/50) commit, use the
   existing preview build settings and run `pnpm deploy:preview:web`.
   Record the commit and the new `shaxda-web-preview` version. Confirm the
   match page serves the H3 viewer before running the smoke checks.
2. Reuse Wave 2's next friendly save and the two approved participant
   sessions. Open the new match as each player and compare the final replay
   board and result with the room. While signed out and in an unrelated
   session, compare the match's HTML and `__data.json` with an unknown ID.
   Expect page 404 and a 404 error node in the data response. Check
   `Cache-Control: no-store` on both admitted responses.
3. Reuse Wave 2's existing public rated save. Signed out, check the final
   board and result, share an interior position and open the URL in a fresh
   tab. Check that stepping and playback make no page data requests and
   that canonical and Open Graph URLs omit the position query. Record the
   Worker version, match IDs, and smoke results here.

## Physical Android gate

The frozen [H3 specification](../specs/h3-replay-viewer.md#95-end-to-end-and-the-device-gate)
requires Chrome on a physical entry-level Android phone. Status: **open**.

1. On preview, play a real saved match from the beginning to the result.
   Exercise Play, Pause, Previous, Next, Start, End, each speed, and position
   sharing in portrait orientation. Confirm that sound starts off, the cue
   and final overlay remain legible, and Android's **Remove animations**
   setting keeps the layout and cues intact.
2. Seed the [maximal E4 fixture](../../packages/game-engine/src/fixtures/e4-maximum.ts)
   in a local D1 match with its engine-derived ledger facts. Use USB port
   forwarding in Chrome DevTools to open the local rated match on the phone.
   In the phone's inspected page, read the last
   `performance.getEntriesByName("shaxda:replay-build")` duration and record
   the heap after the build with DevTools.
3. Record the phone model, chipset, RAM, Android and Chrome versions, the
   match or fixture, action count, measured duration, heap, and each control
   and layout result here. The maximal replay has 1,403 actions and must build
   in at most one second without a crash or reload.

After production enablement is authorized, repeat the preview smoke checks
against production and record the results. If rollback is needed, redeploy
the preceding web Worker version. H3 writes no match data.
