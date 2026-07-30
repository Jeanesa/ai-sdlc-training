# ADR-LMS-MC-E004: Validate the Entitlement CSV in Full Before Applying Any Changes

| Field | Value |
|---|---|
| **Project** | Leave Management System (LMS) — Phase 1 |
| **Epic** | Epic 4 — Leave Balance & Entitlement Management |
| **Date** | 2026-05-13 |
| **Status** | Accepted |
| **Type** | Decision — alternatives were evaluated |

---

## Context

FR-BAL-004 requires a CSV bulk import for the annual entitlement reset covering up to 800 employees. The PRD states the import "validates CSV before applying changes (format errors, missing employees, invalid values)" and that "invalid rows are reported to HR Admin." The PRD does not explicitly specify whether a CSV containing some invalid rows is fully rejected, or whether valid rows are applied while invalid rows are skipped.

This ambiguity creates a genuine architectural choice between two distinct validation strategies.

---

## Options Considered

### Option 1: All-or-Nothing — Validate All Rows, Apply Only If the Entire CSV Passes (Chosen)

The Route Handler reads and validates every row before writing any DB changes. If any row fails validation, the entire import is rejected and all errors are returned to HR Admin in a single response. No partial state is written to `leave_balances`.

- **Pros**: All employees share the same effective entitlement update date — no inconsistency window where some employees are on new allocations and others are still on old ones. Simplifies audit logging: either a complete set of per-employee entries exists, or none do, making it straightforward to verify a complete annual reset. Forces HR Admin to deliver a clean CSV, reducing the risk of an unnoticed partial reset.
- **Cons**: A single bad row blocks the entire import. For an 800-row CSV, one malformed entry requires HR Admin to fix and re-upload the full file. The error report must surface all validation errors in a single response so they can be fixed in one pass.

### Option 2: Partial Apply — Apply Valid Rows, Skip Invalid Rows, Report Skipped Rows

The Route Handler processes each row independently. Valid rows are applied immediately; invalid rows are skipped and returned to HR Admin as an error list.

- **Pros**: HR Admin can proceed with the majority of employees without being blocked by isolated data quality issues; useful for large files with sparse errors.
- **Cons**: Creates an inconsistency window during the reset period — some employees have new entitlements, others still have old ones. Audit log entries exist for some employees but not others, making it difficult to confirm a complete annual reset occurred. Adds Route Handler complexity: it must track mixed success/failure state and present a combined result clearly to HR Admin.

---

## Decision

**Option 1 — All-or-Nothing validation.**

An annual entitlement reset is a high-stakes, infrequent operation. A partial reset — where some employees have updated balances while others do not — creates compliance and operational inconsistency that is harder to detect and remediate than a fully rejected import. The cost of requiring HR Admin to fix all errors before applying is acceptable for an operation performed at most once per year.

---

## Rationale

The PRD phrase "validates CSV before applying changes" most naturally reads as: validation precedes application, and application is contingent on full validation success. The audit log completeness requirement (FR-AUD-002) is simpler to satisfy under all-or-nothing — either all per-employee changes are logged as a single reset event, or none are — compared to partial apply, where the audit trail would cover only a subset of employees.

---

## Consequences

**Positive:**
- Consistent organizational state after every import: all employees share the same effective date for their updated entitlements.
- Audit log entries for a successful import constitute a complete, verifiable record of the annual reset event, satisfying FR-AUD-002.
- Implementation is straightforward: validate all rows in memory, accumulate errors, and only proceed to DB writes if the error list is empty.

**Negative:**
- The error reporting UX is critical: HR Admin must see all validation errors in a single response, not just the first error encountered. The Route Handler must complete full validation before returning — it must not short-circuit on the first invalid row.
- The Route Handler must hold the validated dataset in memory before beginning DB writes. For an 800-row CSV with basic entitlement fields, this is well within Vercel serverless function memory limits, but the pattern should be noted for future file size growth.
- HR Admin experience is worse for large files with sparse errors — they must fix and re-upload the entire CSV even for one bad row. Mitigated by returning all errors at once so a single corrective pass is sufficient.

---

## Open Question

OQ-04 (from ARCH-LMS-MC-v1.0): The CSV column format for bulk import is not yet defined (OI-06). The validation logic and accepted column schema must be locked in Sprint 0 before FR-BAL-004 development begins in Sprint 2.

---

## Architecture Document Reference
ARCH-LMS-MC-v1.0, Section 3 (Balance & Entitlement API component), Section 6 (Integration and API Design)