# Shaxda PRD

## 1. Purpose

This document is the technical and product source of truth for building **Shaxda V1.0**.

It combines the product scope, final tech stack, infrastructure rules, build workflow, and milestone roadmap into one concise file for Codex, Claude, and future developers.

For exact game rules, board structure, terms, and rule edge cases, see:

```txt
docs/shaxda_game.md
```

Do not duplicate or invent Shaxda rules inside the app. The rules engine must follow `shaxda_game.md`.

---

## 2. Product Summary

**Shaxda** is a free, installable web version of the traditional Somali two-player strategy board game.

V1.0 is a focused first public launch. It includes:

- public landing pages;
- rules and learning pages;
- local offline 2-player mode;
- guest live online 2-player invite games;
- installable PWA support;
- Somali-only user-facing content and UI for launch.

V1.0 intentionally does **not** include accounts, Google login, match history, leaderboard, replay viewer, or full English/i18n. Those belong in V1.1 after the core game is playable, tested, and launched.

The product should feel like a modern Somali wooden board game: warm wood, carved board lines, raised pieces, smooth motion, clear jare highlights, simple sound feedback, and strong mobile usability.

---

## 3. V1.0 Launch Scope

### Included in V1.0

| Area | Decision |
|---|---|
| Local offline 2-player | Yes |
| Live online 2-player | Yes |
| Guest casual invite games | Yes |
| Logged-in games | No, V1.1 |
| Accounts | No, V1.1 |
| Google login | No, V1.1 |
| Username system | Guest display name only in V1.0; permanent usernames in V1.1 |
| Match history | No, V1.1 |
| Leaderboard | No, V1.1 |
| Replay viewer | No, V1.1 |
| PWA install | Yes |
| Offline support | Local mode works offline after app shell is cached |
| Languages | Somali only in V1.0 |
| Default language | Somali |
| English/i18n | Future-friendly structure only; no visible English toggle/routes in V1.0 |
| Visual style | Modern wooden 2.5D |
| Board renderer | SVG |
| Sound | Native Web Audio |
| Online model | Server-authoritative |
| Infrastructure | Cloudflare-first |

### Excluded from V1.0

Do not build these in V1.0:

- accounts;
- Google login;
- permanent logged-in profiles;
- permanent usernames;
- match history;
- leaderboard;
- replay viewer;
- full English/i18n;
- language toggle;
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
- paid accounts.

Monetization belongs in a future business document:

```txt
docs/shaxda_brd.md
```

---

## 4. V1.1 Fast-Follow Scope

V1.1 should start after V1.0 launch feedback is understood.

V1.1 candidates:

- Google login;
- permanent usernames;
- logged-in online games;
- logged-in match history;
- compact replay storage;
- replay viewer;
- leaderboard;
- full English support;
- language toggle;
- richer onboarding/tutorial improvements.

V1.1 should not be allowed to block V1.0 launch.

---

## 5. User Modes

### 5.1 Local Offline Mode

Local mode is a hot-seat 2-player game on one device.

Requirements:

- works without login;
- works offline after the PWA app shell is cached;
- uses the same `game-engine` package as online mode;
- supports complete game flow from placement to win/draw/resignation;
- can save/resume local games using localStorage;
- uses localStorage for small preferences such as sound, theme, and any future language setting.

Do not use IndexedDB in V1.0 unless a later technical reason makes it necessary. A serialized Shaxda game state is small enough for localStorage.

### 5.2 Guest Online Mode

Guest mode lets casual players create or join online games without account friction.

Requirements:

- create room;
- join by code;
- join by link;
- guest display name;
- lightweight guest/device/session identity;
- unranked;
- mostly non-persistent;
- no permanent guest match history by default;
- protected by Turnstile and rate limits;
- optimized for sharing through WhatsApp and social links.

Guest identity should be simple:

- generate a random guest id on the device;
- store it in localStorage;
- send it when joining/reconnecting to a room;
- keep server persistence limited to the active room lifetime.

