"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeaveTypeName } from "@/types";
import { MY_BALANCES, MY_REQUESTS } from "@/data/mockData";

const LEAVE_TYPES: { name: LeaveTypeName; balanceKey: string }[] = [
  { name: "Annual Leave", balanceKey: "Annual Leave" },
  { name: "Sick Leave", balanceKey: "Sick Leave" },
  { name: "Emergency Leave", balanceKey: "Emergency Leave" },
  { name: "Unpaid Leave", balanceKey: "Unpaid Leave" },
];

function countWorkingDays(start: string, end: string): number {
  if (!start || !end) return 0;
  let count = 0;
  const cur = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (cur <= endDate) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function hasConflict(start: string, end: string): boolean {
  if (!start || !end) return false;
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return MY_REQUESTS.some((r) => {
    if (r.status !== "APPROVED") return false;
    const rs = new Date(r.startDate + "T00:00:00");
    const re = new Date(r.endDate + "T00:00:00");
    return !(e < rs || s > re);
  });
}

const today = new Date().toISOString().split("T")[0];

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

export default function NewLeaveRequest() {
  const router = useRouter();
  const [leaveType, setLeaveType] = useState<LeaveTypeName | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const balance = leaveType
    ? MY_BALANCES.find((b) => b.leaveType === leaveType)
    : null;

  const workingDays = countWorkingDays(startDate, endDate);
  const conflict = hasConflict(startDate, endDate);

  const isExempt = leaveType === "Emergency Leave" || leaveType === "Unpaid Leave";
  const zeroBalance = balance && !isExempt && balance.remainingDays === 0;

  const startDateError = submitAttempted && !startDate ? "Start date is required." : "";
  const endDateError =
    submitAttempted && !endDate
      ? "End date is required."
      : endDate && startDate && endDate < startDate
      ? "End date must be on or after start date."
      : "";
  const reasonError =
    (reasonTouched || submitAttempted) && reason.length > 0 && reason.length < 10
      ? "Reason must be at least 10 characters."
      : submitAttempted && reason.length === 0
      ? "Reason is required."
      : "";

  const canSubmit =
    leaveType && startDate && endDate && !endDateError && reason.length >= 10 && !zeroBalance && !fileError;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileError("");
    setFile(null);
    if (!f) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(f.type)) {
      setFileError("Only PDF and image files (JPEG, PNG, GIF, WebP) are accepted.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setFileError("File size must not exceed 5MB.");
      return;
    }
    setFile(f);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setReasonTouched(true);
    if (!canSubmit) return;
    const params = new URLSearchParams({
      leaveType: leaveType as string,
      startDate,
      endDate,
      workingDays: String(workingDays),
      reason,
      hasDocument: file ? "1" : "0",
    });
    router.push(`/employee/confirmation?${params.toString()}`);
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

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="p-6">
            <label htmlFor="leaveType" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Leave Type <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="leaveType"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveTypeName)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
              required
            >
              <option value="">Select leave type...</option>
              {LEAVE_TYPES.map((lt) => <option key={lt.name} value={lt.name}>{lt.name}</option>)}
            </select>

            {balance && (
              <div className={`mt-3 flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${
                zeroBalance ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-100"
              }`}>
                <svg className={`w-4 h-4 flex-shrink-0 ${zeroBalance ? "text-red-500" : "text-blue-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>
                  {leaveType === "Unpaid Leave" ? (
                    <span className="text-blue-800">Unpaid Leave has no balance limit.</span>
                  ) : leaveType === "Emergency Leave" ? (
                    <span className="text-blue-800">
                      Emergency Leave balance: <strong>{balance.remainingDays}</strong> of {balance.totalDays} days remaining.
                      Not subject to balance restriction.
                    </span>
                  ) : zeroBalance ? (
                    <span className="text-red-800 font-medium">
                      You have no remaining {leaveType} balance for this year.
                    </span>
                  ) : (
                    <span className="text-blue-800">
                      Remaining balance: <strong>{balance.remainingDays}</strong> of {balance.totalDays} days.
                    </span>
                  )}
                </div>
              </div>
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
                  min={today}
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(""); }}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${startDateError ? "border-red-400" : "border-gray-300"}`}
                  aria-invalid={!!startDateError}
                  required
                />
                {startDateError && <p className="mt-1 text-xs text-red-600" role="alert">{startDateError}</p>}
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  End Date <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="endDate"
                  type="date"
                  min={startDate || today}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${endDateError ? "border-red-400" : "border-gray-300"}`}
                  aria-invalid={!!endDateError}
                  required
                />
                {endDateError && <p className="mt-1 text-xs text-red-600" role="alert">{endDateError}</p>}
              </div>
            </div>

            {startDate && endDate && !endDateError && (
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
            )}
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
              onBlur={() => setReasonTouched(true)}
              placeholder="Briefly describe the reason for your leave..."
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${reasonError ? "border-red-400" : "border-gray-300"}`}
              aria-describedby="reason-hint"
              aria-invalid={!!reasonError}
              required
            />
            <div className="mt-1.5 flex justify-between items-center">
              <div>
                {reasonError && <p className="text-xs text-red-600" role="alert">{reasonError}</p>}
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
              <div className={`relative border-2 border-dashed rounded-lg px-4 py-6 text-center transition-colors ${
                fileError ? "border-red-300 bg-red-50" : file ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
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
              {fileError && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1" role="alert">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {fileError}
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
              disabled={!!zeroBalance}
              title={zeroBalance ? `You have no remaining ${leaveType} balance.` : undefined}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#1a3a5c" }}
              aria-disabled={!!zeroBalance}
            >
              Submit Request
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
