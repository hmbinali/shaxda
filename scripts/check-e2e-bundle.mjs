// Proves the bundle `pnpm test:e2e` serves was built against the tracked E2E
// fixtures and carries no production or preview configuration.
//
// Deliberately not a blanket "no non-localhost https://" rule: the bundle
// legitimately contains external URLs (schema.org, the Cloudflare beacon,
// Turnstile, dependency and documentation links), and flagging those would make
// this check useless. It matches exact Shaxda origins instead, and derives them
// from the tracked Wrangler configs so the list cannot drift.

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { repoRoot } from "./lib/e2e-state.mjs";
import { readE2eFixture, webRoot } from "./lib/e2e-env.mjs";
import { readEnvFile } from "./lib/env-file.mjs";

// `vite preview` serves `output/`; `cloudflare/` is the copy the deploy would
// upload. Scan what the suite actually runs against.
const bundleRoot = resolve(webRoot, ".svelte-kit/e2e/output");

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

/** Every `https://` origin named in the tracked deploy configurations. */
async function deployedOrigins() {
  const sources = await Promise.all([
    readText(resolve(webRoot, "wrangler.jsonc")),
    readText(resolve(webRoot, "wrangler.preview.jsonc")),
    readText(resolve(repoRoot, "worker/wrangler.production.toml")),
    readText(resolve(repoRoot, "worker/wrangler.preview.toml")),
  ]);

  const origins = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/https:\/\/[a-z0-9.-]+/gi)) {
      // Skip the JSON schema and documentation links these files also contain.
      if (match[0].includes("cloudflare.com")) continue;
      origins.add(match[0]);
    }
    for (const match of source.matchAll(/"pattern":\s*"([a-z0-9.-]+)\/\*"/gi)) {
      origins.add(`https://${match[1]}`);
    }
  }

  return [...origins];
}

async function bundleFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await bundleFiles(path)));
    else if (entry.isFile()) files.push(path);
  }

  return files;
}

let files;
try {
  files = await bundleFiles(bundleRoot);
} catch (error) {
  if (error?.code === "ENOENT") {
    throw new Error(`No E2E bundle at ${bundleRoot}. Build it first.`);
  }
  throw error;
}

const contents = await Promise.all(
  files.map(async (path) => [path, await readFile(path, "latin1")]),
);

function findAll(needle) {
  return contents
    .filter(([, text]) => text.includes(needle))
    .map(([path]) => path.slice(bundleRoot.length + 1));
}

const fixture = await readE2eFixture();
const failures = [];

// The PWA plugin moves the service worker into the client bundle using a
// hardcoded path, so a change to the E2E out-dir can silently drop it and the
// offline specs then time out waiting for `navigator.serviceWorker.ready`.
const relative = files.map((path) => path.slice(bundleRoot.length + 1));
for (const required of ["client/sw.js", "client/manifest.webmanifest"]) {
  if (!relative.includes(required)) {
    failures.push(`${required} is missing from the E2E bundle.`);
  }
}

for (const key of ["PUBLIC_SITE_ORIGIN", "PUBLIC_WORKER_ORIGIN"]) {
  const value = fixture[key];
  if (!value) continue;
  if (findAll(value).length === 0) {
    failures.push(`${key} (${value}) is missing from the E2E bundle.`);
  }
}

for (const origin of await deployedOrigins()) {
  const hits = findAll(origin);
  if (hits.length > 0) {
    failures.push(`Deployed origin ${origin} appears in: ${hits.join(", ")}`);
  }
}

// An untracked `web/.env.production` must not be able to reach the E2E bundle.
// Read without printing: only the variable name is ever reported.
const productionEnv = await readEnvFile(resolve(webRoot, ".env.production"));
for (const [key, value] of Object.entries(productionEnv ?? {})) {
  if (!key.startsWith("PUBLIC_") || value.trim() === "") continue;
  if (value === fixture[key]) continue;
  if (findAll(value).length > 0) {
    failures.push(
      `${key} from web/.env.production leaked into the E2E bundle.`,
    );
  }
}

if (failures.length > 0) {
  console.error("E2E bundle check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`E2E bundle check passed across ${files.length} files.`);
