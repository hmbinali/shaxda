import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Every dedicated E2E state directory lives under this one root. */
export const testResultsRoot = resolve(repoRoot, "test-results");

/**
 * Resolves a dedicated E2E state directory and refuses anything that is not
 * strictly inside `test-results/`. Guards the recursive delete below: a
 * malformed or redirected path must never be able to reach the repository or a
 * developer's own Wrangler state.
 */
export function resolveE2eStatePath(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("An E2E state directory name is required.");
  }

  const target = resolve(testResultsRoot, name);

  if (target === testResultsRoot) {
    throw new Error(
      `Refusing to treat ${testResultsRoot} as an E2E state directory.`,
    );
  }

  const inside = relative(testResultsRoot, target);
  if (
    inside === "" ||
    inside.startsWith("..") ||
    resolve(testResultsRoot, inside) !== target
  ) {
    throw new Error(
      `Refusing an E2E state directory outside ${testResultsRoot}: ${target}`,
    );
  }

  // A symlink anywhere along the resolved path could redirect the delete out of
  // `test-results/`, so re-check containment against the real path of the
  // nearest existing ancestor.
  let ancestor = target;
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) {
    ancestor = dirname(ancestor);
  }

  if (existsSync(ancestor)) {
    const real = realpathSync(ancestor);
    const realRoot = existsSync(testResultsRoot)
      ? realpathSync(testResultsRoot)
      : testResultsRoot;
    const realInside = relative(realRoot, real);
    if (
      realInside.startsWith("..") ||
      (real !== realRoot && realInside === "")
    ) {
      throw new Error(
        `Refusing an E2E state directory that resolves outside ${realRoot}: ${real}`,
      );
    }
  }

  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error(`Refusing to delete the symlink ${target}.`);
  }

  return target;
}

/**
 * Removes a dedicated E2E state directory. Safe to call after an interrupted
 * run: the directory may be absent, partially written, or left over.
 */
export function cleanE2eStateDirectory(name) {
  const target = resolveE2eStatePath(name);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  return target;
}
