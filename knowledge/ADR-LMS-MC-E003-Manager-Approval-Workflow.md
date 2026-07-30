# ADR-LMS-MC-E003: Execute Leave Approval as a Single Atomic Transaction with Irrevocable Finality

| Field | Value |
|---|---|
| **Project** | Leave Management System (LMS) — Phase 1 |
| **Epic** | Epic 3 — Manager Approval Workflow |
| **Date** | 2026-05-13 |
| **Status** | Accepted |
| **Type** | Prescribed — mandated by FR-BAL-003, FR-MGR-003, and FR-MGR-004 — not open for evaluation |

---

## Source

- FR-BAL-003: *"Balance update and status change to APPROVED execute as a single transaction — either both succeed or both fail"*
- FR-MGR-003: *"Status updates immediately to APPROVED. Balance deducted atomically (FR-BAL-003). Decision is final; no edit after submission."*
- FR-MGR-004: *"Decision is final; no edit after submission."*
- Epic 3 Out of Scope: *"❌ Editing a manager decision after submission"*

---

## Context

When a manager approves a leave request, two separate database rows must change: `leaves.status` transitions to APPROVED, and `leave_balances.used_days` is incremented by the number of requested days. These are in different tables. The PRD mandates both that this operation is atomic and that the resulting decision cannot be undone by the manager. Both requirements shape the approval implementation at the database level.

---

## Decision

The Manager Action API Route Handler executes the approval as a single PostgreSQL `BEGIN / UPDATE leaves / UPDATE leave_balances / COMMIT` transaction. Once committed, the decision is final and cannot be modified through the normal approval workflow — only an HR Admin override (FR-HRADM-003) can alter the state, and doing so creates a separate `OVERRIDDEN` audit entry.

---

## Rationale

**Why atomicity is non-negotiable**: A non-atomic approval exposes two possible partial states:

- `leaves.status = APPROVED`, balance not deducted → employee has approved leave but quota is not consumed. Repeated occurrences silently inflate effective entitlements beyond the configured allocation.
- Balance deducted, `leaves.status` still PENDING → employee's quota is reduced but leave is not approved. The employee loses days they did not use.

Both states corrupt leave balance accuracy and undermine PRD Section 1 Goal 3 (error rate target). PostgreSQL's ACID transaction model guarantees neither partial state can persist.

**Why the audit trigger is transaction-safe**: The `audit_log` INSERT triggered by the `leaves` UPDATE fires within the same transaction. If the transaction rolls back, the audit entry rolls back with it. The audit log never records an approval that did not persist.

**Why irrevocability is prescribed**: Permitting reversal would require compensating transaction logic — re-crediting the balance, re-opening the request — and would produce ambiguous audit sequences (an APPROVED entry followed by a retraction). The PRD's prescribed remediation for a mistaken approval is the HR Admin override (FR-HRADM-003), which appends a new `OVERRIDDEN` entry rather than mutating the original.

**Notification asymmetry**: The employee email notification (FR-NOTIF-002) is dispatched after the transaction commits. If the email fails, the transaction is not rolled back (FR-NOTIF-005). This is a known and accepted asymmetry — the leave state is the authoritative record; the email is informational only.

---

## Consequences

**Positive:**
- Leave balance accuracy is guaranteed at the database level with no application-layer reconciliation needed.
- Irrevocable decisions produce a clean, linear audit trail: one APPROVED entry per request, with no retraction events in the normal workflow.
- The implementation is straightforward: a single `BEGIN / UPDATE / UPDATE / COMMIT` block in the Route Handler.

**Negative:**
- If a manager approves in error, only HR Admin override can remediate. The override does not automatically reverse the balance deduction — balance reconciliation is a manual HR process in Phase 1. This gap should be raised with Maria Santos at the Sprint 0 review for explicit sign-off.
- The two-table write holds an open DB connection for the transaction duration. Under PgBouncer transaction-mode pooling, the connection is released at COMMIT, which is correct. Developers must not issue unrelated queries between `BEGIN` and `COMMIT` that would extend the hold time unnecessarily.

---

## Architecture Document Reference
ARCH-LMS-MC-v1.0, Section 3 (Manager Action API component), Section 6 (Manager Approval sequence diagram), Section 8 (NFR Fulfillment)