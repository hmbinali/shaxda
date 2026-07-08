# Q1 QA Checklist

Use this checklist before BETA1 sign-off. Q1 validates launch confidence only; do not add V1.1 features while completing it.

## Automated Gates

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:worker`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm test:perf`

## Manual Low-End Android Pass

- Install the PWA from Chrome on a low-end Android device or the closest available real Android device.
- Launch from the installed icon and confirm the app opens to Somali content.
- Start `/local`, place pieces with touch, toggle sound, reload, and confirm the game resumes.
- Enable airplane mode after the service worker is ready, reload `/local`, and confirm offline local play still opens.
- Create an `/online` room, share the invite link through a normal mobile sharing path such as WhatsApp, join from another browser/device, make one move, refresh one player, and confirm reconnect.
- Confirm touch targets are comfortable, the board is not clipped, and controls remain reachable without horizontal scrolling.
- Confirm no English UI, language toggle, ads, sponsor placeholders, payments, accounts, leaderboard, chat, or tournament UI is visible.

## Responsive And Accessibility Spot Checks

- Check `/`, `/learn`, `/rules`, `/privacy`, `/terms`, `/local`, and `/online` at narrow mobile and desktop widths.
- Confirm keyboard-only navigation reaches primary links, local controls, online form fields, and game buttons in a sensible order.
- Confirm visible focus styles are present on links, buttons, and inputs.
- Confirm reduced-motion OS/browser settings do not block gameplay feedback or make the board unusable.
- Confirm screen-reader labels are meaningful for form fields, status notices, and board points.

## Public Route Checks

- Confirm public routes render Somali metadata and canonical links.
- Confirm `/manifest.webmanifest` has Somali app metadata and required icons.
- Confirm `/board` is not linked from public navigation or launch CTAs; it is an internal fixture gallery and is excluded from launch QA unless made player-facing.
