# Shaxda Build Guide

## 1. Purpose

This guide explains how to build Shaxda using GitHub, Conductor, Claude, and Codex.

It is written for the project owner, not for the agents. Use it as a follow-along guide while building the game from start to finish.

The agents should mainly follow:

```txt
AGENTS.md
CLAUDE.md
docs/shaxda_prd.md
docs/shaxda_game.md
```

This guide explains how you should operate the build process.

---

## 2. Mental Model

Before starting, understand these simple ideas.

| Term                    | Meaning                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| **GitHub repo**         | The main home of the project code.                                                                  |
| **main branch**         | The stable version of the project. Keep this clean.                                                 |
| **Conductor workspace** | An isolated copy of the repo where one agent works.                                                 |
| **Worktree**            | The Git feature behind Conductor workspaces. It lets multiple copies of the same repo exist safely. |
| **Workspace branch**    | The temporary branch Conductor uses for a workspace.                                                |
| **Commit**              | A saved change. Small commits are best.                                                             |
| **Pull request / PR**   | A review step before merging agent work into `main`.                                                |
| **Merge**               | Accepting a workspace branch into `main`.                                                           |
| **Pull / rebase**       | Updating other workspaces after `main` changes.                                                     |

Simple rule:

```txt
main = stable
workspace = experiment/work area
PR = review before accepting
merge = make it official
```

---

## 3. Final Document Structure

Use these docs:

```txt
docs/shaxda_game.md   # game rules and rule source of truth
docs/shaxda_prd.md    # product, tech, infrastructure, roadmap
docs/build_guide.md   # this guide
docs/shaxda_brd.md    # business document later
```

---

## 4. Files to Have Before Building

Before starting M0, your repo should contain:

```txt
AGENTS.md
CLAUDE.md

.conductor/
  settings.toml
  settings.local.example.toml

.claude/
  skills/
    shaxda-rules/
      SKILL.md
    cloudflare-do-hibernation/
      SKILL.md

.github/
  pull_request_template.md

docs/
  shaxda_game.md
  shaxda_prd.md
  build_guide.md

.gitignore
.editorconfig
.nvmrc
```

Optional later:

```txt
docs/shaxda_brd.md
```

Do not add monetization content to V1.

---

## 5. First GitHub Setup

Create an empty GitHub repository first.

Then on your computer:

```bash
git init
git add .
git commit -m "docs: add project plan and agent context"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

After pushing, turn on basic GitHub protection for `main` if available:

```txt
Require pull request before merging.
Require status checks to pass before merging.
Do not allow force-pushes to main.
```

As a solo builder, PRs still help because they create a review checkpoint before agent work enters the stable branch.

---

## 6. Conductor Setup

Open the GitHub repo in Conductor.

Conductor will use:

```txt
.conductor/settings.toml
```

That file defines:

- setup command;
- web dev command;
- worker dev command;
- test command;
- check command;
- concurrent run mode.

Conductor gives each workspace its own port range, so multiple workspaces can run without fighting over the same port.

### Main run commands

The web app will run through:

```bash
pnpm dev:web -- --host 0.0.0.0 --port $CONDUCTOR_PORT
```

The Worker will run through:

```bash
pnpm dev:worker -- --port $((CONDUCTOR_PORT + 1))
```

The Worker command is mainly useful after backend milestones begin.

---

## 7. Root package.json Scripts

During M0, make sure the root `package.json` includes these scripts.

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:web": "pnpm --filter @shaxda/web dev",
    "dev:worker": "pnpm --filter @shaxda/worker dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:watch": "vitest --watch",
    "test:worker": "turbo run test:worker",
    "test:e2e": "playwright test",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
    "format": "turbo run format"
  }
}
```

If package names are different, update the filters. Recommended names:

```txt
@shaxda/web
@shaxda/worker
@shaxda/game-engine
@shaxda/shared
@shaxda/db
@shaxda/i18n
@shaxda/ui
```

---

## 8. How to Use Claude and Codex

Use agents for focused tasks, not giant project requests.

### Good use of Claude

Use Claude for:

- architecture thinking;
- complex refactors;
- reviewing PRs;
- UI/UX judgment;
- explaining tradeoffs;
- debugging unclear errors;
- checking if a milestone implementation matches the PRD.

### Good use of Codex

Use Codex for:

- implementing small features;
- writing tests;
- fixing failing tests;
- scaffolding files;
- following clear milestone tasks;
- repetitive code changes.

### Bad prompt

Do not ask:

```txt
Build the full Shaxda game.
```

### Good prompt

Ask:

