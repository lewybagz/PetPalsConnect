# Global Claude Code skills

Skills kept here are **global**, not repo-specific: they are meant to live at
`~/.claude/skills/<name>/` and run against whatever repository you are in.

They are stored in this repo only because it is a durable, version-controlled
home for them — nothing here is coupled to PetPalsConnect. The directory is
deliberately **not** `.claude/skills/`, which is the path Claude Code
auto-discovers for project-scoped skills; keeping them out of it prevents them
loading for this project alone.

## Install

Run from the **repository root**, not from your home directory — the paths below
are relative to the repo.

**Windows (PowerShell):**

```powershell
.\tools\claude-skills\install.ps1
```

**macOS / Linux:**

```bash
bash tools/claude-skills/install.sh
```

Both copy every skill directory here into `~/.claude/skills/` (on Windows,
`%USERPROFILE%\.claude\skills`), overwriting an existing copy of the same name.
Restart Claude Code afterwards.

Set `CLAUDE_SKILLS_DIR` to install somewhere else.

Both installers **verify** what they wrote and exit non-zero if it will not
load. A skill Claude Code cannot parse is skipped in silence — no error, it
simply never appears — so the checks cover the three ways that happens: a
UTF-8 BOM, a stray CR, and a frontmatter block that is not `---` on line 1
with single-line `name:` and `description:` fields. A YAML block scalar
(`description: >-`) is valid YAML and still will not load; it is rejected too.

**Do not run `install.sh` under WSL bash for a Windows install of Claude Code.**
`$HOME` there is the Linux home directory, so the skill would land somewhere
Windows Claude Code never reads while the script reports success. The script
detects WSL and refuses unless `CLAUDE_SKILLS_DIR` says which one you meant.

## Skills

| Skill | What it does |
| --- | --- |
| `ultimate-planner` | Codebase-grounded feature and refactor planning. Ships `orient.sh`, a read-only probe that maps the current repo (stack, conventions, routes, data layer, API surface, tests, verification commands, prior plans, available skills) before any plan is written. |

## Alternative: account-level sync

To have a skill follow your account across machines and Claude Code on the web
instead, add it under Settings → Capabilities on claude.ai. Skills synced that
way land in `~/.claude/skills/synced/` and are managed by Claude, not by this
script.
