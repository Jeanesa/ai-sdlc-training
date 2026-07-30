# ADR-LMS-MC-E008: Generate Reports via Server-Side PostgreSQL Aggregation Rather Than Application-Layer Data Processing

| Field | Value |
|---|---|
| **Project** | Leave Management System (LMS) — Phase 1 |
| **Epic** | Epic 8 — Reporting |
| **Date** | 2026-05-13 |
| **Status** | Accepted |
| **Type** | Decision — alternatives were evaluated |

---

## Context

Epic 8 defines two reports accessible to HR Admins only: FR-RPT-001 (Leave Utilization — total days taken per employee per leave type for a specified date range) and FR-RPT-002 (Department Summary — average leave days per department). Both must be previewable in-app and exportable to CSV. Both require aggregating leave data across up to 800 employees, potentially over multi-year date ranges given the 5-year retention window (FR-DATA-002). The PRD prescribes PostgreSQL as the database but does not specify where report computation occurs.

---

## Options Considered

### Option 1: Server-Side PostgreSQL Aggregation (Chosen)

The Report API Route Handler executes `GROUP BY` / `SUM` / `AVG` SQL aggregate queries directly on PostgreSQL. PostgreSQL returns pre-aggregated result rows — one row per employee/leave-type combination for FR-RPT-001, one row per department for FR-RPT-002. The Route Handler streams these compact results to the browser for in-app preview and CSV generation.

- **Pros**: Computation is co-located with data — no bulk data transfer between Supabase and Vercel. For FR-RPT-001, the result set is at most `n_employees × n_leave_types` rows (~3,200 rows for 800 employees × 4 leave types), regardless of how many leave records exist in the underlying date range. PostgreSQL's query optimizer handles dataset growth across the 5-year retention window without application changes. RLS is enforced automatically during the query, guaranteeing HR Admin-only access at the DB level.
- **Cons**: Report logic is expressed as SQL, not TypeScript. A schema change can silently alter report output if aggregate queries are not updated in tandem. SQL aggregate queries are harder to unit-test in isolation than TypeScript functions and require integration tests against the Supabase local emulator for correctness validation.

### Option 2: Application-Layer Data Processing

The Route Handler fetches raw `leaves` rows for the requested date range; TypeScript code aggregates in memory using `reduce` or equivalent operations.

- **Pros**: Report logic is TypeScript, consistent with the rest of the codebase and straightforward to unit-test with mocked data arrays.
- **Cons**: For a broad date range over 5 years of accumulated data (FR-DATA-002), the Route Handler must transfer all raw leave rows from Supabase to Vercel before any aggregation occurs. This is a significantly larger data transfer than pre-aggregated results. Memory usage in the serverless function scales with the raw dataset size, not the aggregated result size — risking Vercel function memory limits as data accumulates. RLS is still applied at the DB query level, so the access control boundary is identical to Option 1.

---

## Decision

**Option 1 — Server-side PostgreSQL aggregation.**

For FR-RPT-001 and FR-RPT-002, the SQL is standard and non-complex: `SUM` of days grouped by employee and leave type, and `AVG` of days grouped by department. The data transfer advantage of Option 1 is decisive and grows over time: the result set is bounded by the number of employees and departments, not by the number of leave records accumulated across the 5-year retention window.

---

## Rationale

The 5-year retention requirement (FR-DATA-002) means the `leaves` table grows monotonically. An approach that returns pre-aggregated rows scales linearly with the number of reporting dimensions (employees, leave types, departments), not with the volume of historical records. Option 2 degrades as data accumulates; Option 1 does not. For these two specific report types, the SQL complexity is low and the trade-off is unambiguous.

---

## Consequences

**Positive:**
- Report query result sets are small and bounded regardless of how many leave records exist in the underlying date range. Generation latency is determined by PostgreSQL query execution time, not data transfer volume.
- As the `leaves` table grows over the retention window, report performance remains stable without any application changes.
- CSV export in the Route Handler operates on compact aggregated rows, keeping the export memory footprint minimal.

**Negative:**
- Aggregate SQL queries require integration tests against the Supabase local emulator for correctness validation. Unit tests with mocked data arrays cannot verify that the SQL handles edge cases correctly (e.g., leave requests spanning a month boundary within the date range).
- If a future report requirement involves complex multi-table joins or window functions beyond standard aggregation, the SQL-in-migration approach may become unwieldy. At that point, re-evaluating Option 2 or a dedicated reporting tool would be warranted.

---

## Open Question

OQ-05 (from ARCH-LMS-MC-v1.0): Whether FR-RPT-002 (Department Summary) accepts a date range filter is unresolved (OI-07, owner: Maria Santos). The presence or absence of a `WHERE start_date BETWEEN` clause changes the query shape and index strategy significantly. This must be resolved before Sprint 3 report implementation begins.

---

## Architecture Document Reference
ARCH-LMS-MC-v1.0, Section 3 (Report API component), Section 4 (Technology Choices), Section 9 (OQ-05)