### 5.3 Logged-in Online Mode

Logged-in mode is **not part of V1.0**.

When built in V1.1, it should use:

- Google login only;
- no password login;
- no email verification/password reset flow;
- required unique username;
- saved match history;
- leaderboard participation;
- compact replay for completed logged-in games.

---

## 6. Product Decisions

| Decision | V1.0 Choice |
|---|---|
| Main format | Website + installable PWA |
| Main audience | Somali-first, diaspora-friendly |
| Languages | Somali only |
| English | V1.1 unless strong post-launch evidence says otherwise |
| Monetization | None in V1.0 |
| Game timer | No visible chess clock |
| Turn housekeeping | Reconnect grace, idle nudge, claim-win after disconnect/idle grace, abandoned-room cleanup |
| AI | Not in V1.0 |
| 3D | Not in V1.0 |
| Future 3D support | Renderer stays swappable |
| Sound | Native Web Audio |
| Backend | Cloudflare Workers + Durable Objects |
| Auth | None in V1.0; Better Auth + Google in V1.1 |
| Database | Not required for core V1.0 gameplay; D1 may be used for tiny summary events and V1.1 persistence |
| Local save | localStorage |
| Small prefs | localStorage |

---

## 7. Final Tech Stack

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
| Sound | Native Web Audio | V1.0 uses direct Web Audio utility. No Howler.js. |
| Realtime | Durable Objects + WebSockets | One Durable Object per online match. |
| WebSocket cost control | Durable Object WebSocket Hibernation | Required. |
| Database | Cloudflare D1 | Optional tiny V1.0 summary events; main use is V1.1 users, matches, replay, leaderboard. |
| ORM | Drizzle ORM | Use when D1 persistence is introduced. |
| Auth | Better Auth | V1.1 only, Google login only. |
| Validation | Zod | WebSocket messages, API payloads, moves, important user input. |
| i18n | Future-friendly content structure | No full English/i18n in V1.0. Paraglide/Inlang may be introduced in V1.1. |
| PWA | `@vite-pwa/sveltekit` | Installable app and offline local mode. |
| Unit tests | Vitest | Game engine and pure functions. |
| Worker tests | Workers Vitest pool / Miniflare | Workers, Durable Objects, WebSockets, alarms, optional D1. |
| E2E tests | Playwright | Local game, online room, reconnect, claim-win. |
| Analytics | Cloudflare Web Analytics + optional D1 summary events | No high-volume analytics in V1.0. |
| Error monitoring | Cloudflare logs first | Add Sentry later only if needed. |
| Domain | Namecheap + Cloudflare DNS | Buy domain on Namecheap, manage DNS in Cloudflare. |

---

## 8. Architecture

```txt
shaxda/
  apps/
    web/              # SvelteKit marketing site + game app + PWA
    worker/           # Cloudflare Worker APIs + Durable Objects

  packages/
    game-engine/      # Pure TypeScript Shaxda rules engine
    shared/           # Zod schemas, shared types, WebSocket protocol, fixtures
    db/               # D1 + Drizzle schema and queries when persistence is needed
    i18n/             # Somali messages/content now; English later if added
    ui/               # Shared UI components and design tokens

  docs/
    shaxda_game.md    # exact game rules
    shaxda_prd.md     # this file
    shaxda_brd.md     # business document, later
```

### Architecture Rules

- Keep rules in `packages/game-engine`.
- Keep shared types, Zod schemas, WebSocket protocol, and fixture states in `packages/shared`.
- Keep database schema and queries in `packages/db` only when D1 persistence is needed.
- Keep visual UI separate from game rules.
- Use the same engine on client and server.
- Online mode is server-authoritative.
- Local mode can run fully in the browser.
- Marketing/rules pages should be static/prerendered.
- Normal local gameplay should not call Workers.
- V1.0 must not depend on accounts, Google OAuth, leaderboard, or match history.

---

## 9. Foundation Contracts

Before parallel implementation expands, freeze a contracts layer in `packages/shared`.

