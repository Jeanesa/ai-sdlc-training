# Coding Standards — Meridian LMS

Reusable rules distilled from completed tasks. Each rule includes a rationale and
bad/good examples so the *why* survives the *what*.

---

## Postgres DDL

### Quote all literals in Postgres CHECK constraints and DEFAULT clauses

- **Rule**: Every string literal inside a `CHECK` constraint or `DEFAULT` clause must be wrapped in single quotes.

- **Rationale**: Unquoted values like `CHECK (role IN (employee, ...))` are parsed by
  PostgreSQL as **column references**, not literals. The migration fails at apply time with
  `ERROR: column "employee" does not exist` — a silent bug that only surfaces when the
  migration actually runs, never during code review or type-checking. The CSV/task spec is
  usually written unquoted, so copy-pasting DDL verbatim from a task description re-introduces
  this bug (TASK-008's spec had it).

- **Example (bad -> good)**:
  ```sql
  -- BAD
  role TEXT CHECK (role IN (employee, manager, hr_admin, sys_admin))
  status TEXT CHECK (status IN (PENDING, APPROVED, REJECTED, CANCELLED)) DEFAULT PENDING

  -- GOOD
  role TEXT CHECK (role IN ('employee', 'manager', 'hr_admin', 'sys_admin'))
  status TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')) DEFAULT 'PENDING'
  ```

- **Scope**: Applies to `CHECK` constraint definitions and to `DEFAULT` clauses on text/enum-like
  columns. Numeric and boolean defaults (DEFAULT 0, DEFAULT false) need no quotes.


---

## Row Level Security & Database Functions

### Functions that write to RLS- or grant-restricted tables must be SECURITY DEFINER

- **Rule**: Any trigger or function that must write to a table protected by RLS or lacking table-level grants (e.g. `audit_log`, `profiles` on first login) must be `SECURITY DEFINER`, owned by `postgres`, with `SET search_path = ''` and fully-qualified object names (`public.<table>`).
- **Rationale**: RLS and grants apply to the *invoking* role. A trigger firing as `authenticated`/`supabase_auth_admin` is blocked and the whole business mutation rolls back. Running as owner (`postgres`, `rolbypassrls = true`) bypasses both; `search_path = ''` blocks search-path hijacking. Recurred in TASK-012 (`handle_new_user`) and TASK-013 (`log_audit_event`).
- **Scope**: PL/pgSQL trigger functions and RPCs writing to RLS/grant-restricted tables. Read-only helpers used *inside* policies (e.g. `current_user_role()`) also use `SECURITY DEFINER` to avoid infinite recursion when they query the table the policy protects.

## Testing

### Never use the service-role client for RLS assertions

- **Rule**: RLS/authz tests must assert through a per-role **anon-key** client with a real signed-in session. Use the service-role client only for setup (creating users, inserting fixtures).
- **Rationale**: `service_role` has `rolbypassrls = true`, so any query through it bypasses RLS — the assertion passes even if the policy is broken (false-green). Confirmed in TASK-016.

### RLS "empty" results are not errors

- **Rule**: For a role that should see no rows, assert `data` is empty **and** `error` is null. Assert an error (`code === '42501'`) only for blocked *writes* (DELETE with no grant; INSERT against a `WITH CHECK (false)` policy). Assert non-empty + a specific fixture id on "returns records" cases.
- **Rationale**: RLS returns an empty set for disallowed reads, not an error; asserting a thrown error there is wrong and makes the test misleading.

### Test location, runner, and naming

- **Rule**: Unit tests are colocated as `*.test.ts` / `*.test.tsx` (jsdom via a `// @vitest-environment jsdom` docblock when rendering components); integration tests live in `tests/integration/` and run via `npm run test:integration`. `npm run test` (unit) must stay DB-free. The project uses **Vitest, not Jest**.
- **Rationale**: Keeps the fast unit gate free of Docker/emulator dependencies and separates the two Vitest projects.

## Migrations

### Migrations must be idempotent and single-owner

- **Rule**: Use `CREATE OR REPLACE FUNCTION`, and `DROP POLICY IF EXISTS` / `DROP TRIGGER IF EXISTS` before each `CREATE`. Don't add grants/policies another migration already owns.
- **Rationale**: `supabase db reset` re-applies every migration from scratch; idempotent statements keep re-runs clean and let each migration own its concern without collision.

## Data Retention & Storage

### New persistence surfaces inherit the no-hard-delete posture

- **Rule**: Every new business data store — a table **or** a Supabase Storage bucket — must block hard `DELETE` for all roles **including `service_role`**, unless a decision explicitly exempts it. For Storage, add a `storage.objects` policy denying DELETE to every role; for tables, take the same no-DELETE stance as `leaves` (TASK-011). Removal happens only via the soft-delete `deleted_at` pattern on the owning business row.
- **Rationale**: PRD FR-DATA-001/002 require 5-year retention and prohibit hard deletes on business records. Supporting documents are audit evidence for sick leave; if the `leaves` row is soft-deleted and retained but its Storage object can be hard-deleted by the owner, the evidence vanishes and the audit trail is incomplete — invisible until an auditor looks. Surfaced in Epic 2 TASK-018, whose bucket policy originally allowed owner DELETE.
- **Scope**: Storage buckets and business tables. Auth/session/ephemeral infra tables are exempt.

## Data Model

### Enum-like TEXT values must use ONE canonical vocabulary across every table and app layer

- **Rule**: When a value is stored as free TEXT (not an FK/enum) in more than one table and used as a join or lookup key — e.g. `leave_type` in `leaves`, `leave_balances`, and `leave_types.name` — every producer and consumer must store and match the EXACT same canonical string. Name the single source of truth (here: `leave_types.name`, full names like `'Annual Leave'`). A UI dropdown may DISPLAY a short label, but the stored/submitted VALUE must be the canonical string. Verify the concrete values against `seed.sql`/schema — not the PRD's prose labels.
- **Rationale**: The PRD's "dropdown: Annual, Sick, …" is display shorthand; the DB seeds full names ('Annual Leave', …). A form constant storing the short label writes `leaves.leave_type = 'Annual'`, which silently fails to join `leave_balances.leave_type = 'Annual Leave'` — no error, just zero-matching rows, wrong balances, and skipped deductions. This slipped through Epic 2's gates because per-epic validation checked against the PRD (short labels looked correct) and only surfaced at Epic 4 when the grid JOIN forced a value comparison. Cross-table data contracts are invisible to single-epic spec validation.
- **Scope**: Any enum-like TEXT shared across tables or between DB and app (`leave_type`, `status`, `action`, `role`). Note the related known drift: DB `hr_admin`/`sys_admin` vs `types.ts` `hradmin`/`sysadmin`. When an admin feature RENAMES a canonical value (Epic 5 FR-HRADM-001 edits `leave_types.name`), existing `leaves`/`leave_balances` rows keyed on the old string are orphaned unless the rename cascades or is blocked.