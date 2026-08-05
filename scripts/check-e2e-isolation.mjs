// Proves `pnpm test:e2e` uses only controlled fixtures, whatever a developer
// happens to have on disk or exported in their shell.
//
// Three contamination sources, each with a negative control so no assertion can
// pass vacuously:
//
//   1. a conflicting `web/.dev.vars`   -> beaten by `platformProxy.envFiles`
//   2. a conflicting `.env`/`.env.local` -> beaten by `--mode e2e`
//   3. conflicting process-level PUBLIC_* -> beaten by the explicit child env
//
// Everything runs against throwaway fixtures in the system temp directory. The
// developer's own `web/.dev.vars` is never read, moved, rewritten or printed.

import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { repoRoot } from "./lib/e2e-state.mjs";
import {
  E2E_ENV_FILE,
  buildE2eEnv,
  readE2eFixture,
  webRoot,
} from "./lib/e2e-env.mjs";

const workerRoot = resolve(repoRoot, "worker");

const MARKER = "__SHAXDA_PROBE__";

const CONFLICTING_DEV_VARS = {
  AUTH_BASE_URL: "https://developer-machine.example",
  BETTER_AUTH_SECRET: "developer-local-secret-that-must-never-reach-e2e",
  GOOGLE_CLIENT_ID: "developer-local-google-client",
  GOOGLE_CLIENT_SECRET: "developer-local-google-secret",
  DB: "developer-local-not-a-database",
};

// A real developer `worker/.dev.vars` carries these two. Left unchecked, the
// local ALLOWED_ORIGIN breaks CORS for the preview server and the real
// TURNSTILE_SECRET makes every online room creation fail `turnstileFailed`.
const CONFLICTING_WORKER_DEV_VARS = {
  ALLOWED_ORIGIN: "http://localhost:5173",
  TURNSTILE_SECRET: "developer-local-turnstile-secret",
  ONLINE_IDENTITY_SECRET: "developer-local-online-identity-secret",
};

const CONFLICTING_PUBLIC = {
  PUBLIC_SITE_ORIGIN: "https://contaminated-site.example",
  PUBLIC_WORKER_ORIGIN: "https://contaminated-worker.example",
};

const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    process.stdout.write(`  ✔ ${name}\n`);
    return;
  }
  failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
  process.stdout.write(`  ✘ ${name}\n`);
}

/** Runs a probe in a child process so its environment is fully controlled. */
function probe(source, env, cwd = webRoot) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    {
      cwd,
      encoding: "utf8",
      env: { ...env, SHAXDA_PROBE_MARKER: MARKER },
    },
  );

  if (result.status !== 0) {
    throw new Error(`Probe failed:\n${result.stdout}\n${result.stderr}`);
  }

  // Wrangler logs to stdout, so pick the marked line rather than parsing all of it.
  const line = result.stdout
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(MARKER));
  if (!line) throw new Error(`Probe produced no result:\n${result.stdout}`);
  return JSON.parse(line.slice(MARKER.length));
}

// `unstable_getVarsForDev` is the function that decides between `.dev.vars` and
// `envFiles`, so it is exactly the behaviour under test. It reads the real
// `web/wrangler.e2e.jsonc` for the expected values but resolves `.dev.vars` and
// `.env.e2e` relative to the throwaway fixture directory.
const BINDINGS_PROBE = `
import { unstable_getVarsForDev, unstable_readConfig } from "wrangler";
const config = unstable_readConfig({ config: process.env.SHAXDA_PROBE_CONFIG });
const envFiles = process.env.SHAXDA_PROBE_ENV_FILES
  ? [process.env.SHAXDA_PROBE_ENV_FILES]
  : undefined;
const resolved = unstable_getVarsForDev(
  process.env.SHAXDA_PROBE_DIR + "/" + process.env.SHAXDA_PROBE_CONFIG,
  envFiles,
  config.vars,
  undefined,
  true,
);
process.stdout.write(process.env.SHAXDA_PROBE_MARKER + JSON.stringify({
  vars: Object.fromEntries(
    Object.entries(resolved).map(([key, binding]) => [key, binding.value]),
  ),
  d1Bindings: (config.d1_databases ?? []).map((database) => database.binding),
}) + "\\n");
`;

const PUBLIC_ENV_PROBE = `
import { loadEnv } from "vite";
const loaded = loadEnv(process.env.SHAXDA_PROBE_MODE, process.env.SHAXDA_PROBE_DIR, ["PUBLIC_"]);
process.stdout.write(process.env.SHAXDA_PROBE_MARKER + JSON.stringify({
  PUBLIC_SITE_ORIGIN: loaded.PUBLIC_SITE_ORIGIN,
  PUBLIC_WORKER_ORIGIN: loaded.PUBLIC_WORKER_ORIGIN,
}) + "\\n");
`;

function writeEnvFile(path, values) {
  writeFileSync(
    path,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
  );
}

/**
 * A throwaway stand-in for a Worker directory: the tracked E2E fixture file plus
 * whichever conflicting files this case is testing. The probes never touch the
 * repository copies, so a developer's own `.dev.vars` is left completely alone.
 */
function makeFixture(root, { envFileFrom, devVars, dotEnv } = {}) {
  mkdirSync(root, { recursive: true });
  if (envFileFrom) {
    copyFileSync(envFileFrom, resolve(root, E2E_ENV_FILE));
  }

  if (devVars) writeEnvFile(resolve(root, ".dev.vars"), devVars);
  if (dotEnv) {
    writeEnvFile(resolve(root, ".env"), dotEnv);
    writeEnvFile(resolve(root, ".env.local"), dotEnv);
  }

  return root;
}

