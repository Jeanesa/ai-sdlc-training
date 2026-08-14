import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/leaves/route";
import { requireSelfServiceUser } from "@/lib/auth/self-service";
import type { DbRole } from "@/lib/auth/route-guards";
import {
  SupportingDocError,
  getSupportingDocSignedUrl,
  uploadSupportingDoc,
} from "@/lib/leave/storage";
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

vi.mock("@/lib/leave/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/leave/storage")>();
  return {
    ...actual,
    uploadSupportingDoc: vi.fn(),
    getSupportingDocSignedUrl: vi.fn(),
  };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notificationDispatcher: { sendNewRequestToManager: vi.fn() },
}));

const CALLER_ID = "20000000-0000-4000-8000-000000000001";
const MANAGER_ID = "10000000-0000-4000-8000-000000000001";
const LEAF_ID = "20000000-0000-4000-8000-000000000201";
const START_DATE = "2030-06-03";
const END_DATE = "2030-06-05";
const REASON = "Family vacation and travel plans";
const CURRENT_YEAR = new Date().getUTCFullYear();
const CALLER = { id: CALLER_ID, role: "employee", managerId: MANAGER_ID } as const;

type TableName = "leave_balances" | "leaves" | "profiles";

interface FakeClientConfig {
  balances?: { total_days: number; used_days: number } | null;
  leaves?: { id: string } | null;
  leavesList?: unknown[] | null;
  profile?: { full_name: string | null } | null;
  errors?: Partial<Record<TableName, unknown>>;
}

interface QueryLog {
  table: string;
  selectCalls: unknown[][];
  eqCalls: unknown[][];
  isCalls: unknown[][];
  lteCalls: unknown[][];
  gteCalls: unknown[][];
  orderCalls: unknown[][];
}

function makeFrom(config: Required<FakeClientConfig>): {
  from: ReturnType<typeof vi.fn>;
  logs: QueryLog[];
} {
  const logs: QueryLog[] = [];
  const from = vi.fn((table: string) => {
    const log: QueryLog = {
      table,
      selectCalls: [],
      eqCalls: [],
      isCalls: [],
      lteCalls: [],
      gteCalls: [],
      orderCalls: [],
    };
    logs.push(log);
    const tableError = (config.errors as Record<string, unknown> | undefined)?.[table];
    const maybeSingle = vi.fn().mockResolvedValue(
      tableError !== undefined
        ? { data: null, error: tableError }
        : {
            data:
              table === "leave_balances"
                ? config.balances
                : table === "leaves"
                  ? config.leaves
                  : table === "profiles"
                    ? config.profile
                    : null,
            error: null,
          },
    );
    const chain = {
      select: vi.fn((...args: unknown[]) => {
        log.selectCalls.push(args);
        return chain;
      }),
      eq: vi.fn((...args: unknown[]) => {
        log.eqCalls.push(args);
        return chain;
      }),
      is: vi.fn((...args: unknown[]) => {
        log.isCalls.push(args);
        return chain;
      }),
      lte: vi.fn((...args: unknown[]) => {
        log.lteCalls.push(args);
        return chain;
      }),
      gte: vi.fn((...args: unknown[]) => {
        log.gteCalls.push(args);
        return chain;
      }),
      order: vi.fn((...args: unknown[]) => {
        log.orderCalls.push(args);
        return Promise.resolve(
          tableError !== undefined
            ? { data: null, error: tableError }
            : { data: table === "leaves" ? config.leavesList : null, error: null },
        );
      }),
      maybeSingle,
    };
    return chain;
  });
  return { from, logs };
}

function makeRequest(form?: (fd: FormData) => void): NextRequest {
  const fd = new FormData();
  fd.set("leaveType", "Annual Leave");
  fd.set("startDate", START_DATE);
  fd.set("endDate", END_DATE);
  fd.set("reason", REASON);
  form?.(fd);
  return new NextRequest(new URL("http://localhost:3000/api/leaves"), {
    method: "POST",
    body: fd,
  });
}

interface HarnessOptions {
  sessionUserId?: string | null;
  caller?: { id: string; role: DbRole; managerId: string | null } | null;
  balances?: { total_days: number; used_days: number } | null;
  leaves?: { id: string } | null;
  profile?: { full_name: string | null } | null;
  errors?: Partial<Record<TableName, unknown>>;
  rpcResult?: { data: { id: string; status: string } | null; error: unknown } | null;
  form?: (fd: FormData) => void;
}

