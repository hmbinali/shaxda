# Shaxda V1.0 Production Launch Runbook

This runbook is for the product owner to execute after Q1 and BETA1 are signed
off. Production uses one hostname, `https://shaxda.app`, for the site, API, and
WebSocket traffic. Cloudflare routes `/rooms*` and `/health` to `shaxda-worker`;
the broader `/*` route sends all other traffic to `shaxda-web`.

Do not run the live deploy until:

- `docs/qa/q1-report.md` records passing checks and ready-for-beta sign-off;
- `docs/qa/beta1-feedback-log.md` records beta closeout as ready for launch;
- any approved BETA1 rule corrections are already merged.

## 1. Domain And DNS

1. Add `shaxda.app` to Cloudflare on the Free zone plan.
2. Point the domain's Namecheap nameservers to the nameservers Cloudflare
   provides.
3. Wait until Cloudflare marks the zone active and Universal SSL is issued.
4. Enable the Workers Paid plan for Durable Objects and SQLite-backed Durable
   Object storage.
5. In Cloudflare DNS, add a proxied `AAAA` record for `@` with the value `100::`.
   Worker routes do not create DNS records, so the apex will not resolve without
   this placeholder record.
6. Set SSL/TLS encryption mode to **Full (strict)** and enable **Always Use
   HTTPS**.

## 2. Cloudflare Account Setup

1. Log in with Wrangler:

   ```bash
   pnpm --filter @shaxda/worker exec wrangler login
   ```

2. Export the account id in the shell that will deploy:

   ```bash
   export CLOUDFLARE_ACCOUNT_ID="<cloudflare-account-id>"
   ```

3. Create a Managed Turnstile widget for `shaxda.app` and record:
   - site key;
   - secret key.

4. Create billing alerts before traffic is announced. Use
   `docs/ops/billing-alerts.md`.

Store the production Turnstile secret immediately before the production Worker
deploy in section 6. Never pass the secret on the command line or commit it to a
file.

## 3. Local Validation

Run the complete local check from a clean worktree:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
```

Validate the Worker package without publishing:

```bash
pnpm --filter @shaxda/worker exec wrangler deploy --config wrangler.production.toml --dry-run --outdir /tmp/shaxda-worker-dry
```

## 4. Temporary workers.dev Preview

Use `workers.dev` to smoke-test both Workers before attaching `shaxda.app`.
The committed preview configs enable `workers_dev` without production routes, so
no scratch edits or later restoration are needed. The API preview allows any CORS
origin because its web preview runs on a separate `workers.dev` hostname; the
production config remains restricted to `https://shaxda.app`.

Deploy the API Worker first:

```bash
pnpm deploy:preview:worker
```

Confirm its reported URL returns the health response:

```bash
curl https://shaxda-worker.<workers-dev-subdomain>.workers.dev/health
```

Expected response:

```json
{ "ok": true, "service": "shaxda" }
```

For preview only, create `web/.env.production` with the reported Worker URL and
Cloudflare's always-passing Turnstile test site key. Use the matching test secret
when prompted by `wrangler secret put`:

```bash
PUBLIC_SITE_ORIGIN=https://shaxda-web.<workers-dev-subdomain>.workers.dev
PUBLIC_WORKER_ORIGIN=https://shaxda-worker.<workers-dev-subdomain>.workers.dev
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
PUBLIC_CF_BEACON_TOKEN=
```

The always-passing test secret is
`1x0000000000000000000000000000000AA`. These test credentials work on any
hostname; do not authorize the preview host on the production widget.

```bash
pnpm --filter @shaxda/worker exec wrangler secret put TURNSTILE_SECRET --config wrangler.preview.toml
pnpm deploy:preview:web
```

Smoke-test the reported web URL. Confirm room creation, joining, moves, reconnect,
and claim-win across two devices or browser profiles. The browser network panel
must show API requests to the Worker preview URL and a `wss://` room connection.

## 5. Production Web Build Environment

Replace the preview values in the untracked `web/.env.production` with production
values. The production deploy scripts select the production configs, where
`workers_dev` is `false` and all `shaxda.app` routes are present:

```bash
PUBLIC_SITE_ORIGIN=https://shaxda.app
PUBLIC_WORKER_ORIGIN=https://shaxda.app
PUBLIC_TURNSTILE_SITE_KEY=<turnstile-site-key>
PUBLIC_CF_BEACON_TOKEN=<cloudflare-web-analytics-token-or-empty>
```

The site key is public, but `web/.env.production` remains untracked. Never put the
Turnstile secret in this file. If Cloudflare Web Analytics is not configured,
leave `PUBLIC_CF_BEACON_TOKEN` empty.

Build the production bundle, then confirm the expected public origins were applied:

```bash
SHAXDA_REQUIRE_PUBLIC_ENV=1 pnpm --filter @shaxda/web build
pnpm check:bundle
```

The build rejects missing or non-HTTPS public origins. The bundle check positively
confirms both expected origins are present; fallback literals may remain in optimized
code even when the production values were applied. Then validate the web package
without publishing:

```bash
pnpm --filter @shaxda/web exec wrangler deploy --dry-run --outdir /tmp/shaxda-web-dry
```

## 6. Production Deploy

Confirm the proxied apex `AAAA @` record, Universal SSL certificate, production
Turnstile widget, and both production env values are ready. Replace the preview
Turnstile secret with the production secret:

```bash
pnpm --filter @shaxda/worker exec wrangler secret put TURNSTILE_SECRET --config wrangler.production.toml
```

Deploy the API Worker first:

```bash
pnpm deploy:worker
```

Verify the more-specific `/health` route reaches the API Worker:

```bash
curl -sS https://shaxda.app/health
```

Expected response:

```json
{ "ok": true, "service": "shaxda" }
```

Deploy the web Worker. The package script rebuilds with the production environment,
enforces the HTTPS origin guard, and runs the bundle check before publishing:

```bash
pnpm deploy:web
```

## 7. Production Smoke Test

Check these flows on `https://shaxda.app` before announcing launch:

- `/`, `/learn`, `/privacy`, and `/terms` load successfully; `/rules` returns
  the Somali 404 page.
- Canonical and Open Graph URLs use `https://shaxda.app`, with no
  `shaxda.example` values.
- Visible UI remains Somali-only and there is no language toggle.
- Browser requests use only `https://` and `wss://`, with no mixed-content
  warnings, localhost requests, or preview URLs.
- A full local game can be completed.
- Turnstile is visible, room creation succeeds after verification, and invalid
  tokens are rejected.
- Online room create, join-by-link/code, move sync, reconnect, and claim-win work
  across two devices or browser profiles.
- The online socket connects to `wss://shaxda.app/rooms/<code>/ws`.
- PWA install and offline local play work after the app shell is cached.
- Cloudflare Web Analytics records traffic if configured.
- Worker logs show no repeated errors during smoke testing.

## 8. Rollback

List recent deployments:

```bash
pnpm --filter @shaxda/worker exec wrangler deployments list --config wrangler.production.toml
pnpm --filter @shaxda/web exec wrangler deployments list
```

Rollback the affected deployment if production smoke testing finds a launch
blocker:

```bash
pnpm --filter @shaxda/worker exec wrangler rollback --config wrangler.production.toml
pnpm --filter @shaxda/web exec wrangler rollback
```

Rolling back code leaves Durable Object storage intact. Do not rename the Worker,
edit migration tags or class names, delete either Worker, or remove the Cloudflare
zone as part of a rollback.
