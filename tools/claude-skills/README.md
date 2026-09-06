# Global Claude Code skills

Skills kept here are **global**, not repo-specific: they are meant to live at
`~/.claude/skills/<name>/` and run against whatever repository you are in.

They are stored in this repo only because it is a durable, version-controlled
home for them — nothing here is coupled to PetPalsConnect. The directory is
deliberately **not** `.claude/skills/`, which is the path Claude Code
auto-discovers for project-scoped skills; keeping them out of it prevents them
loading for this project alone.

## Install

```bash
bash tools/claude-skills/install.sh
```

Copies every skill directory here into `~/.claude/skills/`, overwriting an
existing copy of the same name. Restart Claude Code afterwards.

## Skills

| Skill | What it does |
| --- | --- |
| `ultimate-planner` | Codebase-grounded feature and refactor planning. Ships `orient.sh`, a read-only probe that maps the current repo (stack, conventions, routes, data layer, API surface, tests, verification commands, prior plans, available skills) before any plan is written. |

## Alternative: account-level sync

To have a skill follow your account across machines and Claude Code on the web
instead, add it under Settings → Capabilities on claude.ai. Skills synced that
way land in `~/.claude/skills/synced/` and are managed by Claude, not by this
script.
