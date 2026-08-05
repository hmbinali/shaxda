# V1.1-A / V1.1-A2 Release Verification Record

Dated record of what was actually executed and observed while taking the merged
V1.1-A and V1.1-A2 work to production. "Merged" and "production-verified" are
different states; this file tracks the second one.

Account: `Techwithmahamed@gmail.com's Account` (`68aa1bfc1a838ad45891d614ddd9381a`).

## 2026-08-05 — starting production state

Confirmed before any change, against `https://shaxda.app`:

| Probe                                 | Result                             |
| ------------------------------------- | ---------------------------------- |
| `GET /`                               | 200 — V1.0 web Worker live         |
| `GET /health`                         | `{"ok":true,"service":"shaxda"}`   |
| `GET /login`, `/register`, `/account` | 404 — accounts UI not deployed     |
| `GET /api/auth/get-session`           | 404 — Better Auth not mounted      |
| `GET /api/online/identity`            | 404 — A2 ticket route not deployed |
| `wrangler d1 list`                    | `[]` — no databases existed        |

So V1.1-A and V1.1-A2 were merged but entirely undeployed, and production had
never had a D1 database.

## CI repair (merged as #40)

`main` was red at `204f664`. `worker/src/match-room.test.ts` forged a ticket by
rewriting the final base64url character of the HMAC signature to a fixed `"A"`.
A 32-byte HMAC-SHA-256 signature encodes to 43 characters whose last one carries
four significant bits, so it is one of only sixteen values and is already `"A"`
about 6.25% of the time — measured at 6.299% over 200,000 random signatures. In
that case the "forged" ticket equalled the valid one, the room accepted it, and
the assertion timed out waiting for an error frame that was never sent.

Fixed by flipping the leading signature character, which has no such constraint,
plus an inequality assertion so a regression fails legibly. Verified: 0/100,000
unchanged signatures with the new tamper, 15/15 repeated worker suites, and a
clean CI run with zero annotations.

## Preview environment

| Resource            | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| Web Worker          | `shaxda-web-preview`                                                     |
| Game Worker         | `shaxda-worker-preview`                                                  |
| Web URL             | `https://shaxda-web-preview.shaxda.workers.dev`                          |
| Game URL            | `https://shaxda-worker-preview.shaxda.workers.dev`                       |
| Database            | `shaxda-db-preview` / `5a84ac83-8387-4b68-b831-28ec450cd922`             |
| Google redirect URI | `https://shaxda-web-preview.shaxda.workers.dev/api/auth/callback/google` |

Both preview configs previously carried the production Worker names, which would
have replaced the live `shaxda.app` scripts on the first `deploy:preview`. Renamed
before any deploy command ran.

### Verified

- Preview migration `0000_accounts.sql` applied to `shaxda-db-preview`: 14
  commands, tables `account`, `d1_migrations`, `session`, `user`,
  `username_claim`, `verification`.
- Production `shaxda-db` left empty (`_cf_KV` only) and unbound.
- `shaxda-worker-preview` deployed, version `329e211c-3036-4370-bb36-f4b0f995e4fc`.
- `GET /health` → `{"ok":true,"service":"shaxda"}`. The first calls after deploy
  returned Cloudflare error 1042; that is workers.dev propagation and cleared in
  about ten seconds.
- `POST /rooms` with no Turnstile token → `403 turnstileFailed`.
- `POST /rooms` with an invalid Turnstile token → `403 turnstileFailed`.
- `POST /rooms` with a forged identity ticket → `401 identityInvalid`, fail-closed
  and checked before Turnstile.
