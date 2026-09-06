#!/usr/bin/env bash
# Install the skills in this directory into ~/.claude/skills/ (user-global scope).
#
# These are GLOBAL skills that happen to be version-controlled here. They are
# deliberately NOT under .claude/skills/, so they do not auto-load as
# repo-scoped skills for this project only.
#
#   bash tools/claude-skills/install.sh
#
# On Windows use install.ps1 instead. Override the destination with
# CLAUDE_SKILLS_DIR if your config lives somewhere else.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

# Under WSL, $HOME is the Linux home - not the Windows profile a Windows install
# of Claude Code reads. Installing there would report success and put the skill
# somewhere nothing looks, so refuse unless the destination was chosen on purpose.
if [ -z "${CLAUDE_SKILLS_DIR:-}" ] && grep -qi microsoft /proc/version 2>/dev/null; then
  echo "This looks like WSL, so \$HOME ($HOME) is the Linux home directory." >&2
  echo "A Windows install of Claude Code reads skills from your Windows profile" >&2
  echo "instead, and this script cannot tell which one you mean." >&2
  echo >&2
  echo "  Windows Claude Code:  run tools\\claude-skills\\install.ps1 from PowerShell" >&2
  echo "  Claude Code in WSL:   CLAUDE_SKILLS_DIR=\"\$HOME/.claude/skills\" bash \"\$0\"" >&2
  exit 1
fi

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
