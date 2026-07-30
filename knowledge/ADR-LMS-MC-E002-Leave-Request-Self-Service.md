# ADR-LMS-MC-E002: Enforce Leave Submission Validation at Both Client and Server Layers

| Field | Value |
|---|---|
| **Project** | Leave Management System (LMS) — Phase 1 |
| **Epic** | Epic 2 — Leave Request: Employee Self-Service |
| **Date** | 2026-05-13 |
| **Status** | Accepted |
| **Type** | Decision — alternatives were evaluated |

---

## Context

Epic 2 includes multiple validation rules applied during leave submission (FR-LVR-001 to 004): date range checks (Start Date not in the past, End Date ≥ Start Date), minimum reason length (10 characters), file type and size restrictions (PDF/image, ≤ 5 MB), leave balance enforcement (hard block for Annual/Sick at zero balance; FR-LVR-003), and conflict detection against existing Approved requests (soft warning; FR-LVR-004).

These rules must drive the error rate from ~15% to under 2% (PRD Section 1, Goal 3). The architectural question is: **where are these validation rules enforced?**

---

## Options Considered

### Option 1: Client-Side Only
All validation implemented as React form logic in the browser. Invalid submissions are caught before the form is submitted.

- **Pros**: Immediate inline feedback with no network round-trip; aligns with the PRD error state spec ("Form rejects submission if...").
- **Cons**: Bypassable — a direct HTTP call to the Route Handler skips all client validation. For a compliance-grade system replacing a 15%-error-rate manual process, relying solely on browser-side enforcement is insufficient.

### Option 2: Server-Side Only
All validation implemented inside the Route Handler. The form submits without pre-checks; the server returns errors after a round-trip.

- **Pros**: Single enforcement point that cannot be bypassed regardless of client behaviour.
- **Cons**: Every validation error requires a full round-trip before the employee sees feedback. PRD Section 4 (Error States) defines inline, field-level error messages, and NFR-009 requires usability without training — server-only validation produces a poor experience for the non-technical 800-employee user base.

### Option 3: Dual-Layer — Client for UX, Server for Integrity (Chosen)
Client-side validation provides immediate inline feedback. Server-side validation in the Route Handler is the authoritative enforcement point — it re-validates all rules before executing any DB write.

- **Pros**: Satisfies both the UX requirement (immediate field-level errors, NFR-009) and the integrity requirement (server cannot be bypassed). PRD acceptance criteria use both "Form rejects..." (client) and "Submission blocked..." (server), implying both layers.
- **Cons**: Validation logic exists in two places; any rule change must be applied in both layers to stay consistent.

---

## Decision

**Option 3 — Dual-Layer validation.**

The PRD's error state definitions, acceptance criteria phrasing, and error rate target jointly require both immediate UX feedback and tamper-resistant server enforcement. The cost of maintaining rules in two places is low relative to the integrity gain.

---

## Rationale

PRD Section 1 Goal 3 targets a <2% error rate. PRD Section 4 defines inline field-level error messages. NFR-009 requires usability without training. These three constraints together require client-side feedback and server-side enforcement — neither layer alone satisfies all three.

**Special case — working-day calculation (FR-LVR-002)**: Computed entirely client-side. Phase 1 excludes Philippine public holidays (A-04, A-05), making the Mon–Fri count pure arithmetic with no DB dependency. No server-side recalculation is needed at submission.

**Special case — conflict detection (FR-LVR-004)**: Requires a DB query (check Approved requests for date overlap) and is performed server-side. The client displays a pre-submission warning based on a prior fetch, but the server re-checks at write time because Approved leave records may change between form load and submission.

---

## Consequences

**Positive:**
- Non-technical employees receive immediate, specific error messages before submitting, reducing frustration and re-submissions (NFR-009).
- Server-side validation makes the API integrity-correct regardless of how the client is built or extended.
- Balance enforcement at the server layer (FR-LVR-003) ensures a zero-balance submission cannot be forced through the API even if a client bug disables the form guard.

**Negative:**
- Two validation codebases: React form logic (TypeScript) and Route Handler validation logic. Any rule change must be applied in both; an out-of-sync rule is a latent bug that should be caught in code review.
- Server-side conflict detection adds a DB read on every submission. At 800 employees this is negligible, but the pattern should be noted for any future high-volume extension.

---

## Architecture Document Reference
ARCH-LMS-MC-v1.0, Section 3 (Leave Request API, Employee Portal components), Section 6 (Leave Submission sequence diagram)