Required contracts:

- board point labels;
- adjacency map;
- valid jare-line list;
- `GameState`, `Action`, `Phase`, and `Player` types;
- Zod schemas for public actions and WebSocket messages;
- engine public API signatures:
  - `initialState()`;
  - `legalActions(state)`;
  - `applyAction(state, action)`;
  - `serialize(state)`;
  - `deserialize(serialized)`;
  - replay/action-log helpers;
- WebSocket protocol with a `v: 1` protocol version field;
- canonical fixture states.

Fixture states should include at least:

- empty starting board;
- mid-placement;
- placement that creates a jare;
- initial removal phase;
- movement phase;
- capture pending;
- repeated jare scenario;
- blocked-player scenario;
- win state;
- draw or termination-rule scenario once defined in `shaxda_game.md`.

Contracts are the parallelism unlock. Board UI, engine, online skeleton, and tests should all depend on these shared contracts instead of inventing their own data shapes.

After contracts are marked frozen, changes require an explicit contract-change commit and all active workspaces must rebase.

---

## 10. Game Engine Requirements

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
- draw/termination detection once defined in `shaxda_game.md`;
- resignation;
- serialization/deserialization;
- compact action-log replay.

Do not implement game rules inside Svelte components or Worker handlers. Those layers must call the engine.

### 10.1 Rule Gaps to Resolve in `shaxda_game.md`

Before finalizing the engine, the game rules document should explicitly answer these items:

| Gap | Required decision |
|---|---|
| Draw / termination rule | Define how games end if players repeat positions or avoid captures forever. |
| Both players blocked | Define result when the current player is blocked and the opponent cannot legally make space. |
| Space-making move impossible without forming jare | Define whether to allow the jare but forbid capture, or declare draw. |
| Multi-jare placement | Define whether one placement can complete multiple jare lines and how first advantage is handled. |
| Idle-but-connected opponent online | Define housekeeping behavior for a player who stays connected but does not move. |

These are rules/product decisions, not implementation details. Agents must not invent them inside engine code.

### 10.2 Compact Replay Format

Define compact replay as an ordered action log, not a database row per move.

Example shape:

```json
[
  { "a": "P", "p": "O3" },
  { "a": "M", "f": "O3", "t": "M2" },
  { "a": "C", "p": "I1" },
  { "a": "R" }
]
```

The exact action codes can change during contracts work, but the principle should not change:

- replay is compact;
- replay is deterministic;
- replay reconstructs from initial state using the engine;
- replay viewer is V1.1, not V1.0.

---

## 11. Frontend and UX Requirements

### 11.1 Board UI

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
- win/draw/resign screen;
- rematch/new game controls.

The basic board UI can be built against fixture states before the full engine exists.

### 11.2 Visual Style

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

### 11.3 Sound

Use **Native Web Audio** only in V1.0.

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
- no background music in V1.0 unless explicitly added later;
- no Howler.js in V1.0.

### 11.4 Accessibility

Should include:

- keyboard/focus basics for board points where practical;
- readable status text;
- clear current player/phase display;
- reduced-motion support;
- visible error feedback that is not sound-only.

---

## 12. Public Content Website Requirements

The public website is part of V1.0 and should be Somali-only.

Required routes:

- `/`;
- `/learn`;
- `/rules`;
- `/privacy`;
- `/terms`.

Requirements:

- Somali content only;
- no English content in V1.0;
- no language toggle in V1.0;
- no `/en` route tree;
- no single-URL bilingual toggle;
- public-page copy should live in clean structured content/config files;
- content structure should be easy to extend later;
- use source-of-truth rule content from `docs/shaxda_game.md`;
- preserve Somali terms like `shaxda`, `jare`, and `irmaan`;
- add page-level metadata;
- add Open Graph/Twitter metadata;
- add canonical-friendly URLs;
- add a static OG image asset;
- export `prerender = true` for static content pages;
- no sponsor pages or monetization placeholders.

