# ADR-LMS-MC-E007: Guarantee Audit Log Completeness via Database Triggers and Immutability via Append-Only RLS

| Field | Value |
|---|---|
| **Project** | Leave Management System (LMS) — Phase 1 |
| **Epic** | Epic 7 — Audit Log & Data Integrity |
| **Date** | 2026-05-13 |
| **Status** | Accepted |
| **Type** | Prescribed — mandated by PRD Core Engineering Rules, FR-AUD-001, FR-AUD-002, FR-DATA-001, FR-DATA-002 — not open for evaluation |

---

## Source

- PRD Core Engineering Rules: *"Audit logging via database triggers — not application-layer code — to ensure tamper resistance"*
- FR-AUD-001: *"Implemented at the database trigger level — not application-layer logging. Records must never be permanently deleted."*
- FR-AUD-002: Audit logging of all entitlement changes per-employee per-type with before/after values
- FR-DATA-001: soft-delete pattern (`deleted_at`) on all business tables; no hard deletes permitted
- FR-DATA-002: minimum 5-year data retention for all leave records (Philippine labor law)

---

## Context

Epic 7 is the primary compliance mechanism for Philippine labor law. The Legal department identified a critical compliance gap in the current email-and-Excel process (PRD Section 1): leave records must be audit-ready, meaning every state change must be permanently recorded in a tamper-evident log. The architecture must satisfy two independent properties simultaneously: **completeness** (every state change produces an audit entry, with no bypass possible) and **immutability** (no audit entry can be modified or deleted after creation).

---

## Decision

**Completeness** is guaranteed by PostgreSQL database triggers on the `leaves` and `leave_balances` tables. Every INSERT and qualifying UPDATE fires a trigger that writes a corresponding entry to `audit_log`, capturing: UTC timestamp, actor ID, action type, and before/after JSONB snapshots.

**Immutability** is guaranteed by an append-only RLS policy on `audit_log`: INSERT is permitted for all authorized roles; UPDATE and DELETE are blocked for all roles, including the service role key used by Route Handlers.

**Data retention** is enforced by the soft-delete pattern (`deleted_at` timestamp) on all business tables and a DELETE-blocking RLS policy. No business record is physically removed within the 5-year retention window. The `audit_log` table has no `deleted_at` column — entries are never deleted by any mechanism.

---

## Rationale

**Why database triggers for completeness**: Triggers fire at the database engine level on every qualifying table event, regardless of how the mutation was initiated — Route Handler, Supabase Studio query, migration script, or any future integration. There is no code path that writes to a trigger-covered table without producing an audit entry.

**Why not application-layer logging**: The PRD explicitly prohibits application-layer logging (FR-AUD-001). Application-layer logging fails the completeness requirement for three specific reasons:

1. A developer writing a new Route Handler may omit the log write call.
2. A partial transaction failure may commit the mutation but not the log entry.
3. Direct DB access (Supabase Studio, migration scripts) bypasses application code entirely and produces no audit entry.

None of these failure modes are possible with trigger-based logging.

**Transaction safety**: Audit trigger functions execute within the same transaction as the mutation they log. If the transaction rolls back, the `audit_log` INSERT rolls back with it. The audit log never contains entries for operations that did not persist — no phantom entries for failed operations.

**Actor identity**: The trigger reads the actor's user ID from a transaction-scoped PostgreSQL session variable (`current_setting('app.current_user_id')`), set by the Route Handler via `SET LOCAL app.current_user_id = $uid` before each mutation. `SET LOCAL` is transaction-scoped and is safe under PgBouncer transaction-mode pooling — it does not persist across connections in the pool. This convention must be applied consistently in every Route Handler that mutates a trigger-covered table.

**Soft-delete for 5-year retention**: `deleted_at IS NULL` is the filter on all active queries. Records are never physically deleted. A DELETE-blocking RLS policy on business tables prevents hard deletion through the application layer regardless of the client's role. This ensures the retention window is enforced by database policy, not operational procedure.

---

## Consequences

**Positive:**
- Audit completeness is guaranteed by the DB engine, not developer discipline. No application code path can produce a state change without a corresponding audit entry.
- Trigger-based logging is transactional — rolled-back mutations produce no phantom audit entries, maintaining a clean compliance record.
- Append-only RLS on `audit_log` means a compromised or misconfigured Route Handler with service role key access cannot delete or modify audit entries, satisfying the tamper-evidence requirement for Philippine labor law compliance.
- Soft-delete preserves full historical record for the 5-year retention window with no scheduled purge jobs required.

**Negative:**
- Trigger functions are PL/pgSQL, not TypeScript. They must be authored and maintained as versioned SQL migration files in `/supabase/migrations/`, creating a language boundary between the audit implementation and the rest of the codebase. Developers unfamiliar with PL/pgSQL require onboarding before contributing to trigger logic.
- The `SET LOCAL app.current_user_id` convention must be applied consistently in every Route Handler that performs a mutation on a trigger-covered table. An omission produces an audit entry with a null actor — not a security breach, but a compliance gap. Code review must enforce this convention.
- Trigger performance overhead: each write to `leaves` or `leave_balances` incurs an additional write to `audit_log`. At 800 employees and typical leave request frequency this is negligible, but should be documented for any future high-volume extension.

---

## Open Question

OQ-06 (from ARCH-LMS-MC-v1.0): PgBouncer must be confirmed in transaction-mode pooling before the `SET LOCAL` actor identity pattern is implemented. Session-mode pooling would cause session variables to persist across different users' requests — a serious data integrity bug. This must be resolved before Sprint 1 begins.

---

## Architecture Document Reference
ARCH-LMS-MC-v1.0, Section 3 (Audit Trigger Engine component), Section 4 (Audit Logging, Soft-Delete Pattern), Section 5 (Data Model — `audit_log`), Section 6 (sequence diagrams), Section 8 (NFR-007)