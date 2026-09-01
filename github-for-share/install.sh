#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
NAME="github-for-share"

copy_to() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -R "$ROOT/." "$dest/"
  echo "installed $dest"
}

copy_to "${HOME}/.cursor/skills/${NAME}"
copy_to "${HOME}/.agents/skills/${NAME}"
copy_to "${HOME}/.codex/skills/${NAME}"
copy_to "${HOME}/.claude/skills/${NAME}"

echo
echo "已安装为 user-level skill。新开一个 Agent 对话后即可调用 github-for-share。"
