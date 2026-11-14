# V1.1-A / V1.1-A2 Accounts Operations Runbook

Use this runbook to provision and release Google-backed Shaxda accounts and their
online-room identity integration. Auth is served by `shaxda-web` under
`/api/auth/*`; the game Worker verifies signed identity tickets only. Guest rooms
and Turnstile remain available without an account.

## Prerequisites and environment separation

Create separate databases and copy the returned ids into the Wrangler files:

```bash
pnpm --filter @shaxda/web exec wrangler d1 create shaxda-db
pnpm --filter @shaxda/web exec wrangler d1 create shaxda-db-preview
```

Never reuse the production database id in preview.

Preview and production Workers must never share a script name. Wrangler deploys
by name, so a preview deploy under a production name replaces the live
`shaxda.app` script with a build bound to the preview database and the preview
auth origin. The four names are:

| Environment | Web Worker           | Game Worker             |
| ----------- | -------------------- | ----------------------- |
| Production  | `shaxda-web`         | `shaxda-worker`         |
| Preview     | `shaxda-web-preview` | `shaxda-worker-preview` |

Preview hosts follow from those names on the account workers.dev subdomain, and
the preview `AUTH_BASE_URL`, the preview game Worker `ALLOWED_ORIGIN`, the
build-time `PUBLIC_*` origins, and the Google redirect URI must all agree with
them.

## Google OAuth client

Create one Google Cloud Console OAuth 2.0 Web application and register every
authorized redirect URI used by Shaxda:

```txt
http://localhost:5173/api/auth/callback/google
http://127.0.0.1:4173/api/auth/callback/google
https://shaxda-web-preview.<your-workers-subdomain>.workers.dev/api/auth/callback/google
https://shaxda.app/api/auth/callback/google
```

The preview URI must exactly match `AUTH_BASE_URL` in
`web/wrangler.preview.jsonc`. The origin is configuration, never an inbound Host
header.

For local development, copy both examples, generate a random online-identity
secret of at least 32 characters, and paste the exact same value into both
`ONLINE_IDENTITY_SECRET` entries. Add the real Google client id and secret to the
web file. `.dev.vars` is ignored by Git.

```bash
cp web/.dev.vars.example web/.dev.vars
cp worker/.dev.vars.example worker/.dev.vars
```

Keep `AUTH_BASE_URL` in `.dev.vars`. Without it, `platform.env` falls back to the
production `AUTH_BASE_URL` in `web/wrangler.jsonc`, Better Auth's origin check
stops matching the dev server, and every `/api/auth/*` request returns a
SvelteKit 404 instead of an error. The value must equal the origin the browser
uses, so update it if the dev server is not on `http://localhost:5173`.

## Worker secrets

Set the auth secrets and the web-side identity secret for preview and production.
Use the corresponding Wrangler config when prompted:

```bash
pnpm --filter @shaxda/web exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.preview.jsonc
pnpm --filter @shaxda/web exec wrangler secret put GOOGLE_CLIENT_ID --config wrangler.preview.jsonc
pnpm --filter @shaxda/web exec wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.preview.jsonc
pnpm --filter @shaxda/web exec wrangler secret put ONLINE_IDENTITY_SECRET --config wrangler.preview.jsonc

pnpm --filter @shaxda/web exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.jsonc
pnpm --filter @shaxda/web exec wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
pnpm --filter @shaxda/web exec wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc
pnpm --filter @shaxda/web exec wrangler secret put ONLINE_IDENTITY_SECRET --config wrangler.jsonc

pnpm --filter @shaxda/worker exec wrangler secret put ONLINE_IDENTITY_SECRET --config wrangler.preview.toml
pnpm --filter @shaxda/worker exec wrangler secret put ONLINE_IDENTITY_SECRET --config wrangler.production.toml
```

Preview and production must use different random online-identity secrets. Within
one environment, the web and game Worker values must match exactly. Do not add
these values to `[vars]` in preview or production because a var shadows a Worker
secret.

Set every secret an environment needs _before_ deploying the code that reads it.
An unread secret on an older Worker version is inert, but `createAuthOptions`
throws when `BETTER_AUTH_SECRET` is missing, so a web deploy that lands ahead of
its secrets fails every request instead of degrading. `wrangler secret put` does
create a new Worker version, which is why the secret step precedes the deploy
step in the release order below rather than following it.

This holds for a brand-new environment too: `wrangler secret put` creates the
Worker when it does not exist, as a script with no code and a deployment history
showing only `Source: Secret Change`. The first real `wrangler deploy` then
replaces the placeholder and applies any Durable Object migrations. Do not infer
the opposite from `wrangler secret list`, which fails on a missing Worker with
"If this is a new Worker, run `wrangler deploy` first to create it" — that advice
applies to `list`, not to `put`.

