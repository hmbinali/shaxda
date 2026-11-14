# X1a product analytics runbook

## Local verification

The web Worker owns the activity beacons, dispatcher, and analytics tables.
The game Worker records daily online totals under X1b.
Use the committed E2E fixtures for browser tests. For a Wrangler smoke test,
use a separate local persistence directory and fixture auth credentials
from `web/wrangler.e2e.jsonc`. From `web/`, run:

```sh
pnpm build
pnpm exec wrangler d1 migrations apply shaxda-db --local --persist-to ../test-results/x1a-smoke
pnpm exec wrangler dev --local --port 8796 --persist-to ../test-results/x1a-smoke \
  --var AUTH_BASE_URL:http://127.0.0.1:8796 --test-scheduled
```

Use a local env file with fixture auth and analytics bindings, or replace
the placeholders in `.dev.vars.example` in your local `.dev.vars`. From
another terminal, trigger a run and inspect the job:

```sh
curl --fail 'http://127.0.0.1:8796/cdn-cgi/handler/scheduled?cron=15+0+*+*+*'
pnpm exec wrangler d1 execute shaxda-db --local --persist-to ../test-results/x1a-smoke \
  --command "SELECT last_success_at, last_error, cursor FROM job_state WHERE name = 'x1.nightly'"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8796/_worker.js
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8796/_kit_worker.js
```

Expect a non-null success time, a null error, and two 404s. A normal minute
tick begins work at 00:15 UTC. The test cron forces one step. Catch-up writes
one completed day per tick, up to the most recent 35 days, and prunes at most
5,000 rows per step. Missing older rollups remain visible as gaps. A failed
step keeps its lease for up to five minutes. The next eligible tick resumes
from the last committed cursor. A deployed trigger runs even with ingestion
disabled.

## Preview and production rollout

1. Apply the additive migrations to the target web database in order:
   `0000_accounts.sql`, `0001_analytics.sql`, `0002_match_ledger.sql`.
   Apply them before deploying the web build. The analytics migration is in
   the Drizzle journal. H1's hand-written ledger migration runs through
   Wrangler's D1 migration table. Use the environment-specific config and verification procedure in
   the [accounts runbook](v11a-accounts-runbook.md).
2. Provision `ANALYTICS_SALT` and `ADMIN_USER_IDS` as Worker secrets in each
   environment, with distinct random salts and a minimum of 32 characters.
   `ADMIN_USER_IDS` contains comma-separated internal session user IDs
   with no whitespace around entries. Keep both values out of logs and build
   variables. Record rotation dates in the ops log. Windows spanning a salt
   rotation can overcount because the same identity gets a different code.
3. Confirm the environment has its own `ANALYTICS_RATE_LIMIT` namespace with
   120 requests per 60 seconds and a single `* * * * *` trigger. Deploy the
   wrapped web build to preview after Somali copy review.
4. In preview, check that a signed-out beacon writes one browser row and that
   signing in on that browser adds only the account row for that day. A reload
   should send no repeat request. Confirm a session outside the allowlist gets
   403 and an allowlisted session gets 200 with `no-store` and `noindex`.
5. Verify the cron advances `last_success_at` and both Worker entry paths
   return 404. With synthetic rows on either side of the retention boundary in
   preview, verify that UTC day N−90 is retained and N−91 is removed. Repeat
   with `ANALYTICS_ENABLED` set to `"false"`. Check that local play still works.
6. Apply the same order to production after preview passes. Record seven
   consecutive days of fresh gauges and verify that the founder can quote
   30-day active browsers and active accounts with their definitions. The
   ledger gauges use the H1 tables and the same nightly job.

## X1b online counters

1. Confirm `0001_analytics` is applied and the game Worker points to the
   same D1 database as the web Worker. X1b uses the existing `event_daily`
   table. Publish the web changes for `/admin/stats` and `/legal` alongside
   the game Worker with `ANALYTICS_ENABLED="true"`.
