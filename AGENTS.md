# AGENTS.md — Shaxda

> Shared instructions for every AI agent working in this repo: Codex, Claude Code, and any other coding agent.
> Claude Code reads this through `CLAUDE.md`; Codex reads `AGENTS.md` directly.
> Read this fully before making the first change.

## What We Are Building

Shaxda — a free, installable web version of the traditional Somali board game.

V1.0 includes:

- one website for marketing, rules, learning, and the game;
- local offline 2-player mode;
- guest live online 2-player invite games;
- guest display names only;
- Somali-only user-facing content and UI;
- PWA installability.

V1.0 does **not** include:

- accounts;
- Google login;
- logged-in games;
- permanent usernames;
- match history;
- leaderboard;
- replay viewer;
- English UI/content or a language toggle;
- AI opponent;
- real 3D;
- ads;
- sponsors;
- sponsor placeholders;
- payment flows;
- affiliate/referral flows;
- tournaments as a core feature;
- chat;
- spectating;
- app-store wrapper.

Accounts, Google login, logged-in history, leaderboard, replay viewer, Better Auth, and full English/i18n are V1.1 candidates only after V1.0 has launched.

## Source-of-Truth Documents

Read these before relevant work:

1. `docs/shaxda_prd.md`
   - Product, tech stack, architecture, infrastructure rules, build workflow, and phased roadmap.
   - Work tasks should follow the phase/track order in this file.

2. `docs/shaxda_game.md`
   - Exact Shaxda rules, board, terms, phases, jare, repeated jare, irmaan, blocked-player handling, and win/draw conditions.
   - Required before rules-engine, move-validation, board-model, replay, or online-sync work.
   - Authoritative over assumptions for game rules.

3. `docs/shaxda_brd.md`
   - Business, brand, and revenue strategy later.
   - Do not create monetization features in V1.0 unless this document and the PRD are updated.

## Locked Stack — Do Not Substitute

- TypeScript
- pnpm workspaces + Turborepo
- SvelteKit on Cloudflare Workers/static assets using the native Cloudflare adapter
- SVG + Svelte motion/transitions
- Tailwind CSS + shadcn-svelte
- Native Web Audio for sound
- Cloudflare Workers
- Cloudflare Durable Objects + WebSockets
- Cloudflare D1 + Drizzle ORM when persistence is introduced
- Guest mode for casual invite games
- Zod for validation
- Somali-only V1.0 content with future-friendly copy structure
- `@vite-pwa/sveltekit`
- Vitest
- Workers Vitest pool / Miniflare
- Playwright

Do not introduce Better Auth, Google OAuth, Paraglide/Inlang, or English routes/content in V1.0 unless `docs/shaxda_prd.md` is deliberately changed first.

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
- IndexedDB;
- Zod.

The web UI and the server must both call this engine.

`packages/shared` may import `game-engine` to expose Zod schemas, WebSocket protocol contracts, and canonical fixtures. The engine must never import `shared`.

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

### 5. No Monetization in V1.0

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
- Completed logged-in persistence is V1.1 only.
- Guest games write nothing permanent by default.
- If D1 is introduced for V1.0, keep it to tiny summary/operational events.
- Index every common D1 query.
- Avoid full-table scans.

### Validation

- Validate every WebSocket message with Zod.
- Validate every API payload with Zod.
- Treat client input as untrusted.

### UI / Content

- Somali is the only visible V1.0 language.
- Do not add English content, `/en` routes, or a language toggle in V1.0.
- Preserve Somali terms such as `shaxda`, `jare`, and `irmaan`.
- Marketing/rules pages should be static/prerendered.
- Gameplay should be client-rendered and not invoke Workers on every local interaction.

## Repository Layout

```txt
web/                # SvelteKit site + game UI + PWA
worker/             # Cloudflare Worker + Durable Objects

packages/
  game-engine/      # Pure TypeScript Shaxda rules and dependency-free contracts
  shared/           # Zod schemas + WebSocket protocol + canonical fixtures
  db/               # D1 + Drizzle schema and queries when persistence is needed
  i18n/             # Somali messages/content scaffold; English later if added
  ui/               # Shared UI and design tokens

docs/
  shaxda_game.md    # exact game rules
  shaxda_prd.md     # product/tech/infra/roadmap source of truth
  shaxda_brd.md     # business strategy later
```

## Current Roadmap

Use the phased roadmap in `docs/shaxda_prd.md`.

```txt
Phase 0: F0 foundation + F1 contracts/fixtures
Phase 1: A2/A3 engine, B1 board UI, C1 content, D1 DO spike, E1 assets
Phase 2: L1 local game, then L2/L3/L4 polish/sound/PWA
Phase 3: O1/O2/O3 guest online play/resilience/hardening
Phase 4: Q1 QA, BETA1 community beta, P1 launch
V1.1: accounts -> history/replay -> leaderboard -> English
```

F1 contracts are the parallelism gate for A2, A3, B1, and O1. C1, D1, and E1 may run earlier only if they do not define or consume game state/action contracts.

After F1 is merged and marked frozen, contract changes require an explicit contract-change commit and all active workspaces must rebase.

F0 remote Cloudflare deployment verification is deferred to D1/P1. Do not point local Phase 0 work at remote Cloudflare resources unless the task is explicitly about deployment.

## How to Work a Task

1. Find the task/phase in `docs/shaxda_prd.md`.
2. Read any relevant source document:
   - rules work -> `docs/shaxda_game.md`;
   - Durable Object / D1 / online / infrastructure work -> `docs/shaxda_prd.md`.
3. Implement the smallest working slice.
4. Add or update tests.
5. Run checks.
6. Commit one logical change.

## Conductor Workflow

Conductor uses isolated workspaces/worktrees. You do **not** need to manually create branches outside Conductor for every milestone.

Use:

```txt
One Conductor workspace = one focused task/phase branch/review flow.
```

Name workspaces clearly:

```txt
f1-contracts-fixtures
a2-advanced-engine
b1-board-ui-fixtures
c1-somali-content
d1-do-hibernation-spike
o1-online-gameplay
```

Correct sequencing:

```txt
1. Finish/merge F0 if it is not already merged.
2. Close F1 contracts and fixtures.
3. After F1 freezes, fan out A2/A3, B1, and O1-dependent work.
4. C1, D1, and E1 can run before F1 only under the no-contract-touch rule.
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

Do not create a "build full game" commit.

## Definition of Done

A task is done only when:

- the PRD phase/task is complete;
- tests are added or updated where appropriate;
- lint/typecheck/tests/build pass;
- no V1.0-excluded feature was added;
- the diff is small enough to review;
- the commit message follows the project convention.
