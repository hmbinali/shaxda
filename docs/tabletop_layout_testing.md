# Tabletop layout testing

The `/local` and started `/online` screens use the same tabletop shell in two
orientations:

- local play is shared across one device, so the top rail is rotated;
- online play is solo, so the viewer is always on the bottom and neither the
  board nor either rail is rotated.

`tests/e2e/tabletop-layout.spec.ts` exercises the real `/local` route at short
CSS viewports, including 320×460 and an offline PWA notice. It measures the
rendered board, point targets, rail separation, horizontal overflow, and the
scroll fallback below the supported minimum tier.
`tests/e2e/online-game.spec.ts` covers the solo orientation with two browser
contexts and verifies that a player seated as B remains B, uses dark stones,
and appears at the bottom without rotation.

These browser tests model available CSS viewport space, not the physical screen
or browser chrome. Before release, manually verify:

- iOS Safari on a small device with browser chrome visible;
- the installed PWA on an iOS device or Simulator for safe-area behavior;
- shared local play from both ends of the phone, including rail rotation,
  turn-state changes, top-bar resignation, the centered confirmation dialog, and
  both halves of the result overlay.

The app intentionally does not opt into `viewport-fit=cover`; changing that
requires a separate audit of all global chrome, notices, sheets, and
orientations.
