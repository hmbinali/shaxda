# CLAUDE.md — Shaxda Claude Code Instructions

All project instructions are shared with Codex in `AGENTS.md`.

Claude Code reads this file, and this file imports `AGENTS.md`, so both tools use the same source of truth.

Edit `AGENTS.md`, not this file. Only Claude Code specifics live below.

@AGENTS.md

## Claude Code specifics

- Project skills in `.claude/skills/`: load `shaxda-rules` before engine,
  replay, or online-sync work, and `cloudflare-do-hibernation` before Worker,
  Durable Object, WebSocket, or D1 work.
- `.claude/settings.json` is shared: it pre-allows local checks and denies
  deploys, Wrangler secrets, `--remote` commands, and access to `.dev.vars`,
  `.env`, and `.env.production`. Do not work around a denial; ask instead.
  Personal overrides go in the ignored `.claude/settings.local.json`.
- The pre-commit hook runs lint-staged (ESLint and Prettier) on staged files.
