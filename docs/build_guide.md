# Shaxda Build Guide

This guide records the implementation plan prepared on 2026-11-14. Product
authority follows [PRD §27](shaxda_prd.md#27-final-rule), with V2 scope and
order in [the V2 brief](shaxda-v2.md) and its [spec register](specs/README.md).

## Current state and focus

V1 local/offline and guest invite play, Google accounts, and account-owned
online seats are implemented. The account release still has production
browser checks open in the [release record](ops/v11a-a2-release-verification.md).
V2 has 17 frozen milestone specs awaiting implementation and activation.

The current request is to prepare the development work and plan parallel
sessions. Sponsorship S1–S3 and publishing are scheduled later. Product
analytics X1 belongs in the game plan because ratings, scheduled jobs, and
queue measurement depend on it. K2 and R6-detect retain their existing
evidence gates for later V2 work.

## Preparation and spec review

The register and each spec's implementation slices define the build order.
The following existing prerequisites need explicit session ownership.

| Work                 | Required result                                                                                                      | Dependent work                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Local baseline       | Use the pinned runtime and lockfile, then record `pnpm check` and `pnpm test:e2e` results                            | Feature branches need a reproducible starting point |
| E5 rating simulation | Reproducible local simulation of 20–300 players, provisional duration, leaderboard eligibility, and pair-cap effects | R1 and R3 activation                                |
| E6 query study       | Seed 5,000 matches for one account, record query plans and rows read for every query named in contracts §12          | H2, R3, R4, and R5 implementation                   |
| A3 timing, Q1        | Founder decision on account deletion timing, with the register recommending completion by rated public play          | A3 activation and wave-2 production enablement      |

Run E5 and E6 against the frozen contracts in disposable local fixtures.
Preserve the scripts, seeds, commands, versions, and results so feature
sessions can reproduce the evidence. Start E6 with the H2 queries and cover
the complete query set before recording an overall pass. A failed budget or
policy assumption goes through the register's contract-change process before
its dependent implementation. E1–E4 already have recorded results. The
owning milestone's acceptance tests verify those assumptions in the actual
implementation.

The source review also found existing account-token retention work in the
release record. Schedule its local fix and regression test before the A3
auth changes touch the same options and hooks. Production cleanup and browser
verification belong to the later release work.

The 2026-11-14 baseline passed `pnpm check` with Node 24.18.0 and pnpm 9.15.4.
The fuzz test runs all 1,000 original seeds in 20 batches, with the original
assertions and action limit for every seed. The browser suite passed all 74
cases on a full rerun in a temporary copy using alternate loopback ports.
One guest rematch case timed out in the initial full run and passed both in
isolation and in the rerun. Both `pnpm check` and all 74 browser cases also
passed on `73772b9`, which includes the Lucide import change.

An uncached `pnpm run build --force` passed for all seven packages using
Node 24.18.0 and the existing cached pnpm 9.15.4 executable. Invoking that
cached executable directly avoided an intermittent child-process launcher
error in the shell's pnpm path.

## First three sessions

Use one isolated workspace per assignment. This plan starts with three major
sessions, following PRD §21's recommendation for the available review
capacity. Record a milestone's activation when its implementation is assigned.
This preparation plan leaves activation pending.

| Session                 | Assignment                                                                                                                            | Boundary and handoff                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `h1-match-persistence`  | H1's implementation slices, starting with its documented PRD/AGENTS amendments, compact replay, schemas, ledger migration, and writer | Own the MatchRoom/coordinator changes and shared local-D1 E2E harness. Publish the merged migration and writer commits for X1a and H2. Finish with a real account game saved and retries/restarts covered. |
| `x1a-product-analytics` | X1a's independent slices 1–8, including activity measurement, analytics tables, jobs, web entry wrapper, and admin statistics         | Own the generated web entry and cron dispatcher. Slice 9, ledger gauges, waits for H1's migration on main. Finish the required disclosure and operations slices after that handoff.                        |
| `v2-e5-e6-evidence`     | E5 and E6 with local fixtures and reproducible evidence                                                                               | Own the proof results in contracts §12. Record any proposed contract change before affected feature work. After the studies, take H2 when H1 and E6 are ready.                                             |

H1 and X1a both touch `packages/db`, shared exports, copy, scripts, and
Wrangler configuration. Agree on file ownership before starting overlapping
slices. H1 owns the ledger tables and writer. X1a owns analytics and job
tables. Assign migration numbers at merge, as contracts §11 requires, and
rebase the other workspace after each shared migration lands. H1 alone
changes E2E state-directory cleanup and migration ownership; X1a integrates
its configuration after that change.

## Subsequent session assignments

These are dependency groups. Reuse a free session as its prerequisites land.
The V2 brief's preview and production gates still apply when publishing
resumes.

| Group                           | Parallel assignments                                                        | Start and integration conditions                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private history                 | H2; remaining X1a work                                                      | H2 starts after H1 and E6. Its rating-status slice waits for R1's migration. Use H1's writer and shared database fixtures.                                                                                                                      |
| Rated play                      | R1 processor/rating package; R2 consent/policy/UI; R6-core correction tools | Start R1 and R2 together after H1, X1a, and E5. Land R2's shared policy before R1 consumes it. Merge R1's rating migration, then R6-core's migration, then R1's processor. R6-core completion is required for rated public play.                |
| Online measurement and deletion | X1b; A3 if Q1 confirms its activation                                       | X1b follows H1 and X1a, with the game-Worker edits coordinated after R2. A3 follows H1/X1a and the token-retention fix, then integrates the readers built by H2/R1. Keep its auth hooks and shared cron edits under one owner at a time.        |
| Replay, statistics, matching    | H3; H4; K1                                                                  | H3/H4 may begin after wave 1; H4 also uses X1a's dispatcher. K1 waits for H1/R1/R2/X1b. Serialize H4 and K1's MatchRoom edits. Merge H3 and H4's match-page integration in sequence.                                                            |
| Leaderboard and profiles        | R3, then R4, then R5                                                        | R3 needs R1/R2/R6-core plus E5/E6. R4 also needs H2/H4 and R3. R5 follows R4. Integrate A3's reader helper if A3 has landed. These three features share profile, ranking, and query contracts and follow that order.                            |
| Later queue and integrity work  | K2; R6-detect                                                               | K2 follows K1 and the activation evidence in K2 §10.1. R6-detect follows the evidence in its spec. Schedule these once the evidence exists.                                                                                                     |
| Later commercial work           | S1 with S2-min, then S3a/S3b                                                | Resume after the founder returns to sponsorship. Existing prerequisites include approved commercial decisions, 30 days of X1 production data, and working reporting. S3b follows a delivered report; token links and the PDF remain later work. |

A3 is included in this plan with the register's recommended timing. Q1 is
still open. Commercial questions Q2/Q5, community and budget inputs Q3, and
Somali review Q4 are tracked in the register at the release they affect.

## Shared-file coordination

- Give one session ownership of each active migration, shared schema, and
  protocol change. Consumers rebase onto the merged contract commit.
- Keep one owner at a time for `match-room.ts`, `/online`, and result/rematch
  controls as H1, R2, X1b, H4, and K1 pass through them.
- X1a owns the wrapper and dispatcher foundation. R1, A3, and H4 register
  their jobs against it, with integration commits applied in sequence.
- H2 owns the initial `/match/[id]` loader and page. H3's replay and H4's
  statistics can develop in separate modules, then integrate into that page
  in sequence. R4 and R5 similarly share the profile page in order.
- Run E2E suites from separate workspaces with distinct ports when concurrent,
  or run them in sequence. Each workspace's two Workers share its own local
  database according to contracts §10.4 once H1 lands.
- Record implementation, local verification, preview verification, and
  production verification separately in the handoff. The register's
  `shipped@<date>` status requires production verification.

## Session handoff

Give each session its milestone, starting commit, owned files, and prerequisite
commits. Ask it to read `AGENTS.md`, the PRD, the V2 brief, canonical contracts,
and its spec. Rules and online-sync work also reads `shaxda_game.md`. Follow
the spec's implementation slices with one logical change per commit.

Each handoff records the resulting commit, checks run, remaining acceptance
criteria, migration order, and shared interfaces the next session can use.
The integration session runs the wave's real-game E2E scenario on the merged
result and records any release-only checks still pending.

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

`pnpm test:e2e` builds its own bundle from tracked fixtures and cleans its own
Durable Object state, so it needs no manual setup and leaves your local
`.dev.vars`, `web/.env.production`, and `.wrangler/state` untouched. See
[Step 2 test determinism](./ops/step2-test-determinism.md).

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
