import { NextResponse, type NextRequest } from "next/server";

import { decide, matchesGuardedRoute } from "@/lib/auth/route-guards";
import { createProxyClient, getSessionUserId, getUserRole } from "@/lib/supabase/proxy";

const LOGIN_PATH = "/auth/login";

const AUTH_COOKIE_HEADERS = ["Cache-Control", "Expires", "Pragma"];

function buildLoginUrl(request: NextRequest, pathname: string, search: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = "";
  url.searchParams.set("redirect_to", `${pathname}${search}`);
  return url;
}

function buildDashboardUrl(request: NextRequest, dashboard: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = dashboard;
  url.search = "";
  return url;
}

function copyAuthHeaders(from: NextResponse, to: NextResponse): void {
  for (const name of AUTH_COOKIE_HEADERS) {
    const value = from.headers.get(name);
    if (value !== null) {
      to.headers.set(name, value);
    }
  }
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value, cookie);
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!matchesGuardedRoute(pathname)) {
    return NextResponse.next({ request });
  }

  const { supabase, response } = createProxyClient(request);
  const userId = await getSessionUserId(supabase);
  const decision = await decide({
    pathname,
    hasSession: userId !== null,
    role: userId ? await getUserRole(supabase, userId) : null,
  });

  switch (decision.type) {
    case "allow":
      return response;
    case "redirect-login": {
      const redirect = NextResponse.redirect(buildLoginUrl(request, pathname, search));
      copyAuthHeaders(response, redirect);
      return redirect;
    }
    case "redirect-dashboard": {
      const redirect = NextResponse.redirect(buildDashboardUrl(request, decision.dashboard));
      copyAuthHeaders(response, redirect);
      return redirect;
    }
  }
}

export const config = {
  matcher: [
    "/((?!api|auth|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|woff|woff2)$).*)",
  ],
};
