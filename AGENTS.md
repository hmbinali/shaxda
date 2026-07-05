# AGENTS.md — Shaxda

> Shared instructions for every AI agent working in this repo: Codex, Claude Code, and any other coding agent.
> Claude Code reads this through `CLAUDE.md`; Codex reads `AGENTS.md` directly.
> Read this fully before making the first change.

## What We Are Building

Shaxda — a free, installable web version of the traditional Somali board game.

V1 includes:

- one website for marketing, rules, learning, and the game;
- local offline 2-player mode;
- live online 2-player mode;
- guest casual invite games;
- Google-login account games;
- logged-in match history;
- logged-in leaderboard;
- Somali + English;
- PWA installability.

V1 does **not** include:

- AI opponent;
- real 3D;
- ads;
- sponsors;
- sponsor placeholders;
- payment flows;
- tournaments as a core feature;
- chat;
- spectating;
- app-store wrapper.

## Source-of-Truth Documents

Read these before relevant work:

1. `docs/shaxda_prd.md`
   - Product, tech stack, architecture, infrastructure rules, build workflow, and milestone roadmap.
   - Work tasks should follow the milestone order in this file.

2. `docs/shaxda_game.md`
   - Exact Shaxda rules, board, terms, phases, jare, repeated jare, irmaan, blocked-player handling, and win conditions.
   - Required before rules-engine, move-validation, board-model, replay, or online-sync work.
   - Authoritative over assumptions for game rules.

3. `docs/shaxda_brd.md`
   - Business, brand, and revenue strategy later.
   - Do not create monetization features in V1 unless this document and the PRD are updated.

## Locked Stack — Do Not Substitute

- TypeScript
- pnpm workspaces + Turborepo
- SvelteKit on Cloudflare Workers/static assets using the native Cloudflare adapter
- SVG + Svelte motion/transitions
- Tailwind CSS + shadcn-svelte
- Native Web Audio for sound
- Cloudflare Workers
- Cloudflare Durable Objects + WebSockets
- Cloudflare D1 + Drizzle ORM
- Better Auth with Google login only
- Guest mode for casual invite games
- Zod for validation
- Paraglide / Inlang for i18n
- Somali default + English
- `@vite-pwa/sveltekit`
- Vitest
- Workers Vitest pool / Miniflare
- Playwright

## Build Principles

### 1. Engine First

The package `packages/game-engine` is the single source of truth for Shaxda rules.

It must be pure TypeScript with no dependency on:

- Svelte;
- DOM;
- Cloudflare;
- D1;
- WebSockets;
- localStorage;
- IndexedDB.

The web UI and the server must both call this engine.

### 2. Functional Before Beautiful

Make each feature work correctly first. Then add polish, motion, sound, and visual quality.

Do not polish a broken interaction.

### 3. Small Chunks, Honest Commits

One logical unit per commit.

For rules and backend logic, prefer TDD:

```txt
test(engine): cover repeated jare
feat(engine): enforce repeated jare
```

### 4. Local-First, $0 Development

Everything should run locally:

```bash
pnpm dev
wrangler dev
pnpm test
```

Wrangler/Miniflare simulate Workers, Durable Objects, and D1 locally.

Do not point local work at remote Cloudflare resources unless the task is explicitly about deployment.

### 5. No Monetization in V1

Do not add:

- ads;
- sponsor slots;
- sponsor placeholders;
- sponsor pages;
- payment flows;
- affiliate links;
- programmatic ads.

Monetization is post-V1 only after the game is finished and has users.

## Non-Negotiables

### Cloudflare / Cost

- Match Durable Objects must use the WebSocket Hibernation API: `ctx.acceptWebSocket(...)`.
- Do not use normal WebSocket `accept()` in match Durable Objects.
- Do not use `setInterval` in match Durable Objects.
- Avoid `setTimeout` for match lifecycle.
- Use Durable Object alarms for cleanup.
- Add tests or review checks proving idle rooms can hibernate where possible.
- Getting hibernation wrong can bill wall-clock per match and create a large cost swing.

### Online Authority

- Online play is server-authoritative.
- Client may preview and animate moves.
- Server validates every online move through `game-engine`.
- Server rejects illegal moves.

### Data

- Do not write every move as a D1 row.
- Active match state lives in the Durable Object.
- Completed logged-in games store one summary row + compact replay.
- Guest games write nothing permanent by default.
- Leaderboard/history are logged-in only.
- Index every common D1 query.
- Avoid full-table scans.

### Validation

- Validate every WebSocket message with Zod.
- Validate every API payload with Zod.
- Treat client input as untrusted.

### UI / i18n

- Somali is the default language.
- English is supported from V1.
- Preserve Somali terms such as `shaxda`, `jare`, and `irmaan` in both languages.
- Marketing/rules pages should be static/prerendered.
- Gameplay should be client-rendered and not invoke Workers on every interaction.

## Repository Layout

```txt
apps/
  web/              # SvelteKit site + game UI + PWA
  worker/           # Cloudflare Worker + Durable Objects

packages/
  game-engine/      # Pure TS Shaxda rules
  shared/           # Zod schemas + shared types + WebSocket protocol
  db/               # D1 + Drizzle schema and queries
  i18n/             # Paraglide messages
  ui/               # Shared UI and design tokens

docs/
  shaxda_game.md    # exact game rules
  shaxda_prd.md     # product/tech/infra/roadmap source of truth
  shaxda_brd.md     # business strategy later
```

## How to Work a Task

1. Find the task/milestone in `docs/shaxda_prd.md`.
2. Read any relevant source document:
   - rules work → `docs/shaxda_game.md`;
   - Durable Object / D1 / online / infrastructure work → `docs/shaxda_prd.md`.
3. If using Claude and a relevant skill exists, use it.
4. Implement the smallest working slice.
5. Add or update tests.
6. Run checks.
7. Commit one logical change.

## Conductor Workflow

Conductor uses isolated workspaces/worktrees. You do **not** need to manually create branches outside Conductor for every milestone.

Use:

```txt
One Conductor workspace = one focused task/milestone branch/review flow.
```

Name workspaces clearly:

```txt
m0-foundation
m1-board-data
m2-engine-core
m17-content-pages
m11-online-core
```

Do not run tasks that depend on M0 until the M0 scaffold has merged.

Correct start order:

```txt
1. Agent/workspace 1: M0 foundation.
2. Agent/workspace 2: AGENTS.md / CLAUDE.md / docs review if needed.
3. Merge M0.
4. Then fan out:
   - workspace A: M1 board data / engine;
   - workspace B: content pages.
```

## Required Commands

Run relevant commands before completing a task:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Worker/Durable Object tasks:

```bash
pnpm test:worker
```

End-to-end tasks:

```bash
pnpm test:e2e
```

## Commit Conventions

Use Conventional Commits with scopes:

```txt
feat(engine): ...
test(engine): ...
feat(web): ...
fix(online): ...
perf(db): ...
docs: ...
chore: ...
build: ...
ci: ...
style: ...
refactor: ...
```

One commit = one logical change.

Do not create a “build full game” commit.

## Definition of Done

A task is done only when:

- the PRD milestone/task is complete;
- tests are added or updated where appropriate;
- lint/typecheck/tests/build pass;
- no V1-excluded feature was added;
- the diff is small enough to review;
- the commit message follows the project convention.