Do not put real secrets in `vars`, shell history, screenshots, CI logs, or source
control. The production bundle check rejects any supplied auth secret and the
committed e2e secrets if one appears in `.svelte-kit/cloudflare/`.

### Public build variables and local tests

`web/.env.production` holds the build-time `PUBLIC_*` values and is untracked. It
is loaded by every production-mode `vite build`.

It has no effect on `pnpm test:e2e`, and neither does a real `web/.dev.vars` or
`worker/.dev.vars`. Leave all three in place: the end-to-end run builds its own
bundle into `web/.svelte-kit/e2e` with `--mode e2e`, from an environment that
drops every inherited `PUBLIC_*` and re-reads the tracked `web/.env.e2e`. Both
Workers are given an explicit env file — `platformProxy.envFiles` for the web
Worker, `wrangler dev --env-file` for the game Worker — which is what makes
Wrangler skip `.dev.vars` entirely. Nothing moves, rewrites, or reads your real
files. See [Step 2 test determinism](./step2-test-determinism.md).

### Online-identity secret rotation

Apply this independently to preview and production:

1. On the game Worker, set `ONLINE_IDENTITY_SECRET_PREVIOUS` to the old value and
   replace `ONLINE_IDENTITY_SECRET` with the new value.
2. On the web Worker, replace `ONLINE_IDENTITY_SECRET` with the new value.
3. Wait at least 95 seconds after the last possible old-secret ticket mint.
4. Delete `ONLINE_IDENTITY_SECRET_PREVIOUS` from the game Worker with
   `wrangler secret delete`.

The game Worker accepts both values only during the rotation window. Room
creation does not persist or replay-track a create ticket; join/reconnect tickets
are single-use per seat.

## Migrations

`pnpm dev:web` reads `web/wrangler.jsonc` and persists D1 to
`web/.wrangler/state/v3`. Apply migrations there once before the first local
sign-in, otherwise Better Auth starts against a database with no tables:

```bash
pnpm --filter @shaxda/web exec wrangler d1 migrations apply shaxda-db --local
```

Local authenticated application e2e uses an isolated persisted database:

```bash
pnpm --filter @shaxda/web exec wrangler d1 migrations apply shaxda-db-e2e \
  --config wrangler.e2e.jsonc --local \
  --persist-to ../test-results/wrangler-web-e2e
```

Apply remote migrations before deploying code that uses them:

```bash
pnpm --filter @shaxda/web exec wrangler d1 migrations apply shaxda-db-preview \
  --config wrangler.preview.jsonc --remote

pnpm --filter @shaxda/web exec wrangler d1 migrations apply shaxda-db \
  --config wrangler.jsonc --remote
```

The Better Auth schema is generated from the checked-in config. Runtime packages
are pinned at `1.6.25`. The separately versioned CLI has no `1.6.25` release, so
the repository pins its current stable `1.4.22`; `schema:check` loads the real
runtime config and fails when its output differs from the committed schema.

```bash
pnpm --filter @shaxda/db run schema:check
```

Migration SQL is hand-written. `0000_accounts.sql` adds a unique username index,
a unique provider/account index, the username and avatar-mode CHECK constraints,
and `NOT NULL` on `avatar_mode` — none of which the Better Auth-generated Drizzle
model or `migrations/meta/` can describe. Do not hand-sync the snapshot to match:
the next `drizzle-kit generate` would then emit DROP statements for them. The
reasoning and the full list are in `packages/db/src/schema.ts`, and
`pnpm --filter @shaxda/db run test:worker` fails if any of them stops being
applied.

## Release order

1. Create distinct preview and production D1 databases.
2. Replace and review all Wrangler placeholders.
3. Apply the preview migration.
4. Set matching preview online-identity secrets on both Workers, set auth
   secrets, and deploy both preview Workers.
5. Complete the preview smoke test below.
6. Apply the production migration.
7. Set matching production online-identity secrets on both Workers, set auth
   secrets, and deploy both production Workers.
8. Complete the production smoke test and monitor Worker/D1 errors.

## Retained identity data

D1 retains the minimum sign-in and public-profile data:

- Better Auth internal user id;
- verified Google email, private to the owner;
- Google provider id and subject id;
- private Google image URL;
- public normalized username and historical aliases;
- public avatar preference (`initial` or explicitly opted-in `google`);
- session/account timestamps and cooldown timestamp.

The Google full name is scrubbed before insertion. Both account write hooks
clear the provider access, refresh, and ID tokens and their expiry fields.
Returning sign-in skips provider account updates. Public loaders omit email,
ids, provider records, session records, token fields, and the cooldown timestamp.

