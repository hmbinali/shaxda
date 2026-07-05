# Shaxda Build Guide

This guide is a lightweight companion to `docs/shaxda_prd.md`. The PRD is the source of truth for product scope, architecture, infrastructure rules, and roadmap order.

## Current V1.0 Scope

Build V1.0 as a Somali-only, guest-first web/PWA game:

- public Somali content pages;
- local offline 2-player mode;
- guest online invite games;
- PWA installability;
- no accounts, Google login, match history, leaderboard, replay viewer, English UI, language toggle, ads, sponsors, or payments.

## Workspace Order

Use Conductor workspaces for focused branches:

```txt
f1-contracts-fixtures
a2-advanced-engine
b1-board-ui-fixtures
c1-somali-content
d1-do-hibernation-spike
e1-assets
l1-local-game
o1-online-gameplay
```

F1 contracts and fixtures are the main parallelism gate. After F1 freezes, A2/A3, B1, and O1-dependent work can rely on stable game state/action shapes and canonical fixtures.

C1, D1, and E1 may run before F1 only if they do not define or consume game contracts.

## Local Development

```bash
pnpm install
pnpm dev:web
pnpm dev:worker
pnpm check
```

Required checks before completing normal work:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Worker/Durable Object work also runs:

```bash
pnpm test:worker
```

End-to-end work also runs:

```bash
pnpm test:e2e
```

## Contract Ownership

`packages/game-engine` owns dependency-free rules, board data, game state/action types, serialization, replay helpers, and the reducer.

`packages/shared` imports the engine and owns Zod schemas, WebSocket protocol envelopes, and canonical fixtures for engine, UI, and Worker tests.

The engine must never import Svelte, Cloudflare APIs, D1, WebSockets, localStorage, IndexedDB, Zod, or `packages/shared`.

## Durable Object Rule

Match Durable Objects must use WebSocket Hibernation:

```ts
ctx.acceptWebSocket(webSocket);
```

Do not use normal `accept()` for match rooms, do not use `setInterval`, avoid lifecycle `setTimeout`, and use alarms for cleanup.