Gameplay CTAs may point to planned stable routes such as `/play`, `/local`, and `/online` even if another milestone implements those pages.

---

## 13. PWA and Offline Requirements

The app should be installable and usable like a lightweight mobile app.

Required:

- PWA manifest;
- app icons;
- service worker;
- cached app shell;
- local mode available offline;
- online mode shows clear offline/unavailable state;
- local preferences stored in localStorage;
- local saved game stored in localStorage.

Offline analytics should be minimal. If summary events are queued, they may be flushed later or discarded silently.

---

## 14. Internationalization Requirements

V1.0 is Somali-only.

Requirements:

- Somali is the only visible language;
- no English toggle;
- no `/en` routes;
- no bilingual public-page content;
- no full i18n implementation unless a later milestone explicitly reopens the decision;
- keep copy organized so English can be added later without rewriting the app;
- preserve Somali game terms:
  - shaxda;
  - jare;
  - irmaan.

English can be reconsidered in V1.1 after observing real demand from diaspora users, sponsors, app reviewers, press, or onboarding/rules feedback.

---

## 15. Online Multiplayer Requirements

Online play uses Cloudflare Durable Objects and WebSockets.

### 15.1 Room Flow

Required:

- create room;
- generate high-entropy room code;
- join by code;
- join by link;
- assign players;
- support guest display names;
- start when both players are present;
- sync state to both players;
- show lobby/waiting screen;
- show connection status.

### 15.2 Server Authority

The server must:

- own authoritative online game state;
- validate every move with `game-engine`;
- reject illegal moves;
- validate all WebSocket messages with Zod;
- broadcast updated state after valid actions.

The client may animate/preview, but the server decides legality.

### 15.3 Reconnect, Disconnect, and Idle Handling

Required:

- reconnect after refresh;
- reconnect after temporary disconnect;
- persist enough match state for reconnect within the active room lifetime;
- disconnect grace period;
- opponent can claim win after grace period;
- soft idle nudge after a reasonable period;
- opponent can claim win after longer idle grace if the player is present but not moving;
- graceful expired-room errors.

This is housekeeping only. It is not a visible chess clock.

---

## 16. Infrastructure and Cost Rules

Shaxda must stay cheap to operate.

### 16.1 Durable Objects

Non-negotiable:

- one Durable Object per online match;
- use WebSocket Hibernation;
- use `ctx.acceptWebSocket(...)`;
- do not use normal WebSocket `accept()` in match rooms;
- no `setInterval` in match Durable Objects;
- avoid `setTimeout` for lifecycle;
- use Durable Object alarms for cleanup.

Getting hibernation wrong can bill wall-clock per match and create a large cost swing.

### 16.2 Durable Object Spike

Do an early online skeleton spike before full online gameplay.

The spike should include:

- Wrangler config;
- Worker health endpoint;
- one Match Durable Object;
- WebSocket hibernation using `ctx.acceptWebSocket()`;
- create/join room by code;
- echo/broadcast between two clients;
- reconnect after refresh;
- alarm-based cleanup;
- CI conformance test preventing non-hibernating WebSocket patterns.

No game logic is needed in the spike. The point is to de-risk infrastructure and billing early.

### 16.3 D1

D1 is not required for core V1.0 gameplay.

D1 may be used in V1.0 only for:

- tiny anonymous summary events;
- operational metadata if truly needed.

D1 is mainly for V1.1:

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

### 16.4 Guest Abuse Protection

Use:

- Turnstile on guest room creation;
- room creation rate limits;
- max active guest rooms per IP/device where practical;
- high-entropy room codes;
- route-level request caps where practical.

### 16.5 Cleanup

- Empty/abandoned rooms expire after around 1 hour.
- Disconnected player grace period allows reconnect.
- Opponent can claim win after grace expires.
- Idle-but-connected players can be nudged and then claim-win eligible after a longer grace period.
- Cleanup uses Durable Object alarms.

---

## 17. Data and Persistence

### 17.1 V1.0 Local Data

