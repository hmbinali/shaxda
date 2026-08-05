import { readdir, readFile } from "node:fs/promises";
import { parseEnv } from "./lib/env-file.mjs";
const webRoot = new URL("../web/", import.meta.url);
const bundleRoot = new URL(".svelte-kit/cloudflare/", webRoot);
const fallbackOrigins = ["https://shaxda.example", "http://127.0.0.1:8787"];
const committedTestSecret = "shaxda-e2e-only-secret-48-characters-long-000000";
const committedOnlineIdentityTestSecret =
  "shaxda-online-identity-dev-test-secret-000000000001";

async function productionEnv() {
  const env = {};
  const files = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ];

  for (const name of files) {
    try {
      Object.assign(
        env,
        parseEnv(await readFile(new URL(name, webRoot), "utf8")),
      );
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  return { ...env, ...process.env };
}

async function bundleFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      url.pathname += "/";
      files.push(...(await bundleFiles(url)));
    } else if (entry.isFile()) {
      files.push(url);
    }
  }

  return files;
}

const env = await productionEnv();
const requiredOrigins = ["PUBLIC_SITE_ORIGIN", "PUBLIC_WORKER_ORIGIN"];
const invalidOrigins = requiredOrigins.filter(
  (name) => !env[name]?.trim().startsWith("https://"),
);

if (invalidOrigins.length > 0) {
  console.error(
    `Production bundle check requires HTTPS values for: ${invalidOrigins.join(", ")}`,
  );
  process.exit(1);
}

let files;
try {
  files = await bundleFiles(bundleRoot);
} catch (error) {
  if (error?.code === "ENOENT") {
    console.error("Production bundle is missing. Build @shaxda/web first.");
    process.exit(1);
  }
  throw error;
}

const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
const missingOrigins = requiredOrigins.filter((name) => {
  const expected = env[name].trim().replace(/\/+$/, "");
  return !contents.some((content) => content.includes(expected));
});
const presentFallbacks = fallbackOrigins.filter((fallback) =>
  contents.some((content) => content.includes(fallback)),
);
const forbiddenSecrets = [
  env.BETTER_AUTH_SECRET,
  env.GOOGLE_CLIENT_SECRET,
  env.ONLINE_IDENTITY_SECRET,
  env.ONLINE_IDENTITY_SECRET_PREVIOUS,
  committedTestSecret,
  committedOnlineIdentityTestSecret,
].filter((value) => typeof value === "string" && value.length > 0);
const exposedSecrets = forbiddenSecrets.filter((secret) =>
  contents.some((content) => content.includes(secret)),
);

if (exposedSecrets.length > 0) {
  console.error(
    "Production bundle contains an authentication or identity secret.",
  );
  process.exit(1);
}

if (missingOrigins.length > 0) {
  console.error(
    `Production bundle is missing expected values for: ${missingOrigins.join(", ")}`,
  );
  if (presentFallbacks.length > 0) {
    console.error(`Fallback literals found: ${presentFallbacks.join(", ")}`);
  }
  process.exit(1);
}

console.log(
  `Production bundle contains expected values for ${requiredOrigins.join(" and ")}.`,
);
if (presentFallbacks.length > 0) {
  console.log(
    `Informational: fallback literals remain in optimized code (${presentFallbacks.join(", ")}).`,
  );
}
