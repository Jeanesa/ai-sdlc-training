import { NextResponse, type NextRequest } from "next/server";

import { copyAuthHeaders } from "@/lib/auth/redirects";
import { requireSelfServiceUser } from "@/lib/auth/self-service";
import { countWorkingDays } from "@/lib/leave/working-days";
import { notificationDispatcher } from "@/lib/notifications";
import { createProxyClient, getSessionUserId } from "@/lib/supabase/proxy";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonWithHeaders(
  proxyResponse: NextResponse,
  body: unknown,
  status: number,
): NextResponse {
  const json = NextResponse.json(body, { status });
  copyAuthHeaders(proxyResponse, json);
  return json;
}

export async function POST(
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

  const service = createServiceClient();

  const { data: rpcRow, error: rpcError } = await service.rpc("cancel_leave_request", {
    p_actor: caller.id,
    p_leave_id: id,
  });

  if (rpcError) {
    return jsonWithHeaders(
      response,
      { error: { code: "CANCEL_FAILED", message: "Failed to cancel the leave request." } },
      500,
    );
  }

  if (rpcRow !== null) {
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", rpcRow.employee_id)
      .maybeSingle();

    const employeeName =
      !profileError && profileRow !== null && typeof profileRow.full_name === "string"
        ? profileRow.full_name
        : "";

    const workingDays = countWorkingDays(rpcRow.start_date, rpcRow.end_date);

    const payload = {
      employeeName,
      leaveType: rpcRow.leave_type,
      startDate: rpcRow.start_date,
      endDate: rpcRow.end_date,
      workingDays,
      requestLink: `/manager/pending?request=${rpcRow.id}`,
    };
    void notificationDispatcher.sendCancelToManager(payload).catch(() => {});

    return jsonWithHeaders(response, { id: rpcRow.id, status: rpcRow.status }, 200);
  }

  const { data: readRow, error: readError } = await service
    .from("leaves")
    .select("employee_id, status")
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

  if (readRow === null) {
    return jsonWithHeaders(
      response,
      { error: { code: "NOT_FOUND", message: "Leave request not found." } },
      404,
    );
  }

  if (readRow.employee_id !== caller.id) {
    return jsonWithHeaders(
      response,
      { error: { code: "FORBIDDEN", message: "This leave request belongs to another user." } },
      403,
    );
  }

  if (readRow.status !== "PENDING") {
    return jsonWithHeaders(
      response,
      {
        error: { code: "ALREADY_DECIDED", message: "Only PENDING requests can be cancelled." },
        id,
        status: readRow.status,
      },
      409,
    );
  }

  return jsonWithHeaders(
    response,
    { error: { code: "UNEXPECTED_STATE", message: "Could not cancel the leave request." } },
    500,
  );
}
