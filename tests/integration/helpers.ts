import {
  createClient,
  type PostgrestError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { expect } from "vitest";

export type Role = "employee" | "manager" | "hr_admin" | "sys_admin";

export const ANDRES_ID = "20000000-0000-4000-8000-000000000001";
export const BIANCA_ID = "30000000-0000-4000-8000-000000000001";
export const EXTRA_EMPLOYEE_ID = "60000000-0000-4000-8000-000000000001";

const PASSWORD = "Task-016-Integration!";

const SEED_USERS: readonly { role: Role; id: string; email: string }[] = [
  { role: "manager", id: "10000000-0000-4000-8000-000000000001", email: "maya.delacruz@stratpoint.com" },
  { role: "employee", id: ANDRES_ID, email: "andres.lopez@stratpoint.com" },
  { role: "hr_admin", id: "40000000-0000-4000-8000-000000000001", email: "gina.herrera@stratpoint.com" },
  { role: "sys_admin", id: "50000000-0000-4000-8000-000000000001", email: "sam.yap@stratpoint.com" },
];

export const EXTRA_EMPLOYEE = {
  id: EXTRA_EMPLOYEE_ID,
  email: "e2e.other.employee@stratpoint.com",
  role: "employee",
} as const;

export const FIXTURE_OWN_LEAF_ID = "20000000-0000-4000-8000-000000000201";
export const FIXTURE_DIRECT_REPORT_LEAF_ID = "20000000-0000-4000-8000-000000000202";
export const FIXTURE_HR_UPDATE_LEAF_ID = "20000000-0000-4000-8000-000000000203";
export const FIXTURE_OTHER_LEAF_ID = "30000000-0000-4000-8000-000000000201";
export const FIXTURE_NON_DIRECT_LEAF_ID = "60000000-0000-4000-8000-000000000201";

const FIXTURE_LEAVES = [
  {
    id: FIXTURE_OWN_LEAF_ID,
    employee_id: ANDRES_ID,
    leave_type: "Annual Leave",
    start_date: "2026-09-01",
    end_date: "2026-09-03",
    reason: "Own leave fixture",
    status: "PENDING",
  },
  {
    id: FIXTURE_DIRECT_REPORT_LEAF_ID,
    employee_id: ANDRES_ID,
    leave_type: "Sick Leave",
    start_date: "2026-09-08",
    end_date: "2026-09-09",
    reason: "Direct-report fixture",
    status: "PENDING",
  },
  {
    id: FIXTURE_HR_UPDATE_LEAF_ID,
    employee_id: ANDRES_ID,
    leave_type: "Emergency Leave",
    start_date: "2026-09-15",
    end_date: "2026-09-15",
    reason: "HR update target",
    status: "PENDING",
  },
  {
    id: FIXTURE_OTHER_LEAF_ID,
    employee_id: BIANCA_ID,
    leave_type: "Annual Leave",
    start_date: "2026-10-01",
    end_date: "2026-10-02",
    reason: "Other employee fixture",
    status: "PENDING",
  },
  {
    id: FIXTURE_NON_DIRECT_LEAF_ID,
    employee_id: EXTRA_EMPLOYEE_ID,
    leave_type: "Annual Leave",
    start_date: "2026-11-01",
    end_date: "2026-11-02",
    reason: "Non-direct-report fixture",
    status: "PENDING",
  },
] as const;

export function getEnv(): { supabaseUrl: string; anonKey: string; serviceRoleKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
        "SUPABASE_SERVICE_ROLE_KEY). Run `supabase start` and provide them via .env.local or CI env.",
    );
  }
  return { supabaseUrl, anonKey, serviceRoleKey };
}

export function createServiceClient(): SupabaseClient {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

export function createAnonClient(): SupabaseClient {
  const { supabaseUrl, anonKey } = getEnv();
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
}

function seedEmail(role: Role): string {
  const user = SEED_USERS.find((u) => u.role === role);
  if (!user) {
    throw new Error(`No seed user for role ${role}`);
  }
  return user.email;
}

function isAlreadyRegistered(error: { message?: string } | null): boolean {
  return !error || /already/i.test(error.message ?? "") || /duplicate/i.test(error.message ?? "");
}

export async function ensureSeededUsers(service: SupabaseClient): Promise<void> {
  for (const user of SEED_USERS) {
    const { error } = await service.auth.admin.createUser({
      id: user.id,
      email: user.email,
      email_confirm: true,
      password: PASSWORD,
    });
    if (!isAlreadyRegistered(error)) {
      throw error;
    }
  }
}

export async function ensureExtraEmployee(service: SupabaseClient): Promise<string> {
  const created = await service.auth.admin.createUser({
    id: EXTRA_EMPLOYEE.id,
    email: EXTRA_EMPLOYEE.email,
    email_confirm: true,
    password: PASSWORD,
  });
  if (!isAlreadyRegistered(created.error)) {
    throw created.error;
  }
  let userId: string | undefined;
  if (created.error) {
    const { data: listed, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      throw listError;
    }
    userId = listed?.users?.find((u) => u.email === EXTRA_EMPLOYEE.email)?.id;
  } else {
    userId = created.data.user?.id;
  }
  if (!userId) {
    throw new Error(`Extra employee auth user not found for ${EXTRA_EMPLOYEE.email}`);
  }
  const { error: upsertError } = await service
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: EXTRA_EMPLOYEE.email,
        full_name: "E2E Other Employee",
        role: "employee",
        manager_id: null,
        department: "QA",
      },
      { onConflict: "id" },
    );
  if (upsertError) {
    throw upsertError;
  }
  return userId;
}

export async function insertFixtureLeaves(service: SupabaseClient): Promise<void> {
  const { error } = await service.from("leaves").upsert(FIXTURE_LEAVES, { onConflict: "id" });
  if (error) {
    throw error;
  }
}

export async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) {
    throw error;
  }
  if (!data.session) {
    throw new Error(`No session returned for ${email}`);
  }
  await client.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return client;
}

export async function createRoleClients(): Promise<Record<Role, SupabaseClient>> {
  const service = createServiceClient();
  await ensureSeededUsers(service);
  await ensureExtraEmployee(service);
  return {
    employee: await signInAs(seedEmail("employee")),
    manager: await signInAs(seedEmail("manager")),
    hr_admin: await signInAs(seedEmail("hr_admin")),
    sys_admin: await signInAs(seedEmail("sys_admin")),
  };
}

export function expectBlocked(result: { error: PostgrestError | null }): void {
  expect(result.error?.code).toBe("42501");
}

export function expectData<T>(result: { data: T | null; error: PostgrestError | null }): T {
  expect(result.error).toBeNull();
  expect(result.data).toBeTruthy();
  if (result.data === null) {
    throw new Error("Expected rows, but the query returned null.");
  }
  return result.data;
}

const MAILPIT_BASE = (process.env.MAILPIT_URL ?? "http://127.0.0.1:54324").replace(/\/$/, "");

export async function waitForOtpEmail(email: string, timeoutMs = 10_000): Promise<void> {
  const url = `${MAILPIT_BASE}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`;
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const res = await fetch(url);
    lastStatus = res.status;
    if (res.ok) {
      const body = (await res.json()) as { messages?: unknown[] };
      if (Array.isArray(body.messages) && body.messages.length > 0) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `No OTP email arrived for ${email} within ${timeoutMs}ms (Mailpit ${url} -> ${lastStatus})`,
  );
}
