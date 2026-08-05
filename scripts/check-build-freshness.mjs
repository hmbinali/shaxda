// Proves the Turbo build outputs are complete and that a rebuild never serves a
// stale bundle: clean build -> controlled source change -> revert.
//
// This mutates a tracked source file while it runs and restores it in a
// `finally`, so it is run on demand rather than from `pnpm check`.
//
// Known Turbo behaviour this pins down: a cache *restore* extracts the cached
// outputs over whatever is already on disk without pruning, so files from an
// abandoned build survive as unreferenced orphans. Everything the bundle
// actually references is still restored byte for byte, and the deploy scripts
// call `vite build` directly (the adapter rimrafs its output directory), so a
// deployed bundle never contains them. Step 4 proves that last point.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { repoRoot } from "./lib/e2e-state.mjs";
import { listFiles } from "./lib/fs-tree.mjs";

const target = resolve(repoRoot, "packages/i18n/src/index.ts");
const anchor = "laguna diyaariyay ciyaar marti ah.";
const bundleRoot = resolve(repoRoot, "web/.svelte-kit/cloudflare");
const sentinel = `shaxda-build-freshness-${randomUUID()}`;

function run(label, command, args, options = {}) {
  process.stdout.write(`\n▸ ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`\`${command} ${args.join(" ")}\` failed during: ${label}`);
  }
}

function digestOf(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(resolve(bundleRoot, file)));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function snapshot() {
  const files = listFiles(bundleRoot);
  if (files.length === 0) {
    throw new Error(`No build output found at ${bundleRoot}.`);
  }
  return { files, digest: digestOf(files) };
}

function contains(files, needle) {
  return files.filter((file) =>
    readFileSync(resolve(bundleRoot, file), "latin1").includes(needle),
  );
}

/**
 * Hash-independent orphan detector. Every route node is emitted exactly once as
 * `_app/immutable/nodes/<index>.<hash>.js`, so a duplicated index means a file
 * from an earlier build survived. Content hashes are not stable between
 * independent builds of identical source, so the file names themselves cannot be
 * compared across runs.
 */
function duplicatedNodes(files) {
  const byIndex = new Map();
  for (const file of files) {
    const match = file.match(/^_app\/immutable\/nodes\/(\d+)\.[^/]+\.js$/);
    if (!match) continue;
    byIndex.set(match[1], (byIndex.get(match[1]) ?? 0) + 1);
  }
  return [...byIndex.entries()].filter(([, count]) => count > 1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  process.stdout.write(`  ✔ ${message}\n`);
}

const original = readFileSync(target, "utf8");

if (!original.includes(anchor)) {
  throw new Error(
    `check-build-freshness expects the anchor string in ${target}. Update the anchor.`,
  );
}

function restore() {
  if (readFileSync(target, "utf8") !== original) {
    writeFileSync(target, original);
    process.stdout.write(`\nRestored ${target}.\n`);
  }
}

// `finally` does not run when the process is signalled, so restore there too.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}

try {
  rmSync(resolve(repoRoot, "web/.svelte-kit"), {
    recursive: true,
    force: true,
  });
  run("1/4 clean build", "pnpm", ["build"]);
  const clean = snapshot();
  assert(
    contains(clean.files, sentinel).length === 0,
    "a clean build succeeds and carries no sentinel",
  );

  writeFileSync(target, original.replace(anchor, `${anchor} ${sentinel}`));
  run("2/4 rebuild after a controlled source change", "pnpm", ["build"]);
  const changed = snapshot();
  assert(
    contains(changed.files, sentinel).length > 0,
    "the source change reaches the emitted Cloudflare bundle",
  );
  assert(
    changed.digest !== clean.digest,
    "the emitted bundle differs from the clean build",
  );

  writeFileSync(target, original);
  run("3/4 rebuild after reverting the change", "pnpm", ["build"]);
  const restored = listFiles(bundleRoot);
  assert(
    clean.files.every((file) => restored.includes(file)),
    "every artifact the clean build produced is restored",
  );
  assert(
    digestOf(clean.files) === clean.digest,
    "each restored artifact matches the clean build byte for byte",
  );
  assert(
    contains(clean.files, sentinel).length === 0,
    "no restored artifact carries the reverted change",
  );

  const orphans = restored.filter((file) => !clean.files.includes(file));
  const sentinelOrphans = contains(orphans, sentinel);
  process.stdout.write(
    `  · Turbo's cache restore left ${orphans.length} unreferenced orphan(s)` +
      `, ${sentinelOrphans.length} of them from the abandoned build\n`,
  );

  run("4/4 direct build, the path the deploy scripts take", "pnpm", [
    "--filter",
    "@shaxda/web",
    "build",
  ]);
  const direct = snapshot();
  assert(
    duplicatedNodes(direct.files).length === 0,
    "a direct `vite build` prunes the orphans, so a deploy never ships them",
  );
  assert(
    direct.files.length === clean.files.length,
    "the deployable bundle has the same artifact count as a from-scratch build",
  );
  assert(
    contains(direct.files, sentinel).length === 0,
    "the deployable bundle carries no trace of the reverted change",
  );

  process.stdout.write(
    `\nBuild freshness verified across ${clean.files.length} bundle files.\n`,
  );
} finally {
  // Always restore the working tree, including on an assertion failure part-way
  // through a build.
  restore();
}
