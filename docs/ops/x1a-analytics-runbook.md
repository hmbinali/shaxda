# X1a product analytics runbook

## Local verification

The web Worker owns measurements, the dispatcher, and the analytics tables.
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

1. At integration, assign the analytics migration the next available number in
   D1 order and synchronize its journal index, tag, and timestamp. Apply the
   additive migration to the target web database before deploying the web
   build. Use the environment-specific config and verification procedure in
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
   ledger gauges require the H1 migration and X1a slice 9.

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

## Slice 9 handoff

Integrate after H1's `match` and `match_player` migration is on `main`.
If H1 lands as `0001_match_ledger.sql`, rename X1a's temporary
`0001_analytics.sql` to `0002_analytics.sql` and reconcile
`packages/db/migrations/meta/_journal.json` with migration order. Use fresh
local D1 state to verify the combined sequence. H1 owns the shared E2E D1
setup. Keep both H1 ledger and X1a retention clauses in the `/legal` service
bullet when resolving the copy overlap.

Use `ledgerSeq` in the `x1.nightly` cursor to find late saves. Recompute
saved game counts from the earliest newly ingested `ended_at` day, affected
ISO weeks from seven days before it, and cohorts from 30 days before it.
Advance `ledgerSeq` only after the affected writes commit. Keep bounded,
fenced steps and use H1's ledger indexes. Replace the saved games, weekly
return, and cohort placeholders on `/admin/stats`, and label immature
windows without showing a zero percentage. Verify M1–M10, query plans, and a
late save with a higher `seq` and older `ended_at`.
