# Shaxda PRD

## 1. Purpose

This document is the technical and product source of truth for building **Shaxda V1**.

It combines the product scope, final tech stack, infrastructure rules, build workflow, and milestone roadmap into one concise file for Codex, Claude, and future developers.

For exact game rules, board structure, terms, and rule edge cases, see:

```txt
docs/shaxda_game.md
```

Do not duplicate or invent Shaxda rules inside the app. The rules engine must follow `shaxda_game.md`.

---

## 2. Product Summary

**Shaxda** is a free, installable web version of the traditional Somali two-player strategy board game.

V1 is one website/app that includes:

- public landing pages;
- rules and learning pages;
- local offline 2-player mode;
- live online 2-player mode;
- guest casual invite games;
- Google-login account games;
- logged-in match history;
- logged-in leaderboard;
- Somali + English;
- installable PWA support.

The product should feel like a modern Somali wooden board game: warm wood, carved board lines, raised pieces, smooth motion, clear jare highlights, simple sound feedback, and strong mobile usability.

---

## 3. V1 Scope

### Included in V1

| Area | Decision |
|---|---|
| Local offline 2-player | Yes |
| Live online 2-player | Yes |
| Guest casual invite games | Yes |
| Logged-in games | Yes |
| Accounts | Yes |
| Login method | Google only |
| Username | Required for logged-in players |
| Match history | Logged-in only |
| Leaderboard | Logged-in only |
| PWA install | Yes |
| Offline support | Local mode works offline |
| Languages | Somali + English |
| Default language | Somali |
| Visual style | Modern wooden 2.5D |
| Board renderer | SVG |
| Sound | Native Web Audio |
| Online model | Server-authoritative |
| Infrastructure | Cloudflare-first |

### Excluded from V1

Do not build these in V1:

- AI opponent;
- real 3D board;
- ads;
- sponsors;
- sponsor placeholders;
- payments;
- affiliate/referral flows;
- tournaments as a core feature;
- chat;
- spectating;
- app-store wrapper;
- paid accounts;
- programmatic ads.

Monetization belongs in a future business document:

```txt
docs/shaxda_brd.md
```

---

## 4. User Modes

### 4.1 Local Offline Mode

Local mode is a hot-seat 2-player game on one device.

Requirements:

- works without login;
- works offline after the PWA is cached;
- uses the same `game-engine` package as online mode;
- supports complete game flow from placement to win;
- can save/resume local games using IndexedDB if implemented in V1;
- uses localStorage only for small preferences such as language, sound, and theme.

### 4.2 Guest Online Mode

Guest mode lets casual players create or join online games without account friction.

Requirements:

- create room;
- join by code;
- join by link;
- guest display name;
- guest/device/session identity;
- unranked;
- mostly non-persistent;
- no permanent guest match history by default;
- protected by Turnstile and rate limits.

### 4.3 Logged-in Online Mode

Logged-in mode uses Google login.

Requirements:

- Google login only;
- no password login;
- no email verification/password reset flow in V1;
- required unique username;
- saved match history;
- leaderboard participation;
- compact replay for completed logged-in games.

---

## 5. Product Decisions

| Decision | V1 Choice |
|---|---|
| Main format | Website + installable PWA |
| Main audience | Somali-first, diaspora-friendly |
| Languages | Somali + English |
| Monetization | None in V1 |
| Game timer | None |
| Turn housekeeping | Reconnect grace, claim-win after disconnect, abandoned-room cleanup |
| AI | Not in V1 |
| 3D | Not in V1 |
| Future 3D support | Renderer stays swappable |
| Sound | Native Web Audio |
| Backend | Cloudflare Workers + Durable Objects + D1 |
| Auth | Better Auth + Google only |
| Database | Cloudflare D1 |
| Local save | IndexedDB |
| Small prefs | localStorage |

---

