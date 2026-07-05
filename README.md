# Shaxda

Free, installable web version of the traditional Somali board game.

## Development

This repository uses pnpm workspaces and Turborepo.

```bash
pnpm install
pnpm dev:web
pnpm dev:worker
pnpm check
```

Required milestone checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Workspace Layout

```txt
web/                # SvelteKit site and game UI
worker/             # Cloudflare Worker
packages/
  game-engine/      # Pure TypeScript rules package
  shared/           # Shared schemas and types
  db/               # D1/Drizzle package
  i18n/             # Somali + English messages
  ui/               # Shared UI tokens and components
```
