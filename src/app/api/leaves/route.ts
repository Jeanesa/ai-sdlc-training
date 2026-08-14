import { NextResponse, type NextRequest } from "next/server";

import { copyAuthHeaders } from "@/lib/auth/redirects";
import { requireSelfServiceUser } from "@/lib/auth/self-service";
import { countWorkingDays } from "@/lib/leave/working-days";
import { SupportingDocError, uploadSupportingDoc } from "@/lib/leave/storage";
import {
  LEAVE_TYPE,
  validateBalance,
  validateLeaveDates,
  validateReason,
  validateSupportingFile,
} from "@/lib/leave/validation";
import { notificationDispatcher, type NewRequestPayload } from "@/lib/notifications";
import { createProxyClient, getSessionUserId } from "@/lib/supabase/proxy";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Timezone-deterministic "today" following the Date.UTC discipline of
// working-days.ts (and the seed's `extract(year from current_date)`), NOT
// local y/m/d — parity-guard requirement for the injected validateLeaveDates
// `today` and for the leave_balances `year` lookup.
function currentUtcDay(): { today: string; year: number } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return { today: `${year}-${month}-${day}`, year };
}

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

function fieldError(
  proxyResponse: NextResponse,
  field: string,
  result: { code: string; message: string },
): NextResponse {
  return jsonWithHeaders(
    proxyResponse,
    { error: { code: result.code, message: result.message }, fields: { [field]: result } },
    400,
  );
}

