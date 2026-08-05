-- TASK-013: audit trigger engine on leaves and leave_balances.
--
-- Design notes (see PLAN approved for TASK-013):
-- - log_audit_event() is SECURITY DEFINER (owner postgres): TASK-011 blocks
--   audit_log INSERT for all roles (authenticated via RLS WITH CHECK (false);
--   anon/service_role via missing INSERT grant), so only an owner-run function
--   (postgres, rolbypassrls = TRUE) can write audit_log. Same pattern as
--   handle_new_user() (TASK-012). Forward dependency documented in
--   20260519000002_rls_policies.sql.
-- - search_path is pinned to '' with fully-qualified public.audit_log (same
--   hardening as handle_new_user()); row_to_json / current_setting / now are
--   pg_catalog built-ins and resolve under an empty search_path.
-- - EXECUTE is revoked from PUBLIC: trigger-fired invocations of a SECURITY
--   DEFINER function run as the owner and do not require PUBLIC EXECUTE
--   (verified for handle_new_user() in the local emulator); this only blocks
--   direct invocation by arbitrary roles.
-- - Actor identity: current_setting('app.current_user_id', true) with
--   missing_ok = true returns NULL (no error) when the GUC was not set; a NULL
--   actor inserts cleanly (nullable FK). The app MUST set the GUC in the same
--   transaction as the mutation (later feature tasks). An omitted GUC is a
--   compliance gap, not a crash (ADR-E007).
-- - Action derivation: leaves INSERT -> SUBMITTED; leaves UPDATE ->
--   status-derived from NEW.status (APPROVED/REJECTED/CANCELLED) but an
--   override GUC (app.audit_action, set by the epic-5 HR override flow) wins:
--   coalesce(nullif(current_setting('app.audit_action', true), ''), NEW.status).
--   leaves.status CHECK allows only PENDING/APPROVED/REJECTED/CANCELLED, so
--   OVERRIDDEN is signalled by the GUC, not by a status value.
--   leave_balances has no status column -> fixed action ENTITLEMENT_CHANGED.
-- - The leaves UPDATE audit is gated on OLD.status IS DISTINCT FROM NEW.status:
--   only status transitions are audited (the AC action set is status-only;
--   note-only updates produce no entry). The gate also guarantees every path
--   reaching the INSERT has a non-null action (audit_log.action is NOT NULL),
--   since a NULL action would abort the business mutation.
-- - Snapshots: old_data = row_to_json(OLD)::jsonb (NULL on INSERT, NOT
--   coalesced to '{}' — the AC requires NULL); new_data = row_to_json(NEW)::jsonb
--   on all events.
-- - The trigger runs inside the mutation's transaction: a rollback rolls back
--   the audit entry too (no phantom entries). No exception handlers — any
--   unhandled error aborts the business mutation (intentional).

-- ---------------------------------------------------------------------------
-- 1. Trigger function: write an audit_log entry for leaves/leave_balances
--    mutations. Runs as owner (postgres) to bypass the TASK-011 audit_log
--    INSERT block.
-- ---------------------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_action text;
begin
  v_actor := nullif(current_setting('app.current_user_id', true), '')::uuid;

  if TG_TABLE_NAME = 'leaves' then
    if TG_OP = 'INSERT' then
      v_action := 'SUBMITTED';
    elsif OLD.status is distinct from NEW.status then
      v_action := coalesce(nullif(current_setting('app.audit_action', true), ''), NEW.status);
    else
      -- no status change: not an audited transition; skip without ever
      -- reaching the INSERT with a NULL action (audit_log.action NOT NULL)
      return null;
    end if;
  elsif TG_TABLE_NAME = 'leave_balances' and TG_OP = 'UPDATE' then
    v_action := 'ENTITLEMENT_CHANGED';
  else
    return null;
  end if;

  insert into public.audit_log (table_name, record_id, action, actor_id, old_data, new_data, created_at)
  values (TG_TABLE_NAME, new.id, v_action, v_actor, row_to_json(old)::jsonb, row_to_json(new)::jsonb, now());

  return null;
end;
$$;

-- Revoke direct invocation by arbitrary roles (verified safe: trigger-fired
-- invocations of a SECURITY DEFINER function run as the owner and do not
-- require PUBLIC EXECUTE).
revoke execute on function public.log_audit_event() from public;

-- ---------------------------------------------------------------------------
-- 2. Triggers: fire AFTER the mutation so OLD/NEW are both available; execute
--    in the same transaction as the mutation (rollback removes the audit entry
--    too).
-- ---------------------------------------------------------------------------
drop trigger if exists trg_audit_leaves on public.leaves;
create trigger trg_audit_leaves
  after insert or update on public.leaves
  for each row
  execute function public.log_audit_event();

drop trigger if exists trg_audit_leave_balances on public.leave_balances;
create trigger trg_audit_leave_balances
  after update on public.leave_balances
  for each row
  execute function public.log_audit_event();
