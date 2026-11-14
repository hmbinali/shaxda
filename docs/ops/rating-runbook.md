# Ratings and integrity operations

Wave 2 uses the immutable H1 ledger. Apply D1 migrations
`0003_ratings.sql` and `0004_rating_integrity.sql` in order. The web Worker
runs the processor on its minute cron. The game Worker sends an RPC hint
after saving. Every decision commits with both seat updates and the cursor
under one lease and fence.

## Local verification

Use Node from `.nvmrc` and the repository's pinned pnpm.

```sh
pnpm check
SHAXDA_E2E_WEB_PORT=4267 SHAXDA_E2E_WORKER_PORT=8867 pnpm test:e2e
node docs/specs/evidence/e5.mjs > /tmp/shaxda-e5.json
pnpm rating:rebuild -- --database local
pnpm rating:admin -- check-consistency --database local
```

The Workers suite folds the six-match correction fixture, checks the
indexed pair and invalidation lookups, invalidates the second result,
and rescinds. The browser fixture processes a played account match
against its own local D1 and checks the public rating response.

Use `inspect-match`, `verify-replay`, and `inspect-rating --full` with
a match id to investigate an individual decision. `check-consistency`
checks the ledger, rating fold, and exclusion projection.
`rating:rebuild` returns 0 for zero drift, 1 for drift, and 2 for errors.

## Corrections

Run `rating:admin` with an explicit database. For example, review the
local impact of an invalidation and apply its digest.

```sh
pnpm rating:admin -- invalidate-match "$match_id" --database local --reason "$reason"
pnpm rating:admin -- invalidate-match "$match_id" --database local --reason "$reason" --apply "$digest"
```

Use `rescind-invalidation` to reverse it. Use `exclude-account` or
`include-account` with `--username` or `--user-id` to update the public
ranking exclusion. `pause-ratings` and `resume-ratings` take a reason
and use the same plan and apply sequence. Pending matches continue to
save while ratings are paused. A resumed correction verifies the staged
prefix against the current plan before continuing. Use `resume-ratings`
to discard staged rows if abandoning a correction.

A later ledger decision makes a digest stale. Plan again and review the
new diff. Keep reasons limited to the operational facts. The public
response exposes status and the existence of a correction only.

The founder rehearses the commands on preview before production use.
Remote apply records a D1 Time Travel bookmark. Production apply also
requires `--confirm-database shaxda-db`. Afterward, check consistency and
record the bookmark, high-water mark, changed and marked counts, timing,
and the zero-drift confirmation.

Preview and production rehearsal are open. Public rated play remains
disabled pending the R2 release gates in the frozen specs.
