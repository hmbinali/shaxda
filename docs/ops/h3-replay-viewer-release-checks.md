# H3 replay viewer release checks

H3 uses the existing match ledger and access check. It deploys with the web
Worker. The game Worker, D1 schema, bindings, and scheduled jobs require no
changes.

## Preview

1. Open a newly saved friendly match as each player. Replay to the final
   position and compare it with the room result. Compare HTML and
   `__data.json` for that match and an unknown match while signed out.
2. Open a saved rated match signed out. Check the final board and result,
   share an interior position, then open that URL in a fresh tab. Check that
   stepping and playback make no data requests and leave the canonical URL
   free of the position query.

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
