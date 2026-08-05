# Step 2 — Test Determinism and Auth Infrastructure Hardening

Maintenance work between V1.1-A2 and V1.1-B. No product behaviour changed: no
game rules, WebSocket protocol, account or username behaviour, D1 schema or
migrations, room identity contracts, secrets, Worker names, routes, or deploys.

## Audit

Each reported issue was reproduced or conclusively verified against `main` at
`c5d098b` before anything was changed.

### 1. A developer `.dev.vars` overrode the E2E values — confirmed

`vite preview` calls `adapter.emulate()`, which calls
`getPlatformProxy(platformProxy)`. Wrangler's `getVarsForDev` loads
`<configDir>/.dev.vars` and overrides the config `vars` **only when `envFiles`
is empty or undefined**. A named Wrangler environment is not sufficient:
`loadDotDevDotVars(path, env)` falls back to plain `.dev.vars` when
`.dev.vars.<env>` is missing.

`CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV` defaults to `true` and
`CLOUDFLARE_INCLUDE_PROCESS_ENV` to `false`.

This was not theoretical. A `worker/.dev.vars` on a developer machine supplied
`ALLOWED_ORIGIN=http://localhost:5173` and a real `TURNSTILE_SECRET` to the game
Worker, so every online room creation returned `turnstileFailed` and four specs
failed.

**Fix.** A non-empty env file list is the switch that makes Wrangler skip
`.dev.vars`: `platformProxy.envFiles` for the web Worker, `wrangler dev
--env-file` for the game Worker. Values come from the tracked `web/.env.e2e` and
`worker/.env.e2e`.

The same contamination reaches the unit suites, which have no env-file control
of their own. Both were pre-existing and both were reproduced here:

- `@cloudflare/vitest-pool-workers` calls `unstable_getMiniflareWorkerOptions`
  without `envFiles` and exposes no option to change that, so `worker/.dev.vars`
  is loaded into the test Worker. A real `TURNSTILE_SECRET` there failed 33
  Worker tests. Pinned through `miniflare.bindings` in
  `worker/vitest.config.ts`, which is merged over the Wrangler-derived options.
- Vite loads `.env.local` in every mode, `test` included, so a real
  `PUBLIC_TURNSTILE_SITE_KEY` made the online lobby render a Turnstile widget
  that never resolves under jsdom, leaving Create disabled and failing 12 web
  tests. Pinned through `test.env` in `web/vite.config.ts`; `vi.stubEnv` still
  overrides per test.

### 2. Vite `.env` files lose to `process.env` — confirmed

`--mode e2e` alone cannot isolate the build. Vite's `loadEnv` re-applies
prefixed `process.env` keys _after_ merging the `.env` files, so an exported
`PUBLIC_WORKER_ORIGIN` still wins.

**Fix.** Both launchers construct an explicit child environment that drops every
inherited `PUBLIC_*` and `SHAXDA_REQUIRE_PUBLIC_ENV`, re-reads them from
`web/.env.e2e`, normalises `NODE_ENV` (Vite only forces its production default
when `NODE_ENV` is unset), and pins the two Cloudflare env-loading flags. The
parent shell is never mutated.

### 3. Playwright's Worker flags never reached Wrangler — confirmed by execution

`pnpm --filter @shaxda/worker dev -- --ip ... --port ... --persist-to ...`
became the literal process `wrangler dev "--" "--ip" ...`. pnpm forwards `--`
verbatim and yargs pushes everything after it into `_`. Verified directly:
`pnpm --filter @shaxda/worker dev -- --help` started a dev server instead of
printing help.

So `--persist-to` was inert, Durable Object state went to
`worker/.wrangler/state`, and `rm -rf test-results/wrangler-e2e` deleted
nothing. With `ACTIVE_MAX_PER_IP = 5` and `ACTIVE_ROOM_TTL_MS = 70 min`, rooms
accumulated across runs until `tooManyRooms`. `reuseExistingServer: !CI` also
skipped the cleanup command entirely on local reruns.

**Fix.** `scripts/start-worker-e2e.mjs` spawns Wrangler directly with no `--`
separator. `reuseExistingServer` is `false` for both servers, so every run gets
freshly cleaned state and a second concurrent run fails loudly on the bound port
instead of silently sharing a persistence path.

Two further sources of run-to-run failure surfaced during the repeated-run
verification, both pre-existing and both local-only:

- **Shared D1 write lock.** The account fixtures seed through a separate
  `wrangler d1 execute` process while the preview Worker holds the same local
  SQLite file open. With parallel Playwright workers, whichever side loses the
  write lock fails with `SQLITE_BUSY`; the Worker surfaces it as a
  `jsgInternalError` on any page load that touches the session, so the test that
  fails is arbitrary. Playwright already defaults to one worker under `CI`,
  which is why only local runs broke. `workers: 1` is now pinned so local and CI
  behave identically, and the fixture retries `SQLITE_BUSY` with jittered
  backoff. Costs about 18s on a 69-test suite.
