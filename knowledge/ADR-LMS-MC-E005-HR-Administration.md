# ADR-LMS-MC-E005: Implement HR Admin Status Override as a Privileged Action with Mandatory Reason and Isolated Audit Entry

| Field | Value |
|---|---|
| **Project** | Leave Management System (LMS) — Phase 1 |
| **Epic** | Epic 5 — HR Administration |
| **Date** | 2026-05-13 |
| **Status** | Accepted |
| **Type** | Prescribed — mandated by FR-HRADM-001, FR-HRADM-003, and Epic 5 Out of Scope — not open for evaluation |

---

## Source

- FR-HRADM-001: *"Deactivated types do not appear in the employee submission form dropdown (soft deactivation — not deleted)"*
- FR-HRADM-002: *"All-requests view with filters: Employee Name, Department, Leave Type, Status, Date Range. CSV export applies to the currently filtered result set."*
- FR-HRADM-003: *"HR Admin can override any request's status with a mandatory reason [...] Override logged in the audit trail with actor, timestamp, reason, and before/after status snapshot. Action type = `OVERRIDDEN`."*
- Epic 5 Out of Scope: *"❌ Hard deletion of leave types or requests"*

---

## Context

Epic 5 gives 5 HR Administrator users full organizational visibility and three control capabilities: leave type lifecycle management, an all-requests view with filtering and CSV export, and the ability to override any request's status. Each capability has architectural implications for data integrity, audit traceability, and query performance.

---

## Decision

Three architectural patterns govern Epic 5's implementation:

1. **Override as an isolated action type**: HR Admin status overrides use action type `OVERRIDDEN` in the audit log — distinct from all normal workflow actions. Mandatory reason is required before the override can be submitted.
2. **Soft-deactivation for leave types**: Leave types are deactivated via `is_active = false`, not deleted. Deactivated types are filtered from the submission form dropdown but remain in the database for historical record integrity.
3. **Server-side filtered queries for the all-requests view**: Filters (Employee Name, Department, Leave Type, Status, Date Range) are applied as PostgreSQL `WHERE` clauses, not as client-side filtering on a pre-fetched dataset.

---

## Rationale

**Override as an isolated action type (FR-HRADM-003)**
The `OVERRIDDEN` action type in the audit log is distinct from all normal workflow actions (`SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`). This allows compliance reviewers to isolate and audit all HR Admin interventions independently — an override is never confused with a manager action in audit log queries (FR-AUD-003). The mandatory reason is captured in the audit entry alongside the before/after status snapshot, making each override self-documenting without requiring separate documentation.

FR-HRADM-003 permits overriding *any* request status, including transitions the normal workflow does not permit (e.g., APPROVED back to PENDING). This is intentional — overrides exist precisely for edge cases the workflow cannot handle. However, this creates a known gap: if an APPROVED request is overridden, the balance deduction that occurred during approval is not automatically reversed. Phase 1 does not automate balance reconciliation after an override; this is a manual HR process (see Consequences).

**Soft-deactivation for leave types (FR-HRADM-001)**
Deactivated leave types set `is_active = false` and remain in the database. This preserves referential integrity — existing `leaves` records linked to a deactivated type remain fully queryable for audit and reporting. Hard deletion is explicitly out of scope (Epic 5 Out of Scope). The submission form dropdown filters `WHERE is_active = true`, hiding deactivated types from new submissions without affecting historical records.

**Server-side filtering for the all-requests view (FR-HRADM-002)**
As the `leaves` table grows across the 5-year retention window (FR-DATA-002), pre-fetching all rows to the browser for client-side filtering would degrade performance and risk hitting Vercel serverless function memory limits. PostgreSQL `WHERE` clauses with appropriate indexes scale cleanly with data volume regardless of retention window length.

---

## Consequences

**Positive:**
- Discrete `OVERRIDDEN` action type enables compliance reviewers to audit all HR Admin interventions in one filtered view (FR-AUD-003), clearly separated from normal workflow events.
- Soft-deactivation preserves historical record integrity — audit queries and reports against deactivated leave types continue to return accurate historical data.
- Server-side filtering on the all-requests view scales with data volume across the 5-year retention window without any application changes.

**Negative:**
- Override capability allows status transitions that bypass balance logic. An APPROVED-to-PENDING override does not automatically re-credit the deducted balance. HR must manually edit the employee's `leave_balances` via the entitlement grid (FR-BAL-002) to reconcile. This gap is accepted in Phase 1 and should receive explicit sign-off from Maria Santos at the Sprint 0 review.
- Override reason minimum character length is unresolved (OQ-03 from ARCH-LMS-MC-v1.0). The Route Handler validation rule and the form guard cannot be finalised until Maria Santos confirms whether the minimum is 20 characters (consistent with manager rejection reason) or 50 characters (higher-stakes action). This blocks FR-HRADM-003 implementation completion and must be resolved before Sprint 2.

---

## Architecture Document Reference
ARCH-LMS-MC-v1.0, Section 3 (HR Admin API, HR Admin Portal components), Section 5 (Data Model — `leave_types`, `audit_log`), Section 9 (OQ-03)