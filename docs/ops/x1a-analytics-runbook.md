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
3. Rehearse setting `ANALYTICS_ENABLED="false"` on the game Worker. Repeat
   an invite game, confirm there are no new online increments, and verify
   that game play and account match saving still work. Restore the switch
   once the check passes. The web Worker has its own switch.
4. After the preview rehearsal and production rollout, record seven
   consecutive completed UTC days. Compare `online_completed_*_account`
   with saved matches by mode and UTC `ended_at` day. Check pending or stalled
   ledger saves and `analyticsCounterFailed` logs for discrepancies. Counter
   failures are dropped. The logs contain the metric name and error class.

For rollback, turn off the game Worker's switch or redeploy the previous game
Worker. Keep the aggregate rows and the shared analytics table.

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
