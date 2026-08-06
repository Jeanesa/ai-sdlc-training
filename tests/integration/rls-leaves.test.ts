import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ANDRES_ID,
  BIANCA_ID,
  EXTRA_EMPLOYEE_ID,
  FIXTURE_DIRECT_REPORT_LEAF_ID,
  FIXTURE_HR_UPDATE_LEAF_ID,
  FIXTURE_NON_DIRECT_LEAF_ID,
  FIXTURE_OTHER_LEAF_ID,
  FIXTURE_OWN_LEAF_ID,
  createRoleClients,
  createServiceClient,
  expectBlocked,
  expectData,
  insertFixtureLeaves,
  type Role,
} from "./helpers";

let clients: Record<Role, SupabaseClient>;

beforeAll(async () => {
  clients = await createRoleClients();
  const service = createServiceClient();
  await insertFixtureLeaves(service);
});

describe("Employee RLS on leaves", () => {
  it("SELECTs own leaves and returns records", async () => {
    const data = expectData(
      await clients.employee.from("leaves").select("*").eq("employee_id", ANDRES_ID),
    );
    expect(data.length).toBeGreaterThan(0);
    expect(data.some((row) => row.id === FIXTURE_OWN_LEAF_ID)).toBe(true);
  });

  it("SELECTs another employee's leaves and returns empty (RLS)", async () => {
    const { data, error } = await clients.employee
      .from("leaves")
      .select("*")
      .eq("employee_id", BIANCA_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot DELETE leaves (blocked via policy stack, 42501)", async () => {
    const result = await clients.employee.from("leaves").delete().eq("id", FIXTURE_OWN_LEAF_ID);
    expectBlocked(result);
  });
});

describe("Manager RLS on leaves", () => {
  it("SELECTs a direct report's leaves and returns records", async () => {
    const data = expectData(
      await clients.manager.from("leaves").select("*").eq("employee_id", ANDRES_ID),
    );
    expect(data.length).toBeGreaterThan(0);
    expect(data.some((row) => row.id === FIXTURE_DIRECT_REPORT_LEAF_ID)).toBe(true);
  });

  it("SELECTs a non-direct-report's leaves and returns empty (RLS)", async () => {
    const { data, error } = await clients.manager
      .from("leaves")
      .select("*")
      .eq("employee_id", EXTRA_EMPLOYEE_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("HR Admin RLS on leaves", () => {
  it("SELECTs all leaves (every fixture row is visible)", async () => {
    const data = expectData(await clients.hr_admin.from("leaves").select("*"));
    const ids = data.map((row) => row.id);
    expect(ids).toContain(FIXTURE_OWN_LEAF_ID);
    expect(ids).toContain(FIXTURE_DIRECT_REPORT_LEAF_ID);
    expect(ids).toContain(FIXTURE_HR_UPDATE_LEAF_ID);
    expect(ids).toContain(FIXTURE_OTHER_LEAF_ID);
    expect(ids).toContain(FIXTURE_NON_DIRECT_LEAF_ID);
  });

  it("UPDATEs any leave successfully", async () => {
    const data = expectData(
      await clients.hr_admin
        .from("leaves")
        .update({ status: "APPROVED", manager_note: "HR update fixture" })
        .eq("id", FIXTURE_HR_UPDATE_LEAF_ID)
        .select("*"),
    );
    expect(data.length).toBe(1);
    expect(data[0].status).toBe("APPROVED");
  });
});

describe("Sys Admin RLS", () => {
  it("SELECTs leaves and returns an empty set", async () => {
    const { data, error } = await clients.sys_admin.from("leaves").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("SELECTs profiles and returns records", async () => {
    const data = expectData(await clients.sys_admin.from("profiles").select("*"));
    expect(data.length).toBeGreaterThan(0);
    const emails = data.map((row) => row.email);
    expect(emails).toContain("sam.yap@stratpoint.com");
  });
});