function installHarness(options: HarnessOptions = {}): {
  request: NextRequest;
  response: NextResponse;
  from: ReturnType<typeof vi.fn>;
  logs: QueryLog[];
  rpc: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
  sendNewRequestToManager: ReturnType<typeof vi.fn>;
} {
  const request = makeRequest(options.form);
  const response = NextResponse.next({ request });
  const { from, logs } = makeFrom({
    balances: options.balances === undefined ? { total_days: 15, used_days: 0 } : options.balances,
    leaves: options.leaves === undefined ? null : options.leaves,
    leavesList: null,
    profile: options.profile === undefined ? { full_name: "Andres Lopez" } : options.profile,
    errors: options.errors ?? {},
  });
  vi.mocked(createProxyClient).mockReturnValue({
    supabase: { from } as unknown as SupabaseClient,
    response,
  });
  vi.mocked(getSessionUserId).mockResolvedValue(
    options.sessionUserId === undefined ? CALLER_ID : options.sessionUserId,
  );
  vi.mocked(requireSelfServiceUser).mockResolvedValue(
    options.caller === undefined ? CALLER : options.caller,
  );
  const rpc = vi.fn().mockResolvedValue(
    options.rpcResult === undefined
      ? { data: { id: LEAF_ID, status: "PENDING" }, error: null }
      : options.rpcResult,
  );
  vi.mocked(createServiceClient).mockReturnValue({ rpc } as unknown as SupabaseClient);
  const sendNewRequestToManager = vi.mocked(notificationDispatcher.sendNewRequestToManager);
  sendNewRequestToManager.mockResolvedValue(undefined);
  return {
    request,
    response,
    from,
    logs,
    rpc,
    upload: vi.mocked(uploadSupportingDoc),
    sendNewRequestToManager,
  };
}

beforeEach(() => {
  vi.mocked(createProxyClient).mockReset();
  vi.mocked(getSessionUserId).mockReset();
  vi.mocked(requireSelfServiceUser).mockReset();
  vi.mocked(uploadSupportingDoc).mockReset();
  vi.mocked(getSupportingDocSignedUrl).mockReset();
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(notificationDispatcher.sendNewRequestToManager).mockReset();
});