```txt
Read AGENTS.md and docs/shaxda_prd.md. Work only on M0.1–M0.3. Keep the diff small. Do not start M1.
```

For rules work:

```txt
Read AGENTS.md, docs/shaxda_prd.md, and docs/shaxda_game.md. Implement M1 board data only: point labels, adjacency map, jare lines, and tests. Do not start UI work.
```

For online work later:

```txt
Read AGENTS.md and docs/shaxda_prd.md. Work only on the Match Durable Object hibernation task. Use ctx.acceptWebSocket, no normal accept(), no setInterval, and add tests/review checks for idle room hibernation.
```

---

## 9. How to Start M0

M0 must happen first because it creates the project structure agents need.

Create one Conductor workspace:

```txt
m0-foundation
```

Give one agent this prompt:

```txt
Read AGENTS.md and docs/shaxda_prd.md. Start M0 Project Foundation only. Create the pnpm workspace, Turborepo setup, SvelteKit app, Worker app, shared packages, TypeScript config, lint/format tooling, Vitest, Playwright, Tailwind/shadcn-svelte, and CI. Keep commits small. Do not start M1.
```

During M0, do not run multiple agents changing the same scaffold. It is too easy to create conflicts at the beginning.

M0 is done when:

```txt
pnpm install works
pnpm lint works
pnpm typecheck works
pnpm test works
pnpm build works
web app runs locally
repo structure matches the PRD
```

Then review and merge M0 into `main`.

---

## 10. After M0: First Safe Parallel Work

After M0 is merged, you can start more than one workspace.

Safe first split:

```txt
Workspace A: m1-board-data
Workspace B: m17-content-website
```

### Workspace A prompt

```txt
Read AGENTS.md, docs/shaxda_prd.md, and docs/shaxda_game.md. Work only on M1 Board Data. Implement point labels, shared game types/schemas, adjacency map, all 16 jare lines, initial state, and tests. Do not start movement rules or UI.
```

### Workspace B prompt

```txt
Read AGENTS.md and docs/shaxda_prd.md. Work only on M17 Content Website basics. Build static homepage, learn page, rules page, quick-start content, privacy, terms, and SEO metadata. Do not add sponsors, ads, or monetization placeholders.
```

If both workspaces pass review, merge one at a time into `main`.

After merging one workspace, update/rebase the other workspace before merging it.

---

## 11. What Not to Parallelize

Avoid running two agents that edit the same area.

Do not parallelize:

```txt
two engine tasks editing the same reducer
two UI tasks editing the same board components
i18n while UI text is still changing heavily
online gameplay before the engine exists
accounts before backend foundation exists
persistence before auth and online flow exist
```

Good parallel examples:

```txt
content pages + engine
visual polish + PWA storage
accounts + online room core
tests/docs + isolated feature work
```

---

## 12. Reviewing Agent Work

Never merge agent work blindly.

Review each workspace like this:

```txt
1. Did it only do the assigned task?
2. Did it read/use the correct docs?
3. Did it edit unrelated files?
4. Did it add forbidden V1 features?
5. Did it add tests where needed?
6. Do lint/typecheck/test/build pass?
7. Are filenames and references correct?
8. Is the diff small enough to understand?
9. Are commit messages clean?
10. Would you be comfortable keeping this forever?
```

Forbidden V1 features to watch for:

```txt
ads
sponsors
sponsor placeholders
payments
AI opponent
real 3D
chat
spectating
tournaments as core feature
Howler.js
```

Sound must use Native Web Audio in V1.

---

## 13. Pull Requests and Merging

Recommended flow:

```txt
workspace work → review diff → run checks → open PR → merge to main
```

A PR means:

```txt
Please review this workspace branch before accepting it into main.
```

A green check means:

```txt
CI/tests/build passed.
```

Merge means:

```txt
main now contains this work.
```

After merge:

```txt
update other Conductor workspaces from main
```

If Conductor handles the merge/review UI for you, still follow the same mental model.

---

## 14. What to Do When Something Goes Wrong

### Agent changed too much

Ask:

```txt
Revert unrelated changes. Keep only the files needed for the assigned task.
```

### Tests fail

Ask:

```txt
Only fix the failing tests. Do not add new features.
```

### Agent starts future milestone

Ask:

```txt
Stop. Remove work outside the assigned milestone. Return to the current task only.
```

### Merge conflict

Ask one agent:

```txt
Pull latest main and resolve the merge conflict. Do not change behavior unless required to resolve the conflict.
```

### File references are wrong

Ask:

```txt
Update references to use docs/shaxda_game.md and docs/shaxda_prd.md only. Do not reference old roadmap/master/infrastructure filenames.
```

### Online code uses wrong WebSocket pattern

