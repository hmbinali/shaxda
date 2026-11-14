# H2 match history and detail release checks

Local implementation starts at Wave 1 integration commit `135d9dd`.
H2 uses the existing H1 ledger migration and adds no migration or binding.
The local fixture may include rated games to exercise public match pages.
Wave 1 account games created through the Workers are friendly.

## Local verification

- Run `pnpm check` and `pnpm test:e2e`. For concurrent worktrees, give
  Playwright distinct `SHAXDA_E2E_WEB_PORT` and
  `SHAXDA_E2E_WORKER_PORT` values. The launchers share the current
  worktree's dedicated D1 state. H2 uses ports 4263 and 8863.
- The [E6 results](../specs/evidence/e6-results.md) cover the six filters
  before and after a cursor, both summary statements, and detail reads for
  rated, friendly, and missing ids. The local rerun with
  `0002_match_ledger.sql` in place of the spec DDL reproduced all 17 plans
  and rows-read counts, including when executing the implemented readers.
  Pages read 84–295 rows, the summary read 5,021 across both statements,
  and detail read six rows for an existing match
  and zero for a missing id. The reader's Worker tests check the actual
  prepared statements against rows saved by the H1 writer.
- The ledger browser test follows a real account invite and rematch
  through play, resignation, the saved-result links, both histories, and
  outsider 404s.

## Preview and production handoff

1. Review Somali copy for the pages, save status, and disclosure with a
   fluent reviewer. Make the `/legal` disclosure live by the first H1
   production save. Apply H1's migration and deploy the game Worker before
   the H2 pages in each environment.
2. On preview, play an account-versus-account invite game. Open the result
   link from both participants, verify each outcome and the friendly label,
   and find the same match at the top of each player's history.
3. Compare a guessed friendly id and an unknown id signed out and from a
   third account. Check both HTML and `__data.json` for matching status,
   `no-store`, and bodies after normalizing the requested id. For a
   participant, check `noindex`, generic page metadata, and absence of
   room codes, account IDs, email addresses, and raw replay or stats in
   page source and serialized data. Verify that the service worker cannot
   serve the private match offline.
4. For rollback while H1 saves are active, use a web build with the
   saved-games disclosure. Revert the H2 routes in a new build if the
   preceding web version lacks that disclosure.

## Follow-on integration

- H3 and H4 extend or call `readMatchForViewer` before exposing replay or
  stats. The match page has an insertion point below the result header.
  Integrate the two page edits in sequence.
- R2 owns the shared rating label mapping and the public rated-game
  disclosure. Add the rating lookup and status labels after R1's migration,
  then rerun the E6 label plans. Rating and correction status do not change
  who can open a match.
- A3 extends the neutral-account predicate for pending and final accounts
  and owns redirects for an account pending deletion.
