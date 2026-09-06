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

failed=0

for dir in "$SRC"/*/; do
  name="$(basename "$dir")"
  rm -rf "${DEST:?}/$name"
  cp -R "$dir" "$DEST/$name"
  chmod +x "$DEST/$name"/*.sh 2>/dev/null || true

  # Strip CR, in case this tree was checked out with CRLF. Claude Code matches
  # the frontmatter block on \n and bash chokes on \r.
  find "$DEST/$name" -type f \( -name '*.md' -o -name '*.sh' \) -exec \
    sed -i 's/\r$//' {} +

  # Verify rather than printing "installed" and hoping. A BOM, a CR, or a
  # frontmatter block that does not open on line 1 all make Claude Code skip
  # the skill silently, which is the failure this is here to catch.
  md="$DEST/$name/SKILL.md"
  why=""
  if [ ! -f "$md" ]; then why="no SKILL.md"
  elif [ "$(head -c3 "$md")" = "$(printf '\357\273\277')" ]; then why="file starts with a UTF-8 BOM"
  elif grep -q $'\r' "$md"; then why="file still contains CR"
  elif [ "$(head -n1 "$md")" != "---" ]; then why="line 1 is not '---'"
  elif ! grep -q '^name: [^[:space:]]' "$md"; then why="no single-line name: field"
  elif ! grep -q '^description: [^[:space:]]' "$md"; then why="no single-line description: field"
  elif grep -qE '^(description|name): *[>|]' "$md"; then why="frontmatter uses a YAML block scalar (>- or |); it must be on one line"
  fi

  if [ -z "$why" ]; then
    echo "installed + verified: $DEST/$name"
  else
    echo "installed BUT UNUSABLE ($why): $DEST/$name" >&2
    failed=1
  fi
done

echo
if [ "$failed" -ne 0 ]; then
  echo "At least one skill will not load. See the reason above." >&2
  exit 1
fi
echo "Restart Claude Code (or start a new session) to pick them up."
