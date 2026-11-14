// Builds and serves the web Worker for end-to-end runs.
//
// The run must depend only on tracked fixtures, so this builds its own bundle
// into `.svelte-kit/e2e` rather than serving whatever `pnpm build` last left in
// `.svelte-kit/cloudflare`. Isolation comes from three places: `--mode e2e` so
// `.env.production` is not loaded, an explicit child environment so an exported
// `PUBLIC_*` cannot win, and explicit env files so Wrangler ignores
// `web/.dev.vars`. A developer's real `.dev.vars` is never read, moved,
// rewritten or printed.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  resolveE2eStatePath,
  repoRoot,
  testResultsRoot,
} from "./lib/e2e-state.mjs";
import {
  E2E_ENV_FILE,
  buildE2eEnv,
  e2eOrigins,
  readE2eBuildFixture,
} from "./lib/e2e-env.mjs";
import { spawnGroup } from "./lib/spawn-group.mjs";
import { fingerprintTree } from "./lib/fs-tree.mjs";

export const SHARED_E2E_STATE = "wrangler-e2e";
export const WEB_DEV_STATE_BASELINE = "dev-state-baseline.web.json";

const web = resolve(repoRoot, "web");
const outDir = ".svelte-kit/e2e";
const workerOutput = resolve(web, outDir, "cloudflare");
const devState = resolve(web, ".wrangler/state");

// The game launcher creates and migrates this state before web starts.
const sharedState = resolveE2eStatePath(SHARED_E2E_STATE);

// A developer's own `web/.wrangler/state` may legitimately exist. Never delete
// or rewrite it — fingerprint it so the suite can prove E2E left it alone.
mkdirSync(testResultsRoot, { recursive: true });
writeFileSync(
  resolve(testResultsRoot, WEB_DEV_STATE_BASELINE),
  `${JSON.stringify({ path: devState, ...fingerprintTree(devState) }, null, 2)}\n`,
);

const origins = e2eOrigins();
const fixture = await readE2eBuildFixture();
const authEnv = resolve(sharedState, "web.env");
const webEnv = readFileSync(resolve(web, E2E_ENV_FILE), "utf8");
writeFileSync(authEnv, `${webEnv}\nAUTH_BASE_URL=${origins.web}\n`);
const env = buildE2eEnv(process.env, fixture, {
  SHAXDA_KIT_OUT_DIR: outDir,
  SHAXDA_WRANGLER_CONFIG: "wrangler.e2e.jsonc",
  SHAXDA_WRANGLER_PERSIST: sharedState,
  SHAXDA_WRANGLER_ENV_FILES: authEnv,
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
 * does nothing. The adapter has already copied client assets at that point,
 * so put the generated files directly in Wrangler's asset directory.
 */
function moveServiceWorkerIntoAssets() {
  const server = resolve(web, outDir, "output/server");
  if (!existsSync(server)) return;

  for (const name of readdirSync(server)) {
    if (name !== "sw.js" && !/^workbox-[^/]+\.js$/.test(name)) continue;
    renameSync(resolve(server, name), resolve(workerOutput, name));
    process.stdout.write(`  moved ${name} into the Worker assets\n`);
  }
}

// Never serve a bundle from an earlier run.
rmSync(resolve(web, outDir), { recursive: true, force: true });

// Vite reads web/tsconfig.json, which extends the default generated config
// even when the E2E bundle itself uses a separate output directory.
const syncEnv = { ...env };
delete syncEnv.SHAXDA_KIT_OUT_DIR;
step(
  "Generating the SvelteKit TypeScript config",
  "pnpm",
  ["exec", "svelte-kit", "sync"],
  { env: syncEnv },
);

step("Building the E2E bundle", "pnpm", [
  "exec",
  "vite",
  "build",
  "--mode",
  "e2e",
]);
moveServiceWorkerIntoAssets();
step("Wrapping the E2E Worker", "node", [
  "scripts/wrap-worker.mjs",
  workerOutput,
]);
step("Checking the E2E bundle", "node", ["../scripts/check-e2e-bundle.mjs"]);
// Run the wrapped entry against the same local D1 that the game launcher owns.
spawnGroup(
  "pnpm",
  [
    "exec",
    "wrangler",
    "dev",
    "--config",
    "wrangler.e2e.jsonc",
    "--ip",
    "127.0.0.1",
    "--port",
    new URL(origins.web).port,
    "--persist-to",
    sharedState,
    "--env-file",
    authEnv,
    "--test-scheduled",
  ],
  { cwd: web, stdio: "inherit", env },
);
