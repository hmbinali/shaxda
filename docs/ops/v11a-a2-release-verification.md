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

## Remaining work

Preview: browser smoke test, identity-secret rotation drill, restore a single
final secret.

Production: apply `shaxda-db` migration, set the four web and one game secrets,
swap `web/.env.production` to production values, deploy the game Worker then the
web Worker, and re-run the smoke test. Record the pre-deploy version ids of
`shaxda-web` and `shaxda-worker` first — they are the rollback targets, and both
must be rolled back together.
