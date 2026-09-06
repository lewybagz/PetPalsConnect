#!/usr/bin/env bash
# Repo orientation probe for the ultimate-planner skill.
# Prints a bounded map of the repo you are planning in. Read-only.
# Usage: bash orient.sh [start-dir]
set -uo pipefail

START="${1:-$PWD}"
cd "$START" 2>/dev/null || { echo "no such dir: $START"; exit 1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
cd "$ROOT"

PRUNE='-path ./node_modules -prune -o -path ./.git -prune -o -path ./dist -prune -o -path ./build -prune -o -path ./.next -prune -o -path ./vendor -prune -o -path ./target -prune -o'

hdr() { printf '\n=== %s ===\n' "$1"; }
# run a command; print "(none)" when it produces nothing, so an empty section
# is visibly "nothing here" rather than a probe that silently failed.
some() { local out; out="$(cat)"; if [ -n "$out" ]; then printf '%s\n' "$out"; else echo "(none)"; fi; }
# find with the standard prunes; args are the match expression
f() { eval "find . $PRUNE \\( $1 \\) -print" 2>/dev/null | sed 's|^\./||' | sort; }

hdr "REPO"
echo "root:   $ROOT"
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(not a git repo)')"
echo "head:   $(git log -1 --format='%h %s' 2>/dev/null | cut -c1-100)"

hdr "STACK (manifests)"
f "-name package.json -o -name go.mod -o -name pyproject.toml -o -name requirements.txt -o -name Cargo.toml -o -name Gemfile -o -name pom.xml -o -name build.gradle -o -name composer.json" | head -20

hdr "CONVENTION DOCS (read these before planning)"
f "-name CLAUDE.md -o -name AGENTS.md -o -name CONTRIBUTING.md -o -name .cursorrules -o -name ARCHITECTURE.md" | head -15

hdr "VERIFICATION COMMANDS (package.json scripts)"
for p in $(f "-name package.json" | head -8); do
  echo "--- $p"
  node -e 'try{const s=require(process.argv[1]).scripts||{};for(const k of Object.keys(s))console.log("   "+k+": "+s[k])}catch(e){}' "$ROOT/$p" 2>/dev/null | head -25
done

hdr "CI"
f "-path '*/.github/workflows/*.yml' -o -path '*/.github/workflows/*.yaml' -o -name '.gitlab-ci.yml' -o -name 'Makefile'" | head -10

hdr "ENTRY POINTS / ROUTING"
f "-name 'App.tsx' -o -name 'App.jsx' -o -name 'App.js' -o -name 'main.tsx' -o -name 'main.ts' -o -name 'index.tsx' -o -name 'server.js' -o -name 'Server.js' -o -name 'app.py' -o -name 'main.go'" | head -15
f "-type d \\( -name routes -o -name router -o -name navigation -o -name pages -o -name app \\)" | head -15

hdr "DATA LAYER (models / schema / migrations)"
f "-type d \\( -name models -o -name migrations -o -name prisma -o -name entities -o -name schemas \\)" | head -15
f "-name 'schema.prisma' -o -name '*.sql' -o -name 'firestore.rules' -o -name 'storage.rules'" | head -10

hdr "API SURFACE"
f "-type d \\( -name api -o -name controllers -o -name handlers -o -name webhooks -o -name functions \\)" | head -15

hdr "SHARED UI / DESIGN TOKENS"
f "-type d \\( -name components -o -name ui -o -name styles -o -name theme \\)" | head -12
f "-name 'tokens.*' -o -name 'tailwind.config.*' -o -name 'theme.*'" | head -8

hdr "AUTH / ACCESS"
f "-type d \\( -name middleware -o -name auth -o -name guards \\)" | head -10

hdr "TESTS"
f "-type d \\( -name test -o -name tests -o -name __tests__ -o -name e2e \\)" | head -12

hdr "CONFIG / ENV TEMPLATES"
f "-name '.env.example' -o -name '.env.sample' -o -name '.env.template'" | head -8

hdr "PRIOR PLANS (extend, do not duplicate)"
for d in .claude/plans docs/plans plans .plans; do
  [ -d "$d" ] && { echo "--- $d"; ls -1 "$d" | head -20; }
done
[ -d .claude/plans ] || [ -d docs/plans ] || [ -d plans ] || echo "(none found - ask where plans should live)"

hdr "AVAILABLE SKILLS (project, walking up from \$PWD)"
d="$START"
while :; do
  grep -Hm1 '^description:' "$d"/.claude/skills/*/SKILL.md 2>/dev/null | cut -c1-220
  { [ -e "$d/.git" ] || [ "$d" = / ]; } && break
  d="$(dirname "$d")"
done | some
echo "--- user-level (~/.claude/skills)"
grep -Hm1 '^description:' "$HOME"/.claude/skills/*/SKILL.md 2>/dev/null | cut -c1-220 | some
echo "--- account-synced"
find "$HOME/.claude/skills/synced" -maxdepth 3 -name SKILL.md 2>/dev/null \
  | sed 's|.*/\([^/]*\)/SKILL.md|  \1|' | sort | head -40 | some
echo "--- plugins"
find "$HOME/.claude/plugins" -maxdepth 4 -name 'plugin.json' -o -maxdepth 4 -name '.claude-plugin' 2>/dev/null | head -10 | some

hdr "DONE"
echo "Next: read the convention docs listed above before proposing anything."
