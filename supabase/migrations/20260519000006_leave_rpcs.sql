-- TASK-021: audit-actor SECURITY DEFINER leave RPCs (submit + cancel).
--
-- THE CANONICAL AUDIT-ACTOR RPC PATTERN — the Epic-3/4/5 RPCs (approve, entitlement,
-- override) mirror this exact shape.
--
-- 1. Audit actor: each RPC OWNS the app.current_user_id set. The FIRST statement is
--    set_config('app.current_user_id', p_actor, true) (is_local = true = SET LOCAL,
--    transaction-scoped) so the SAME-transaction INSERT/UPDATE fires trg_audit_leaves
--    (TASK-013) which reads the GUC and records the correct actor_id. This supersedes
--    ADR-LMS-MC-E007's literal "Route Handler SET LOCAL" wording: the RPC boundary now
--    owns the set, with identical transaction scoping and atomicity (one function call =
--    one transaction). Safe under PgBouncer transaction-mode pooling (OQ-06) — the GUC
--    never leaks across pooled connections.
-- 2. Action derivation is the TASK-013 trigger's job: leaves INSERT -> SUBMITTED;
--    leaves UPDATE -> coalesce(nullif(current_setting('app.audit_action', true), ''),
--    NEW.status), so a cancel UPDATE derives CANCELLED from NEW.status. Cancel sets
--    ONLY app.current_user_id — NOT app.audit_action, which is Epic-5 OVERRIDDEN
--    territory (TASK-070).
-- 3. SECURITY DEFINER hardening (AGENTS.md): owner postgres (rolbypassrls = TRUE, so the
--    DEFINER write bypasses RLS and the authenticated-only grants), SET search_path = '',
--    fully-qualified public.leaves. Same hardening as handle_new_user() / log_audit_event().
-- 4. Grants (A6): a freshly created function defaults to PUBLIC EXECUTE (verified in the
--    emulator), so EXECUTE is REVOKEd from PUBLIC and granted to service_role ONLY — no
--    anon/authenticated grant — so only the trusted server-side client can call these
--    RLS-bypassing writes.
-- 5. Cancel semantics: the WHERE clause enforces self-ownership, PENDING-only, and
--    deleted_at IS NULL (a soft-deleted leave is not cancellable; FR-DATA-001, matching
--    the TASK-036/070 RPCs) in SQL. No-match -> RETURNING * yields no row -> the function
--    returns NULL, which TASK-029 maps to 409 (not PENDING) / 403 (not owned).
-- 6. Idempotency (AGENTS.md): CREATE OR REPLACE FUNCTION; explicit ALTER OWNER / REVOKE /
--    GRANT are idempotent; no DROP FUNCTION IF EXISTS needed (new, stable signatures);
--    supabase db reset re-applies cleanly.

-- ---------------------------------------------------------------------------
-- 1. submit_leave_request
-- ---------------------------------------------------------------------------
create or replace function public.submit_leave_request(
  p_actor uuid,
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_supporting_doc_path text
)
returns public.leaves
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.leaves;
begin
  perform set_config('app.current_user_id', p_actor::text, true);

  insert into public.leaves (employee_id, leave_type, start_date, end_date, reason, supporting_doc_url, status)
  values (p_actor, p_leave_type, p_start_date, p_end_date, p_reason, p_supporting_doc_path, 'PENDING')
  returning * into v_row;

  return v_row;
end;
$$;

alter function public.submit_leave_request(uuid, text, date, date, text, text) owner to postgres;
revoke execute on function public.submit_leave_request(uuid, text, date, date, text, text) from public;
grant execute on function public.submit_leave_request(uuid, text, date, date, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. cancel_leave_request
-- ---------------------------------------------------------------------------
create or replace function public.cancel_leave_request(
  p_actor uuid,
  p_leave_id uuid
)
returns public.leaves
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.leaves;
begin
  perform set_config('app.current_user_id', p_actor::text, true);

  update public.leaves
  set status = 'CANCELLED', updated_at = now()
  where id = p_leave_id
    and employee_id = p_actor
    and status = 'PENDING'
    and deleted_at is null
  returning * into v_row;

  if not found then
    return null;
  end if;

  return v_row;
end;
$$;

alter function public.cancel_leave_request(uuid, uuid) owner to postgres;
revoke execute on function public.cancel_leave_request(uuid, uuid) from public;
grant execute on function public.cancel_leave_request(uuid, uuid) to service_role;
