// End-to-end role-guard checks for TASK-014.
//
// Usage (Supabase local emulator):
//   1. supabase start
//   2. supabase db reset
//   3. npm run dev   (Next.js dev server on http://localhost:3000)
//   4. node --env-file=.env.local scripts/mint-test-sessions.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY in .env.local (service key optional: without it the
// script can only check unauthenticated redirects).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const PASSWORD = "Task-014-E2E!";

const SEEDED_ROLES = [
  { role: "manager", id: "10000000-0000-4000-8000-000000000001", email: "maya.delacruz@stratpoint.com" },
  { role: "employee", id: "20000000-0000-4000-8000-000000000001", email: "andres.lopez@stratpoint.com" },
  { role: "hr_admin", id: "40000000-0000-4000-8000-000000000001", email: "gina.herrera@stratpoint.com" },
  { role: "sys_admin", id: "50000000-0000-4000-8000-000000000001", email: "sam.yap@stratpoint.com" },
];

const EXPECTED = {
  "/employee/dashboard": {
    "": 307,
    employee: 200,
    manager: 200,
    hr_admin: 200,
    sys_admin: 200,
  },
  "/manager/pending": {
    "": 307,
    employee: "/employee/dashboard",
    manager: 200,
    hr_admin: 200,
    sys_admin: 200,
  },
  "/hradmin/leave-types": {
    "": 307,
    employee: "/employee/dashboard",
    manager: "/manager/pending",
    hr_admin: 200,
    sys_admin: "/sysadmin/users",
  },
  "/sysadmin/users": {
    "": 307,
    employee: "/employee/dashboard",
    manager: "/manager/pending",
    hr_admin: "/hradmin/all-requests",
    sys_admin: 200,
  },
};

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  console.error("Run with: node --env-file=.env.local scripts/mint-test-sessions.mjs");
  process.exit(1);
}

const service = createClient(SUPABASE_URL, SERVICE_KEY ?? "no-service-key", {
  auth: { persistSession: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

const COOKIE_NAME = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

async function ensureUser(seeded) {
  const { error } = await service.auth.admin.createUser({
    id: seeded.id,
    email: seeded.email,
    email_confirm: true,
    password: PASSWORD,
  });
  if (!error || /already registered|already exists|duplicate/i.test(error.message ?? "")) {
    return seeded.email;
  }
  const email = `e2e.${seeded.role}@stratpoint.com`;
  const { data: existing } = await service.auth.admin.listUsers({ perPage: 1000 });
  const found = existing?.users?.find((user) => user.email === email);
  let userId = found?.id;
  if (!userId) {
    const { data, error: createError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      password: PASSWORD,
    });
    if (createError) {
      throw createError;
    }
    userId = data.user.id;
  }
  const { error: upsertError } = await service
    .from("profiles")
    .upsert({ id: userId, email, role: seeded.role }, { onConflict: "id" });
  if (upsertError) {
    throw upsertError;
  }
  return email;
}

async function getSession(email) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) {
    throw error;
  }
  return data.session;
}

function cookieHeader(session) {
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  return `${COOKIE_NAME}=${value}`;
}

async function probe(path, session) {
  const headers = session ? { cookie: cookieHeader(session) } : {};
  const res = await fetch(`${APP_URL}${path}`, { redirect: "manual", headers });
  return { status: res.status, location: res.headers.get("location") ?? "" };
}

function passed(actual, expected) {
  if (typeof expected === "number") {
    return actual.status === expected;
  }
  return actual.status === 307 && actual.location.includes(expected);
}

async function main() {
  const sessions = {};
  if (SERVICE_KEY) {
    for (const seeded of SEEDED_ROLES) {
      const email = await ensureUser(seeded);
      sessions[seeded.role] = await getSession(email);
    }
  } else {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set - only unauthenticated redirects will be checked.");
  }

  const failures = [];
  for (const [path, cases] of Object.entries(EXPECTED)) {
    for (const [role, expected] of Object.entries(cases)) {
      const session = role === "" ? null : sessions[role];
      const actual = await probe(path, session);
      const ok = passed(actual, expected);
      const label = role === "" ? "no-session" : role;
      console.log(
        `${ok ? "PASS" : "FAIL"}  ${label.padEnd(10)} ${path} -> status=${actual.status} location=${actual.location || "-"}`,
      );
      if (!ok) {
        failures.push(
          `${label} ${path}: expected ${typeof expected === "number" ? `status ${expected}` : `redirect to ${expected}`}, got status ${actual.status}${actual.location ? `, location ${actual.location}` : ""}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} assertion(s) failed:`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
  console.log("\nAll role-guard assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
