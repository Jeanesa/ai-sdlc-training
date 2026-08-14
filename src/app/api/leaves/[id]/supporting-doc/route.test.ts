import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/leaves/[id]/supporting-doc/route";
import { requireSelfServiceUser } from "@/lib/auth/self-service";
import type { DbRole } from "@/lib/auth/route-guards";
import { getSupportingDocSignedUrl } from "@/lib/leave/storage";
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
  return { ...actual, getSupportingDocSignedUrl: vi.fn() };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

const CALLER_ID = "20000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "30000000-0000-4000-8000-000000000001";
const LEAF_ID = "20000000-0000-4000-8000-000000000201";
const DOC_PATH = `${CALLER_ID}/aaaaaaaa-0000-4000-8000-000000000000.pdf`;
const SIGNED_URL = "https://example.com/object/signed";
const CALLER = { id: CALLER_ID, role: "employee", managerId: null } as const;

interface LeafRow {
  employee_id: string;
  supporting_doc_url: string | null;
}

interface HarnessOptions {
  sessionUserId?: string | null;
  caller?: { id: string; role: DbRole; managerId: string | null } | null;
  row?: LeafRow | null;
  readError?: unknown;
  mintResult?: string | null;
  id?: string;
}

interface Harness {
  request: NextRequest;
  response: NextResponse;
  serviceFrom: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  mint: ReturnType<typeof vi.fn>;
}

function installHarness(options: HarnessOptions = {}): Harness {
  const id = options.id ?? LEAF_ID;
  const request = new NextRequest(
    new URL(`http://localhost:3000/api/leaves/${id}/supporting-doc`),
    { method: "GET" },
  );
  const response = NextResponse.next({ request });

  vi.mocked(createProxyClient).mockReturnValue({
    supabase: {} as unknown as SupabaseClient,
    response,
  });
  vi.mocked(getSessionUserId).mockResolvedValue(
    options.sessionUserId === undefined ? CALLER_ID : options.sessionUserId,
  );
  vi.mocked(requireSelfServiceUser).mockResolvedValue(
    options.caller === undefined ? CALLER : options.caller,
  );

  const maybeSingle = vi.fn().mockResolvedValue(
    options.readError !== undefined
      ? { data: null, error: options.readError }
      : {
          data:
            options.row === undefined
              ? { employee_id: CALLER_ID, supporting_doc_url: DOC_PATH }
              : options.row,
          error: null,
        },
  );
  const is = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  const serviceFrom = vi.fn(() => ({ select }));
  vi.mocked(createServiceClient).mockReturnValue({
    from: serviceFrom,
  } as unknown as SupabaseClient);

  const mint = vi.mocked(getSupportingDocSignedUrl);
  mint.mockResolvedValue(options.mintResult === undefined ? SIGNED_URL : options.mintResult);

  return { request, response, serviceFrom, select, eq, is, mint };
}

beforeEach(() => {
  vi.mocked(createProxyClient).mockReset();
  vi.mocked(getSessionUserId).mockReset();
  vi.mocked(requireSelfServiceUser).mockReset();
  vi.mocked(getSupportingDocSignedUrl).mockReset();
  vi.mocked(createServiceClient).mockReset();
});

describe("GET /api/leaves/[id]/supporting-doc", () => {
  it("returns 401 for an unauthenticated caller with no DB or storage calls", async () => {
    const { request, serviceFrom, mint } = installHarness({ sessionUserId: null });

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required." },
    });
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(mint).not.toHaveBeenCalled();
  });

  it("returns 403 for sys_admin (guard returns null) with no DB or storage calls", async () => {
    const { request, serviceFrom, mint } = installHarness({ caller: null });

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "This account cannot submit leave requests." },
    });
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(mint).not.toHaveBeenCalled();
  });

  it("mints a 60s signed URL for an owned record with a document", async () => {
    const { request, serviceFrom, select, eq, is, mint } = installHarness();

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: SIGNED_URL });
    expect(serviceFrom).toHaveBeenCalledWith("leaves");
    expect(select).toHaveBeenCalledWith("employee_id, supporting_doc_url");
    expect(eq).toHaveBeenCalledWith("id", LEAF_ID);
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(mint).toHaveBeenCalledTimes(1);
    expect(mint).toHaveBeenCalledWith(DOC_PATH);
  });

  it("returns 403 and never mints for another user's record", async () => {
    const { request, mint } = installHarness({
      row: { employee_id: OTHER_USER_ID, supporting_doc_url: DOC_PATH },
    });

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "This leave request belongs to another user." },
    });
    expect(mint).not.toHaveBeenCalled();
  });

  it("returns 404 when no row exists for the id", async () => {
    const { request, mint } = installHarness({ row: null });

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Leave request not found." },
    });
    expect(mint).not.toHaveBeenCalled();
  });

  it("returns 404 when the owned record has no supporting document (null and empty)", async () => {
    for (const doc of [null, ""]) {
      const { request, mint } = installHarness({
        row: { employee_id: CALLER_ID, supporting_doc_url: doc },
      });

      const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({
        error: {
          code: "NOT_FOUND",
          message: "No supporting document exists for this request.",
        },
      });
      expect(mint).not.toHaveBeenCalled();
    }
  });

  it("returns 404 for a malformed UUID with no DB or storage calls", async () => {
    const { request, serviceFrom, mint } = installHarness({ id: "not-a-uuid" });

    const res = await GET(request, { params: Promise.resolve({ id: "not-a-uuid" }) });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Leave request not found." },
    });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(mint).not.toHaveBeenCalled();
  });

  it("returns 500 SIGNED_URL_FAILED when the mint fails closed", async () => {
    const { request, mint } = installHarness({ mintResult: null });

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "SIGNED_URL_FAILED", message: "Could not generate the document link." },
    });
    expect(mint).toHaveBeenCalledWith(DOC_PATH);
  });

  it("returns 500 when the ownership read fails", async () => {
    const { request, mint } = installHarness({ readError: { message: "db down" } });

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "LEAVE_READ_FAILED", message: "Could not read the leave request." },
    });
    expect(mint).not.toHaveBeenCalled();
  });

  it("propagates proxy response cookies onto the 200 response", async () => {
    const { request, response } = installHarness();
    response.cookies.set("sb-refresh-token", "rotated");

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(200);
    expect(res.cookies.get("sb-refresh-token")?.value).toBe("rotated");
  });

  it("propagates proxy response cookies onto error responses", async () => {
    const { request, response } = installHarness({ row: null });
    response.cookies.set("sb-refresh-token", "rotated");

    const res = await GET(request, { params: Promise.resolve({ id: LEAF_ID }) });

    expect(res.status).toBe(404);
    expect(res.cookies.get("sb-refresh-token")?.value).toBe("rotated");
  });
});