/**
 * Both Workers resolve dev vars through the same Wrangler code path, so both get
 * the same positive case and the same negative control.
 */
function checkDevVarsIsolation({
  label,
  slug,
  cwd,
  config,
  envFileFrom,
  conflicting,
}) {
  process.stdout.write(`\n▸ ${label}\n`);

  const base = { ...process.env, SHAXDA_PROBE_CONFIG: config };
  const pristine = makeFixture(resolve(temp, `${slug}-pristine`), {
    envFileFrom,
  });
  const expected = probe(
    BINDINGS_PROBE,
    { ...base, SHAXDA_PROBE_DIR: pristine },
    cwd,
  );

  const contaminated = makeFixture(resolve(temp, slug), {
    envFileFrom,
    devVars: conflicting,
  });

  const isolated = probe(
    BINDINGS_PROBE,
    {
      ...base,
      SHAXDA_PROBE_DIR: contaminated,
      SHAXDA_PROBE_ENV_FILES: E2E_ENV_FILE,
    },
    cwd,
  );

  // The env file also surfaces its own values as bindings, which is harmless, so
  // compare the fixtures the Wrangler config actually declares.
  check(
    `${config} values survive a conflicting .dev.vars`,
    Object.fromEntries(
      Object.keys(expected.vars).map((key) => [key, isolated.vars[key]]),
    ),
    expected.vars,
  );
  check(
    "no .dev.vars value reaches the E2E bindings",
    Object.entries(conflicting).filter(([, value]) =>
      Object.values(isolated.vars).includes(value),
    ),
    [],
  );

  // `.dev.vars` can only add plain-text bindings, so an entry named after a
  // resource binding would shadow it.
  for (const binding of isolated.d1Bindings) {
    check(
      `nothing shadows the ${binding} D1 binding`,
      binding in isolated.vars,
      false,
    );
  }

  const control = probe(
    BINDINGS_PROBE,
    { ...base, SHAXDA_PROBE_DIR: contaminated },
    cwd,
  );
  const [firstKey, firstValue] = Object.entries(conflicting)[0];
  check(
    `control: without an env file the .dev.vars ${firstKey} wins`,
    control.vars[firstKey],
    firstValue,
  );
}

const fixture = await readE2eFixture();
const temp = mkdtempSync(resolve(tmpdir(), "shaxda-e2e-isolation-"));

try {
  // ---- 1. a conflicting .dev.vars, on both Workers -----------------------
  checkDevVarsIsolation({
    label: "1/3a a conflicting web/.dev.vars",
    slug: "web-dev-vars",
    cwd: webRoot,
    config: "wrangler.e2e.jsonc",
    envFileFrom: resolve(webRoot, E2E_ENV_FILE),
    conflicting: CONFLICTING_DEV_VARS,
  });

  checkDevVarsIsolation({
    label: "1/3b a conflicting worker/.dev.vars",
    slug: "worker-dev-vars",
    cwd: workerRoot,
    config: "wrangler.toml",
    envFileFrom: resolve(workerRoot, E2E_ENV_FILE),
    conflicting: CONFLICTING_WORKER_DEV_VARS,
  });

  // ---- 2. a conflicting .env / .env.local --------------------------------
  process.stdout.write("\n▸ 2/3 a conflicting .env and .env.local\n");

  const envFixture = makeFixture(resolve(temp, "dot-env"), {
    envFileFrom: resolve(webRoot, E2E_ENV_FILE),
    dotEnv: CONFLICTING_PUBLIC,
  });
  const clean = { ...process.env };
  for (const key of Object.keys(CONFLICTING_PUBLIC)) delete clean[key];

  check(
    "--mode e2e resolves the tracked fixture values",
    probe(PUBLIC_ENV_PROBE, {
      ...clean,
      SHAXDA_PROBE_DIR: envFixture,
      SHAXDA_PROBE_MODE: "e2e",
    }),
    {
      PUBLIC_SITE_ORIGIN: fixture.PUBLIC_SITE_ORIGIN,
      PUBLIC_WORKER_ORIGIN: fixture.PUBLIC_WORKER_ORIGIN,
    },
  );
  check(
    "control: production mode takes the conflicting values",
    probe(PUBLIC_ENV_PROBE, {
      ...clean,
      SHAXDA_PROBE_DIR: envFixture,
      SHAXDA_PROBE_MODE: "production",
    }),
    CONFLICTING_PUBLIC,
  );

  // ---- 3. conflicting process-level PUBLIC_* ------------------------------
  process.stdout.write("\n▸ 3/3 conflicting process-level PUBLIC_* values\n");

  const exported = { ...clean, ...CONFLICTING_PUBLIC };

  check(
    "the explicit child environment resolves the tracked fixture values",
    probe(PUBLIC_ENV_PROBE, {
      ...buildE2eEnv(exported, fixture),
      SHAXDA_PROBE_DIR: envFixture,
      SHAXDA_PROBE_MODE: "e2e",
    }),
    {
      PUBLIC_SITE_ORIGIN: fixture.PUBLIC_SITE_ORIGIN,
      PUBLIC_WORKER_ORIGIN: fixture.PUBLIC_WORKER_ORIGIN,
    },
  );
  check(
    "control: an inherited environment leaks the exported values",
    probe(PUBLIC_ENV_PROBE, {
      ...exported,
      SHAXDA_PROBE_DIR: envFixture,
      SHAXDA_PROBE_MODE: "e2e",
    }),
    CONFLICTING_PUBLIC,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error("\nE2E isolation check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  "\nE2E isolation verified against all three contamination sources.",
);
