import { resolve } from "node:path";
import { repoRoot } from "./e2e-state.mjs";
import { readEnvFile } from "./env-file.mjs";

export const E2E_ENV_FILE = ".env.e2e";
export const webRoot = resolve(repoRoot, "web");

/**
 * Public build values Vite inlines. `loadEnv` re-applies prefixed `process.env`
 * keys *after* merging the `.env` files, so an exported value beats
 * `.env.e2e` and `--mode e2e` alone cannot isolate the build. Every one of
 * these is dropped from the child environment and then set from the tracked
 * fixture file.
 */
export const CONTROLLED_KEYS = [
  "PUBLIC_SITE_ORIGIN",
  "PUBLIC_WORKER_ORIGIN",
  "PUBLIC_TURNSTILE_SITE_KEY",
  "PUBLIC_CF_BEACON_TOKEN",
  "SHAXDA_REQUIRE_PUBLIC_ENV",
];

export async function readE2eFixture() {
  const fixture = await readEnvFile(resolve(webRoot, E2E_ENV_FILE));
  if (!fixture) {
    throw new Error(`Missing the tracked E2E fixture web/${E2E_ENV_FILE}.`);
  }
  return fixture;
}

/**
 * Builds the environment for the E2E build and preview. Never mutates
 * `process.env`, and never reads, moves or rewrites a developer's `.dev.vars`.
 */
export function buildE2eEnv(parentEnv, fixture, overrides = {}) {
  const env = { ...parentEnv };

  for (const key of CONTROLLED_KEYS) delete env[key];
  for (const key of Object.keys(fixture)) {
    if (key.startsWith("PUBLIC_")) env[key] = fixture[key];
  }

  // Vite only forces its production default when NODE_ENV is unset, so an
  // exported `NODE_ENV=development` would otherwise yield a development bundle.
  env.NODE_ENV = "production";

  // Wrangler reads `.env` files only when `envFiles` is set, and merges
  // `process.env` only when asked. Pin both so a developer's shell cannot flip
  // them mid-run.
  env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "true";
  env.CLOUDFLARE_INCLUDE_PROCESS_ENV = "false";

  return { ...env, ...overrides };
}
