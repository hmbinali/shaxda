// Builds and serves the web Worker for end-to-end runs.
//
// The run must depend only on tracked fixtures, so this builds its own bundle
// into `.svelte-kit/e2e` rather than serving whatever `pnpm build` last left in
// `.svelte-kit/cloudflare`. Isolation comes from three places: `--mode e2e` so
// `.env.production` is not loaded, an explicit child environment so an exported
// `PUBLIC_*` cannot win, and `platformProxy.envFiles` so Wrangler ignores
// `web/.dev.vars`. A developer's real `.dev.vars` is never read, moved,
// rewritten or printed.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  cleanE2eStateDirectory,
  repoRoot,
  testResultsRoot,
} from "./lib/e2e-state.mjs";
import { E2E_ENV_FILE, buildE2eEnv, readE2eFixture } from "./lib/e2e-env.mjs";
import { spawnGroup } from "./lib/spawn-group.mjs";
import { fingerprintTree } from "./lib/fs-tree.mjs";

export const WEB_E2E_STATE = "wrangler-web-e2e";
export const WEB_DEV_STATE_BASELINE = "dev-state-baseline.web.json";

const web = resolve(repoRoot, "web");
const outDir = ".svelte-kit/e2e";
const devState = resolve(web, ".wrangler/state");

// Guarded: refuses any path that is not strictly inside `test-results/`.
cleanE2eStateDirectory(WEB_E2E_STATE);

// A developer's own `web/.wrangler/state` may legitimately exist. Never delete
// or rewrite it — fingerprint it so the suite can prove E2E left it alone.
mkdirSync(testResultsRoot, { recursive: true });
writeFileSync(
  resolve(testResultsRoot, WEB_DEV_STATE_BASELINE),
  `${JSON.stringify({ path: devState, ...fingerprintTree(devState) }, null, 2)}\n`,
);

const env = buildE2eEnv(process.env, await readE2eFixture(), {
  SHAXDA_KIT_OUT_DIR: outDir,
  SHAXDA_WRANGLER_CONFIG: "wrangler.e2e.jsonc",
  SHAXDA_WRANGLER_PERSIST: `../test-results/${WEB_E2E_STATE}`,
  SHAXDA_WRANGLER_ENV_FILES: E2E_ENV_FILE,
});

function step(label, command, args, options = {}) {
  process.stdout.write(`\n▸ ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: web,
    stdio: "inherit",
    env,
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/**
 * `@vite-pwa/sveltekit` generates the service worker into the SSR build
 * directory and then moves it into `client/`, but the destination it moves to is
 * hardcoded to `.svelte-kit/output`, so with the E2E out-dir the move silently
 * does nothing and the preview serves 404s for `/sw.js`. Replicate the move.
 * A no-op for the default out-dir, where the plugin already did it.
 */
function moveServiceWorkerIntoClient() {
  const server = resolve(web, outDir, "output/server");
  const client = resolve(web, outDir, "output/client");
  if (!existsSync(server) || !existsSync(client)) return;

  for (const name of readdirSync(server)) {
    if (name !== "sw.js" && !/^workbox-[^/]+\.js$/.test(name)) continue;
    renameSync(resolve(server, name), resolve(client, name));
    process.stdout.write(`  moved ${name} into the client bundle\n`);
  }
}

// Never serve a bundle from an earlier run.
rmSync(resolve(web, outDir), { recursive: true, force: true });

step("Building the E2E bundle", "pnpm", [
  "exec",
  "vite",
  "build",
  "--mode",
  "e2e",
]);
moveServiceWorkerIntoClient();
step("Checking the E2E bundle", "node", ["../scripts/check-e2e-bundle.mjs"]);
step("Applying E2E migrations", "pnpm", [
  "exec",
  "wrangler",
  "d1",
  "migrations",
  "apply",
  "shaxda-db-e2e",
  "--config",
  "wrangler.e2e.jsonc",
  "--local",
  "--persist-to",
  `../test-results/${WEB_E2E_STATE}`,
]);

// Same child environment and same `SHAXDA_KIT_OUT_DIR`, so the artifact that was
// just built is exactly the artifact that gets served.
// `--strictPort` matters: without it `vite preview` quietly moves to the next
// free port when 4173 is taken, and Playwright then waits out its timeout
// polling a port nothing is listening on.
spawnGroup(
  "pnpm",
  [
    "exec",
    "vite",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4173",
    "--strictPort",
  ],
  { cwd: web, stdio: "inherit", env },
);