- Secret names present, values never displayed: web has `BETTER_AUTH_SECRET`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ONLINE_IDENTITY_SECRET`; game has
  `ONLINE_IDENTITY_SECRET`, `TURNSTILE_SECRET`.
- Preview web build: expected `PUBLIC_*` origins present, Turnstile site key
  present in `_app/immutable/nodes/9.*.js`, and no `shaxda.app` string anywhere in
  `.svelte-kit/cloudflare/`.
- `pnpm check` exit 0; `pnpm test:e2e` 67 passed.

## Cloudflare static asset upload returned 500 — resolved on its own

For roughly 30 minutes `shaxda-web-preview` could not be deployed:
`POST /accounts/<id>/workers/assets/upload?base64=true` returned HTTP 500 with
`code: -1`, "An unknown error has occurred." It then began succeeding with no
change on our side, so no support ticket was needed. Recorded because the
isolation steps below are the right ones to repeat if it recurs, and because a
recurrence during the production deploy would block it the same way.

Isolation performed:

- The assets **upload session** succeeds and returns a JWT and bucket list; only
  the file payload uploads fail.
- 18 failed uploads across three deploy invocations, then 10 further attempts on
  a 60-second backoff over 18 minutes. All failed.
- A throwaway Worker with a single 36-byte HTML file fails identically, so the
  fault is neither bundle size, asset count, nor our configuration.
- Wrangler 4.107.0 and 4.118.0 both fail identically, so it is not a client bug.
- `wrangler deploy --dry-run` resolves all bindings; the build and
  `check-production-bundle.mjs` both pass.
- The game Worker, which has no assets, deployed successfully in the same session
  with the same credentials, as did both D1 databases.

This matches cloudflare/workers-sdk issues #11153 and #13118. Those describe
account-state faults that Cloudflare support had to clear; ours cleared by itself
after about half an hour. If it recurs and does not clear, a support ticket is the
only route — nothing in this repository can work around it, because every
Workers-hosted SvelteKit build needs the `ASSETS` binding.

## Preview web Worker verified

Deployed `shaxda-web-preview`, version `f2d8278d-c6c4-42d7-9d9f-edbb1a296b57`.

| Check                                           | Result                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `/`, `/login`, `/register`, `/local`, `/online` | 200                                                                 |
| `/account` signed out                           | 303 redirect                                                        |
| `/u/nobody`                                     | 404 Somali page                                                     |
| `/api/auth/get-session` signed out              | `null`, 200 — Better Auth mounted                                   |
| `/api/online/identity` signed out               | `{"status":"signedOut"}`, 200                                       |
| `POST /api/online/identity` signed out          | `401 signed-out`                                                    |
| `POST /api/online/identity` cross-origin        | `403 cross-origin-request`                                          |
| `POST /logout` cross-origin                     | `403`                                                               |
| Secret names in served homepage                 | none of the four appear                                             |
| Served online chunk                             | Turnstile site key and preview game origin present, no `shaxda.app` |

The Google authorization URL generated by `POST /api/auth/sign-in/social` carries
`redirect_uri=https://shaxda-web-preview.shaxda.workers.dev/api/auth/callback/google`,
scope `email profile openid`, and PKCE `S256` — confirming the deployed
`AUTH_BASE_URL`, the `trustedOrigins` entry derived from it, and the registered
Google redirect URI all agree.

## Preview browser smoke test and rotation drill

All ten browser checks passed: Google sign-in and callback, registration and
username confirmation, the 30-day cooldown rejecting an immediate rename, the
account page showing the private email, the public profile hiding email and
Google full name, the unsafe `returnTo` landing on `/`, guest create/join/
reconnect, registered create/join with `@username`, registered reconnect, second-
tab takeover with the replacement notice, and a presence frame carrying no
account id, email, Google full name, cookie, or token.

The rotation drill was then run against preview only, per the runbook: the old
secret was installed as `ONLINE_IDENTITY_SECRET_PREVIOUS` on the game Worker, a
new secret replaced `ONLINE_IDENTITY_SECRET` on both Workers, and after the
overlap window `ONLINE_IDENTITY_SECRET_PREVIOUS` was deleted. Deployment history
corroborates it — three post-deploy secret changes on the game Worker and one on
the web Worker — and both preview Workers now hold exactly one current, matching
identity secret with no `PREVIOUS` remaining.

## Production rollout

Rollback targets captured before any change:

