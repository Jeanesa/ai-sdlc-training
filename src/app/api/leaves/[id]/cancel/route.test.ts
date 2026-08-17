import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/leaves/[id]/cancel/route";
import { requireSelfServiceUser } from "@/lib/auth/self-service";
import type { DbRole } from "@/lib/auth/route-guards";
import { countWorkingDays } from "@/lib/leave/working-days";
import { notificationDispatcher } from "@/lib/notifications";
import { createProxyClient, getSessionUserId } from "@/lib/supabase/proxy";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/proxy", () => ({
  createProxyClient: vi.fn(),
  getSessionUserId: vi.fn(),
}));

vi.mock("@/lib/auth/self-service", () => ({
  requireSelfServiceUser: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/leave/working-days", () => ({
  countWorkingDays: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notificationDispatcher: { sendCancelToManager: vi.fn() },
}));

const CALLER_ID = "20000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "30000000-0000-4000-8000-000000000001";
const LEAF_ID = "20000000-0000-4000-8000-000000000201";
const START_DATE = "2030-06-03";
const END_DATE = "2030-06-05";
const CALLER = { id: CALLER_ID, role: "employee", managerId: "mgr-uuid" } as const;

const CANCELLED_RPC_ROW = {
  id: LEAF_ID,
  status: "CANCELLED",
  employee_id: CALLER_ID,
  leave_type: "Annual Leave",
  start_date: START_DATE,
  end_date: END_DATE,
} as const;

interface HarnessOptions {
  sessionUserId?: string | null;
  caller?: { id: string; role: DbRole; managerId: string | null } | null;
  rpcResult?: { data: Record<string, unknown> | null; error: unknown };
  disambiguationRead?: { data: Record<string, unknown> | null; error: unknown };
  profileRead?: { data: { full_name: string | null } | null; error: unknown };
  id?: string;
}

function installHarness(options: HarnessOptions = {}) {
  const id = options.id ?? LEAF_ID;
  const request = new NextRequest(
    new URL(`http://localhost:3000/api/leaves/${id}/cancel`),
    { method: "POST" },
  );
  const response = NextResponse.next({ request });

  vi.mocked(getSessionUserId).mockResolvedValue(
    options.sessionUserId === undefined ? CALLER_ID : options.sessionUserId,
  );
  vi.mocked(requireSelfServiceUser).mockResolvedValue(
    options.caller === undefined ? CALLER : options.caller,
  );
  vi.mocked(countWorkingDays).mockReturnValue(3);

  const rpc = vi.fn().mockResolvedValue(
    options.rpcResult ?? { data: null, error: null },
  );

  const disambMaybeSingle = vi.fn().mockResolvedValue(
    options.disambiguationRead ?? { data: null, error: null },
  );
  const disambIs = vi.fn(() => ({ maybeSingle: disambMaybeSingle }));
  const disambEq = vi.fn(() => ({ is: disambIs }));
  const disambSelect = vi.fn(() => ({ eq: disambEq }));
  const serviceFrom = vi.fn(() => ({ select: disambSelect }));

  vi.mocked(createServiceClient).mockReturnValue({
    rpc,
    from: serviceFrom,
  } as unknown as SupabaseClient);

  const profMaybeSingle = vi.fn().mockResolvedValue(
    options.profileRead ?? { data: { full_name: "Jane Doe" }, error: null },
  );
  const profEq = vi.fn(() => ({ maybeSingle: profMaybeSingle }));
  const profSelect = vi.fn(() => ({ eq: profEq }));
  const proxyFrom = vi.fn(() => ({ select: profSelect }));

  vi.mocked(createProxyClient).mockReturnValue({
    supabase: { from: proxyFrom } as unknown as SupabaseClient,
    response,
  });

  const sendCancelToManager = vi.mocked(notificationDispatcher.sendCancelToManager);
  sendCancelToManager.mockResolvedValue(undefined);

  return {
    request,
    response,
    rpc,
    serviceFrom,
    proxyFrom,
    sendCancelToManager,
  };
}

beforeEach(() => {
  vi.mocked(createProxyClient).mockReset();
  vi.mocked(getSessionUserId).mockReset();
  vi.mocked(requireSelfServiceUser).mockReset();
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(countWorkingDays).mockReset();
  vi.mocked(notificationDispatcher.sendCancelToManager).mockReset();
});

