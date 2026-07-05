import { execFileSync } from "node:child_process";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const gitHooksPath = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
  encoding: "utf8",
}).trim();

const hooksDir = path.isAbsolute(gitHooksPath)
  ? gitHooksPath
  : path.resolve(repoRoot, gitHooksPath);

const hooks = {
  "pre-commit": "pnpm lint:staged",
  "pre-push": "pnpm check",
};

function hookBody(command) {
  return `#!/usr/bin/env sh
set -eu

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

${command}
`;
}

await mkdir(hooksDir, { recursive: true });

for (const [name, command] of Object.entries(hooks)) {
  const hookPath = path.join(hooksDir, name);
  await writeFile(hookPath, hookBody(command), "utf8");
  await chmod(hookPath, 0o755);
}

console.log(`Installed Git hooks in ${hooksDir}`);
