---
name: dev-task-generation
description: EPAV prompt set for generating one epic's Dev Tasks CSV with @task-planner (Tech Lead, Module 4).
role: tech-lead
---

# Dev Task Generation (per epic)

## Purpose
Generate one epic's Dev Tasks CSV from the PRD + Architecture + that epic's ADR via @task-planner,
through Evaluate → Plan → Apply → Validate. One epic per fresh session.

## Project conventions (LMS)
- Output: docs/dev-tasks/epic-N-<slug>-tasks.csv (one CSV per epic).
- Each CSV opens with an Epic row (issue_type: Epic, estimate 0, epic_link EPIC-N), then atomic 1–8h tasks.
- Task IDs are CONTINUOUS across epics (epic-0 = TASK-001…009, epic-1 = TASK-010…016; epic-2 starts at TASK-017).
- 15-col schema: task_id,issue_type,summary,user_story,description,acceptance_criteria,priority,estimate,story_points,role,assignee,status,labels,epic_link,dependencies
- Testing tasks are developer-owned (role Backend/Frontend/Fullstack, never QA).

## Epic → ADR → filename map
| Epic | ADR (docs/arch-docs/) | Output filename |
|---|---|---|
| 2 | ADR-LMS-MC-E002-Leave-Request-Self-Service.md | epic-2-leave-request-self-service-tasks.csv |
| 3 | ADR-LMS-MC-E003-Manager-Approval-Workflow.md | epic-3-manager-approval-workflow-tasks.csv |
| 4 | ADR-LMS-MC-E004-Leave-Balance-Entitlement-Management.md | epic-4-leave-balance-entitlement-tasks.csv |
| 5 | ADR-LMS-MC-E005-HR-Administration.md | epic-5-hr-administration-tasks.csv |
| 6 | ADR-LMS-MC-E006-Notifications.md | epic-6-notifications-tasks.csv |
| 7 | ADR-LMS-MC-E007-Audit-Log-Data-Integrity.md | epic-7-audit-log-data-integrity-tasks.csv |
| 8 | ADR-LMS-MC-E008-Reporting.md | epic-8-reporting-tasks.csv |

## Setup (do yourself, per epic — don't paste)
1. Fresh session; use @task-planner.
2. Load: the PRD's Epic-N section, docs/arch-docs/ARCH-LMS-MC-v1.0.md, that epic's ADR, and the previous epic's CSV.
3. Note the starting task_id = (last TASK-ID of the previous epic) + 1.

## Prompts (send one at a time)

[EVALUATE]
Use @task-planner. I'm generating Dev Tasks for Epic <N> — <name>. Analyze the PRD Epic <N> section
(FR-<PREFIX>-*), the Architecture Document, and ADR-LMS-MC-E0<NN>, and list: (1) features/user stories
needing tasks; (2) Architecture components/ADR decisions each relies on; (3) earlier-epic tasks this
depends on (real TASK-IDs); (4) any dependency on a not-yet-generated later epic. Don't generate yet.

[PLAN]
Plan the breakdown: Epic row then atomic 1–8h tasks; each references its FR + ARCH/ADR section; explicit
dependencies in buildable order; for later-epic dependencies reference at feature level (EPIC-M FR-XXX),
don't invent TASK-IDs. Confirm no task needs a decision not yet made.

[APPLY]
Generate the CSV in the exact 15-column schema, numbering from TASK-<start-id>, leading with the Epic row.
Match the depth/file-path specificity of the prior epic CSV. Save to docs/dev-tasks/epic-<N>-<slug>-tasks.csv.

[VALIDATE]
Check every row vs the Module 4 Dev Tasks bar: atomic + hour-estimated, unique ID, FR + ARCH/ADR reference,
every feature covered, explicit dependencies to real TASK-IDs, no undecided-decision references. Trace each
task → user story → BRD requirement. List every FAIL, then fix.

## Notes
- Fresh session per epic (context poisoning). APPLY is short because the agent + loaded files carry Role/Format/Constraints.