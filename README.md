# Shaxda

Free, installable Somali-only web version of the traditional Somali board game.

V1.0 shipped local 2-player play, guest invite online play, public Somali
rules/learning pages, and PWA installability. V1.1-A (accounts, Google login)
has also shipped, and V1.1-A2 (authenticated online identity — letting a
signed-in account own a seat in an online room via short-lived tickets) is
active. Match persistence, history, leaderboard, replay viewer, and
English/i18n remain later V1.1 milestones. See
[`AGENTS.md`](AGENTS.md) for the full scope and non-negotiables.

## Source-of-truth docs

- [`docs/shaxda_prd.md`](docs/shaxda_prd.md) — product, tech stack,
  architecture, infra rules, and phased roadmap.
- [`docs/shaxda_game.md`](docs/shaxda_game.md) — exact Shaxda rules, board,
  and terms.
- [`docs/online-identity.md`](docs/online-identity.md) — V1.1-A2 account/guest
  seat and identity-ticket design.
- [`docs/shaxda_brd.md`](docs/shaxda_brd.md) — business/brand strategy.

## Development

This repository uses pnpm workspaces and Turborepo.

```bash
pnpm install
pnpm dev:web
pnpm dev:worker
pnpm check
pnpm test:e2e
```

### Environment setup

Copy the web app's public env file:

```bash
cp web/.env.example web/.env.local
```

Before authenticated local play, copy both Worker examples and put the same
generated `ONLINE_IDENTITY_SECRET` value in each file:

```bash
cp web/.dev.vars.example web/.dev.vars
cp worker/.dev.vars.example worker/.dev.vars
```

`web/.dev.vars` also needs `BETTER_AUTH_SECRET` (32+ random characters) and a
Google OAuth `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` pair for the Google
sign-in flow. Keep the committed dev/test literal confined to Wrangler test
configuration; use a fresh random value in local, preview, and production
environments.

`pnpm test:e2e` builds and serves its own bundle from tracked fixtures, so your
`.dev.vars` and `web/.env.production` can stay exactly where they are — never
move, rename, or delete them.

Required milestone checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Worker/Durable Object and end-to-end tasks:

```bash
pnpm test:worker
pnpm test:e2e
```

Git hooks are installed by `pnpm install`. The pre-commit hook runs staged
formatting/linting, and the pre-push hook runs `pnpm check`.

## Workspace Layout

```txt
web/                # SvelteKit site and game UI
worker/             # Cloudflare Worker
packages/
  game-engine/      # Pure TypeScript rules package
  shared/           # Zod schemas, WebSocket protocol, and fixtures
  db/               # D1/Drizzle package
  i18n/             # Somali messages/content scaffold
  ui/               # Shared UI tokens and components
```