## 6. Final Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript | Shared across frontend, backend, engine, validation, and tests. |
| Monorepo | pnpm workspaces + Turborepo | Apps and packages stay organized. |
| Web framework | SvelteKit | Marketing, rules, and game app in one project. |
| Hosting/runtime | Cloudflare Workers + static assets | Low-maintenance, Cloudflare-first deployment. |
| Cloudflare adapter | Native SvelteKit Cloudflare adapter | No Next.js/OpenNext. |
| Client state | Svelte stores | Enough for local and online game state. |
| Styling | Tailwind CSS + shadcn-svelte | Fast UI development with custom design control. |
| Board rendering | SVG | Lightweight, crisp, easy to animate, easy to swap later. |
| Animation | Svelte transitions + spring/tween motion | Placement, movement, selection, jare, capture, invalid move, win. |
| Sound | Native Web Audio | V1 uses direct Web Audio utility. No Howler.js. |
| Realtime | Durable Objects + WebSockets | One Durable Object per online match. |
| WebSocket cost control | Durable Object WebSocket Hibernation | Required. |
| Database | Cloudflare D1 | Users, profiles, match summaries, compact replay, leaderboard, small analytics. |
| ORM | Drizzle ORM | Type-safe schema and queries. |
| Auth | Better Auth | Google login only. |
| Validation | Zod | WebSocket messages, API payloads, moves, important user input. |
| i18n | Paraglide / Inlang | Somali default + English. |
| PWA | `@vite-pwa/sveltekit` | Installable app and offline local mode. |
| Unit tests | Vitest | Game engine and pure functions. |
| Worker tests | Workers Vitest pool / Miniflare | Workers, Durable Objects, D1, auth, APIs. |
| E2E tests | Playwright | Local game, online room, login, reconnect, claim-win. |
| Analytics | Cloudflare Web Analytics + D1 summary events | No high-volume analytics in V1. |
| Error monitoring | Cloudflare logs first | Add Sentry later only if needed. |
| Domain | Namecheap + Cloudflare DNS | Buy domain on Namecheap, manage DNS in Cloudflare. |

---

## 7. Architecture

```txt
shaxda/
  apps/
    web/              # SvelteKit marketing site + game app + PWA
    worker/           # Cloudflare Worker APIs + Durable Objects

  packages/
    game-engine/      # Pure TypeScript Shaxda rules engine
    shared/           # Zod schemas, shared types, WebSocket protocol
    db/               # D1 + Drizzle schema and queries
    i18n/             # Somali + English messages
    ui/               # Shared UI components and design tokens

  docs/
    shaxda_game.md    # exact game rules
    shaxda_prd.md     # this file
    shaxda_brd.md     # business document, later
```

### Architecture Rules

- Keep rules in `packages/game-engine`.
- Keep shared types and Zod schemas in `packages/shared`.
- Keep database schema and queries in `packages/db`.
- Keep visual UI separate from game rules.
- Use the same engine on client and server.
- Online mode is server-authoritative.
- Local mode can run fully in the browser.
- Marketing/rules pages should be static/prerendered.
- Normal local gameplay should not call Workers.

---

## 8. Game Engine Requirements

The rules engine is the highest-risk and highest-priority part of the product.

The engine must be:

- pure TypeScript;
- deterministic;
- test-heavy;
- independent from UI/backend/storage;
- reusable by both local UI and online server.

It must implement the rules from:

```txt
docs/shaxda_game.md
```

Required engine areas:

- board model;
- 24 point labels;
- adjacency map;
- valid jare lines;
- placement phase;
- first advantage;
- initial removal;
- movement phase;
- legal move generation;
- jare detection;
- repeated jare handling;
- capture flow;
- blocked-player rule;
- win detection;
- resignation;
- serialization/deserialization;
- compact replay.

Do not implement game rules inside Svelte components or Worker handlers. Those layers must call the engine.

---

## 9. Frontend and UX Requirements

### 9.1 Board UI

The board should use SVG.

Required:

- three connected squares;
- 24 visible points/sockets;
- clear piece ownership;
- responsive mobile-first layout;
- tap/click support;
- selected-piece state;
- legal-move hints;
- capture selection state;
- blocked-player prompt;
- win screen;
- rematch/new game controls.

### 9.2 Visual Style

Direction:

- warm wooden board;
- carved board lines;
- raised wooden pieces;
- soft shadows;
- selected-piece glow;
- valid-move pulse;
- jare line glow;
- capture pop/fade;
- invalid move shake;
- subtle Somali-inspired accents;
- no casino/cartoon/heavy-3D feeling.

### 9.3 Sound

Use **Native Web Audio** only in V1.

Required sounds:

- place;
- move;
- jare;
- capture;
- invalid move;
- win.

Requirements:

- sound toggle;
- persisted preference;
- respect mobile browser audio-unlock limitations;
- no background music in V1 unless explicitly added later;
- no Howler.js in V1.

