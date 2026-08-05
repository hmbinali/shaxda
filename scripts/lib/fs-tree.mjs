import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

/**
 * Lists every regular file under `root`, as paths relative to `root`, sorted so
 * the result is stable across runs and platforms.
 */
export function listFiles(root) {
  const base = resolve(root);
  if (!existsSync(base)) return [];

  const files = [];
  const pending = [base];

  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile()) files.push(relative(base, path));
    }
  }

  return files.sort();
}

/**
 * Fingerprints a directory tree from path, size, and mtime. Used to prove the
 * E2E run left a developer's own Wrangler state untouched, so it must never
 * read or copy the contents of that state.
 */
export function fingerprintTree(root) {
  const base = resolve(root);
  if (!existsSync(base)) return { exists: false, files: 0, digest: null };

  const hash = createHash("sha256");
  const files = listFiles(base);

  for (const file of files) {
    const stats = statSync(resolve(base, file));
    hash.update(`${file}\0${stats.size}\0${stats.mtimeMs}\n`);
  }

  return { exists: true, files: files.length, digest: hash.digest("hex") };
}
