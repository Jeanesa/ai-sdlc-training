import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, it } from "vitest";

import {
  FIXTURE_OWN_LEAF_ID,
  createRoleClients,
  expectBlocked,
  type Role,
} from "./helpers";

let clients: Record<Role, SupabaseClient>;

beforeAll(async () => {
  clients = await createRoleClients();
});

const ALL_ROLES: readonly Role[] = ["employee", "manager", "hr_admin", "sys_admin"];

describe("audit_log is append-only for all roles", () => {
  it.each(ALL_ROLES)("%s cannot DELETE audit_log", async (role) => {
    const result = await clients[role]
      .from("audit_log")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    expectBlocked(result);
  });

  it.each(ALL_ROLES)("%s cannot INSERT audit_log", async (role) => {
    const result = await clients[role].from("audit_log").insert({
      table_name: "leaves",
      record_id: FIXTURE_OWN_LEAF_ID,
      action: "SUBMITTED",
    });
    expectBlocked(result);
  });
});