Store in localStorage:

- sound preference;
- theme preference if implemented;
- local saved game;
- guest/device/session identity;
- guest display name if the user chooses one.

### 17.2 V1.0 Guest Online Data

Guest identity should be lightweight and temporary.

Store only what is needed for the active room/session.

Do not store permanent guest match history by default.

### 17.3 V1.1 Logged-in Users

When accounts are added later, store:

- user id;
- Google auth identity;
- username;
- basic profile;
- match history;
- leaderboard stats.

### 17.4 V1.1 Matches

For completed logged-in matches, store one row containing:

- match id;
- players;
- winner;
- timestamps;
- final status;
- basic stats;
- compact replay.

Do not store each move as its own D1 row.

---

## 18. Analytics and Monitoring

### V1.0 Analytics

Use:

- Cloudflare Web Analytics for site traffic;
- optional small D1 summary events for:
  - game started;
  - game completed;
  - local vs online;
  - guest online room created/joined.

Do not track every move as analytics.

### Later Analytics

Use Workers Analytics Engine later if event volume grows.

PostHog is not part of V1.0.

### Error Monitoring

Use Cloudflare logs first.

Add Sentry later only if real traffic shows a need.

---

## 19. Security Requirements

Required:

- Zod validation for all external input;
- high-entropy room codes;
- no room-code guessing weakness;
- no trust in client-side move validation;
- guest room rate limits;
- Turnstile on guest room creation;
- safe handling of expired/missing rooms;
- no account-only security work in V1.0.

Auth-gated history/leaderboard security belongs to V1.1.

---

## 20. Testing Requirements

### 20.1 Unit Tests

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
- draw/termination rule once defined;
- win detection;
- serialization;
- replay/action-log reconstruction.

### 20.2 Fuzz and Property Tests

Add property/fuzz tests for the engine.

They should check:

- random legal playouts do not crash;
- no illegal state is reachable;
- serialize/deserialize roundtrips;
- blocked-player handling always resolves;
- draw/termination rules prevent infinite games once defined.

### 20.3 Shared Fixtures and Conformance Tests

Create canonical fixture states and full-game action scripts.

Use the same fixtures for:

- engine unit tests;
- board UI rendering tests;
- Worker integration tests;
- regression tests after community beta rule corrections.

### 20.4 Worker Integration Tests

Use Workers Vitest / Miniflare for:

- Worker health endpoint;
- Durable Object room creation;
- hibernating WebSocket setup;
- join room;
- WebSocket sync;
- illegal move rejection;
- reconnect;
- claim-win;
- room cleanup alarms;
- optional D1 persistence if added.

### 20.5 End-to-End Tests

Use Playwright for:

- public content routes load;
- no language toggle appears in V1.0;
- local full game;
- online create/join/move;
- reconnect flow;
- claim-win;
- low-end/mobile responsive basics;
- accessibility basics.

Do not add V1.0 E2E requirements for login, match history, replay viewer, or leaderboard.

---

## 21. Build Workflow

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
- Contract changes must be explicit and coordinated.
- For a solo founder, keep only 2–3 major workspaces active at once unless review capacity is available.

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

## 22. V1.0 Milestone Roadmap

This roadmap replaces the old fully serial M0–M20 plan. It is organized as tracks so AI agents can work in parallel after contracts are frozen.

### Phase 0 — Foundation and Contracts

#### F0 — Project Foundation

Goal: clean monorepo with tooling and a deployed hello-world.

Includes:

- pnpm workspace;
- Turborepo;
- SvelteKit app;
- Cloudflare adapter;
- Worker app;
- shared packages;
- TypeScript config;
- lint/format;
- Vitest;
- Playwright;
- Tailwind + shadcn-svelte;
- CI;
- agent instructions;
- deployed Cloudflare hello-world.

#### F1 — Contracts and Fixtures

Goal: freeze shared types, board data, engine API shape, WebSocket protocol, and fixture states.

Includes:

