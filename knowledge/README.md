# Knowledge Directory — Meridian LMS

Version-controlled AI assets for this project: rules, agents, skills, prompts, patterns, retros.
Committed to the repo so every session and every future contributor inherits them (Modules 6–7).

## Structure
knowledge/
├── README.md      # this file
├── rules/         # always-on coding standards + rationale (mirrored in AGENTS.md)
├── agents/dev/    # named, scoped AI roles (per-role subfolder)
├── skills/        # on-demand domain expertise (SKILL.md per skill)
├── prompts/       # reusable prompt templates, per role (dev/, tech-lead/)
├── patterns/      # multi-step workflows with load/run instructions
├── retros/        # dated epic/project retrospectives
└── templates/     # reusable document templates

## Contents
- rules/coding-standards.md — coding rules + rationale (e.g. quote Postgres CHECK literals).
- agents/dev/unit-test-reviewer.md — reviews test quality (AC coverage, mocking, naming). *(pending)*
- skills/test-coverage-check/ — verifies happy/boundary/error paths per AC. *(pending)*
- prompts/dev/migration-task.md — E→P→A→V for a schema migration (example: TASK-008).
- prompts/tech-lead/dev-task-generation.md — E→P→A→V for generating one epic's Dev Tasks CSV.
- patterns/verify-migration-in-container.md — verify a migration/seed in a throwaway postgres:16 container.
- retros/2026-08-03.md — Epic 0 findings. *(Epic 1 retro pending)*

## Conventions
- Assets are portable markdown (frontmatter + body); wire into OpenCode via .opencode/agents/ and .opencode/skills/.
- docs/ (BRD, PRD, arch-docs, dev-tasks) lives BESIDE the repo and is NOT part of knowledge/.
- Contribute back: when a prompt, rule, or pattern proves reusable, add it here.