### 9.4 Accessibility

Should include:

- keyboard/focus basics for board points where practical;
- readable status text;
- clear current player/phase display;
- reduced-motion support;
- visible error feedback that is not sound-only.

---

## 10. PWA and Offline Requirements

The app should be installable and usable like a lightweight mobile app.

Required:

- PWA manifest;
- app icons;
- service worker;
- cached app shell;
- local mode available offline;
- online mode shows clear offline/unavailable state;
- local preferences stored in localStorage;
- local saved games stored in IndexedDB if implemented.

Offline analytics should be minimal. If summary events are queued, they may be flushed later or discarded silently.

---

## 11. Internationalization Requirements

V1 supports Somali and English.

Requirements:

- Somali default;
- English available;
- manual language toggle;
- browser auto-detect if practical;
- preserve Somali game terms:
  - shaxda;
  - jare;
  - irmaan.

Avoid translating key cultural terms into awkward English labels. Explain them instead.

---

## 12. Online Multiplayer Requirements

Online play uses Cloudflare Durable Objects and WebSockets.

### 12.1 Room Flow

Required:

- create room;
- generate high-entropy room code;
- join by code;
- join by link;
- assign players;
- start when both players are present;
- sync state to both players;
- show lobby/waiting screen;
- show connection status.

### 12.2 Server Authority

The server must:

- own authoritative online game state;
- validate every move with `game-engine`;
- reject illegal moves;
- validate all WebSocket messages with Zod;
- broadcast updated state after valid actions.

The client may animate/preview, but the server decides legality.

### 12.3 Reconnect and Disconnect

Required:

- reconnect after refresh;
- reconnect after temporary disconnect;
- persist enough match state for reconnect;
- disconnect grace period;
- opponent can claim win after grace period;
- graceful expired-room errors.

This is housekeeping only. It is not a visible chess clock.

---

## 13. Infrastructure and Cost Rules

Shaxda must stay cheap to operate.

### 13.1 Durable Objects

Non-negotiable:

- one Durable Object per online match;
- use WebSocket Hibernation;
- use `ctx.acceptWebSocket(...)`;
- do not use normal WebSocket `accept()` in match rooms;
- no `setInterval` in match Durable Objects;
- avoid `setTimeout` for lifecycle;
- use Durable Object alarms for cleanup.

Getting hibernation wrong can bill wall-clock per match and create a large cost swing.

### 13.2 D1

D1 is for durable product data, not live gameplay chatter.

Store:

- users;
- usernames;
- completed logged-in match summaries;
- compact replay as one field;
- leaderboard;
- small analytics summaries.

Do not store:

- one row per move;
- permanent guest history by default;
- high-volume click/per-move analytics.

### 13.3 Guest Abuse Protection

Use:

- Turnstile on guest room creation;
- room creation rate limits;
- max active guest rooms per IP/device;
- higher limits for logged-in users if needed;
- high-entropy room codes;
- route-level request caps where practical.

### 13.4 Cleanup

- Empty/abandoned rooms expire after around 1 hour.
- Disconnected player grace period allows reconnect.
- Opponent can claim win after grace expires.
- Cleanup uses Durable Object alarms.

---

## 14. Data and Persistence

### 14.1 Logged-in Users

Store:

- user id;
- Google auth identity;
- username;
- basic profile;
- match history;
- leaderboard stats.

### 14.2 Guest Users

Guest identity should be lightweight and temporary.

Store only what is needed for the active room/session.

Do not store permanent guest match history by default.

### 14.3 Matches

For completed logged-in matches, store one row containing:

- match id;
- players;
- winner;
- timestamps;
- final status;
- basic stats;
- compact replay.

Do not store each move as its own D1 row.

### 14.4 Replay

V1 should support compact replay storage for logged-in games.

Replay viewer is useful but can be treated as should-have if launch pressure is high.

---

## 15. Analytics and Monitoring

### V1 Analytics

Use:

- Cloudflare Web Analytics for site traffic;
- small D1 summary events for:
  - game started;
  - game completed;
  - local vs online;
  - logged-in vs guest.

Do not track every move as analytics.

### Later Analytics

Use Workers Analytics Engine later if event volume grows.

PostHog is not part of V1.

### Error Monitoring

Use Cloudflare logs first.

Add Sentry later only if real traffic shows a need.

---

## 16. Security Requirements

Required:

