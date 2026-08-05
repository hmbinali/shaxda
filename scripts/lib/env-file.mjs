import { readFile } from "node:fs/promises";

/**
 * Parses a dotenv-style file. Deliberately minimal and shared by the E2E
 * launchers and the bundle checks so they all agree on what a fixture file
 * means.
 */
export function parseEnv(contents) {
  const env = {};

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/,
    );
    if (!match) continue;

    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    env[match[1]] = value;
  }

  return env;
}

/**
 * Reads and parses an env file. Returns `undefined` when the file is absent so
 * callers can treat an optional untracked file as "nothing to check". Never
 * logs the contents.
 */
export async function readEnvFile(url) {
  try {
    return parseEnv(await readFile(url, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}
