-- TASK-012: profiles auto-creation trigger on first login.
--
-- Design notes (see PLAN approved for TASK-012):
-- - handle_new_user() is SECURITY DEFINER (owner postgres): once profiles RLS is
--   enabled and INSERT is blocked for non-sys_admin (TASK-011), the first-login
--   profiles INSERT would otherwise be denied. Two independent blockers exist:
--   (1) supabase_auth_admin (the role GoTrue inserts auth.users as) has no
--       grants on public.profiles, so a plain SECURITY INVOKER function would
--       hit "permission denied" before RLS is even evaluated;
--   (2) the only profiles INSERT policy allows sys_admin only, and a brand-new
--       user has no profile/role yet (current_user_role() returns NULL), so the
--       RLS WITH CHECK would reject it. Running as owner (postgres, rolbypassrls
--       = TRUE) bypasses both the GRANT and RLS layers.
-- - search_path is pinned to '' (empty) and every object is fully qualified
--   (public.profiles): strongest hardening for a SECURITY DEFINER function, so a
--   search_path hijack cannot redirect writes to an attacker-controlled object.
-- - ON CONFLICT (id) DO NOTHING makes the insert idempotent (AC: trigger does
--   not fail if the profiles row already exists). A new auth user whose email
--   collides with an existing profile email (e.g. a seed profile in the local
--   emulator) still raises unique_violation on profiles.email — this is
--   intentional, on-spec behavior; verify with an email NOT present in seed.sql.
-- - EXECUTE is revoked from PUBLIC: trigger-fired invocations do NOT require
--   EXECUTE on the trigger function (verified in the local emulator), so this
--   only blocks direct invocation of the SECURITY DEFINER function by arbitrary
--   roles (defense-in-depth; a direct call would fail on unassigned NEW anyway).
-- - NULL-email guard deliberately omitted: magic-link-only auth (enable_signup
--   = false, config.toml) guarantees email is always present on real users.

-- ---------------------------------------------------------------------------
-- 1. Trigger function: create profiles row on auth.users INSERT.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, manager_id, department, created_at, updated_at)
  values (new.id, new.email, '', 'employee', null, null, now(), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Revoke direct invocation by arbitrary roles (verified safe: trigger-fired
-- invocations do not require EXECUTE).
revoke execute on function public.handle_new_user() from public;

-- ---------------------------------------------------------------------------
-- 2. Trigger on auth.users: fire after any INSERT (any source — GoTrue magic
--    link sign-in or direct SQL), in the same transaction as the sign-up.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
