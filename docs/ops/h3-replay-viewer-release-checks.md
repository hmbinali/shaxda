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

The follow-up at `232bc3d` passed `pnpm check` and all 89 Playwright tests
with `pnpm test:e2e --timeout=120000` against isolated local Workers and D1.

## Preview

On 2026-11-14 at 18:22 UTC, `shaxda-web-preview` began serving
`9366b599-8592-4441-8a8a-99a658654515` at 100%. The web-only build came
from [PR #50](https://github.com/hmbinali/shaxda/pull/50) at `ea622d9`, which
passed [CI run 43624239476](https://github.com/hmbinali/shaxda/actions/runs/43624239476).
The previous preview web version for H3 rollback is
`d3bbbae9-925b-4ab0-ba7e-8982df1303ef`. Deployment followed R2 and X1b's
switch restoration. The served match bundle matched the staged asset byte
for byte, and the preview game Worker health check passed.

- [Wave 2's public M2 match](https://shaxda-web-preview.shaxda.workers.dev/match/AZ4RHCUBMGZUC6DKW9VZ)
  passed signed-out playback through position 4, final-board and result
  checks, position sharing into a fresh context, keyboard stepping, silent
  start, and cues with reduced motion. Canonical and Open Graph URLs omitted
  `a`. Stepping and playback made zero page-data requests.
- Both signed-in owners opened Wave 2's 68-action friendly save in their
  existing Chrome and in-app browser profiles. Both reached the same
  result and occupancy on all 24 points, matching the terminal state of
  the canonical M1 game played in Wave 2. Seat A won with 11 pieces to B's 2.
  Signed-out HTML returned 404 and `__data.json` carried a 404 error node.
  Both responses matched an unknown ID and carried `Cache-Control: no-store`.
  The unrelated signed-in response and participant cache-policy assertions
  passed against local Workers and D1.

## Physical Android gate

The frozen [H3 specification](../specs/h3-replay-viewer.md#95-end-to-end-and-the-device-gate)
requires Chrome on a physical entry-level Android phone. Status: **open for
preview interaction checks**.

On 2026-11-14, a physical Samsung SM-E075F (MediaTek MT6789, Android 16,
3,698,548 KiB of reported RAM, Chrome 157.0.8103.51) loaded the 1,403-action E4
fixture from local H3 build `4c09d2c` through USB port forwarding. The replay
displayed `0 / 1403` in portrait without horizontal overflow. The single
`shaxda:replay-build` entry measured **83.4 ms**, within the 1,000 ms budget.
DevTools reported **5,725,564 bytes (5.46 MiB)** of used JS heap after the build.
The successful load showed no crash or automatic reload. The phone was then
needed by another project. Preview M2 controls, position sharing, silent start,
cues, result, and Remove animations still need a physical-device check.

1. On preview, play the [saved rated M2 match](https://shaxda-web-preview.shaxda.workers.dev/match/AZ4RHCUBMGZUC6DKW9VZ)
   from the beginning to the result. Exercise Play, Pause, Previous, Next,
   Start, End, each speed, and position sharing in portrait orientation.
   Confirm that sound starts off, the cue and final overlay remain legible,
   and Android's **Remove animations** setting keeps the layout and cues
   intact.
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
