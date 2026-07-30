# ADR-LMS-MC-E001: Enforce Auth and Authorization via a Three-Layer Defense Architecture

| Field | Value |
|---|---|
| **Project** | Leave Management System (LMS) — Phase 1 |
| **Epic** | Epic 1 — Authentication & Access Control |
| **Date** | 2026-05-13 |
| **Status** | Accepted |
| **Type** | Prescribed — mandated by PRD Section 2 (Core Engineering Rules) and Epic 1 tech stack — not open for evaluation |

---

## Source

- FR-AUTH-001: *"Supabase Auth manages session and issues JWTs"*; domain restriction enforced at the Auth service level
- FR-AUTH-002: *"Four-role RBAC enforced via Supabase RLS policies"*; *"access rules applied at the DB level"*
- FR-AUTH-003: *"Next.js middleware redirects unauthenticated users to login and blocks cross-role route access"*
- PRD Core Engineering Rules: *"Supabase RLS replaces custom RBAC middleware; authorization is enforced at the database level"*

---

## Context

Epic 1 establishes the security foundation for the entire system — 800 employees, 120 managers, 5 HR Admins, and 1 System Administrator across 3 offices, all accessing role-sensitive data through a single web application. Two distinct problems must be solved: verifying who the user is (authentication) and determining what data they may access (authorization). The PRD mandates specific technologies for both, organized into three enforcement layers.

---

## Decision

Implement authentication and authorization as a three-layer defense architecture:

1. **Supabase Auth** — identity verification and session issuance
2. **Next.js Middleware** — route-level access control
3. **Supabase RLS** — data-level access control at the database engine

---

## Rationale

Each layer targets a different class of unauthorized access that the other two layers cannot catch alone.

**Layer 1 — Supabase Auth (FR-AUTH-001)**
Enforces that only `@stratpoint.com` email holders can obtain a session. The domain allow-list is configured at the Supabase Auth service level, rejecting all other identities before a JWT is issued. No downstream layer has to handle unauthenticated identities — they are stopped here. A database trigger on `auth.users` creates the `profiles` record on first login, binding the Supabase identity to the LMS role system before any RLS policy is evaluated.

**Layer 2 — Next.js Middleware (FR-AUTH-003)**
Validates the JWT on every incoming request at the edge before any page or Route Handler executes. Redirects unauthenticated sessions to the login page. Blocks authenticated users from navigating to screens outside their role (e.g., an Employee accessing `/admin`). This layer is entirely about navigation and URL-level access — it does not enforce what data a query returns.

**Layer 3 — Supabase RLS (FR-AUTH-002)**
Evaluates per-role access rules at the PostgreSQL engine for every query, regardless of how the query was issued. The four policies are:

| Role | Access Rule |
|---|---|
| Employee | Read and insert own `leaves` rows only (`WHERE employee_id = auth.uid()`) |
| Line Manager | Read `leaves` rows for direct reports only (`WHERE employee_id IN (SELECT id FROM profiles WHERE manager_id = auth.uid())`) |
| HR Administrator | Full read and update access across all leave and audit records |
| System Administrator | Access restricted to `profiles` table only; cannot query `leaves`, `leave_balances`, or `audit_log` |

**Why all three are necessary together**: Layer 2 alone cannot enforce data isolation — only URL access. Layer 3 alone cannot prevent a valid Employee from rendering the HR Admin UI (even if the UI would return no data). Layer 1 alone only establishes identity, not permissions. Together, a failure at any single layer does not expose the system.

---

## Consequences

**Positive:**
- A Route Handler application bug that constructs an incorrect query still cannot return cross-role data — RLS provides a data-level safety net that operates independently of application code quality.
- RLS policies are versioned SQL migration files, auditable through the same code review process as the TypeScript codebase.
- Supabase Auth JWTs are trusted natively by RLS policy evaluation — no custom token-parsing middleware is needed between the auth and DB layers.

**Negative:**
- Three separate authorization contexts must be kept consistent: `profiles.role` (application data), the Middleware route map (TypeScript), and the RLS policy SQL (PostgreSQL). A role added without updating all three creates a gap.
- The Manager RLS policy evaluates a subquery against `profiles` on every affected query. The `profiles.manager_id` column requires an index to avoid a full table scan per Manager-scoped request.
- Integration tests must assert per-role data isolation against the actual Supabase instance or local emulator — mocking the DB client cannot validate RLS policy correctness.

---

## Architecture Document Reference
ARCH-LMS-MC-v1.0, Section 2 (System Overview), Section 3 (Supabase Auth Service, RLS Policy Engine, Next.js Middleware components), Section 6 (Integration and API Design)