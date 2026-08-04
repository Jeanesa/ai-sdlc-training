-- TASK-011: RLS policies + table-level GRANTs for all business tables.
--
-- Design notes (see PLAN approved for TASK-011):
-- - service_role has rolbypassrls = TRUE, so RLS policies do NOT apply to it.
--   service_role is controlled exclusively via GRANTs (no service_role policies).
-- - authenticated (rolbypassrls = FALSE) is governed by GRANTs + per-role RLS
--   policies keyed off the role stored in public.profiles.
-- - anon (rolbypassrls = FALSE) gets SELECT grants only; no anon policies exist,
--   so RLS default-deny returns empty results (harmless).
-- - DELETE is blocked for every role by OMITTING the DELETE grant entirely
--   (403 permission denied). The FOR DELETE USING (false) policies document the
--   intent and stay inert while no DELETE grant exists.
-- - audit_log is append-only: INSERT blocked for all roles (RLS WITH CHECK (false)
--   for authenticated; grant omission for anon/service_role); no UPDATE/DELETE.
-- - Profiles policies cannot reference profiles via subquery (infinite recursion);
--   the SECURITY DEFINER helper current_user_role() is used for all role checks.
--
-- FORWARD DEPENDENCIES (not implemented here):
-- - TASK-013 log_audit_event() MUST be SECURITY DEFINER (owner postgres): once
--   audit_log INSERT is blocked for all roles, the audit trigger's own INSERT
--   would otherwise be denied by RLS on every leaves/leave_balances mutation.
-- - TASK-012 handle_new_user() MUST be SECURITY DEFINER (owner postgres): once
--   profiles RLS is enabled and INSERT is blocked for non-sys_admin, the
--   first-login profiles INSERT would otherwise fail with an RLS violation.

-- ---------------------------------------------------------------------------
-- 1. Helper function: current role lookup (bypasses profiles RLS via SECURITY
--    DEFINER to avoid infinite recursion in profiles self-referencing policies).
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 2. Table-level GRANTs (DELETE deliberately omitted everywhere).
-- ---------------------------------------------------------------------------

-- profiles
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;

-- leaves
grant select on public.leaves to anon;
grant select, insert, update on public.leaves to authenticated;
grant select, insert, update on public.leaves to service_role;

-- leave_balances
grant select on public.leave_balances to anon;
grant select, insert, update on public.leave_balances to authenticated;
grant select, insert, update on public.leave_balances to service_role;

-- leave_types
grant select on public.leave_types to anon;
grant select, insert, update on public.leave_types to authenticated;
grant select, insert, update on public.leave_types to service_role;

-- audit_log: INSERT to authenticated is granted so that the RLS WITH CHECK
-- (false) policy produces the canonical RLS error; no INSERT for anon/service_role.
grant select on public.audit_log to anon;
grant select, insert on public.audit_log to authenticated;
grant select on public.audit_log to service_role;

-- ---------------------------------------------------------------------------
-- 3. Enable Row Level Security on all business tables.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leaves enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_types enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Profiles policies (authenticated).
-- ---------------------------------------------------------------------------

drop policy if exists "auth_profiles_select_own" on public.profiles;
create policy "auth_profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "auth_profiles_select_direct_reports" on public.profiles;
create policy "auth_profiles_select_direct_reports" on public.profiles
  for select to authenticated
  using (manager_id = auth.uid());

drop policy if exists "auth_profiles_select_hr" on public.profiles;
create policy "auth_profiles_select_hr" on public.profiles
  for select to authenticated
  using (public.current_user_role() = 'hr_admin');

drop policy if exists "auth_profiles_select_sys" on public.profiles;
create policy "auth_profiles_select_sys" on public.profiles
  for select to authenticated
  using (public.current_user_role() = 'sys_admin');

drop policy if exists "auth_profiles_insert_sys" on public.profiles;
create policy "auth_profiles_insert_sys" on public.profiles
  for insert to authenticated
  with check (public.current_user_role() = 'sys_admin');

drop policy if exists "auth_profiles_update_sys" on public.profiles;
create policy "auth_profiles_update_sys" on public.profiles
  for update to authenticated
  using (public.current_user_role() = 'sys_admin')
  with check (public.current_user_role() = 'sys_admin');

-- ---------------------------------------------------------------------------
-- 5. Leaves policies (authenticated).
-- ---------------------------------------------------------------------------

-- Own leaves: available to all authenticated EXCEPT sys_admin (Sys Admin gets no
-- leaves regardless of data). Covers employee and manager's own requests.
drop policy if exists "auth_leaves_select_own" on public.leaves;
create policy "auth_leaves_select_own" on public.leaves
  for select to authenticated
  using (employee_id = auth.uid() and public.current_user_role() <> 'sys_admin');

