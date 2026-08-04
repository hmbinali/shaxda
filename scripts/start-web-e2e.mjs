import { rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const web = new URL("web/", root);
const state = new URL("test-results/wrangler-web-e2e/", root);

rmSync(state, { recursive: true, force: true });

const migration = spawnSync(
  "pnpm",
  [
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
    "../test-results/wrangler-web-e2e",
  ],
  { cwd: web, stdio: "inherit" },
);

if (migration.status !== 0) process.exit(migration.status ?? 1);

const preview = spawn(
  "pnpm",
  ["preview", "--host", "127.0.0.1", "--port", "4173"],
  {
    cwd: web,
    stdio: "inherit",
    env: {
      ...process.env,
      SHAXDA_WRANGLER_CONFIG: "wrangler.e2e.jsonc",
      SHAXDA_WRANGLER_PERSIST: "../test-results/wrangler-web-e2e",
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => preview.kill(signal));
}

preview.on("exit", (code) => process.exit(code ?? 0));
