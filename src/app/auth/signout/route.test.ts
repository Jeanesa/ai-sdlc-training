import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/auth/signout/route";
import { createProxyClient } from "@/lib/supabase/proxy";

const SESSION_COOKIE = "sb-127-auth-token";

function makeRequest(): NextRequest {
  const request = new NextRequest(new URL("http://localhost:3000/auth/signout"), {
    method: "POST",
  });
  request.cookies.set(SESSION_COOKIE, "still-a-session");
  return request;
}

function installMock(options?: {
  signOut?: (response: NextResponse) => Promise<unknown>;
}): { signOut: ReturnType<typeof vi.fn> } {
  const response = NextResponse.next({ request: makeRequest() });
  const behavior = options?.signOut;
  const signOut = vi.fn(async () => {
    if (behavior) {
      return behavior(response);
    }
    response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return { error: null };
  });
  vi.mocked(createProxyClient).mockReturnValue({
    supabase: { auth: { signOut } } as unknown as SupabaseClient,
    response,
  });
  return { signOut };
}

vi.mock("@/lib/supabase/proxy", () => ({
  createProxyClient: vi.fn(),
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  vi.mocked(createProxyClient).mockReset();
});

describe("POST /auth/signout", () => {
  it("redirects to /auth/login with 303 and a cleared session cookie", async () => {
    const { signOut } = installMock();

    const response = await POST(makeRequest());

    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/auth/login");

    const cleared = response.cookies.get(SESSION_COOKIE);
    expect(cleared).toBeDefined();
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
  });

  it("still redirects and clears the cookie when signOut fails", async () => {
    installMock({
      signOut: async (response) => {
        response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
        return { error: { name: "AuthApiError", message: "session expired" } };
      },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/auth/login");
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("");
  });
});