- **Leaked `workerd` processes.** Each run left an orphaned `workerd` with
  `ppid=1`; they accumulated until one held port 4173, at which point `vite
preview` silently moved to the next free port and Playwright waited out its
  timeout polling a port nothing was listening on. The preview now runs with
  `--strictPort` so that fails loudly, and the launchers keep their child in
  Playwright's own process group so its group kill reaps the whole tree.
  Detaching the child looks like the fix and is not: it puts the server in a
  different group, Playwright's kill misses it, and the suite hangs after the
  last test.

### 4. Turbo `outputs: []` — premise inaccurate, two real defects found

The reported cause was already handled: `web/turbo.json` declared the SvelteKit
output globs, and every other package's `build` is `tsc --noEmit`, which emits
nothing, so `outputs: []` is correct for them. The root config was left alone.

What was actually wrong:

- `_worker.js` imports `../cloudflare-tmp/manifest.js`, but
  `.svelte-kit/cloudflare-tmp/**` was not a declared output, so a cache restore
  produced an un-deployable bundle.
- `typecheck` claimed `.svelte-kit/**`, overlapping the build output, so a
  typecheck cache hit could restore a stale `.svelte-kit/output` over a fresh
  build. Narrowed to what `svelte-kit sync` actually emits.
- `build/**` was declared but nothing writes there.
- No `env` keys were declared for the `PUBLIC_*` values the build inlines.

### 5. Better Auth could not determine the client IP — confirmed

`getIp()` defaults to `["x-forwarded-for"]`, which Cloudflare does not set.
`advanced.ipAddress.ipAddressHeaders` is a real option in the installed
`better-auth@1.6.25`, now set to `["cf-connecting-ip"]` — a single-value header
written by the edge, which Better Auth trusts without a `trustedProxies` list.

## Known behaviours, deliberately not "fixed"

**Turbo cache restore does not prune.** A cache hit extracts the cached outputs
over whatever is on disk without removing files from an abandoned build, so
unreferenced orphan chunks survive in `.svelte-kit/cloudflare`. Everything the
bundle references is restored byte for byte, and the deploy scripts call `vite
build` directly (the adapter rimrafs its output directory), so a deployed bundle
never contains them. `scripts/check-build-freshness.mjs` pins both halves of
this down.

**The web build is not byte-reproducible.** Two builds of identical source
produce the same file count with different content hashes, so build artifacts
cannot be compared by name across independent runs. The freshness check uses a
hash-independent orphan detector instead.

**`@vite-pwa/sveltekit` ignores `kit.outDir`.** It never reads
`svelte.config.js`, and the path it moves the generated service worker to is
hardcoded to `.svelte-kit/output`. Its `outDir` option cannot resolve this: it
means the build directory to the generator but the parent of `client/` to the
mover. `scripts/start-web-e2e.mjs` performs the move, and
`scripts/check-e2e-bundle.mjs` fails when `sw.js` is missing so it cannot
silently regress again.

## Verifying

```bash
pnpm check                      # includes check:e2e-isolation
pnpm test:e2e
```

`scripts/check-e2e-isolation.mjs` (also `pnpm check:e2e-isolation`) covers four
contamination sources against throwaway fixtures in the system temp directory,
each paired with a negative control so no assertion can pass vacuously:

1. a conflicting `.dev.vars`, for both Workers — beaten by the env file;
2. conflicting `.env`, `.env.local`, and `.env.production` files — beaten by
   `--mode e2e`;
3. conflicting process-level `PUBLIC_*` — beaten by the explicit child
   environment;
4. Wrangler's process-environment opt-in — forced off in every E2E child.

It never reads, moves, rewrites, or prints a real `.dev.vars`.

`scripts/check-build-freshness.mjs` (also `pnpm check:build-freshness`) verifies
clean build → controlled change → revert. It edits a tracked source file while
it runs and restores it in a `finally` and on `SIGINT`/`SIGTERM`, and it runs
several full builds, so it is run on demand rather than from `pnpm check`.

To prove cleanup holds across separate server lifecycles, run the online suites
as independent invocations rather than with `--repeat-each`, which would reuse a
single server and prove nothing:

```bash
pnpm test:e2e && pnpm test:e2e
for i in 1 2 3 4; do
  pnpm exec playwright test tests/e2e/online-game.spec.ts \
    tests/e2e/online-identity.spec.ts tests/e2e/e2e-infra.spec.ts
done
```

`tests/e2e/e2e-infra.spec.ts` polls for Durable Object persistence under
`test-results/wrangler-e2e` and compares `worker/.wrangler/state` and
`web/.wrangler/state` against the fingerprints the launchers record before
startup. A developer's own Wrangler state may legitimately exist, so it is
required to be _unchanged_, never absent.