- board point labels;
- adjacency map;
- jare-line list;
- game state/action/player/phase types;
- Zod schemas;
- engine API signatures;
- WebSocket protocol version `v: 1`;
- fixture states;
- full-game action scripts where possible.

Definition of done: contracts merged and marked frozen. Later changes require explicit contract-change commits.

### Phase 1 — Parallel Tracks After F1

#### A1 — Core Rules Engine

Goal: normal headless game flow.

Includes:

- placement;
- first advantage;
- transition to initial removal;
- initial removal;
- legal moves;
- movement reducer;
- topology tests.

#### A2 — Advanced Rules Engine

Goal: difficult rules and end states.

Includes:

- jare detection;
- captures;
- repeated jare;
- blocked player;
- space-making;
- win detection;
- draw/termination handling once defined;
- resignation;
- serialization;
- compact action-log replay.

Do not include optional AI-like strategy hints such as irmaan suggestions in V1.0.

#### A3 — Engine Fuzz and Conformance Harness

Goal: catch rules bugs early.

Includes:

- random legal playouts;
- invariant checks;
- serialization roundtrips;
- fixture conformance;
- action-log replay conformance.

#### B1 — Board UI from Fixtures

Goal: render the board before the full engine is finished.

Includes:

- SVG board;
- coordinate map;
- sockets;
- wooden pieces;
- render from shared fixture states;
- selected state;
- legal-hint state;
- capture visual state;
- responsive scaling.

#### C1 — Somali Content Website

Goal: public website for V1.0.

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
- Somali-only content;
- SEO;
- Open Graph;
- prerendering.

No language toggle, English content, sponsor pages, or monetization placeholders.

This milestone is the updated equivalent of the old M17.

#### D1 — Online Durable Object Hibernation Spike

Goal: de-risk Cloudflare infrastructure before full online gameplay.

Includes:

- Wrangler config;
- Worker health endpoint;
- Match Durable Object;
- `ctx.acceptWebSocket()` hibernation;
- create/join room by code;
- echo/broadcast test payloads;
- reconnect after refresh;
- alarm cleanup;
- CI conformance check against non-hibernating WebSocket patterns.

No game logic required.

#### E1 — Asset Direction and Minimum Asset Set

Goal: avoid art/sound/icon bottlenecks.

Includes:

- board texture direction;
- piece style direction;
- app icons;
- OG image;
- six sounds: place, move, jare, capture, invalid, win;
- source/licensing notes for each asset.

### Phase 2 — Local Game

#### L1 — Playable Local Game

Goal: full local game on one device.

Depends on A1/A2 and B1.

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
- win/draw/resign screen;
- `/local` route;
- localStorage save/resume.

#### L2 — Wooden Polish

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

#### L3 — Sound and Feedback

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

#### L4 — PWA and Offline Local Mode

Goal: installable/offline local mode.

Includes:

- PWA setup;
- manifest/icons;
- app shell caching;
- install prompt if appropriate;
- localStorage save/resume;
- localStorage preferences;
- offline tests.

L2, L3, and L4 can run in parallel after L1 is stable.

### Phase 3 — Online Guest Play

#### O1 — Online Gameplay

Goal: complete guest online game.

Depends on A2 and D1.

Includes:

- drop engine into Match Durable Object;
- server-side move validation;
- illegal message rejection;
- phase/turn sync;
- placement/removal/movement/capture sync;
- win/draw/resign sync;
- online store;
- `/online` route;
- create/join/share-link UI;
- guest display names;
- full online integration test.

#### O2 — Online Resilience

Goal: real-world online reliability.

Includes:

- reconnect after refresh;
- reconnect after disconnect;
- connection status;
- disconnect grace;
- idle nudge;
- claim-win;
- room cleanup alarms;
- idle room expiration;
- reconnect tests.

#### O3 — Abuse and Cost Hardening

Goal: protect infrastructure before launch.

Includes:

- Turnstile;
- rate limits;
- active room limits;
- room-code hardening;
- Zod validation audit;
- hibernation audit;
- request caps;
- billing alert checklist;
- graceful error states.

