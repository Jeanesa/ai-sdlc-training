import { NextResponse, type NextRequest } from "next/server";

import { copyAuthHeaders } from "@/lib/auth/redirects";
import { createProxyClient } from "@/lib/supabase/proxy";

const LOGIN_PATH = "/auth/login";

export async function POST(request: NextRequest) {
  const { supabase, response } = createProxyClient(request);

  await supabase.auth.signOut({ scope: "global" });

  const redirect = NextResponse.redirect(new URL(LOGIN_PATH, request.url), 303);
  copyAuthHeaders(response, redirect);
  return redirect;
}
