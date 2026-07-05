#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repo_root="$(CDPATH= cd -- "$script_dir/.." && pwd)"

if ! node --version >/dev/null 2>&1 && [ -f "$repo_root/.nvmrc" ]; then
  node_version="$(tr -d '[:space:]' < "$repo_root/.nvmrc")"
  node_version="${node_version#v}"
  nvm_node_bin="$HOME/.nvm/versions/node/v$node_version/bin"

  if [ -d "$nvm_node_bin" ]; then
    export PATH="$nvm_node_bin:$PATH"
  fi
fi

exec "$@"
