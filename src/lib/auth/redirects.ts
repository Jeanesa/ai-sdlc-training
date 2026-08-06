import type { NextResponse } from "next/server";

const AUTH_COOKIE_HEADERS = ["Cache-Control", "Expires", "Pragma"];

export function copyAuthHeaders(from: NextResponse, to: NextResponse): void {
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

export function sanitizeRedirect(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (!value.startsWith("/")) {
    return null;
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value.includes(":")) {
    return null;
  }
  return value;
}