drop policy if exists "auth_leaves_insert_own" on public.leaves;
create policy "auth_leaves_insert_own" on public.leaves
  for insert to authenticated
  with check (employee_id = auth.uid() and public.current_user_role() <> 'sys_admin');

-- Manager: direct reports' leaves.
drop policy if exists "auth_leaves_select_direct_reports" on public.leaves;
create policy "auth_leaves_select_direct_reports" on public.leaves
  for select to authenticated
  using (employee_id in (select id from public.profiles where manager_id = auth.uid()));

drop policy if exists "auth_leaves_update_direct_reports" on public.leaves;
create policy "auth_leaves_update_direct_reports" on public.leaves
  for update to authenticated
  using (employee_id in (select id from public.profiles where manager_id = auth.uid()))
  with check (employee_id in (select id from public.profiles where manager_id = auth.uid()));

-- HR Admin: all leaves.
drop policy if exists "auth_leaves_select_hr" on public.leaves;
create policy "auth_leaves_select_hr" on public.leaves
  for select to authenticated
  using (public.current_user_role() = 'hr_admin');

drop policy if exists "auth_leaves_update_hr" on public.leaves;
create policy "auth_leaves_update_hr" on public.leaves
  for update to authenticated
  using (public.current_user_role() = 'hr_admin')
  with check (public.current_user_role() = 'hr_admin');

-- ---------------------------------------------------------------------------
-- 6. Leave_balances policies (authenticated).
-- ---------------------------------------------------------------------------

drop policy if exists "auth_balances_select_own" on public.leave_balances;
create policy "auth_balances_select_own" on public.leave_balances
  for select to authenticated
  using (employee_id = auth.uid() and public.current_user_role() <> 'sys_admin');

drop policy if exists "auth_balances_select_hr" on public.leave_balances;
create policy "auth_balances_select_hr" on public.leave_balances
  for select to authenticated
  using (public.current_user_role() = 'hr_admin');

drop policy if exists "auth_balances_update_hr" on public.leave_balances;
create policy "auth_balances_update_hr" on public.leave_balances
  for update to authenticated
  using (public.current_user_role() = 'hr_admin')
  with check (public.current_user_role() = 'hr_admin');

-- ---------------------------------------------------------------------------
-- 7. Leave_types policies (authenticated).
-- ---------------------------------------------------------------------------

drop policy if exists "auth_types_select_active" on public.leave_types;
create policy "auth_types_select_active" on public.leave_types
  for select to authenticated
  using (is_active = true and deleted_at is null);

drop policy if exists "auth_types_select_hr" on public.leave_types;
create policy "auth_types_select_hr" on public.leave_types
  for select to authenticated
  using (public.current_user_role() = 'hr_admin');

drop policy if exists "auth_types_update_hr" on public.leave_types;
create policy "auth_types_update_hr" on public.leave_types
  for update to authenticated
  using (public.current_user_role() = 'hr_admin')
  with check (public.current_user_role() = 'hr_admin');

-- ---------------------------------------------------------------------------
-- 8. Audit_log policies (authenticated).
-- ---------------------------------------------------------------------------

-- HR Admin: read-only access to the audit trail (append-only by design).
drop policy if exists "auth_audit_select_hr" on public.audit_log;
create policy "auth_audit_select_hr" on public.audit_log
  for select to authenticated
  using (public.current_user_role() = 'hr_admin');

-- Block all authenticated INSERTs: audit_log is populated exclusively by the
-- SECURITY DEFINER audit trigger (TASK-013). Produces the canonical RLS error.
drop policy if exists "auth_audit_block_insert" on public.audit_log;
create policy "auth_audit_block_insert" on public.audit_log
  for insert to authenticated
  with check (false);

-- ---------------------------------------------------------------------------
-- 9. Global block policies: DELETE denied on every business table for all
--    roles. Inert while no DELETE grant exists (403 from the grant layer);
--    documents the intent and covers any future accidental DELETE grant.
-- ---------------------------------------------------------------------------

drop policy if exists "block_delete_profiles" on public.profiles;
create policy "block_delete_profiles" on public.profiles
  for delete to public
  using (false);

drop policy if exists "block_delete_leaves" on public.leaves;
create policy "block_delete_leaves" on public.leaves
  for delete to public
  using (false);

drop policy if exists "block_delete_leave_balances" on public.leave_balances;
create policy "block_delete_leave_balances" on public.leave_balances
  for delete to public
  using (false);

drop policy if exists "block_delete_leave_types" on public.leave_types;
create policy "block_delete_leave_types" on public.leave_types
  for delete to public
  using (false);

drop policy if exists "block_delete_audit_log" on public.audit_log;
create policy "block_delete_audit_log" on public.audit_log
  for delete to public
  using (false);