Stop and fix immediately:

```txt
Use Durable Object WebSocket Hibernation with ctx.acceptWebSocket. Remove normal accept(), setInterval, and lifecycle setTimeout usage.
```

### AI added Howler.js

Remove it. V1 sound uses Native Web Audio only.

---

## 15. Build Path From Start to Finish

Follow the PRD milestones in this order.

### Phase 1 — Foundation

```txt
M0
```

Create repo, monorepo, tooling, packages, CI, app shell.

### Phase 2 — Rules Engine

```txt
M1 → M2 → M3
```

Build board data, core rules, advanced rules, serialization, replay.

This is the most important part. Do not rush it.

### Phase 3 — Local Game

```txt
M4 → M5
```

Render the board and make local 2-player gameplay work.

### Phase 4 — Polish

```txt
M6 → M7
```

Add wooden style, motion, Native Web Audio, feedback, reduced motion.

### Phase 5 — App Experience

```txt
M8 → M9
```

Add PWA/offline support and Somali/English i18n.

At this point, you should have a strong offline game.

### Phase 6 — Backend

```txt
M10
```

Add Worker, D1, Drizzle, Durable Object binding, WebSocket schemas, tests.

### Phase 7 — Online Multiplayer

```txt
M11 → M12 → M13
```

Build rooms, server-authoritative online gameplay, reconnect, claim-win, cleanup.

### Phase 8 — Identity and Persistence

```txt
M14 → M15 → M16
```

Add Google login, guests, usernames, history, compact replay, leaderboard, analytics.

### Phase 9 — Website and Hardening

```txt
M17 → M18
```

Complete content website, Turnstile, rate limits, D1 indexes, cost checks.

### Phase 10 — QA and Launch

```txt
M19 → M20
```

Run E2E, mobile QA, accessibility, performance, production setup, domain, launch.

---

## 16. Daily Working Routine

Use this simple routine every time you work.

```txt
1. Open Conductor.
2. Pick the next PRD milestone/task.
3. Create or open one focused workspace.
4. Give one agent a narrow prompt.
5. Let it work.
6. Review the diff.
7. Ask for fixes if needed.
8. Run checks.
9. Commit/PR/merge.
10. Update other workspaces from main.
11. Move to the next task.
```

Do not start too many agents at once. Two focused workspaces are usually enough.

---

## 17. Suggested Agent Prompts by Stage

### M0 Foundation

```txt
Read AGENTS.md and docs/shaxda_prd.md. Work only on M0 Project Foundation. Keep the implementation minimal and correct. Add scripts, packages, tooling, and CI. Do not start game rules or UI.
```

### M1 Board Data

```txt
Read AGENTS.md, docs/shaxda_prd.md, and docs/shaxda_game.md. Work only on M1 Board Data. Add point labels, adjacency, jare lines, initial state, and tests.
```

### M2/M3 Rules Engine

```txt
Read docs/shaxda_game.md carefully. Use TDD. Add failing tests first, then implement the assigned engine rule. Do not touch UI.
```

### M4/M5 Local Game

```txt
Read AGENTS.md, docs/shaxda_prd.md, and docs/shaxda_game.md. Build only the local game UI for the assigned milestone. Use the game engine for all rule decisions.
```

### M10+ Online Work

```txt
Read AGENTS.md and docs/shaxda_prd.md. Use the cloudflare-do-hibernation skill. Implement only the assigned online milestone. Server must validate moves through game-engine. No per-move D1 rows.
```

### Review Prompt

```txt
Review this workspace against AGENTS.md, docs/shaxda_prd.md, and docs/shaxda_game.md. Check for scope creep, wrong file references, missing tests, forbidden V1 features, and Cloudflare cost risks.
```

---

## 18. Final Starting Checklist

Before starting M0, confirm:

```txt
AGENTS.md exists
CLAUDE.md exists
.conductor/settings.toml exists
docs/shaxda_game.md exists
docs/shaxda_prd.md exists
docs/build_guide.md exists
Claude skills exist
No old docs are referenced
No Howler.js is referenced
No monetization placeholders exist
Images referenced in shaxda_game.md have matching filenames
GitHub repo is pushed
Conductor can open the repo
```

Then start:

```txt
Workspace: m0-foundation
```

First prompt:

```txt
Read AGENTS.md and docs/shaxda_prd.md. Start M0 Project Foundation only. Keep changes small and reviewable. Do not start M1.
```

---

## 19. Final Rule

When unsure, do less.

A good AI-agent workflow is not about asking agents to do everything at once. It is about giving them small, clear tasks, reviewing carefully, and merging only stable work into `main`.
