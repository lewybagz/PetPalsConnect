---
name: ultimate-planner
description: >-
  Plans features and refactors grounded in the current repository — maps routes, data
  models, APIs, and conventions before proposing work. Discovers and installs relevant
  Claude Code plugins/skills by domain (UI/UX, Stripe, Firebase, testing, Three.js
  game/arena, 2D characters/sprites/cosmetics, etc.) so implementation follows
  specialized workflows. Uses Context7 for library API docs and web search for
  live external facts when plans need current information. Use when the user asks
  to plan a feature, design an implementation, write a spec, break work into phases,
  choose architecture, scope an MVP, or says "how should we build", "plan this",
  "/plan", or "ultimate planner".
allowed-tools: Read, Glob, Grep, Bash, Write, WebSearch, WebFetch, Skill, TodoWrite, TaskCreate, TaskUpdate
---

# Ultimate Planner

Produce **actionable, codebase-grounded plans** — not generic advice. Every plan must cite real files, patterns, and constraints discovered in the repo.

This skill is **global**: it installs at `~/.claude/skills/ultimate-planner/` and runs against whatever repo you are currently in. It assumes nothing about the stack — it discovers it, every time, with `orient.sh`.

## Mindset

- **Solo-dev practical**: smallest correct scope, no enterprise theater, no paid tools without generous free tiers.
- **Reuse over reinvention**: extend existing components, configs, and API routes before adding parallel systems.
- **Frontend copy stays human**: plans for user-facing work must note "no technical jargon in UI copy" unless explicitly requested.
- **Plans are proposals**: flag assumptions and open questions; do not treat the plan as approved implementation.
- **Ponytail-aware**: if Ponytail is installed in this environment, scope phases toward the smallest correct implementation — don't plan speculative abstractions or premature scaffolding into v1.

## Planning workflow

Track progress with your todo tool (`TodoWrite` in the Claude Code CLI; `TaskCreate`/`TaskUpdate` where those are the tools). If neither exists, keep this checklist inline and tick it as you go:

```
Planning progress:
- [ ] 1. Clarify goal and constraints
- [ ] 2. Map codebase touchpoints (run orient.sh)
- [ ] 3. Check prior art in repo
- [ ] 3b. Discover & install relevant plugins/skills (by domain)
- [ ] 4. Research libraries via Context7 (if connected)
- [ ] 4b. Research live web facts via WebSearch/WebFetch (if needed)
- [ ] 5. Choose approach and scope phases
- [ ] 6. Write plan artifact
- [ ] 7. Sanity-check against constraints
```

### Step 1 — Clarify goal and constraints

Extract or confirm:

| Item            | Questions                                                     |
| --------------- | ------------------------------------------------------------- |
| **Outcome**     | What does "done" look like for the user or business?          |
| **Audience**    | Who uses this — public, admin, API consumer, internal tool?   |
| **Constraints** | Timeline, must-use stack, env/secrets, legal/compliance, a11y |
| **Non-goals**   | What to explicitly defer                                      |

If the request is ambiguous, ask **one** focused question — not a questionnaire.

### Step 2 — Map codebase touchpoints

**Always explore before planning.** Start with the orientation probe that ships with this skill — it is read-only and prints a bounded map of whatever repo you are standing in:

```bash
bash ~/.claude/skills/ultimate-planner/orient.sh
```

It reports, in one pass: repo root and branch, stack manifests, **convention docs** (`CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`), **verification commands** (every `package.json` script), CI config, entry points and routing, data layer, API surface, shared UI and design tokens, auth/middleware, test dirs, env templates, prior plans, and the skills/plugins available here.

Then read what it found. **The convention docs are not optional** — a repo's `CLAUDE.md` usually encodes hard rules (what must never import what, which model is the source of truth, where a rule is allowed to live exactly once) that will invalidate a plan written without them.

Follow up with targeted `Glob`/`Grep`/`Read` on whatever the feature actually touches:

1. **Routing** — app entry, nested routers, route registration points
2. **Pages & shells** — layout wrappers, route groups, standalone vs nested routes
3. **Data layer** — DB client, ORM, collections, shared types
4. **APIs** — REST handlers, serverless routes, webhooks, background jobs
5. **Content & config** — `content/`, `config/`, `.env.example`
6. **Shared UI** — component library, form patterns, design tokens
7. **Auth & access** — middleware, guards, RBAC, security rules
8. **Tests & QA** — test dirs, CI scripts, manual QA docs
9. **Game / sim / renderer** (when relevant) — physics sim, asset manifests, Three.js/render packages, sprite/character folders

