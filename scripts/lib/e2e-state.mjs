import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Every dedicated E2E state directory lives under this one root. */
export const testResultsRoot = resolve(repoRoot, "test-results");

/**
 * Resolves a dedicated E2E state directory. Guards the recursive delete below,
 * so it takes a plain directory name and refuses anything that could reach
 * outside `test-results/` — no separators, no traversal, no absolute paths, no
 * symlink standing in for the directory.
 */
export function resolveE2eStatePath(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("An E2E state directory name is required.");
  }

  if (/[/\\]/.test(name) || name === "." || name === "..") {
    throw new Error(
      `An E2E state directory must be a plain name inside ${testResultsRoot}, got: ${name}`,
    );
  }

  const target = resolve(testResultsRoot, name);
  const inside = relative(testResultsRoot, target);

  if (inside !== name) {
    throw new Error(
      `Refusing an E2E state directory outside ${testResultsRoot}: ${target}`,
    );
  }

  // A symlink here would redirect the delete at whatever it points to.
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error(`Refusing to delete the symlink ${target}.`);
  }

  // If the directory already exists, confirm it really does live under
  // `test-results/` rather than being reached through a redirected ancestor.
  if (existsSync(target) && existsSync(testResultsRoot)) {
    const real = realpathSync(target);
    const realRoot = realpathSync(testResultsRoot);
    if (relative(realRoot, real) !== name) {
      throw new Error(
        `Refusing an E2E state directory that resolves outside ${realRoot}: ${real}`,
      );
    }
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