describe("POST /api/leaves/[id]/cancel", () => {
  it("returns 401 for an unauthenticated caller with no DB or RPC calls", async () => {
    const { request, rpc, serviceFrom, sendCancelToManager } = installHarness({
      sessionUserId: null,
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required." },
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated sys_admin (guard returns null)", async () => {
    const { request, rpc, serviceFrom, sendCancelToManager } = installHarness({
      caller: null,
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "This account cannot submit leave requests." },
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed UUID with no DB or RPC calls", async () => {
    const { request, rpc, serviceFrom, sendCancelToManager } = installHarness({
      id: "not-a-uuid",
    });

    const res = await POST(request, { params: Promise.resolve({ id: "not-a-uuid" }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Leave request not found." },
    });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 500 when the cancel RPC fails", async () => {
    const { request, serviceFrom, sendCancelToManager } = installHarness({
      rpcResult: { data: null, error: { message: "db error" } },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "CANCEL_FAILED", message: "Failed to cancel the leave request." },
    });
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 200 with CANCELLED status for an owned PENDING request and dispatches notification", async () => {
    const { request, rpc, serviceFrom, sendCancelToManager } = installHarness({
      rpcResult: { data: CANCELLED_RPC_ROW, error: null },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: LEAF_ID, status: "CANCELLED" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("cancel_leave_request", {
      p_actor: CALLER_ID,
      p_leave_id: LEAF_ID,
    });
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(sendCancelToManager).toHaveBeenCalledTimes(1);
    expect(sendCancelToManager).toHaveBeenCalledWith({
      employeeName: "Jane Doe",
      leaveType: "Annual Leave",
      startDate: START_DATE,
      endDate: END_DATE,
      workingDays: 3,
      requestLink: `/manager/pending?request=${LEAF_ID}`,
    });
  });

  it("falls back to empty employeeName when the profile read fails on the 200 path", async () => {
    const { request, sendCancelToManager } = installHarness({
      rpcResult: { data: CANCELLED_RPC_ROW, error: null },
      profileRead: { data: null, error: { message: "db error" } },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(200);
    expect(sendCancelToManager).toHaveBeenCalledWith(
      expect.objectContaining({ employeeName: "" }),
    );
  });

  it("does not await the notification before responding (fire-and-forget)", async () => {
    const { request, sendCancelToManager } = installHarness({
      rpcResult: { data: CANCELLED_RPC_ROW, error: null },
    });
    sendCancelToManager.mockReturnValue(new Promise<void>(() => {}));

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: LEAF_ID, status: "CANCELLED" });
  });

  it("returns 409 ALREADY_DECIDED with the current status for an APPROVED request", async () => {
    const { request, serviceFrom, sendCancelToManager } = installHarness({
      disambiguationRead: {
        data: { employee_id: CALLER_ID, status: "APPROVED" },
        error: null,
      },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: { code: "ALREADY_DECIDED", message: "Only PENDING requests can be cancelled." },
      id: LEAF_ID,
      status: "APPROVED",
    });
    expect(serviceFrom).toHaveBeenCalledWith("leaves");
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 409 ALREADY_DECIDED with CANCELLED status for an already-cancelled request", async () => {
    const { request, sendCancelToManager } = installHarness({
      disambiguationRead: {
        data: { employee_id: CALLER_ID, status: "CANCELLED" },
        error: null,
      },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_DECIDED");
    expect(body.status).toBe("CANCELLED");
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 403 with no record details for another user's request", async () => {
    const { request, sendCancelToManager } = installHarness({
      disambiguationRead: {
        data: { employee_id: OTHER_USER_ID, status: "PENDING" },
        error: null,
      },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "FORBIDDEN", message: "This leave request belongs to another user." },
    });
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("status");
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 404 when the record does not exist", async () => {
    const { request, sendCancelToManager } = installHarness({
      disambiguationRead: { data: null, error: null },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Leave request not found." },
    });
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 404 when the record is soft-deleted (deleted_at IS NULL filter)", async () => {
    const { request, sendCancelToManager } = installHarness({
      disambiguationRead: { data: null, error: null },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(404);
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 500 when the disambiguation read fails", async () => {
    const { request, sendCancelToManager } = installHarness({
      disambiguationRead: { data: null, error: { message: "db down" } },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "LEAVE_READ_FAILED", message: "Could not read the leave request." },
    });
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("returns 500 UNEXPECTED_STATE when RPC returns NULL but read shows owned PENDING", async () => {
    const { request, sendCancelToManager } = installHarness({
      disambiguationRead: {
        data: { employee_id: CALLER_ID, status: "PENDING" },
        error: null,
      },
    });

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "UNEXPECTED_STATE", message: "Could not cancel the leave request." },
    });
    expect(sendCancelToManager).not.toHaveBeenCalled();
  });

  it("propagates proxy response cookies onto the 200 response", async () => {
    const { request, response } = installHarness({
      rpcResult: { data: CANCELLED_RPC_ROW, error: null },
    });
    response.cookies.set("sb-refresh-token", "rotated");

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(200);
    expect(res.cookies.get("sb-refresh-token")?.value).toBe("rotated");
  });

  it("propagates proxy response cookies onto error responses", async () => {
    const { request, response } = installHarness({ sessionUserId: null });
    response.cookies.set("sb-refresh-token", "rotated");

    const res = await POST(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(401);
    expect(res.cookies.get("sb-refresh-token")?.value).toBe("rotated");
  });
});
