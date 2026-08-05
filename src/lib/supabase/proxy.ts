import { createServerClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { type DbRole, isDbRole } from "@/lib/auth/route-guards";

function envUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  return url;
}

function envAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  }
  return key;
}

export interface ProxyClient {
  supabase: SupabaseClient;
  response: NextResponse;
}

export function createProxyClient(request: NextRequest): ProxyClient {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(envUrl(), envAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        if (headers) {
          for (const [name, value] of Object.entries(headers)) {
            response.headers.set(name, value);
          }
        }
      },
    },
  });
  return { supabase, response };
}

export async function getSessionUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

export async function getUserRole(supabase: SupabaseClient, userId: string): Promise<DbRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const role = data.role;
  if (typeof role !== "string" || !isDbRole(role)) {
    return null;
  }
  return role;
}
