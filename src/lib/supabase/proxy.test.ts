import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { createProxyClient } from "@/lib/supabase/proxy";

const SESSION_COOKIE = "sb-127-auth-token";

function makeRequest(path = "/hradmin/all-requests"): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("createProxyClient", () => {
  it("throws when the Supabase URL is not configured", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createProxyClient(makeRequest())).toThrow("NEXT_PUBLIC_SUPABASE_URL is not set");
  });

  it("throws when the anon key is not configured", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => createProxyClient(makeRequest())).toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
    );
  });

  it("exposes a response and can write a cookie after a storage change", async () => {
    const request = makeRequest();
    request.cookies.set(SESSION_COOKIE, "not-a-session");
    const { supabase, response } = createProxyClient(request);

    expect(response).toBeInstanceOf(Response);
    await supabase.auth.signOut();
    expect(response.cookies.getAll().map((cookie) => cookie.name)).toContain(SESSION_COOKIE);
  });
});
