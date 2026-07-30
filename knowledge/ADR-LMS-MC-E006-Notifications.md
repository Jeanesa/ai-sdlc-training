# ADR-LMS-MC-E006: Dispatch Email Notifications via Fire-and-Forget Within Route Handlers Rather Than a Dedicated Job Queue

| Field | Value |
|---|---|
| **Project** | Leave Management System (LMS) — Phase 1 |
| **Epic** | Epic 6 — Notifications |
| **Date** | 2026-05-13 |
| **Status** | Accepted |
| **Type** | Decision — alternatives were evaluated |

---

## Context

FR-NOTIF-005 mandates that all email delivery is non-blocking: *"API responses do not wait for email delivery. Email failures are logged. Retry logic is implemented. A failed delivery does not roll back the leave state change."* The PRD prescribes Resend API as the delivery provider but does not specify the async dispatch mechanism. Two architecturally distinct approaches are viable within the prescribed Next.js + Vercel stack.

---

## Options Considered

### Option 1: Fire-and-Forget Within the Route Handler (Chosen)

After the DB transaction commits, the Route Handler initiates the Resend API call as a non-awaited async operation — `void sendNotification(payload)` — then returns the HTTP response to the client immediately. Delivery queuing, retry logic, and failure logging are delegated entirely to Resend's built-in capabilities.

- **Pros**: No infrastructure beyond what is already prescribed (Next.js + Vercel + Resend). Resend handles delivery retry natively, satisfying FR-NOTIF-005's retry requirement without any application-managed queue. No new billing line, CI/CD configuration, or operational overhead. Low notification volume at 800 employees (5 trigger types, low per-employee frequency) does not justify additional infrastructure.
- **Cons**: The Vercel serverless function must remain alive long enough for the async dispatch call to be initiated before the runtime exits. If the function is terminated between sending the HTTP response and initiating the Resend call, the notification is silently dropped. Retry visibility is limited to Resend's dashboard — the LMS has no in-app view of delivery failure beyond its own error log. If Resend's retries are exhausted, there is no application-managed dead-letter queue.

### Option 2: Dedicated Background Job Queue (e.g., Inngest, Upstash QStash)

After the DB transaction commits, the Route Handler enqueues a notification job. A separate Vercel function, triggered by the queue, executes the Resend call independently of the request lifecycle.

- **Pros**: True decoupling — the Route Handler has no dependency on email dispatch timing or success. Resilient to serverless function termination between response and dispatch. Application-visible retry state, configurable backoff, and dead-letter queue capabilities.
- **Cons**: Introduces a job queue service not in the prescribed stack. Adds a new infrastructure dependency, billing line, and CI/CD configuration. Adds operational complexity for a workload that does not justify it at 800 users. Neither the PRD nor BRD references a job queue component.

---

## Decision

**Option 1 — Fire-and-Forget within the Route Handler.**

The prescribed stack contains no job queue; adding one would introduce unsanctioned infrastructure. Resend provides delivery retry natively (FR-NOTIF-005). Notification volume at 800 employees is low — even at peak load (annual entitlement reset triggering up to 800 simultaneous FR-NOTIF-004 emails) — within Resend's throughput without a queue.

---

## Rationale

FR-NOTIF-005 requires async delivery and automatic retry; Resend satisfies both natively. The PRD's explicit selection of Resend over an in-house notification service implies preference for delegating delivery complexity to the SaaS provider. Introducing a job queue satisfies the same requirements at significantly higher complexity for a low-volume, non-critical-path feature.

**Serverless lifetime risk mitigation**: The implementation must ensure the async dispatch is initiated within the Route Handler's execution context before the response is returned. The correct pattern is `Promise.allSettled([dbResult, emailDispatch])` — both operations are in-flight before the function returns — not a queued microtask after the response is sent. This is an implementation discipline requirement, not an infrastructure one, and must be enforced in code review.

---

## Consequences

**Positive:**
- Zero additional infrastructure; no new billing line or CI/CD changes beyond Resend API key management.
- Leave state commits are never delayed waiting for email dispatch; FR-NOTIF-005's non-blocking requirement is satisfied structurally.
- Failed email delivery does not affect system availability or leave record integrity.

**Negative:**
- Dead-letter visibility: if Resend's retries are exhausted, the only failure record is in Resend's delivery dashboard and the LMS application error log. HR Admin has no in-app notification failure view in Phase 1.
- The serverless lifetime dependency is a subtle implementation constraint not enforced by the framework. Incorrect async patterns (e.g., using `setTimeout`) can silently drop notifications without error. This must be documented in coding conventions and enforced in code review.
- If Vercel's serverless function execution model changes in a future platform update to enforce stricter termination timing, the fire-and-forget pattern may need to be re-evaluated in favour of Option 2.

---

## Open Question

OQ-02 (from ARCH-LMS-MC-v1.0): Resend domain verification for `@stratpoint.com` must be completed before Sprint 3. If verification is delayed, notification emails cannot be sent from `@stratpoint.com` in production. Resend sandbox mode unblocks integration testing in Sprints 1–2.

---

## Architecture Document Reference
ARCH-LMS-MC-v1.0, Section 3 (Notification Dispatcher component), Section 6 (Integration and API Design — Notification Dispatcher section, Leave Submission sequence diagram), Section 9 (OQ-02)