import { spawn } from "node:child_process";

/**
 * Spawns a long-running server and forwards termination to it.
 *
 * Deliberately *not* detached. Playwright starts each `webServer` as a process
 * group leader and shuts it down by signalling the whole group, so leaving the
 * child in that same group is what lets one kill reap the launcher, `pnpm`, and
 * the `vite`/`wrangler`/`workerd` processes beneath it. Detaching gives the
 * child its own group, Playwright's group kill misses it, and the suite hangs
 * after the last test with the servers still bound to their ports.
 */
export function spawnGroup(command, args, options = {}) {
  const child = spawn(command, args, options);

  const stop = (signal) => {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      stop(signal);
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  }

  process.on("exit", () => stop("SIGKILL"));
  child.on("exit", (code) => process.exit(code ?? 0));

  return child;
}
