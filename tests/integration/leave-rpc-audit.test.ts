import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/leaves/route";
import {
  ANDRES_ID,
  createRoleClients,
  createServiceClient,
  expectData,
  getEnv,
  insertFixtureLeaves,
  signInAs,
  type Role,
} from "./helpers";

const MAYA_ID = "10000000-0000-4000-8000-000000000001";

let clients: Record<Role, SupabaseClient>;
let service: SupabaseClient;

beforeAll(async () => {
  clients = await createRoleClients();
  service = createServiceClient();
  await insertFixtureLeaves(service);
});

describe("Leave RPCs via service client", () => {
  let submittedId: string;

  it("submit_leave_request returns PENDING row with correct actor", async () => {
    const { data: rpcRow, error } = await service.rpc("submit_leave_request", {
      p_actor: ANDRES_ID,
      p_leave_type: "Annual Leave",
      p_start_date: "2026-12-01",
      p_end_date: "2026-12-03",
      p_reason: "Integration test leave for TASK-033 RPC layer",
      p_supporting_doc_path: null,
    });
    expect(error).toBeNull();
    expect(rpcRow).not.toBeNull();
    expect(rpcRow!.status).toBe("PENDING");
    expect(rpcRow!.employee_id).toBe(ANDRES_ID);
    submittedId = rpcRow!.id;

    const { data: auditRows } = await service
      .from("audit_log")
      .select("*")
      .eq("table_name", "leaves")
      .eq("record_id", submittedId);
    expect(auditRows).not.toBeNull();
    expect(auditRows!.length).toBeGreaterThanOrEqual(1);
    const submittedAudit = auditRows!.find(
      (r: { action: string }) => r.action === "SUBMITTED",
    );
    expect(submittedAudit).toBeDefined();
    expect(submittedAudit!.actor_id).toBe(ANDRES_ID);
  });

  it("cancel_leave_request returns CANCELLED with correct actor", async () => {
    const { data: rpcRow, error } = await service.rpc("cancel_leave_request", {
      p_actor: ANDRES_ID,
      p_leave_id: submittedId,
    });
    expect(error).toBeNull();
    expect(rpcRow).not.toBeNull();
    expect(rpcRow!.status).toBe("CANCELLED");
    expect(rpcRow!.id).toBe(submittedId);

    const { data: auditRows } = await service
      .from("audit_log")
      .select("*")
      .eq("table_name", "leaves")
      .eq("record_id", submittedId);
    expect(auditRows).not.toBeNull();
    const cancelledAudit = auditRows!.find(
      (r: { action: string }) => r.action === "CANCELLED",
    );
    expect(cancelledAudit).toBeDefined();
    expect(cancelledAudit!.actor_id).toBe(ANDRES_ID);
  });

  it("cancel on APPROVED request returns NULL (PENDING-only rule)", async () => {
    const { data: approvedRow, error: submitErr } = await service.rpc(
      "submit_leave_request",
      {
        p_actor: ANDRES_ID,
        p_leave_type: "Annual Leave",
        p_start_date: "2026-12-10",
        p_end_date: "2026-12-12",
        p_reason: "Integration test APPROVED fixture for cancel guard",
        p_supporting_doc_path: null,
      },
    );
    expect(submitErr).toBeNull();
    expect(approvedRow).not.toBeNull();

    const { error: updateErr } = await service
      .from("leaves")
      .update({ status: "APPROVED" })
      .eq("id", approvedRow!.id);
    expect(updateErr).toBeNull();

    const { data: rpcRow, error } = await service.rpc("cancel_leave_request", {
      p_actor: ANDRES_ID,
      p_leave_id: approvedRow!.id,
    });
    expect(error).toBeNull();
    expect(rpcRow).not.toBeNull();
    expect(rpcRow!.id).toBeNull();
    expect(rpcRow!.status).toBeNull();
  });
});

