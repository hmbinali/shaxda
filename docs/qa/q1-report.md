# Q1 QA Report

Date: 2026-08-03
Tester: Codex (automated local validation)
Commit: `be72bdd`
Environment: local Conductor workspace on macOS, Node `v24.18.0`, pnpm `9.15.4`

## Automated Results

- `pnpm check`: **Pass** (exit 0). This ran formatting, hibernation,
  lint, typecheck, unit tests, Worker tests, and all package builds.
- `pnpm lint`: **Pass** via `pnpm check` (7/7 packages).
- `pnpm typecheck`: **Pass** via `pnpm check` (10/10 tasks; Svelte
  reported 0 errors and 0 warnings).
- `pnpm test`: **Pass** via `pnpm check`.
- `pnpm test:worker`: **Pass** via `pnpm check` (37/37 tests across
  4 files, including the socket cap and activity-write regression tests).
- `pnpm build`: **Pass** via `pnpm check` (7/7 packages).
- Production bundle guard: **Pass**. A flag-gated build with
  `PUBLIC_SITE_ORIGIN=https://shaxda.app` and
  `PUBLIC_WORKER_ORIGIN=https://shaxda.app` succeeded, and
  `pnpm check:bundle` confirmed both expected origins in the Cloudflare bundle.
- `pnpm test:e2e`: **Pass** (56/56 tests across desktop Chromium and
  mobile Chromium).
- `pnpm test:perf`: **Pass** (exit 0; all Lighthouse CI assertions passed
  for `/`, `/learn`, `/local`, and `/online`). Performance scores were
  91, 89, 90, and 90 respectively; accessibility, best practices, and SEO
  were 100 for every audited route.
- Worker production Wrangler dry run: **Pass** (Wrangler `4.107.0`; both
  Durable Object bindings and the production origin binding resolved).
- Worker preview Wrangler dry run: **Pass** (Wrangler `4.107.0`; both
  Durable Object bindings resolved).
- Web production Wrangler dry run: **Pass** (71 assets; `ASSETS` binding
  resolved).
- Web preview Wrangler dry run: **Pass** (71 assets; `ASSETS` binding
  resolved).

## Manual Device Results

- Device/browser: Pending workers.dev preview smoke test.
- PWA install: Pending workers.dev preview smoke test.
- Offline local play: Pending workers.dev preview smoke test.
- Online invite/reconnect: Pending workers.dev preview smoke test.
- Touch/responsive: Pending workers.dev preview smoke test.
- Accessibility spot checks: Pending workers.dev preview smoke test.
- Somali-only/no-language-toggle: Pending workers.dev preview smoke test.

## Issues Found

- No product issue was found in automated validation.
- The first E2E attempt used a temporary production-origin probe file and
  therefore pointed the browser at the undeployed production hostname. The
  probe file was removed, the normal local bundle was rebuilt, and the complete
  E2E suite then passed 56/56. No source change was needed for that test setup
  error.

## Sign-Off

Ready for BETA1: **Pending**
Notes: Automated checks are green. Sign-off remains blocked on the workers.dev
preview deployment and the manual-device results above.
