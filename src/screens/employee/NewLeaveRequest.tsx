"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEAVE_TYPE, EXEMPT_LEAVE_TYPES, validateBalance, validateLeaveDates, validateReason, validateSupportingFile } from "@/lib/leave/validation";
import { countWorkingDays } from "@/lib/leave/working-days";
import { createClient } from "@/lib/supabase/client";

interface BalanceRow {
  leave_type: string;
  total_days: number;
  used_days: number;
}

interface ApprovedLeave {
  startDate: string;
  endDate: string;
}

function localToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function NewLeaveRequest({ notice }: { notice?: string | null }) {
  const router = useRouter();
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [balanceRows, setBalanceRows] = useState<BalanceRow[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<ApprovedLeave[]>([]);

  useEffect(() => {
    const currentYear = new Date().getUTCFullYear();
    void createClient()
      .from("leave_balances")
      .select("leave_type, total_days, used_days")
      .is("deleted_at", null)
      .eq("year", currentYear)
      .then(
        (result: { data: BalanceRow[] | null }) => {
          if (result.data) setBalanceRows(result.data);
        },
        () => {},
      );

    fetch("/api/leaves")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: unknown) => {
        if (Array.isArray(rows)) {
          setApprovedLeaves(
            rows
              .filter(
                (r: { status?: string }) =>
                  (r as { status?: string }).status === "APPROVED",
              )
              .map((r: { startDate: string; endDate: string }) => ({
                startDate: r.startDate,
                endDate: r.endDate,
              })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const isExempt = EXEMPT_LEAVE_TYPES.some((t) => t === leaveType);
  const balanceRow = balanceRows.find((r) => r.leave_type === leaveType);
  const remaining =
    balanceRow != null
      ? balanceRow.total_days - balanceRow.used_days
      : null;

  const conflict =
    startDate &&
    endDate &&
    approvedLeaves.some(
      (r) =>
        !(endDate < r.startDate || startDate > r.endDate),
    );

  const todayStr = localToday();

  const datesResult = validateLeaveDates(startDate, endDate, todayStr);
  const reasonResult = validateReason(reason);
  const fileResult = validateSupportingFile(file, leaveType);
  const balanceResult = validateBalance(leaveType, remaining);

  const shouldShowError = (field: string) =>
    touched[field] === true || submitAttempted;

  function showError(field: string): string | null {
    if (!shouldShowError(field)) return null;
    return errors[field] ?? null;
  }

  const workingDays = countWorkingDays(startDate, endDate);

  const zeroBalanceBlock = !isExempt && !balanceResult.ok && balanceResult.code === "BALANCE_ZERO";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setTouched((prev) => ({ ...prev, reason: true }));

    const newErrors: Record<string, string> = {};

    if (!datesResult.ok) {
      const field =
        datesResult.code === "END_BEFORE_START" ? "endDate" : "startDate";
      newErrors[field] = datesResult.message;
    }

    if (!reasonResult.ok) {
      newErrors["reason"] = reasonResult.message;
    }

    if (!fileResult.ok) {
      newErrors["file"] = fileResult.message;
    }

    if (!balanceResult.ok) {
      newErrors["balance"] = balanceResult.message;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    const formData = new FormData();
    formData.append("leaveType", leaveType);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);
    formData.append("reason", reason);
    if (file) formData.append("file", file);

    fetch("/api/leaves", { method: "POST", body: formData })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const params = new URLSearchParams({
            id: data.id,
            leaveType: data.leaveType,
            startDate: data.startDate,
            endDate: data.endDate,
            workingDays: String(data.workingDays),
            status: data.status,
          });
          router.push(`/employee/confirmation?${params.toString()}`);
          return;
        }

        const body = await res.json();

        if (res.status === 422) {
          setErrors({ balance: body.error.message });
          return;
        }

        if (res.status === 400 && body.fields) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, val] of Object.entries(body.fields) as [string, { message: string }][]) {
            fieldErrors[key] = val.message;
          }
          setErrors(fieldErrors);
          return;
        }

        setErrors({ server: "Something went wrong. Please try again." });
      })
      .catch(() => {
        setErrors({ server: "Something went wrong. Please try again." });
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push("/employee/dashboard")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          New Leave Request
        </h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the details below to submit your leave request.</p>
      </div>

      {notice === "invalid-request" && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2" role="alert">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>That confirmation link is missing or invalid. Please submit a new request.</span>
        </div>
      )}

      {errors.server && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2" role="alert">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{errors.server}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="p-6">
            <label htmlFor="leaveType" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Leave Type <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="leaveType"
              value={leaveType}
              onChange={(e) => {
                setLeaveType(e.target.value);
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next["balance"];
                  return next;
                });
              }}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
              required
            >
              <option value="">Select leave type...</option>
              {LEAVE_TYPE.map((lt) => (
                <option key={lt} value={lt}>
                  {lt}
                </option>
              ))}
            </select>

            {leaveType && (balanceRows.length > 0 || isExempt) && (
              <div
                className={`mt-3 flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
                  zeroBalanceBlock
                    ? "bg-red-50 border border-red-200"
                    : "bg-blue-50 border border-blue-100"
                }`}
              >
                <svg
                  className={`w-4 h-4 flex-shrink-0 ${
                    zeroBalanceBlock ? "text-red-500" : "text-blue-500"
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>
                  {isExempt && remaining === null ? (
                    <span className="text-blue-800">
                      Unpaid Leave has no balance limit.
                    </span>
                  ) : isExempt ? (
                    <span className="text-blue-800">
                      Remaining balance: <strong>{remaining}</strong> days.
                      Not subject to balance restriction.
                    </span>
                  ) : zeroBalanceBlock ? (
                    <span className="text-red-800 font-medium">
                      You have no remaining {leaveType} balance for this year.
                    </span>
                  ) : remaining !== null ? (
                    <span className="text-blue-800">
                      Remaining balance: <strong>{remaining}</strong> days.
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {leaveType && showError("balance") && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {showError("balance")}
              </p>
            )}
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Start Date <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="startDate"
                  type="date"
                  min={todayStr}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) setEndDate("");
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${
                    showError("startDate") ? "border-red-400" : "border-gray-300"
                  }`}
                  aria-invalid={showError("startDate") !== null}
                  required
                />
                {showError("startDate") && (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {showError("startDate")}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  End Date <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="endDate"
                  type="date"
                  min={startDate || todayStr}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${
                    showError("endDate") ? "border-red-400" : "border-gray-300"
                  }`}
                  aria-invalid={showError("endDate") !== null}
                  required
                />
                {showError("endDate") && (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {showError("endDate")}
                  </p>
                )}
              </div>
            </div>

            {startDate && endDate && !datesResult.ok && datesResult.code === "END_BEFORE_START" ? null : startDate && endDate && datesResult.ok ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>
                    <strong>{workingDays}</strong> working {workingDays === 1 ? "day" : "days"} requested
                    <span className="text-gray-400 ml-1">({formatDate(startDate)} &ndash; {formatDate(endDate)}, Mon&ndash;Fri only)</span>
                  </span>
                </div>

                {conflict && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800" role="alert">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <div>
                      <strong className="font-semibold">Date conflict detected.</strong> These dates overlap with an existing approved leave request. You may still submit, but please verify with your manager.
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="p-6">
            <label htmlFor="reason" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Reason <span className="text-red-500" aria-hidden="true">*</span>
              <span className="ml-1 font-normal text-gray-400">(minimum 10 characters)</span>
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, reason: true }))}
              placeholder="Briefly describe the reason for your leave..."
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${
                showError("reason") ? "border-red-400" : "border-gray-300"
              }`}
              aria-describedby="reason-hint"
              aria-invalid={showError("reason") !== null}
              required
            />
            <div className="mt-1.5 flex justify-between items-center">
              <div>
                {showError("reason") && (
                  <p className="text-xs text-red-600" role="alert">
                    {showError("reason")}
                  </p>
                )}
              </div>
              <span
                id="reason-hint"
                className={`text-xs ${reason.length < 10 ? "text-gray-400" : "text-green-600"}`}
                aria-live="polite"
              >
                {reason.length}/10 min
              </span>
            </div>
          </div>

          {leaveType === "Sick Leave" && (
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Supporting Document
                <span className="ml-1 font-normal text-gray-400">(optional &mdash; PDF or image, max 5MB)</span>
              </label>
              <div
                className={`relative border-2 border-dashed rounded-lg px-4 py-6 text-center transition-colors ${
                  showError("file")
                    ? "border-red-300 bg-red-50"
                    : file
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                }`}
              >
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f) {
                      const result = validateSupportingFile(f, leaveType);
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (result.ok) {
                          delete next["file"];
                        } else {
                          next["file"] = result.message;
                        }
                        return next;
                      });
                    } else {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next["file"];
                        return next;
                      });
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Upload supporting document"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-green-500">({(file.size / 1024).toFixed(0)}KB)</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-gray-300 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-sm text-gray-500">Click or drag to upload</p>
                    <p className="text-xs text-gray-400 mt-0.5">PDF, JPEG, PNG, WebP &mdash; max 5MB</p>
                  </>
                )}
              </div>
              {showError("file") && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1" role="alert">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  {showError("file")}
                </p>
              )}
            </div>
          )}

          <div className="p-6 flex flex-col-reverse sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.push("/employee/dashboard")}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={zeroBalanceBlock || submitting}
              {...(zeroBalanceBlock
                ? { title: `You have no remaining ${leaveType} balance.` }
                : {})}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#1a3a5c" }}
              aria-disabled={zeroBalanceBlock}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
