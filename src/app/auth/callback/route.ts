import { NextResponse, type NextRequest } from "next/server";

import { copyAuthHeaders, sanitizeRedirect } from "@/lib/auth/redirects";
import { DASHBOARD_BY_ROLE } from "@/lib/auth/route-guards";
import { createProxyClient, getSessionUserId, getUserRole } from "@/lib/supabase/proxy";

function buildLoginUrl(request: NextRequest, error?: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.search = "";
  if (error) {
    url.searchParams.set("error", error);
  }
  return url;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect_to");

  if (!code) {
    return NextResponse.redirect(buildLoginUrl(request));
  }

  const { supabase, response } = createProxyClient(request);

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const redirect = NextResponse.redirect(buildLoginUrl(request, "invalid_link"));
    copyAuthHeaders(response, redirect);
    return redirect;
  }

  const userId = await getSessionUserId(supabase);
  const role = userId ? await getUserRole(supabase, userId) : null;
  if (!userId || !role) {
    const redirect = NextResponse.redirect(buildLoginUrl(request, "profile_missing"));
    copyAuthHeaders(response, redirect);
    return redirect;
  }

  const destination = sanitizeRedirect(redirectTo) ?? DASHBOARD_BY_ROLE[role];
  const redirect = NextResponse.redirect(new URL(destination, request.url));
  copyAuthHeaders(response, redirect);
  return redirect;
}