describe("POST /api/leaves", () => {
  it("returns 401 for an unauthenticated caller with no DB reads or writes", async () => {
    const { request, from, rpc, sendNewRequestToManager } = installHarness({
      sessionUserId: null,
    });

    const res = await POST(request);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required." },
    });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(sendNewRequestToManager).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated sys_admin (guard returns null)", async () => {
    const { request, from, rpc, sendNewRequestToManager } = installHarness({ caller: null });

    const res = await POST(request);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "This account cannot submit leave requests." },
    });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(sendNewRequestToManager).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_LEAVE_TYPE before any DB read", async () => {
    const { request, from } = installHarness({ form: (fd) => fd.set("leaveType", "Annual") });

    const res = await POST(request);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: { code: "INVALID_LEAVE_TYPE", message: "Selected leave type is not valid." },
      fields: {
        leaveType: { code: "INVALID_LEAVE_TYPE", message: "Selected leave type is not valid." },
      },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 400 PAST_START_DATE with a field-level error", async () => {
    const { request, from } = installHarness({
      form: (fd) => fd.set("startDate", "2020-01-01"),
    });

    const res = await POST(request);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("PAST_START_DATE");
    expect(body.fields.startDate.code).toBe("PAST_START_DATE");
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 400 END_BEFORE_START attributed to endDate", async () => {
    const { request } = installHarness({
      form: (fd) => {
        fd.set("startDate", END_DATE);
        fd.set("endDate", START_DATE);
      },
    });

    const res = await POST(request);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("END_BEFORE_START");
    expect(body.fields.endDate.code).toBe("END_BEFORE_START");
  });

  it("returns 400 REASON_TOO_SHORT for a reason under 10 characters", async () => {
    const { request } = installHarness({ form: (fd) => fd.set("reason", "short") });

    const res = await POST(request);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("REASON_TOO_SHORT");
    expect(body.fields.reason.code).toBe("REASON_TOO_SHORT");
  });

  it("returns 400 FILE_ONLY_FOR_SICK_LEAVE for a file on a non-Sick request", async () => {
    const { request, upload } = installHarness({
      form: (fd) =>
        fd.set("file", new File([new Uint8Array(4)], "doc.pdf", { type: "application/pdf" })),
    });

    const res = await POST(request);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_ONLY_FOR_SICK_LEAVE");
    expect(body.fields.file.code).toBe("FILE_ONLY_FOR_SICK_LEAVE");
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns 400 FILE_WRONG_TYPE for a non-PDF/image file on a Sick request", async () => {
    const { request } = installHarness({
      form: (fd) => {
        fd.set("leaveType", "Sick Leave");
        fd.set("file", new File([new Uint8Array(4)], "notes.txt", { type: "text/plain" }));
      },
    });

    const res = await POST(request);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("FILE_WRONG_TYPE");
  });

  it("returns 400 FILE_TOO_LARGE for a file over 5MB on a Sick request", async () => {
    const { request } = installHarness({
      form: (fd) => {
        fd.set("leaveType", "Sick Leave");
        fd.set(
          "file",
          new File([new Uint8Array(5_242_881)], "big.pdf", { type: "application/pdf" }),
        );
      },
    });

    const res = await POST(request);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("FILE_TOO_LARGE");
  });

  it("returns 422 with the verbatim message when Annual Leave balance is 0 and inserts no row", async () => {
    const { request, rpc, upload } = installHarness({
      balances: { total_days: 0, used_days: 0 },
    });

    const res = await POST(request);

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "BALANCE_ZERO",
        message: "You have no remaining Annual Leave balance for this year",
      },
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns 422 when no balance row exists for Annual Leave (missing row blocks)", async () => {
    const { request, rpc } = installHarness({ balances: null });

    const res = await POST(request);

    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toBe(
      "You have no remaining Annual Leave balance for this year",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 500 when the balance read fails and never reaches the RPC", async () => {
    const { request, rpc } = installHarness({
      errors: { leave_balances: { message: "db down" } },
    });

    const res = await POST(request);

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("BALANCE_READ_FAILED");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 500 when the conflict read fails and never reaches the RPC", async () => {
    const { request, rpc } = installHarness({ errors: { leaves: { message: "db down" } } });

    const res = await POST(request);

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("CONFLICT_READ_FAILED");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 201 with exactly the 7-field summary and never echoes the reason", async () => {
    const { request, logs, rpc } = installHarness();

    const res = await POST(request);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      id: LEAF_ID,
      leaveType: "Annual Leave",
      startDate: START_DATE,
      endDate: END_DATE,
      workingDays: 3,
      status: "PENDING",
      conflictWarning: false,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("submit_leave_request", {
      p_actor: CALLER_ID,
      p_leave_type: "Annual Leave",
      p_start_date: START_DATE,
      p_end_date: END_DATE,
      p_reason: REASON,
      p_supporting_doc_path: null,
    });
    const balanceLog = logs.find((log) => log.table === "leave_balances");
    expect(balanceLog?.selectCalls).toEqual([["total_days, used_days"]]);
    expect(balanceLog?.eqCalls).toEqual([
      ["employee_id", CALLER_ID],
      ["leave_type", "Annual Leave"],
      ["year", CURRENT_YEAR],
    ]);
    expect(balanceLog?.isCalls).toEqual([["deleted_at", null]]);
  });

  it("uploads the file before the RPC and passes the returned path as p_supporting_doc_path", async () => {
    const file = new File([new Uint8Array(4)], "doc.pdf", { type: "application/pdf" });
    const { request, rpc, upload } = installHarness({
      form: (fd) => {
        fd.set("leaveType", "Sick Leave");
        fd.set("file", file);
      },
    });
    upload.mockResolvedValue(`${CALLER_ID}/doc.pdf`);

    const res = await POST(request);

    expect(res.status).toBe(201);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(file, CALLER_ID);
    expect(rpc).toHaveBeenCalledWith(
      "submit_leave_request",
      expect.objectContaining({ p_supporting_doc_path: `${CALLER_ID}/doc.pdf` }),
    );
    expect(upload.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      rpc.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("maps SupportingDocError UPLOAD_FAILED to 500 and never reaches the RPC", async () => {
    const file = new File([new Uint8Array(4)], "doc.pdf", { type: "application/pdf" });
    const { request, rpc } = installHarness({
      form: (fd) => {
        fd.set("leaveType", "Sick Leave");
        fd.set("file", file);
      },
    });
    vi.mocked(uploadSupportingDoc).mockRejectedValue(
      new SupportingDocError("UPLOAD_FAILED", "Failed to upload the supporting document."),
    );

    const res = await POST(request);

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("UPLOAD_FAILED");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sets conflictWarning=true for an overlapping APPROVED request but still returns 201", async () => {
    const { request, logs } = installHarness({ leaves: { id: "existing-approved" } });

    const res = await POST(request);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.conflictWarning).toBe(true);

    const conflictLog = logs.find((log) => log.table === "leaves");
    expect(conflictLog?.eqCalls).toEqual([
      ["employee_id", CALLER_ID],
      ["status", "APPROVED"],
    ]);
    expect(conflictLog?.isCalls).toEqual([["deleted_at", null]]);
    expect(conflictLog?.lteCalls).toEqual([["start_date", END_DATE]]);
    expect(conflictLog?.gteCalls).toEqual([["end_date", START_DATE]]);
  });

  it("allows Emergency Leave submission at zero balance", async () => {
    const { request, rpc } = installHarness({
      balances: { total_days: 0, used_days: 0 },
      form: (fd) => fd.set("leaveType", "Emergency Leave"),
    });

    const res = await POST(request);

    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("allows Unpaid Leave submission with no balance row", async () => {
    const { request, rpc } = installHarness({
      balances: null,
      form: (fd) => fd.set("leaveType", "Unpaid Leave"),
    });

    const res = await POST(request);

    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("treats an empty (0-byte) File as no file on a non-Sick request without uploading", async () => {
    const { request, rpc, upload } = installHarness({
      form: (fd) =>
        fd.set("file", new File([], "empty.pdf", { type: "application/pdf" })),
    });

    const res = await POST(request);

    expect(res.status).toBe(201);
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "submit_leave_request",
      expect.objectContaining({ p_supporting_doc_path: null }),
    );
  });

  it("treats a File with an empty name as no file", async () => {
    const { request, upload } = installHarness({
      form: (fd) => fd.set("file", new File([new Uint8Array(4)], "", { type: "application/pdf" })),
    });

    const res = await POST(request);

    expect(res.status).toBe(201);
    expect(upload).not.toHaveBeenCalled();
  });

  it("dispatches the manager notification with employeeName and manager-facing requestLink", async () => {
    const { request, sendNewRequestToManager } = installHarness();

    const res = await POST(request);

    expect(res.status).toBe(201);
    expect(sendNewRequestToManager).toHaveBeenCalledTimes(1);
    expect(sendNewRequestToManager).toHaveBeenCalledWith({
      employeeName: "Andres Lopez",
      leaveType: "Annual Leave",
      startDate: START_DATE,
      endDate: END_DATE,
      workingDays: 3,
      requestLink: `/manager/pending?request=${LEAF_ID}`,
    });
  });

  it("does not await the notification before responding", async () => {
    const { request, sendNewRequestToManager } = installHarness();
    sendNewRequestToManager.mockReturnValue(new Promise<void>(() => {}));

    const res = await POST(request);

    expect(res.status).toBe(201);
  });

  it("propagates proxy response cookies onto the 201 response", async () => {
    const { request, response } = installHarness();
    response.cookies.set("sb-refresh-token", "rotated");

    const res = await POST(request);

    expect(res.status).toBe(201);
    expect(res.cookies.get("sb-refresh-token")?.value).toBe("rotated");
  });

  it("propagates proxy response cookies onto error responses too", async () => {
    const { request, response } = installHarness({
      balances: { total_days: 0, used_days: 0 },
    });
    response.cookies.set("sb-refresh-token", "rotated");

    const res = await POST(request);

    expect(res.status).toBe(422);
    expect(res.cookies.get("sb-refresh-token")?.value).toBe("rotated");
  });

  it("returns 500 when the submit RPC fails", async () => {
    const { request } = installHarness({
      rpcResult: { data: null, error: { message: "boom" } },
    });

    const res = await POST(request);

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("SUBMIT_FAILED");
  });
});

const FIXTURE_ANNUAL = {
  id: "20000000-0000-4000-8000-000000000201",
  leave_type: "Annual Leave",
  start_date: START_DATE,
  end_date: END_DATE,
  status: "PENDING",
  created_at: "2030-06-03T09:00:00.000Z",
  manager_note: null,
  supporting_doc_url: null,
} as const;

const FIXTURE_SICK = {
  id: "20000000-0000-4000-8000-000000000202",
  leave_type: "Sick Leave",
  start_date: "2030-07-01",
  end_date: "2030-07-01",
  status: "APPROVED",
  created_at: "2030-06-01T09:00:00.000Z",
  manager_note: "Get well soon.",
  supporting_doc_url: `${CALLER_ID}/aaaaaaaa-0000-4000-8000-000000000000.pdf`,
} as const;

const FIXTURE_LEAVES = [FIXTURE_ANNUAL, FIXTURE_SICK];

function installGetHarness(options: {
  sessionUserId?: string | null;
  caller?: { id: string; role: DbRole; managerId: string | null } | null;
  leavesList?: unknown[] | null;
  errors?: Partial<Record<TableName, unknown>>;
} = {}): {
  request: NextRequest;
  response: NextResponse;
  from: ReturnType<typeof vi.fn>;
  logs: QueryLog[];
} {
  const request = new NextRequest(new URL("http://localhost:3000/api/leaves"), {
    method: "GET",
  });
  const response = NextResponse.next({ request });
  const { from, logs } = makeFrom({
    balances: null,
    leaves: null,
    leavesList: options.leavesList === undefined ? null : options.leavesList,
    profile: null,
    errors: options.errors ?? {},
  });
  vi.mocked(createProxyClient).mockReturnValue({
    supabase: { from } as unknown as SupabaseClient,
    response,
  });
  vi.mocked(getSessionUserId).mockResolvedValue(
    options.sessionUserId === undefined ? CALLER_ID : options.sessionUserId,
  );
  vi.mocked(requireSelfServiceUser).mockResolvedValue(
    options.caller === undefined ? CALLER : options.caller,
  );
  return { request, response, from, logs };
}

describe("GET /api/leaves", () => {
  it("returns 401 for an unauthenticated caller with no DB reads", async () => {
    const { request, from } = installGetHarness({ sessionUserId: null });

    const res = await GET(request);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required." },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 403 for sys_admin (guard returns null) with no DB reads", async () => {
    const { request, from } = installGetHarness({ caller: null });

    const res = await GET(request);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "This account cannot submit leave requests." },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns only the caller's rows, filtering employee_id, deleted_at IS NULL, ordered created_at desc", async () => {
    const { request, logs } = installGetHarness({ leavesList: FIXTURE_LEAVES });

    const res = await GET(request);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([
      {
        id: FIXTURE_ANNUAL.id,
        leaveType: "Annual Leave",
        startDate: START_DATE,
        endDate: END_DATE,
        workingDays: 3,
        status: "PENDING",
        createdAt: "2030-06-03T09:00:00.000Z",
        managerNote: null,
        supportingDocPath: null,
      },
      {
        id: FIXTURE_SICK.id,
        leaveType: "Sick Leave",
        startDate: "2030-07-01",
        endDate: "2030-07-01",
        workingDays: 1,
        status: "APPROVED",
        createdAt: "2030-06-01T09:00:00.000Z",
        managerNote: "Get well soon.",
        supportingDocPath: `${CALLER_ID}/aaaaaaaa-0000-4000-8000-000000000000.pdf`,
      },
    ]);

    const leavesLog = logs.find((log) => log.table === "leaves");
    expect(leavesLog?.selectCalls).toEqual([
      ["id, leave_type, start_date, end_date, status, created_at, manager_note, supporting_doc_url"],
    ]);
    expect(leavesLog?.eqCalls).toEqual([["employee_id", CALLER_ID]]);
    expect(leavesLog?.isCalls).toEqual([["deleted_at", null]]);
    expect(leavesLog?.orderCalls).toEqual([["created_at", { ascending: false }]]);
  });

  it("maps rows to the FR-LVR-006 shape and never selects or emits reason", async () => {
    const { request, logs } = installGetHarness({ leavesList: FIXTURE_LEAVES });

    const res = await GET(request);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).not.toHaveProperty("reason");
    const leavesLog = logs.find((log) => log.table === "leaves");
    expect(leavesLog?.selectCalls).toEqual([
      ["id, leave_type, start_date, end_date, status, created_at, manager_note, supporting_doc_url"],
    ]);
  });

  it("never mints a signed URL and emits no url field on list rows (A4)", async () => {
    const { request } = installGetHarness({ leavesList: FIXTURE_LEAVES });

    const res = await GET(request);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).not.toHaveProperty("url");
    expect(body[1]).not.toHaveProperty("url");
    expect(getSupportingDocSignedUrl).not.toHaveBeenCalled();
  });

  it("returns an empty array when the caller has no leave requests", async () => {
    const { request } = installGetHarness({ leavesList: [] });

    const res = await GET(request);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });

  it("returns 500 when the history read fails", async () => {
    const { request } = installGetHarness({ errors: { leaves: { message: "db down" } } });

    const res = await GET(request);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "LEAVES_READ_FAILED", message: "Could not read leave history." },
    });
  });

  it("propagates proxy response cookies onto the 200 response", async () => {
    const { request, response } = installGetHarness({ leavesList: [] });
    response.cookies.set("sb-refresh-token", "rotated");

    const res = await GET(request);

    expect(res.status).toBe(200);
    expect(res.cookies.get("sb-refresh-token")?.value).toBe("rotated");
  });
});