- Zod validation for all external input;
- high-entropy room codes;
- no room-code guessing weakness;
- no trust in client-side move validation;
- auth-gated history/leaderboard;
- guest room rate limits;
- Turnstile on guest room creation;
- safe handling of expired/missing rooms.

---

## 17. Testing Requirements

### Unit Tests

Use Vitest for:

- board topology;
- jare lines;
- placement;
- first advantage;
- initial removal;
- legal moves;
- movement;
- captures;
- repeated jare;
- blocked-player rule;
- win detection;
- serialization;
- replay.

### Integration Tests

Use Workers Vitest / Miniflare for:

- Worker endpoints;
- Durable Object room creation;
- join room;
- WebSocket sync;
- illegal move rejection;
- reconnect;
- claim-win;
- room cleanup alarms;
- D1 persistence;
- auth behavior.

### End-to-End Tests

Use Playwright for:

- local full game;
- online create/join/move;
- reconnect flow;
- claim-win;
- login/username flow;
- match history;
- leaderboard;
- mobile responsive basics.

---

## 18. Build Workflow

Use Conductor as a multi-agent workspace, not as a one-shot generator.

### Agent Usage

| Agent | Best Use |
|---|---|
| Claude | Architecture, refactors, UI/UX, docs, reviews, complex reasoning |
| Codex | Implementation tasks, tests, small features, fixes |

### Workflow Rules

- One Conductor workspace per independent task or milestone.
- Let Conductor manage worktrees/branches.
- Do not manually create branches unless needed.
- Do not run dependent tasks before their dependencies exist.
- Keep diffs small.
- Merge only after checks pass.
- Other workspaces should rebase/pull after merge.

### Required Checks

Before completing a task:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Worker changes:

```bash
pnpm test:worker
```

E2E changes:

```bash
pnpm test:e2e
```

### Commit Style

Use Conventional Commits:

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

One commit should represent one logical change.

---

## 19. Milestone Roadmap

### M0 — Project Foundation

Goal: clean monorepo with tooling.

Includes:

- pnpm workspace;
- Turborepo;
- SvelteKit app;
- Worker app;
- shared packages;
- TypeScript config;
- lint/format;
- Vitest;
- Playwright;
- Tailwind + shadcn-svelte;
- CI;
- agent instructions.

### M1 — Board Data

Goal: static Shaxda board model.

Includes:

- point labels;
- players/phases/actions/types;
- adjacency map;
- valid jare lines;
- initial state;
- topology tests.

### M2 — Core Rules Engine

Goal: normal headless game flow.

Includes:

- placement;
- first advantage;
- transition to initial removal;
- initial removal;
- legal moves;
- movement reducer.

### M3 — Advanced Rules Engine

Goal: difficult rule edge cases.

Includes:

- jare detection;
- captures;
- repeated jare;
- blocked player;
- space-making;
- win detection;
- resignation;
- reducer;
- serialization;
- compact replay;
- optional irmaan hint.

### M4 — Basic Board UI

Goal: render board and pieces.

Includes:

- SVG board;
- coordinate map;
- sockets;
- wooden pieces;
- render from state;
- responsive scaling.

### M5 — Local Game Interaction

Goal: full local game on one device.

Includes:

- local game store;
- placement UI;
- status UI;
- removal UI;
- selection;
- legal move hints;
- movement;
- capture;
- blocked-player UI;
- invalid feedback;
- win screen;
- local route.

### M6 — Wooden Polish

Goal: premium wooden feel.

Includes:

- wooden board background;
- carved lines;
- raised pieces;
- selected glow;
- valid move pulse;
- movement animation;
- jare highlight;
- capture animation;
- invalid shake;
- reduced motion.

### M7 — Sound and Feedback

Goal: tactile feedback.

Includes:

- Native Web Audio utility;
- place sound;
- move sound;
- jare sound;
- capture sound;
- invalid sound;
- win sound;
- mute toggle;
- persisted sound preference;
- optional haptics.

### M8 — PWA and Offline Persistence

Goal: installable/offline local mode.

Includes:

- PWA setup;
- manifest/icons;
- app shell caching;
- install prompt;
- IndexedDB save/resume;
- localStorage preferences;
- offline tests.

### M9 — Internationalization

Goal: Somali-first bilingual UI.

Includes:

- Paraglide/Inlang;
- Somali and English messages;
- externalized UI strings;
- Somali default;
- language toggle;
- preserve Somali terms.

