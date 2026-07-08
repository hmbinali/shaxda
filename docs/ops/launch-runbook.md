# Shaxda V1.0 Production Launch Runbook

This runbook is for the product owner to execute after Q1 and BETA1 are signed
off. It assumes the placeholder production hosts `shaxda.so` and
`api.shaxda.so`; replace both before deployment if the real domain differs.

Do not run the live deploy until:

- `docs/qa/q1-report.md` records passing checks and ready-for-beta sign-off;
- `docs/qa/beta1-feedback-log.md` records beta closeout as ready for launch;
- any approved BETA1 rule corrections are already merged.

## 1. Domain And DNS

1. Buy the domain in Namecheap.
2. Add the domain to Cloudflare.
3. Point Namecheap nameservers to the Cloudflare nameservers.
4. Wait until Cloudflare marks DNS as active.
5. Confirm the intended hosts:
   - web: `https://shaxda.so`
   - API worker: `https://api.shaxda.so`

## 2. Cloudflare Account Setup

1. Log in with Wrangler:

   ```bash
   pnpm --filter @shaxda/worker exec wrangler login
   ```

2. Export the account id in the shell that will deploy:

   ```bash
   export CLOUDFLARE_ACCOUNT_ID="<cloudflare-account-id>"
   ```

3. Create a Turnstile widget for `shaxda.so` and record:
   - site key;
   - secret key.

4. Store the Worker secret:

   ```bash
   pnpm --filter @shaxda/worker exec wrangler secret put TURNSTILE_SECRET --config wrangler.production.toml
   ```

5. Create billing alerts before traffic is announced. Use
   `docs/ops/billing-alerts.md`.

## 3. Web Build Environment

Create an untracked `web/.env.production` from `web/.env.example`:

```bash
PUBLIC_SITE_ORIGIN=https://shaxda.so
PUBLIC_WORKER_ORIGIN=https://api.shaxda.so
PUBLIC_TURNSTILE_SITE_KEY="<turnstile-site-key>"
PUBLIC_CF_BEACON_TOKEN="<cloudflare-web-analytics-token>"
```

If Cloudflare Web Analytics automatic injection is used instead, leave
`PUBLIC_CF_BEACON_TOKEN` empty.

## 4. Preflight Checks

Run the local checks from a clean worktree:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:worker
pnpm build
pnpm check
```

Validate deploy packaging without publishing:

```bash
pnpm --filter @shaxda/worker exec wrangler deploy --config wrangler.production.toml --dry-run --outdir /tmp/shaxda-worker-dry
pnpm --filter @shaxda/web build
pnpm --filter @shaxda/web exec wrangler deploy --dry-run --outdir /tmp/shaxda-web-dry
```

## 5. Deploy

Deploy the API worker first:

```bash
pnpm deploy:worker
```

Verify health:

```bash
curl https://api.shaxda.so/health
```

Expected response:

```json
{ "ok": true, "service": "shaxda" }
```

Deploy the web app:

```bash
pnpm deploy:web
```

Confirm Cloudflare DNS, custom domains, and SSL are active for both hosts.

## 6. Production Smoke Test

Check these flows on production before announcing launch:

- `/`, `/learn`, and `/rules` load successfully.
- Visible UI remains Somali-only and there is no language toggle.
- A full local game can be completed.
- Online room create, join-by-link/code, move sync, reconnect, and claim-win
  work across two devices or browsers.
- Turnstile is visible for room creation and rejects invalid tokens.
- PWA install prompt/app install works on a supported browser.
- Offline local play works after the app shell is cached.
- Cloudflare Web Analytics records site traffic.
- Worker logs show no repeated errors during smoke testing.

## 7. Rollback

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