2. On preview, create a guest invite and a two-account invite. Compare the
   day's totals before and after playing both games. A reconnect changes no
   counters, a pre-play resignation adds no starts or completions, and a
   played rematch adds one start and one completion. Room creation uses
   the creator's kind. Joins, starts, and completions classify mixed seats
   as guest games. Confirm `/admin/stats` displays the totals by kind and mode.
3. Run the [preview account-save rehearsal](#preview-account-save-with-game-analytics-disabled).
4. After production rollout, run the
   [seven-day reconciliation](#production-reconciliation-for-seven-completed-utc-days).

For rollback, turn off the game Worker's switch or redeploy the previous game
Worker. Keep the aggregate rows and the shared analytics table.

### Preview account save with game analytics disabled

Coordinate an exclusive preview game Worker change window with R2. Confirm
two distinct approved accounts can open the online page in authenticated
browser sessions and that the operator can read `shaxda-db-preview` and
change `shaxda-worker-preview`. Record the live deployment version and both
game flags. Keep the web configuration and the rated flag at their existing
values. The R2 friendly account invite can cover both rehearsals.

1. Temporarily set the preview game Worker's `ANALYTICS_ENABLED="false"`.
   Wait for the configuration to take effect. Take the counter baseline
   below before creating a new room. Use the test's first UTC day as the
   literal lower bound in both reads, including if midnight passes.
2. Create and join a friendly invite using the two accounts. Play to a
   board win or resign after three legal placements. Wait for both clients
   to acknowledge the save, then open the private match from one
   participant's history. In preview D1, check the test room's new match has
   `mode='invite'`, `rated=0`, the observed action count, and two
   `match_player` rows for distinct accounts. Compare the same counter
   fields with the baseline. Expect one new save and an identical set of
   online counter rows, counts, and update times.
3. Record the UTC test window, game Worker version, ledger sequence, save
   acknowledgement, and counter deltas. Handle concurrent preview activity
   by repeating in a quiet window if it prevents a clear comparison. Restore
   the exact prior game analytics flag even if the rehearsal fails and
   verify the restored deployment and health before releasing the window.

Use `pnpm --filter @shaxda/web exec wrangler d1 execute shaxda-db-preview
--config wrangler.preview.jsonc --remote --json` with `--command`. The
counter snapshot uses:

```sql
SELECT day, event, count, updated_at
FROM event_daily
WHERE day >= 'YYYY-MM-DD' AND event GLOB 'online_*'
ORDER BY day, event;
```

#### Preview evidence for 2026-11-14

Times below are UTC. The game Worker served version
`b83dc15f-5cbb-4db6-ad73-412f7cab8db3` at 100% with
`ANALYTICS_ENABLED="false"` and `RATED_PLAY_ENABLED="true"`.

| Check                              | Result                                                                                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline at 18:12:16               | One saved match, maximum sequence 1. Eight online counter rows, sum 11.                                                                                                                                         |
| Friendly invite, 18:12:38–18:13:53 | Both browsers acknowledged the same friendly save. Preview match `M2DACF6V2696D7N8JXZL`, sequence 2, match number 1, two distinct account seats, 68 actions, seat A win by `opponentBelowThree`.                |
| D1 read at 18:14:45                | Two saved matches, maximum sequence 2. All eight online rows had identical dates, events, counts and update times, with a total delta of zero.                                                                  |
| Restoration verified at 18:14:57   | Original game version `165224a8-dc5b-47de-b806-d5f4c1d6c44f` served 100% with both original flags enabled. Binding inventory and plain variables matched the original version. Preview game health returned OK. |

### Production reconciliation for seven completed UTC days

After the approved production rollout, record the game Worker version and
UTC time that account match saving and the online counters were both enabled.
Start at the first full UTC day with both enabled. Keep the same seven dates
through follow-up checks. Any day with a known disablement or recording
outage is ineligible for the seven-day window. Collect one snapshot after
each UTC day ends so transient outbox entries and log evidence can be
checked while available. Keep days with no activity in the report.

Save the SQL below in a local file and replace `YYYY-MM-DD` with the first
day of the window. Run it from a shell with authorized production D1 read
access. The query emits only UTC dates, modes, and aggregate counts. Future
or still-open days are excluded, so the final report has 14 rows once all
seven dates have ended.

```sh
pnpm --filter @shaxda/web exec wrangler d1 execute shaxda-db \
  --config wrangler.jsonc --remote --json \
  --command "$(cat /tmp/shaxda-x1b-reconcile.sql)"
```

```sql
WITH RECURSIVE
  days(day, n) AS (
    SELECT date('YYYY-MM-DD'), 1
    UNION ALL
    SELECT date(day, '+1 day'), n + 1 FROM days WHERE n < 7
  ),
  modes(mode) AS (VALUES ('invite'), ('quick')),
  counts AS (
    SELECT d.day, k.mode, COALESCE(e.count, 0) AS completed_accounts,
      (SELECT COUNT(*) FROM match AS m
       WHERE m.rated IN (0, 1) AND m.mode = k.mode
         AND m.ended_at >= unixepoch(d.day) * 1000
         AND m.ended_at < unixepoch(d.day, '+1 day') * 1000) AS saved
    FROM days AS d CROSS JOIN modes AS k
    LEFT JOIN event_daily AS e ON e.day = d.day
      AND e.event = 'online_completed_' || k.mode || '_account'
    WHERE d.day < date('now')
  )
SELECT day, mode, completed_accounts, saved,
       completed_accounts - saved AS completed_minus_saved
FROM counts
ORDER BY day, mode;
```

For each difference, check the pending or stalled H1 outbox via the
read-only `pnpm match:ops -- list-unsaved --database production`. Use each
entry's `endedAt` in UTC and `mode` to attribute it. Check stored game Worker
logs for `analyticsCounterFailed` with the corresponding completion metric,
grouped by log time in UTC. Record whether sampling or retention limited the
log evidence. A counter failure is dropped, and a late save changes the
original end day's ledger total. Re-run the same date window after pending
saves settle, allowing for H1's 72-hour retry window and any later operator
recovery.

Record the two totals and signed difference per date and mode, the time of
each read, and the number and cause of any explained exceptions. Investigate
any residual difference even if offsetting failures make another row's
totals equal. Keep identifiers, tokens, and raw logs out of the release
record. The reconciliation uses reads only. Any recovery action belongs to the
[match operations runbook](launch-runbook.md#h1-match-ledger).

## Stop ingestion or roll back

Set the web Worker variable `ANALYTICS_ENABLED` to `"false"` and deploy the
configuration to stop new beacons and local event writes. The nightly job
continues computing gauges and enforcing retention.

If rolling back the code, redeploy the previous web build and remove the
cron trigger in the same deploy. Keep the additive tables. With scheduled
pruning offline, run this bounded statement against the affected database
daily, repeating until it deletes fewer than 5,000 rows. Confirm the target
environment before running the delete and log only the affected row count.

```sql
DELETE FROM active_user_day
WHERE (day, anon_id) IN (
  SELECT day, anon_id FROM active_user_day
  WHERE day < date('now', '-90 days')
  ORDER BY day, anon_id LIMIT 5000
);
```

Use an aggregate check to verify retention without printing pseudonyms.

```sql
SELECT COUNT(*) AS expired
FROM active_user_day WHERE day < date('now', '-90 days');
```

## Ledger gauges

Saved games use their UTC end day and the ledger's rated flag. Weekly return
uses ISO weeks. D7 and D30 count returns on the exact day, with a separate
within-seven-days figure. The admin page shows each measure's recording start
and marks incomplete windows.

The nightly job uses `ledgerSeq` in its cursor to find late saves. It pins
the input sequence and the last complete day while it processes up to seven
days per tick. It advances the sequence after the last affected window
commits. Changes arriving while a rollup is in progress are picked up in a
later rollup. A backlog can take several ticks to finish.
