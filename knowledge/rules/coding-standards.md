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
