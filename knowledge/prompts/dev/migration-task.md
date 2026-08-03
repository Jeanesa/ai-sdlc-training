# Prompt Set — Database Schema Migration Task (EVAP)

Four-phase prompt set (Evaluate → Plan → Apply → Validate) for implementing a versioned
database migration. Built and proven on **TASK-008** (initial schema, epic-0).

## Files to load first

- Architecture: `docs/arch-docs/ARCH-LMS-MC-v1.0.md` (and the relevant `ADR-LMS-MC-E###-*.md`
  from `docs/arch-docs/` — for TASK-008 that was `ADR-LMS-MC-E007-Audit-Log-Data-Integrity.md`)
- Task spec: the epic CSV, e.g. `docs/dev-tasks/epic-0-project-setup-tasks.csv`
  (parse the quoted fields with a proper CSV reader — naive comma-split breaks on embedded DDL)
- PRD Core Data Entities: `docs/prd/PRD-LMS-MC-v1.0.md` §5 (the ARCH model is "all entities are
  defined in PRD Section 5" — cross-check both)
- Agent conventions: `AGENTS.md` (the app repo's, e.g. `app-repo/AGENTS.md`)

## E — Evaluate (no writing)

> Load the arch doc, the epic CSV, and AGENTS.md. I'm implementing <TASK-ID>.
> First confirm the current DB state, then help me understand:
> - What tables/objects exist now?
> - Do <TASK-ID>'s tables + columns + constraints + indexes match the ARCH data model and the
>   PRD Core Data Entities? Flag any discrepancy before I build.
> - What could go wrong: CHECK-constraint syntax, FK/table order, index names, which tables get
>   deleted_at, which tables must NOT have it.
> Don't write the migration yet.

## P — Plan (no SQL yet)

> If EVALUATE surfaced bugs or discrepancies, bake them into the plan — and don't copy the CSV
> DDL verbatim if it has issues (task specs sometimes ship unquoted CHECK literals or other bugs).
> MUST FIX: <fixes found in E, e.g. quote CHECK literals, add PK defaults>.  (Omit if none.)
> DECISIONS TO APPLY: <reviewer decisions, e.g. deleted_at on X, keep column Y as TEXT with a
> comment, indexes to keep/add>.  (Omit if EVALUATE found nothing to decide.)

## A — Apply

> [APPLY] Plan approved. Implement <TASK-ID>.
> Create <migration-filename> with the full DDL. Follow AGENTS.md. Full file content — no diffs.

## V — Validate (against acceptance criteria, evidence per PASS/FAIL)

> [VALIDATE] The migration applied cleanly to <env> via supabase db push.
> Review <TASK-ID> against its acceptance criteria one by one (PASS/FAIL with evidence),
> verifying BOTH the migration file AND the live schema:
> - <each AC, e.g. tables/columns/NOT NULL, CHECKs, UNIQUEs, indexes, deleted_at placement, FKs>
> List every FAIL. If everything passes, confirm <TASK-ID> is Done.

## TASK-008 — real worked example

- **Task**: create `/supabase/migrations/20260519000001_initial_schema.sql` — five tables
  (`profiles`, `leaves`, `leave_balances`, `leave_types`, `audit_log`), constraints,  9 spec indexes (10 after adding the conflict index).

**E — evaluate output (abridged):** DB empty (all five tables HTTP 404 via PostgREST; no
`supabase db push` run yet). Found: unquoted CHECK literals in the CSV spec (syntax bug),
`leaves.leave_type`/`leave_balances.leave_type` marked FK in ARCH ER but plain TEXT in the task,
`leave_balances` missing `deleted_at` vs FR-DATA-001, redundant indexes, and `audit_log.record_id`
correctly plain UUID (polymorphic, no FK). Decision: don't build yet.

**P — plan (approved):** fix quotes; add `DEFAULT gen_random_uuid()` to the four non-profiles
PKs; add `leave_balances.deleted_at`; keep `leave_type` TEXT with a comment flagging the ARCH
discrepancy (no silent FK); keep all 9 indexes + add `leaves(employee_id, start_date)`; create
order `profiles → leave_types → leaves → leave_balances → audit_log`; single file.

**A — apply:** wrote the 71-line migration with the fixes and both comments (leave_type FK
discrepancy; record_id polymorphic). No lint/typecheck applicable; no CLI to run.

**V — validate output (abridged):** live OpenAPI matched all 42 columns/types/NOT NULL; a
throwaway `postgres:16` container introspection confirmed the 2 CHECKs, 3 UNIQUEs, 4 FKs (no FK
on `record_id` or `leave_type`), and all 10 indexes; rolled-back behavioral probes rejected
bad role/status/duplicates/FK-violations and accepted bogus `leave_type`/`record_id`. All 10 ACs
PASS; TASK-008 Done. Out-of-scope finding logged: live tables had no grants (403 on SELECT) —
RLS/grants to be added in the epic-1 access-control task.

## Important note

The "migration applies cleanly" acceptance criteria (e.g. AC-9/10: local emulator + staging via
CI/CD) are **verified by the developer** running `supabase db push`. The Supabase CLI is **not
available inside the session** (no `supabase` binary, no `psql`, no `SUPABASE_ACCESS_TOKEN`).
The agent's live verification relies on the PostgREST REST API (service-role key) and local
Postgres introspection — see `knowledge/patterns/verify-migration-in-container.md`.