**Per-repo reference:** if `.claude/ultimate-planner.md` exists in the repo, read it first — it is this repo's hand-written map (structure, stack, conventions, gotchas) and beats rediscovery. If it doesn't exist and this repo will be planned more than once, offer to write one at the end of the session. Keep it in the repo, not in this skill — the skill is global and must stay repo-agnostic.

Document findings as **file paths with one-line roles**, not vague area names.

### Step 3 — Check prior art

Before proposing new architecture:

- Read the plans directory `orient.sh` found (`.claude/plans/`, `docs/plans/`, …) for related plans, completed or in-flight
- Read module READMEs and architecture docs
- Grep for existing helpers, config keys, and route patterns to extend
- Note **grep-before-rename** risks when touching shared utilities

Prefer **extending a proven pattern** in the repo over introducing a parallel one.

### Step 3b — Discover & install relevant plugins/skills

**Every plan gets a domain tag pass.** Specialized skills and plugins encode pitfalls, checklists, and tool usage that generic planning misses. Match the work to skills **before** locking architecture — especially for UI/UX, billing, Firebase, security, testing, **Three.js game/arena**, and **2D characters/sprites/cosmetics**.

**Procedure:**

1. **Tag domains** — list every domain the plan touches (e.g. UI/UX + Stripe + API), from the user request and Step 2 touchpoints.
2. **Inventory what's available** — `orient.sh` already listed project, user-level, account-synced, and plugin skills. Cross-check the session's own available-skills list too. Note which domains already have coverage.
3. **Read planning-phase skills now** — for each domain with an installed skill, invoke it (`Skill`) or read its `SKILL.md` and fold its constraints into approach selection (accessibility rules from a UI skill, webhook idempotency from a payments skill).
4. **Search gaps** — if a domain has no local coverage, search with whatever discovery tool this environment exposes (`SearchSkills`, `SearchPlugins`, `SuggestSkills`, `SuggestPluginInstall`). **You cannot type `/plugin` yourself** — it is a UI command. If no search tool is available, ask: "no installed skill covers `<domain>` — want to search the marketplace via `/plugin`, or plan without it?"
   Cap: 3 discovery searches per planning session unless the user asks for a broader audit.
5. **Vet before installing** — prefer Anthropic-official or plugins with real adoption (documented stars/installs, active maintenance, published source). Be skeptical of unknown authors and very low adoption.
6. **Install missing skills** — for skill-only gaps (no hooks, no MCP, no shell access), install and note it in the plan. For anything carrying hooks, MCP servers, or elevated tool access, **ask first** — don't silently expand what has execution rights in this environment.
7. **Record for the artifact** — capture under **Skills for implementation**: domain tags; skills read during planning and the constraints they added; skills to invoke per phase; installs performed or left for the user.

**Examples:**

| Planning task | Domains | Read now (if installed) | Likely gap to search/ask about |
| --- | --- | --- | --- |
| Redesign dashboard sidebar | UI/UX | a frontend-design skill | usually already covered |
| Add Stripe Customer Portal | Stripe, API | — | search for a Stripe skill/plugin |
| Firestore rules for teams | Firebase, Security | firebase, security skills | none if both installed |
| E2E checkout smoke test | Testing, Stripe | Playwright MCP (if connected) | — |
| Vague "make it faster" | Performance | — | search for a perf-audit skill |
| Arena + isometric renderer | Three.js game, Performance | — | search for Three.js gameplay skills |
| Modular clothes/weapons sprites | 2D characters/sprites | — | search for sprite/character pipeline skills |

**Do not skip** this step for UI/UX work — check for and read a frontend-design skill before proposing layout, tokens, or component structure.

**Do not skip** for Three.js arena/gameplay or character/sprite cosmetics work — actively search before locking renderer or cosmetic architecture; generic planning misses the real pitfalls there.

### Step 4 — Context7 documentation research

When the plan involves a **library, framework API, or integration** you are not fully certain about, and Context7 MCP is connected, fetch current docs rather than relying on training data.

**Procedure** (max 3 resolve + 3 query calls per planning session):

1. Resolve the library ID for the official package name.
2. Query docs with a focused implementation question for this feature.
3. Fold API facts into the plan — recommended patterns, breaking changes, setup steps.

**If Context7 isn't connected**, note in open questions that library API facts weren't verified against live docs, and flag anything uncertain rather than presenting it as certain.

**Skip Context7** for a purely internal refactor with no external API surface.

### Step 4b — Web research (live external facts)

When the plan depends on **current information outside the repo** that Context7 can't answer — pricing, quotas, deprecations, release notes — use `WebSearch` and `WebFetch`. Don't guess from training data on anything time-sensitive.

**Activate when planning touches:**

