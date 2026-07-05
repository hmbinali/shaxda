# Shaxda

Free, installable Somali-only web version of the traditional Somali board game.

V1.0 is focused on local 2-player play, guest invite online play, public Somali
rules/learning pages, and PWA installability. Accounts, Google login, logged-in
history, leaderboard, replay viewer, and English/i18n are V1.1 or later.

## Development

This repository uses pnpm workspaces and Turborepo.

```bash
pnpm install
pnpm dev:web
pnpm dev:worker
pnpm check
pnpm test:e2e
```

Required milestone checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
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
