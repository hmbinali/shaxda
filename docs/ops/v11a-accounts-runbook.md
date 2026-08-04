# V1.1-A Accounts Operations Runbook

Use this runbook to provision and release Google-backed Shaxda accounts. Auth is
served by `shaxda-web` under `/api/auth/*`; the game Worker, guest rooms, and
Turnstile are unchanged.

## Prerequisites and placeholders

The committed production and preview Wrangler files deliberately contain
placeholders. Do not deploy until all three are replaced:

- `REPLACE_WITH_SHAXDA_DB_ID` in `web/wrangler.jsonc`;
- `REPLACE_WITH_SHAXDA_DB_PREVIEW_ID` in `web/wrangler.preview.jsonc`;
- `REPLACE_WITH_SHAXDA_WEB_SUBDOMAIN` in the preview `AUTH_BASE_URL`.

Create separate databases and copy the returned ids into those files:

```bash
pnpm --filter @shaxda/web exec wrangler d1 create shaxda-db
pnpm --filter @shaxda/web exec wrangler d1 create shaxda-db-preview
```

Never reuse the production database id in preview.

## Google OAuth client

Create one Google Cloud Console OAuth 2.0 Web application and register every
authorized redirect URI used by Shaxda:

```txt
http://localhost:5173/api/auth/callback/google
http://127.0.0.1:4173/api/auth/callback/google
https://shaxda-web.<your-workers-subdomain>.workers.dev/api/auth/callback/google
https://shaxda.app/api/auth/callback/google
```

The preview URI must exactly match `AUTH_BASE_URL` in
`web/wrangler.preview.jsonc`. The origin is configuration, never an inbound Host
header.

For local development, copy `web/.dev.vars.example` to `web/.dev.vars`, generate
a random secret of at least 32 characters, and add the real Google client id and
secret. `.dev.vars` is ignored by Git.

Keep `AUTH_BASE_URL` in `.dev.vars`. Without it, `platform.env` falls back to the
production `AUTH_BASE_URL` in `web/wrangler.jsonc`, Better Auth's origin check
stops matching the dev server, and every `/api/auth/*` request returns a
SvelteKit 404 instead of an error. The value must equal the origin the browser
uses, so update it if the dev server is not on `http://localhost:5173`.

## Worker secrets

Set all three secrets for preview and production. Use the corresponding Wrangler
config when prompted:

```bash
pnpm --filter @shaxda/web exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.preview.jsonc
pnpm --filter @shaxda/web exec wrangler secret put GOOGLE_CLIENT_ID --config wrangler.preview.jsonc
pnpm --filter @shaxda/web exec wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.preview.jsonc

pnpm --filter @shaxda/web exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.jsonc
pnpm --filter @shaxda/web exec wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
pnpm --filter @shaxda/web exec wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc
```

Do not put real secrets in `vars`, shell history, screenshots, CI logs, or source
control. The production bundle check rejects any supplied auth secret and the
committed e2e secret if one appears in `.svelte-kit/cloudflare/`.

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
4. Set preview secrets and deploy `shaxda-web` preview.
5. Complete the preview smoke test below.
6. Apply the production migration.
7. Set production secrets and deploy `shaxda-web` production.
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

The Google full name is scrubbed before insertion. Provider access, refresh, and
ID tokens are set to null because Shaxda does not call Google APIs. Public loaders
do not return email, ids, provider records, session records, token fields, or the
cooldown timestamp.

The generated initial avatar is the default. Google avatar mode is opt-in, accepts
only HTTPS `lh3`–`lh6.googleusercontent.com` URLs, uses `no-referrer`, discloses
the third-party request, and falls back to the generated initial. A site-wide CSP
and an image proxy remain follow-up hardening work.

## Smoke test

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

Username confirmation starts the 30-day cooldown, so an immediate rename is
expected to be rejected. Alias redirects and owner reclaim are covered by D1 and
authenticated application tests; use a seeded preview account if they must be
manually exercised before 30 days.

## Rollback

Code rollback is safe: revert the web deployment to restore signed-out navigation
and remove route reachability. Do not down-migrate production D1. The migration is
additive, and account rows should remain intact and unused until the fixed code is
redeployed. If auth is unhealthy, roll back the web Worker first; do not change the
game Worker or delete D1 data.

V1.1-A intentionally has no self-service deletion backend. The account screen
contains a non-interactive notice directing users to support until deletion work
is deliberately scoped.
