---
name: test-coverage-check
description: Verifies a task's tests cover the happy path, boundary cases, and error/blocked paths for every acceptance criterion. Use when writing or reviewing tests for a Meridian LMS dev task.
---

# Test Coverage Check

## What this skill provides
A checklist for judging whether a task's tests exercise every acceptance criterion across the three
paths that matter — happy, boundary, and error — for the Meridian LMS (Next.js 16 + Supabase, Vitest).

## Inputs
- The task's acceptance criteria (from the epic Dev Tasks CSV).
- The test file(s) for the task (`*.test.ts` / `*.test.tsx` / `tests/integration/**`).
- The source under test.

## What to do
For each acceptance criterion, confirm a test exists for each applicable path:
1. **Happy path** — the normal success case, asserted on the actual result (not just "no throw").
2. **Boundary cases** — edges implied by the criterion: empty input, min/max length, zero balance, first/last item, date equal vs before/after, a role that should see nothing (assert empty + no error).
3. **Error / blocked paths** — invalid input rejected with the right message; unauthorized access blocked (RLS empty read, or write error `42501`); domain rules enforced (e.g. non-@stratpoint.com rejected).

Then confirm coverage is *real*: assertions would fail on a regression (per-role anon clients for RLS;
non-empty + specific id on "returns records"; correct empty-vs-error distinction); every AC maps to ≥1 test.

## Output format
Per-AC table: `AC | Happy | Boundary | Error | Notes` (✅ / ❌ / n/a per cell), then:
- **Gaps**: ACs or paths with no test.
- **Verdict**: `COVERED` (every AC has happy + applicable boundary/error) or `GAPS` (list them).

## Constraints
- Does not judge style, performance, or lint.
- Does not run the tests — audits their presence and meaningfulness against the ACs.
- Not every AC has all three paths (a pure display AC may have only a happy path).