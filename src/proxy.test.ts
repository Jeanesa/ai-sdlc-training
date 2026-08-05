import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";
import { createProxyClient, getSessionUserId, getUserRole } from "@/lib/supabase/proxy";

const { fakeResponse } = vi.hoisted(() => ({
  fakeResponse: () => ({
    status: 200,
    headers: new Headers(),
    cookies: {
      set: vi.fn(),
      getAll: () => [],
    },
  }),
}));

vi.mock("@/lib/supabase/proxy", () => ({
  createProxyClient: vi.fn(() => ({
    supabase: {},
    response: fakeResponse(),
  })),
  getSessionUserId: vi.fn(async () => null),
  getUserRole: vi.fn(async () => null),
}));

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

function callProxy(path: string): Promise<Response> {
  return proxy(makeRequest(path));
}

beforeEach(() => {
  vi.mocked(getSessionUserId).mockReset();
  vi.mocked(getUserRole).mockReset();
  vi.mocked(getSessionUserId).mockResolvedValue(null);
  vi.mocked(getUserRole).mockResolvedValue(null);
  vi.mocked(createProxyClient).mockClear();
});

describe("proxy", () => {
  it("passes through non-guarded routes without touching auth", async () => {
    const response = await callProxy("/");
    expect(response.status).toBe(200);
    expect(createProxyClient).not.toHaveBeenCalled();
  });

  it("passes through an authenticated employee on an employee route", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user-1");
    vi.mocked(getUserRole).mockResolvedValue("employee");
    const response = await callProxy("/employee/dashboard");
    expect(response.status).toBe(200);
    expect(createProxyClient).toHaveBeenCalled();
  });

  it("redirects an unauthenticated employee route to the login page", async () => {
    const response = await callProxy("/employee/dashboard");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?redirect_to=%2Femployee%2Fdashboard",
    );
  });

  it("redirects an unauthenticated request to the login page with redirect_to", async () => {
    const response = await callProxy("/sysadmin/users");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?redirect_to=%2Fsysadmin%2Fusers",
    );
  });

  it("allows a request whose role matches the guarded route", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user-1");
    vi.mocked(getUserRole).mockResolvedValue("sys_admin");
    const response = await callProxy("/sysadmin/users");
    expect(response.status).toBe(200);
  });

  it("redirects a wrong-role user to their own dashboard", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user-1");
    vi.mocked(getUserRole).mockResolvedValue("employee");
    const response = await callProxy("/sysadmin/users");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/employee/dashboard");
  });

  it("redirects to login when the role lookup fails", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue("user-1");
    vi.mocked(getUserRole).mockResolvedValue(null);
    const response = await callProxy("/sysadmin/users");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/login");
  });

  it("preserves the redirect_to query on the login redirect", async () => {
    const request = makeRequest("/hradmin/all-requests?page=2");
    const response = await proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?redirect_to=%2Fhradmin%2Fall-requests%3Fpage%3D2",
    );
  });
});
