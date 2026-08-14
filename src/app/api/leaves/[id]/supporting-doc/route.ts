import { NextResponse, type NextRequest } from "next/server";

import { copyAuthHeaders } from "@/lib/auth/redirects";
import { requireSelfServiceUser } from "@/lib/auth/self-service";
import { getSupportingDocSignedUrl } from "@/lib/leave/storage";
import { createProxyClient, getSessionUserId } from "@/lib/supabase/proxy";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Standard UUID shape (8-4-4-4-12 hex) — a malformed id is "not found", never a 5xx.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every response goes through here so the proxy client's session-refresh
// cookies are copied onto the JSON response (the proxy matcher excludes /api,
// so the Route Handler is the only place they can be applied).
function jsonWithHeaders(
  proxyResponse: NextResponse,
  body: unknown,
  status: number,
): NextResponse {
  const json = NextResponse.json(body, { status });
  copyAuthHeaders(proxyResponse, json);
  return json;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, response } = createProxyClient(request);

  const userId = await getSessionUserId(supabase);
  if (userId === null) {
    return jsonWithHeaders(
      response,
      { error: { code: "UNAUTHENTICATED", message: "Authentication required." } },
      401,
    );
  }

  const caller = await requireSelfServiceUser(supabase);
  if (caller === null) {
    return jsonWithHeaders(
      response,
      { error: { code: "FORBIDDEN", message: "This account cannot submit leave requests." } },
      403,
    );
  }

  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return jsonWithHeaders(
      response,
      { error: { code: "NOT_FOUND", message: "Leave request not found." } },
      404,
    );
  }

  const { data: row, error: readError } = await createServiceClient()
    .from("leaves")
    .select("employee_id, supporting_doc_url")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) {
    return jsonWithHeaders(
      response,
      { error: { code: "LEAVE_READ_FAILED", message: "Could not read the leave request." } },
      500,
    );
  }

  if (row === null) {
    return jsonWithHeaders(
      response,
      { error: { code: "NOT_FOUND", message: "Leave request not found." } },
      404,
    );
  }

  if (row.employee_id !== caller.id) {
    return jsonWithHeaders(
      response,
      { error: { code: "FORBIDDEN", message: "This leave request belongs to another user." } },
      403,
    );
  }

  const path = row.supporting_doc_url;
  if (typeof path !== "string" || path === "") {
    return jsonWithHeaders(
      response,
      { error: { code: "NOT_FOUND", message: "No supporting document exists for this request." } },
      404,
    );
  }

  const url = await getSupportingDocSignedUrl(path);
  if (url === null) {
    return jsonWithHeaders(
      response,
      { error: { code: "SIGNED_URL_FAILED", message: "Could not generate the document link." } },
      500,
    );
  }

  return jsonWithHeaders(response, { url }, 200);
}