| Worker          | Version to roll back to                |
| --------------- | -------------------------------------- |
| `shaxda-worker` | `fad0f2f6-47a0-4834-b5a7-9d342cd76786` |
| `shaxda-web`    | `e735a9c8-28a0-48f8-9bed-f85a3bed16b0` |

Both date from 2026-08-03 and must be rolled back together.

Applied `0000_accounts.sql` to `shaxda-db` (`b84cc232-ddbd-437d-acd0-0fa0d77e12b0`)
remotely: 14 commands, tables `account`, `d1_migrations`, `session`, `user`,
`username_claim`, `verification`, and the hand-written `user_username_unique`
index confirmed present. `shaxda.app` continued serving 200 throughout, because
the live V1.0 web Worker has no `DB` binding and cannot see the new tables.

Starting production secret state: `shaxda-web` had none; `shaxda-worker` had only
`TURNSTILE_SECRET` from the V1.0 launch, which must not be rotated by this
release.

### Production deployment

Deployed in dependency order, game Worker first:

| Worker          | New version                            |
| --------------- | -------------------------------------- |
| `shaxda-worker` | `8e51f9a4-d3cf-447b-9087-67a1efb5335c` |
| `shaxda-web`    | `9ad0eade-8837-41cc-b46a-19a89d2e4a09` |

The production build was rebuilt against production `PUBLIC_*` values before the
web deploy. The served bundle carries the production Turnstile site key and
`shaxda.app` origins, with zero occurrences of the preview site key or either
preview host. No rollback was needed.

`BETTER_AUTH_SECRET` does appear as a string in one client chunk. It is the
identifier inside Better Auth's isomorphic env accessor — a frozen object of
getters that read `process.env` at runtime and resolve to undefined in a browser
— not the value. Worker secrets are not available at build time, so no build can
bake one in. Note also that `check-production-bundle.mjs` can only compare values
it can see: with the real secrets held only as Worker secrets, its secret scan
covered the committed dev/e2e literals rather than the live values.

### Production verification

| Check                                                 | Result                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/`, `/login`, `/register`, `/local`, `/online`       | 200                                                                                                   |
| `/account` signed out                                 | 303                                                                                                   |
| `/u/nobody`                                           | 404                                                                                                   |
| `/api/auth/get-session`                               | `null`, 200                                                                                           |
| `/api/online/identity`                                | `{"status":"signedOut"}`, 200                                                                         |
| `POST /api/online/identity` signed out / cross-origin | `401 signed-out` / `403 cross-origin-request`                                                         |
| `POST /logout` cross-origin                           | `403`                                                                                                 |
| `/health`                                             | `{"ok":true,"service":"shaxda"}`                                                                      |
| `POST /rooms` no token / invalid token                | `403 turnstileFailed` (both)                                                                          |
| `POST /rooms` forged ticket                           | `401 identityInvalid`                                                                                 |
| Google authorization URL                              | `redirect_uri=https://shaxda.app/api/auth/callback/google`, scope `email profile openid`, PKCE `S256` |

Immediately after the web deploy, `/login` returned 404 once while `/register`
already returned 200. That was a stale edge-cached response from the V1.0 site,
which had no `/login`; it cleared on its own and now returns 200 with
`x-sveltekit-page: true`. Worth expecting on any route that returned 404 under
V1.0 and was requested during pre-deploy checks.

`wrangler tail` on both Workers during the smoke run captured five requests, all
`outcome: ok`, with no exceptions and no error or warning logs. A first attempt at
log capture recorded nothing because macOS has no `timeout` binary; the tails were
re-run without it.

## Remaining browser-only checks on production

Everything below needs a real Google account and a browser, and none of it can be
scripted because the production Turnstile secret makes room creation require a
real widget token:

- Google sign-in, consent, and callback;
- registration and username confirmation;
- the account page showing the private email and next eligible change date;
- public profile hiding email and Google full name;
- username change and alias redirect;
- guest create/join;
- registered create/join;
- registered reconnect and second-tab takeover;
- a presence frame carrying no account id, email, Google full name, or token.

The equivalents all passed on preview against the same code.
