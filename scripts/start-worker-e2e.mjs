// Launches the game Worker for end-to-end runs.
//
// Playwright used to run `pnpm --filter @shaxda/worker dev -- --ip ... --port
// ... --persist-to ...`. pnpm forwards the `--` verbatim, so Wrangler received
// `wrangler dev "--" "--ip" ...` and yargs pushed every flag into `_`: the
// Worker silently listened on its default address and persisted Durable Object
// state to `worker/.wrangler/state`, where nothing ever cleaned it up. This
// spawns Wrangler directly so the flags are actually parsed.

import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  cleanE2eStateDirectory,
  repoRoot,
  testResultsRoot,
} from "./lib/e2e-state.mjs";
import { fingerprintTree } from "./lib/fs-tree.mjs";

export const WORKER_E2E_STATE = "wrangler-e2e";
export const WORKER_DEV_STATE_BASELINE = "dev-state-baseline.worker.json";

const worker = resolve(repoRoot, "worker");
const devState = resolve(worker, ".wrangler/state");

// Guarded: `cleanE2eStateDirectory` refuses any path that is not strictly
// inside `test-results/`, so an interrupted or malformed run can never widen
// this into deleting the repository.
const state = cleanE2eStateDirectory(WORKER_E2E_STATE);

// A developer's own `worker/.wrangler/state` may legitimately exist from
// `pnpm dev:worker`. Never delete or rewrite it — record a fingerprint so the
// suite can prove the E2E run left it alone.
mkdirSync(testResultsRoot, { recursive: true });
writeFileSync(
  resolve(testResultsRoot, WORKER_DEV_STATE_BASELINE),
  `${JSON.stringify({ path: devState, ...fingerprintTree(devState) }, null, 2)}\n`,
);

const wrangler = spawn(
  "pnpm",
  [
    "exec",
    "wrangler",
    "dev",
    "--ip",
    "127.0.0.1",
    "--port",
    "8787",
    "--persist-to",
    "../test-results/wrangler-e2e",
    // Wrangler only consults `.dev.vars` when no env file is given, so this is
    // what keeps a developer's real `worker/.dev.vars` — a local
    // `ALLOWED_ORIGIN`, a real `TURNSTILE_SECRET` — out of the run.
    "--env-file",
    ".env.e2e",
  ],
  { cwd: worker, stdio: "inherit" },
);

process.stdout.write(`Game Worker E2E state: ${state}\n`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => wrangler.kill(signal));
}

wrangler.on("exit", (code) => process.exit(code ?? 0));