export async function POST(request: NextRequest) {
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
    // Authenticated but not self-service eligible (sys_admin, or an unreadable
    // profile) — both land on 403 by design, keeping API checks aligned with
    // the RLS auth_leaves_insert_own predicate.
    return jsonWithHeaders(
      response,
      { error: { code: "FORBIDDEN", message: "This account cannot submit leave requests." } },
      403,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonWithHeaders(
      response,
      { error: { code: "INVALID_FORM_DATA", message: "Expected a multipart/form-data body." } },
      400,
    );
  }

  const rawLeaveType = formData.get("leaveType");
  const rawStartDate = formData.get("startDate");
  const rawEndDate = formData.get("endDate");
  const rawReason = formData.get("reason");
  const rawFile = formData.get("file");

  const leaveType = typeof rawLeaveType === "string" ? rawLeaveType : "";
  const startDate = typeof rawStartDate === "string" ? rawStartDate : "";
  const endDate = typeof rawEndDate === "string" ? rawEndDate : "";
  const reason = typeof rawReason === "string" ? rawReason : "";

  let file: File | null = null;
  if (rawFile instanceof File) {
    file = rawFile;
  }
  if (file !== null && (file.size === 0 || file.name === "")) {
    file = null;
  }

  if (!LEAVE_TYPE.some((type) => type === leaveType)) {
    // INVALID_LEAVE_TYPE is handler-local (absent from ValidationCode) — a
    // future TASK-020 touch-up should promote it into the shared module.
    return fieldError(response, "leaveType", {
      code: "INVALID_LEAVE_TYPE",
      message: "Selected leave type is not valid.",
    });
  }

  const { today, year } = currentUtcDay();

  const datesResult = validateLeaveDates(startDate, endDate, today);
  if (!datesResult.ok) {
    const field = datesResult.code === "END_BEFORE_START" ? "endDate" : "startDate";
    return fieldError(response, field, datesResult);
  }

  const reasonResult = validateReason(reason);
  if (!reasonResult.ok) {
    return fieldError(response, "reason", reasonResult);
  }

  const fileResult = validateSupportingFile(file, leaveType);
  if (!fileResult.ok) {
    return fieldError(response, "file", fileResult);
  }

  const { data: balanceRow, error: balanceError } = await supabase
    .from("leave_balances")
    .select("total_days, used_days")
    .eq("employee_id", caller.id)
    .eq("leave_type", leaveType)
    .eq("year", year)
    .is("deleted_at", null)
    .maybeSingle();

  if (balanceError) {
    return jsonWithHeaders(
      response,
      { error: { code: "BALANCE_READ_FAILED", message: "Could not read leave balance." } },
      500,
    );
  }

  let remaining: number | null = null;
  if (balanceRow !== null) {
    const total = Number(balanceRow.total_days);
    const used = Number(balanceRow.used_days);
    remaining = Number.isFinite(total) && Number.isFinite(used) ? total - used : null;
  }

  const balanceResult = validateBalance(leaveType, remaining);
  if (!balanceResult.ok) {
    return jsonWithHeaders(
      response,
      { error: { code: "BALANCE_ZERO", message: balanceResult.message } },
      422,
    );
  }

  const { data: conflictRow, error: conflictError } = await supabase
    .from("leaves")
    .select("id")
    .eq("employee_id", caller.id)
    .eq("status", "APPROVED")
    .is("deleted_at", null)
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .maybeSingle();

  if (conflictError) {
    return jsonWithHeaders(
      response,
      { error: { code: "CONFLICT_READ_FAILED", message: "Could not check for conflicting leave." } },
      500,
    );
  }
  const conflictWarning = conflictRow !== null;

  let supportingDocPath: string | null = null;
  if (file !== null) {
    try {
      supportingDocPath = await uploadSupportingDoc(file, caller.id);
    } catch (error) {
      if (error instanceof SupportingDocError) {
        return jsonWithHeaders(
          response,
          { error: { code: error.code, message: error.message } },
          error.code === "UPLOAD_FAILED" ? 500 : 400,
        );
      }
      return jsonWithHeaders(
        response,
        { error: { code: "UPLOAD_FAILED", message: "Failed to upload the supporting document." } },
        500,
      );
    }
  }

  // A successful upload followed by an RPC failure leaves an orphaned object
  // in supporting-docs — accepted in Epic 2 (no compensation path).
  const { data: rpcRow, error: rpcError } = await createServiceClient().rpc(
    "submit_leave_request",
    {
      p_actor: caller.id,
      p_leave_type: leaveType,
      p_start_date: startDate,
      p_end_date: endDate,
      p_reason: reason,
      p_supporting_doc_path: supportingDocPath,
    },
  );

  if (rpcError || rpcRow === null) {
    return jsonWithHeaders(
      response,
      { error: { code: "SUBMIT_FAILED", message: "Failed to submit the leave request." } },
      500,
    );
  }

  const workingDays = countWorkingDays(startDate, endDate);

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", caller.id)
    .maybeSingle();

  const employeeName =
    !profileError && profileRow !== null && typeof profileRow.full_name === "string"
      ? profileRow.full_name
      : "";

  const payload: NewRequestPayload = {
    employeeName,
    leaveType,
    startDate,
    endDate,
    workingDays,
    requestLink: `/manager/pending?request=${rpcRow.id}`,
  };
  // Fire-and-forget (FR-NOTIF-005): never awaited before the response; the
  // stub resolves immediately and EPIC-6 owns real delivery + failure logging.
  void notificationDispatcher.sendNewRequestToManager(payload).catch(() => {});

  return jsonWithHeaders(
    response,
    {
      id: rpcRow.id,
      leaveType,
      startDate,
      endDate,
      workingDays,
      status: rpcRow.status,
      conflictWarning,
    },
    201,
  );
}

export async function GET(request: NextRequest) {
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

  const { data: rows, error } = await supabase
    .from("leaves")
    .select(
      "id, leave_type, start_date, end_date, status, created_at, manager_note, supporting_doc_url",
    )
    .eq("employee_id", caller.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonWithHeaders(
      response,
      { error: { code: "LEAVES_READ_FAILED", message: "Could not read leave history." } },
      500,
    );
  }

  const history = (rows ?? []).map((row) => ({
    id: row.id,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    workingDays: countWorkingDays(row.start_date, row.end_date),
    status: row.status,
    createdAt: row.created_at,
    managerNote: row.manager_note ?? null,
    supportingDocPath: row.supporting_doc_url ?? null,
  }));

  return jsonWithHeaders(response, history, 200);
}
