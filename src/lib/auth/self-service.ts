import type { SupabaseClient } from "@supabase/supabase-js";

import { type DbRole, isDbRole } from "@/lib/auth/route-guards";
import { getSessionUserId } from "@/lib/supabase/proxy";

/**
 * Returns the current caller when they are authenticated, have a readable
 * profile, and their role is not `sys_admin`; otherwise returns `null`.
 *
 * The passed client MUST be a `createProxyClient`-derived cookie-aware client
 * (never the `server.ts` no-op `setAll` client) so auth cookies round-trip
 * correctly. Returns `null` for unauthenticated, unreadable-profile, and
 * `sys_admin` callers. Managers and `hr_admin` may submit their own leave
 * (decision 5). The `sys_admin` exclusion mirrors RLS `auth_leaves_insert_own`
 * (`employee_id = auth.uid() AND role <> sys_admin`) so API-level checks and
 * DB-level RLS agree.
 */
export async function requireSelfServiceUser(
  supabase: SupabaseClient,
): Promise<{ id: string; role: DbRole; managerId: string | null } | null> {
  const userId = await getSessionUserId(supabase);
  if (userId === null) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("role, manager_id").eq("id", userId).maybeSingle();
  if (error || data === null) {
    return null;
  }

  const role = data.role;
  if (typeof role !== "string" || !isDbRole(role)) {
    return null;
  }

  if (role === "sys_admin") {
    return null;
  }

  return { id: userId, role, managerId: data.manager_id ?? null };
}
