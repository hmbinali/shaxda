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

if ! node --version >/dev/null 2>&1 && [ -f .nvmrc ]; then
  node_version="$(tr -d '[:space:]' < .nvmrc)"
  node_version="\${node_version#v}"
  nvm_node_bin="$HOME/.nvm/versions/node/v$node_version/bin"

  if [ -d "$nvm_node_bin" ]; then
    export PATH="$nvm_node_bin:$PATH"
  fi
fi

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