### M10 — Backend Foundation

Goal: local Cloudflare backend.

Includes:

- Wrangler;
- Worker health endpoint;
- D1 binding;
- Drizzle;
- migrations;
- Durable Object binding;
- shared API helpers;
- WebSocket schemas;
- Worker integration tests.

### M11 — Online Room Core

Goal: create/join/sync rooms.

Includes:

- Match Durable Object with hibernation;
- room state;
- room codes;
- create room;
- join room;
- join link;
- player assignment;
- start match;
- broadcast state.

### M12 — Online Gameplay

Goal: complete online game.

Includes:

- server-side move validation;
- illegal message rejection;
- phase/turn sync;
- placement/removal/movement/capture sync;
- win/resign sync;
- online store;
- online route;
- create/join/share UI;
- full online integration test.

### M13 — Online Resilience

Goal: real-world online reliability.

Includes:

- reconnect after refresh;
- reconnect after disconnect;
- connection status;
- disconnect grace;
- claim-win;
- room cleanup alarms;
- idle room expiration;
- reconnect tests.

### M14 — Accounts and Identity

Goal: Google login and guest identity.

Includes:

- Better Auth;
- Google provider;
- users table;
- username;
- profile menu;
- logout;
- guest display name;
- guest session identity;
- auth tests.

### M15 — Persistence, History, Replay

Goal: logged-in history.

Includes:

- matches table;
- compact replay column;
- match stats;
- logged-in match persistence;
- no permanent guest match history;
- history page;
- replay reconstruction/viewer.

### M16 — Leaderboard and Analytics

Goal: basic growth data.

Includes:

- leaderboard schema;
- ranking updates;
- leaderboard page;
- profile stats;
- Cloudflare Web Analytics;
- D1 summary game events;
- no per-move analytics.

### M17 — Content Website

Goal: public website.

Includes:

- homepage;
- cultural explanation;
- play links;
- learn page;
- beginner guide;
- rules page;
- jare/irmaan/movement explanations;
- quick start;
- privacy;
- terms;
- SEO;
- Open Graph;
- prerendering.

No sponsor pages or monetization placeholders.

### M18 — Abuse and Cost Hardening

Goal: protect infrastructure.

Includes:

- Turnstile;
- rate limits;
- active room limits;
- tiered limits;
- room-code hardening;
- Zod validation;
- D1 indexes;
- no per-move D1 audit;
- hibernation audit;
- request caps;
- billing alert checklist;
- graceful error states.

### M19 — Testing and QA

Goal: launch confidence.

Includes:

- E2E local game;
- E2E online flow;
- reconnect;
- claim-win;
- login;
- history/replay;
- low-end Android QA;
- responsive QA;
- accessibility audit;
- performance pass.

### M20 — Production Launch

Goal: production V1.

Includes:

- production Cloudflare resources;
- production secrets;
- Google OAuth callback;
- Turnstile keys;
- D1 migrations;
- deploy;
- Namecheap domain;
- Cloudflare DNS;
- custom domain;
- production verification;
- launch checklist.

---

## 20. Post-V1 Backlog

Do not build these in V1:

- direct sponsorships;
- e-book/learning product sales;
- sponsor dashboard;
- AI opponent;
- real 3D board;
- async/correspondence play;
- spectating;
- chat;
- tournaments;
- app-store wrapper;
- R2 storage for avatars/themes/assets;
- Workers Analytics Engine;
- advanced strategy content.

---

## 21. First Build Sequence

Start with:

```txt
M0 → M1 → M2 → M3
```

This gives a tested rules engine.

Then:

```txt
M4 → M5 → M6 → M7 → M8 → M9
```

This gives a polished offline PWA.

Then:

```txt
M10 → M11 → M12 → M13 → M14 → M15 → M16 → M17 → M18 → M19 → M20
```

This gives online multiplayer, accounts, persistence, hardening, and production launch.

After M0 merges, parallel work can begin:

```txt
Workspace A: M1 board data / engine
Workspace B: M17 content website
```

Do not start dependent milestones before their required structure exists.

---

## 22. Final Rule

If there is a conflict between documents:

1. `docs/shaxda_game.md` wins for game rules.
2. `docs/shaxda_prd.md` wins for product, tech, architecture, infrastructure, and roadmap.
3. Agent/config files should reference these two files and not create new product rules.