The generated initial avatar is the default. Google avatar mode is opt-in, accepts
only HTTPS `lh3`–`lh6.googleusercontent.com` URLs, uses `no-referrer`, discloses
the third-party request, and falls back to the generated initial. A site-wide CSP
and an image proxy remain follow-up hardening work.

## Smoke test

### A3 account deletion

Apply `0005_account_deletion.sql` before publishing the web Worker. Test the
request, cancellation, and reauthentication with a dedicated preview account.
Use the wrapped Worker's scheduled test endpoint with cron `16 0 * * *` for
finalization and `17 0 * * *` for username release on a disposable local
database. The deployed minute dispatcher starts both jobs at 00:15 UTC.
Confirm profile and alias URLs return 404 at request time. Existing sockets
can finish, and the opponent sees the neutral seat in history and match pages.

Review only aggregate counts in a routine check. Run the export before any
restore, store it outside the repository, and restrict it to its operator.

```sh
pnpm account:ops -- counts --database local
pnpm account:ops -- export-deletions --database local --file /private/path/deletions.json
pnpm account:ops -- replay-deletions --database local --file /private/path/deletions.json
```

For an import, replay onto the imported database before switching the
binding. For an in-place Time Travel restore, use `replay-deletions` with the
pre-restore export, `--time-travel <bookmark>`, and `--confirm-database` set to
the exact database name. Rehearse on preview. After replay succeeds, check
counts and verify pending sessions and a final account's match page. Dispose
of the export after verification. Preserve the deletion schema throughout
the restore, applying the migration to an imported copy before replay.

Roll forward if a finalizer needs repair. Keep the account status and cancel
routes live for pending users.

### Google sign-in

Run this with a real Google test account:

1. Open `/login`, choose **Ku sii wad Google**, and finish Google consent.
2. Confirm that the callback returns to `/login` and sends an incomplete account
   to `/register`.
3. Confirm a suggested or manually entered username and the initial avatar.
4. Verify `/account` shows the private email and next eligible username-change
   date, while `/u/<username>` does not show the email or Google full name.
5. Verify an unsafe external `returnTo` ends at `/`.
6. Submit logout from the account panel and confirm signed-out navigation appears.
7. Verify `/local` offline play and guest `/online` still work without signing in.
8. With a complete signed-in account, create and join an online room without a
   guest-name field; verify `@username` appears and a move syncs to a guest peer.
9. Refresh the signed-in player and verify it regains the same seat. Open the same
   account in a second tab and verify the first shows the replacement notice and
   does not reconnect.
10. Inspect a presence frame and confirm it contains no account id, email, Google
    full name, cookie, or token.

Username confirmation starts the 30-day cooldown, so an immediate rename is
expected to be rejected. Alias redirects and owner reclaim are covered by D1 and
authenticated application tests; use a seeded preview account if they must be
manually exercised before 30 days.

### Preview provider-token retention

Coordinate a short window on the existing preview deployment with the other
preview testers. Before the run, record the preview D1 clock in milliseconds
with `SELECT CAST(unixepoch('subsec') * 1000 AS INTEGER) AS now_ms`.
Use an approved Google test account that has never signed into Shaxda preview.
Complete the Google callback and confirm Shaxda opens `/register`. Username
confirmation is unnecessary for this check.

Query the new Google provider row through the preview Wrangler config using
the recorded lower bound and the D1 clock at the end of the run. Substitute
those two integer bounds when running the query through Wrangler. Report only
the counts returned by the query. Use the existing preview database with an
authorized Cloudflare session that can read it.

```sql
SELECT COUNT(*) AS new_google_rows,
       COUNT(access_token) AS access_token_non_null,
       COUNT(refresh_token) AS refresh_token_non_null,
       COUNT(id_token) AS id_token_non_null,
       COUNT(access_token_expires_at) AS access_expiry_non_null,
       COUNT(refresh_token_expires_at) AS refresh_expiry_non_null
FROM account
WHERE provider_id = 'google'
  AND created_at >= :start_ms AND created_at <= :end_ms;
```

The expected result is one new Google row and zero non-null values in each
of the five fields. If the window contains other sign-ins or the row count
differs, keep the check open until the new row can be attributed to the test.
Record the observation in the [release verification record](v11a-a2-release-verification.md).

## Rollback

For V1.1-A2, roll back both Workers together. Rolling back only the web Worker
stops new tickets while existing guest play continues; rolling back only the game
Worker makes newly minted account tickets unusable. Do not down-migrate production
D1 or delete account data. If a deployment is unhealthy, restore the previous web
and game Worker versions and their matching secret pair.

While any A3 deletion request is pending, use a web build that preserves the
pending-account restrictions and keeps the status and cancellation routes
available.
