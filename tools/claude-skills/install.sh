#!/usr/bin/env bash
# Install the skills in this directory into ~/.claude/skills/ (user-global scope).
#
# These are GLOBAL skills that happen to be version-controlled here. They are
# deliberately NOT under .claude/skills/, so they do not auto-load as
# repo-scoped skills for this project only.
#
#   bash tools/claude-skills/install.sh
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.claude/skills"
mkdir -p "$DEST"

for dir in "$SRC"/*/; do
  name="$(basename "$dir")"
  rm -rf "${DEST:?}/$name"
  cp -R "$dir" "$DEST/$name"
  chmod +x "$DEST/$name"/*.sh 2>/dev/null || true
  echo "installed: $DEST/$name"
done

echo
echo "Restart Claude Code (or start a new session) to pick them up."