- Third-party pricing, quotas, or deprecations not in the repo
- Integration setup that may have changed since training data (webhooks, OAuth, dashboard steps)
- Verifying a user assumption ("is X still free?", "does Y support Z?")
- External URLs the user cited that must be read for accurate scope

**Procedure** (max 3 search + 3 fetch calls per planning session):

1. `WebSearch` with 1–3 differently-phrased queries; include product names/versions/years.
2. `WebFetch` the 2–5 most authoritative results (official docs, vendor pages) before locking decisions on external services.
3. Fold findings into **Web research notes** with inline source URLs. Flag stale or conflicting sources in **Risks & open questions**. Never fabricate a URL or a fact you didn't retrieve.

**Skip web research** when the plan is purely internal and library surface is already covered confidently.

### Step 5 — Choose approach and scope phases

For each viable approach, briefly score:

| Criterion | Weight |
| --- | --- |
| Fits existing patterns | High |
| Lines/files touched | Medium |
| New dependencies | Medium (avoid unless justified) |
| Operational risk (auth, payments, webhooks) | High |
| Testability | Medium |

**Default phase order:**

1. **Foundation** — types, config, data model, API contract
2. **Core path** — happy path end-to-end
3. **Edge cases** — errors, empty states, mobile, a11y
4. **Polish** — SEO, analytics, copy, motion (if UI)
5. **Verify** — build, targeted tests, manual QA checklist

Each phase should be **independently mergeable** when possible.

### Step 6 — Write plan artifact

Save to the plans directory `orient.sh` found. If the repo has none, ask once: `.claude/plans/<slug>.plan.md` or `docs/plans/<slug>.plan.md`.

Required sections:

- Overview and goal
- Architecture decision (why this approach vs alternatives)
- Mermaid diagram when the flow has 3+ moving parts
- Implementation steps with **clickable file paths**
- Todo list (id + content + status) — verb-led, single-responsibility
- Env vars / dashboard setup prerequisites
- Test plan — **the exact commands `orient.sh` printed** from this repo's scripts and CI, plus manual smoke steps, plus where new tests live and what they cover
- Risks and open questions
- **Skills for implementation** (Step 3b) — domain tags, skills per phase, installs performed
- **Web research notes** (when Step 4b ran) — sourced facts with URLs

**Todo rules:**

- Verb-led, single responsibility, ≤ 1 session of work each
- Order by dependency
- First todo should be unblocking (config/schema before UI)

### Step 7 — Sanity-check

- [ ] Every new route/file references an existing registration point
- [ ] No duplicate systems (second auth flow, second config source, etc.)
- [ ] Nothing contradicts the repo's `CLAUDE.md`/`AGENTS.md` hard rules
- [ ] Security rules / RLS mentioned if the data model changes
- [ ] Webhook/email flows note idempotency and secrets handling
- [ ] Test plan uses this repo's real commands, not invented ones
- [ ] Scope matches solo-dev capacity — say so if it should split across sessions/PRs
- [ ] Step 3b complete — domain tags, skills read/installed, **Skills for implementation** in the artifact

## Output modes

| User intent | Deliver |
| --- | --- |
| "Plan X" | Full plan artifact (file) + short summary in chat |
| "Quick plan" / "outline" | Chat-only: goal, phases, key files, risks (no file write unless asked) |
| "Compare options" | Decision matrix in chat; recommend one; offer full plan on approval |
| "Update plan" | Read the existing plan file, diff against the current codebase, revise todos |

## Anti-patterns

- Generic stack advice without reading the repo
- Skipping `orient.sh` and guessing the layout
- Planning against a repo whose `CLAUDE.md` you never opened
- Planning UI/UX without checking for an installed frontend-design skill first (Step 3b)
- Planning arenas/game loops or character/sprite pipelines without searching for a matching specialized skill
- Skipping skill discovery for Stripe, Firebase, security, or game/sprite work when a matching skill likely exists
- Installing plugins blindly without checking source, adoption, and whether they grant hooks/shell/MCP access
- Introducing heavy new dependencies when the existing stack already covers the need
- Vague steps ("update the form") without file paths
- Skipping auth/rules for features touching user or client data
- Planning UI implementation details before confirming data flow
- More than 8 todos in v1 — split into a Phase 2 plan instead

## Files in this skill

- `orient.sh` — read-only repo orientation probe (Step 2). Safe to run anywhere; degrades gracefully outside a git repo.

## Additional resources

- Per-repo map (optional, create if reused): `.claude/ultimate-planner.md` **in the target repo**
- Plugin marketplace: the user runs `/plugin` (Discover tab); you use the environment's skill/plugin search tools
- Context7 MCP (if connected): live library docs
- `WebSearch` / `WebFetch`: live external facts
