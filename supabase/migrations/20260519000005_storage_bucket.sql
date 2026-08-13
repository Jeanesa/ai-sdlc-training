-- TASK-018: private 'supporting-docs' storage bucket + per-role storage.objects policies.
--
-- Role model mirrored from TASK-011 (20260519000002_rls_policies.sql):
-- - Role checks use the SECURITY DEFINER helper public.current_user_role() (bypasses
--   profiles RLS; avoids the infinite-recursion profiles self-reference).
-- - Direct reports resolve via the same subquery TASK-011 uses on leaves:
--     ... in (select id from public.profiles where manager_id = auth.uid())
--   (id cast to ::text to compare against the text folder segment). The subquery is
--   itself RLS-scoped by TASK-011's profiles policies, so a non-manager can never
--   enumerate other employees' ids through it.
-- - Own-row policies carry the <> 'sys_admin' guard, mirroring auth_leaves_insert_own /
--   auth_leaves_select_own: Sys Admin gets no leaves and no supporting docs regardless
--   of data.
-- - service_role has rolbypassrls = TRUE, so RLS policies never apply to it; it is
--   durably excluded from hard delete by the protect_objects_delete trigger (see the
--   delete-posture note below). anon gets no policies -> RLS default-deny returns empty.
-- - No UPDATE policy (no silent overwrite/replacement of a submitted document) and no
--   DELETE policy (retention, FR-DATA-001/002).
--
-- Honest DELETE posture (verified against the local emulator):
-- - User roles (employee/manager/hr_admin) get 403 from the Storage API because no
--   DELETE policy exists (RLS default-deny for authenticated).
-- - Direct SQL DELETE on storage.objects is blocked for EVERY role (incl. service_role
--   and postgres) by the stock protect_objects_delete trigger (storage.protect_delete()
--   raises 42501 unless the session sets storage.allow_delete_query = 'true').
-- - The emulator's postgres role is non-superuser and neither owner nor grantor of
--   storage.objects, so a migration cannot revoke its platform-owned grants — the REVOKE
--   is intentionally omitted; hard-delete is durably prevented by the shipped
--   protect_objects_delete trigger (all roles) + no DELETE policy (403 for users) + the
--   app exposing no delete path.
-- - A service-key DELETE through the Storage API is architecturally possible: the Storage
--   server runs as supabase_storage_admin (owner of storage.objects; RLS not forced, so
--   RLS never applies to it) and sets the allow-delete GUC for its own deletes. It is
--   intentionally UNUSED: the app exposes no delete path (TASK-024 defines no delete
--   method; TASK-025/029 expose none).
--
-- Idempotency (AGENTS.md): DROP POLICY IF EXISTS before each CREATE POLICY; bucket insert
-- uses ON CONFLICT (id) DO NOTHING. supabase db reset re-applies cleanly.
--
-- RLS on storage.objects is ALREADY enabled by the Supabase stock schema (verified:
-- relrowsecurity = true); no ALTER TABLE ... ENABLE ROW LEVEL SECURITY is emitted.

-- ---------------------------------------------------------------------------
-- 1. Bucket row (private; 5 MB limit; PDF + image/* MIME types).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('supporting-docs', 'supporting-docs', false, 5242880, array['application/pdf', 'image/*'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. storage.objects policies (authenticated).
--    Path convention: supporting-docs/{employeeId}/{uuid}{ext} — the first folder
--    segment is auth.uid()::text; storage.foldername(name)[1] is that segment.
-- ---------------------------------------------------------------------------

-- Employee: INSERT (upload) only under own path; Sys Admin excluded.
drop policy if exists "auth_storage_insert_own" on storage.objects;
create policy "auth_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'supporting-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() <> 'sys_admin');

-- Employee: SELECT own objects; Sys Admin excluded.
drop policy if exists "auth_storage_select_own" on storage.objects;
create policy "auth_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'supporting-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() <> 'sys_admin');

-- Manager: SELECT direct reports' objects.
drop policy if exists "auth_storage_select_direct_reports" on storage.objects;
create policy "auth_storage_select_direct_reports" on storage.objects
  for select to authenticated
  using (bucket_id = 'supporting-docs'
    and (storage.foldername(name))[1] in (select id::text from public.profiles where manager_id = auth.uid()));

-- HR Admin: SELECT all objects in the bucket.
drop policy if exists "auth_storage_select_hr" on storage.objects;
create policy "auth_storage_select_hr" on storage.objects
  for select to authenticated
  using (bucket_id = 'supporting-docs' and public.current_user_role() = 'hr_admin');