### Phase 4 — QA, Community Beta, Launch

#### Q1 — Testing and QA

Goal: launch confidence.

Includes:

- E2E local game;
- E2E online flow;
- reconnect;
- claim-win;
- low-end Android QA;
- responsive QA;
- accessibility audit;
- performance pass;
- public content route checks;
- no-language-toggle check.

#### BETA1 — Community Beta

Goal: validate real-world Somali play tradition before public launch.

Includes:

- 10–20 Somali players/testers;
- local/offline play feedback;
- online invite feedback;
- rules feedback from players who learned physically;
- one planned rule-correction cycle if needed;
- convert confirmed corrections into `shaxda_game.md`, engine tests, and fixtures.

#### P1 — Production Launch

Goal: production V1.0.

Includes:

- production Cloudflare resources;
- production secrets;
- Turnstile keys;
- optional D1 migrations if summary events are used;
- deploy;
- Namecheap domain;
- Cloudflare DNS;
- custom domain;
- production verification;
- launch checklist.

No Google OAuth callback is required for V1.0.

---

## 23. Dependency Map

```txt
F0 ──► F1 ──┬──► A1 ──► A2 ──► A3
            ├──► B1
            ├──► C1
            ├──► D1
            └──► E1

A1/A2 + B1 ──► L1 ──► L2 ║ L3 ║ L4
A2 + D1 ─────► O1 ──► O2 ──► O3
C1 + E1 + L* + O* ──► Q1 ──► BETA1 ──► P1

V1.1 after launch: accounts → history/replay → leaderboard → English
```

`║` means the work can happen in parallel after the dependency is stable.

The two hardest sync points are:

1. F1 contracts freeze;
2. integration into L1 and O1.

---

## 24. Recommended First Build Sequence

Start with:

```txt
F0 → F1
```

Then run carefully parallel tracks:

```txt
Workspace A: A1/A2 game engine
Workspace B: B1 board UI from fixtures
Workspace C: C1 Somali content website
Workspace D: D1 Durable Object hibernation spike
Workspace E: E1 assets
```

For a solo founder, keep only 2–3 of these active at a time if review bandwidth is limited.

Then integrate:

```txt
L1 → L2/L3/L4
O1 → O2 → O3
Q1 → BETA1 → P1
```

Do not build V1.1 accounts/history/leaderboard/English before V1.0 launch unless the roadmap is deliberately changed.

---

## 25. V1.1 Roadmap

After V1.0 is launched and feedback is collected, build:

### V1.1-A — Accounts and Identity

Includes:

- Better Auth;
- Google provider;
- users table;
- username;
- profile menu;
- logout;
- account tests.

### V1.1-B — Persistence, History, Replay

Includes:

- matches table;
- compact replay column;
- match stats;
- logged-in match persistence;
- history page;
- replay reconstruction/viewer.

### V1.1-C — Leaderboard and Stats

Includes:

- leaderboard schema;
- ranking updates;
- leaderboard page;
- profile stats;
- abuse-resistant ranking logic.

### V1.1-D — English and Full i18n

Includes:

- Paraglide/Inlang or equivalent;
- Somali default;
- English messages/content;
- language toggle;
- preserve Somali terms;
- test both languages.

English should be added only if it has clear value after V1.0 feedback.

---

## 26. Post-V1 Backlog

Do not build these in V1.0:

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
- advanced strategy content;
- interactive tutorial/onboarding beyond basic Learn pages.

An interactive tutorial may become more valuable than AI after launch because first advantage and placement strategy are hard for new players.

---

## 27. Final Rule

If there is a conflict between documents:

1. `docs/shaxda_game.md` wins for game rules.
2. `docs/shaxda_prd.md` wins for product, tech, architecture, infrastructure, and roadmap.
3. Agent/config files should reference these two files and not create new product rules.
4. Proposal files such as separate roadmap drafts are not source of truth after this PRD is updated.