describe("RLS enforcement on leaves and audit_log", () => {
  // Leaf RLS (employee own/other, manager direct-report, HR admin all, sys admin
  // empty) is covered by rls-leaves.test.ts. Audit INSERT/DELETE blocks are
  // covered by rls-audit-log.test.ts. Below are assertions unique to TASK-033.

  it("employee UPDATE on own leaves matches zero rows (RLS restricts visible rows)", async () => {
    const { data, error } = await clients.employee
      .from("leaves")
      .update({ status: "APPROVED" })
      .eq("employee_id", ANDRES_ID)
      .eq("status", "PENDING")
      .select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("audit_log: hr_admin can SELECT audit rows", async () => {
    const data = expectData(
      await clients.hr_admin.from("audit_log").select("*"),
    );
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("audit_log: employee SELECT returns empty (RLS)", async () => {
    const { data, error } = await clients.employee
      .from("audit_log")
      .select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("audit_log: manager SELECT returns empty (RLS)", async () => {
    const { data, error } = await clients.manager
      .from("audit_log")
      .select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("audit_log: sys_admin SELECT returns empty (RLS)", async () => {
    const { data, error } = await clients.sys_admin
      .from("audit_log")
      .select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("POST /api/leaves end-to-end", () => {
  const { supabaseUrl } = getEnv();
  const COOKIE_NAME = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase Session is not indexable
  function cookieHeader(session: any): string {
    const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
    return `${COOKIE_NAME}=${value}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeRequest(session: any, formData: FormData): NextRequest {
    return new NextRequest("http://localhost:3000/api/leaves", {
      method: "POST",
      headers: { cookie: cookieHeader(session) },
      body: formData,
    });
  }

  it("spike: authenticated employee gets 201", async () => {
    const client = await signInAs("andres.lopez@stratpoint.com");
    const {
      data: { session },
    } = await client.auth.getSession();
    expect(session).not.toBeNull();

    const formData = new FormData();
    formData.append("leaveType", "Annual Leave");
    formData.append("startDate", "2026-12-20");
    formData.append("endDate", "2026-12-22");
    formData.append("reason", "Integration test E2E spike for TASK-033");

    const response = await POST(makeRequest(session!, formData));
    expect(response.status).toBe(201);
  });

  it("happy submit returns 201 with PENDING row and SUBMITTED audit", async () => {
    const client = await signInAs("andres.lopez@stratpoint.com");
    const {
      data: { session },
    } = await client.auth.getSession();
    expect(session).not.toBeNull();

    const formData = new FormData();
    formData.append("leaveType", "Annual Leave");
    formData.append("startDate", "2026-12-20");
    formData.append("endDate", "2026-12-22");
    formData.append("reason", "Integration test E2E happy path for TASK-033");

    const response = await POST(makeRequest(session!, formData));
    expect(response.status).toBe(201);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.id).toBeDefined();
    expect(body.status).toBe("PENDING");
    expect(body.leaveType).toBe("Annual Leave");
    expect(body.startDate).toBe("2026-12-20");
    expect(body.endDate).toBe("2026-12-22");
    expect(typeof body.workingDays).toBe("number");
    expect(body.conflictWarning).toBe(false);

    const { data: leaves } = await service
      .from("leaves")
      .select("*")
      .eq("id", body.id as string);
    expect(leaves).not.toBeNull();
    expect(leaves!.length).toBe(1);
    expect(leaves![0].employee_id).toBe(ANDRES_ID);
    expect(leaves![0].status).toBe("PENDING");

    const { data: auditRows } = await service
      .from("audit_log")
      .select("*")
      .eq("table_name", "leaves")
      .eq("record_id", body.id as string);
    expect(auditRows).not.toBeNull();
    const submittedAudit = auditRows!.find(
      (r: { action: string }) => r.action === "SUBMITTED",
    );
    expect(submittedAudit).toBeDefined();
    expect(submittedAudit!.actor_id).toBe(ANDRES_ID);
  });

  it("zero-balance block returns 422 and inserts no row", async () => {
    const client = await signInAs("maya.delacruz@stratpoint.com");
    const {
      data: { session },
    } = await client.auth.getSession();
    expect(session).not.toBeNull();

    const formData = new FormData();
    formData.append("leaveType", "Annual Leave");
    formData.append("startDate", "2026-12-25");
    formData.append("endDate", "2026-12-27");
    formData.append("reason", "Integration test E2E zero-balance for TASK-033");

    const response = await POST(makeRequest(session!, formData));
    expect(response.status).toBe(422);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
    expect((body.error as Record<string, unknown>).code).toBe("BALANCE_ZERO");

    const { data: leaves } = await service
      .from("leaves")
      .select("*")
      .eq("employee_id", MAYA_ID)
      .eq("start_date", "2026-12-25");
    expect(leaves).not.toBeNull();
    expect(leaves!.length).toBe(0);
  });
});
