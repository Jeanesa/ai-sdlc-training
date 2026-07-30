"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_REQUESTS } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";

interface Props {
  requestId: string;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

type Decision = "approve" | "reject" | null;

export default function RequestDetail({ requestId }: Props) {
  const router = useRouter();
  const req = ALL_REQUESTS.find((r) => r.id === requestId);
  const [decision, setDecision] = useState<Decision>(null);
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTouched, setRejectTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedDecision, setSubmittedDecision] = useState<"approve" | "reject" | null>(null);

  if (!req) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Request not found.</p>
        <button onClick={() => router.push("/manager/pending")} className="mt-3 text-sm text-[#1a3a5c] hover:underline">Back to Pending Approvals</button>
      </div>
    );
  }

  const rejectReasonError = rejectReason.length > 0 && rejectReason.length < 20
    ? "Rejection reason must be at least 20 characters."
    : (rejectTouched && rejectReason.length === 0)
    ? "Rejection reason is required."
    : "";

  function handleSubmit() {
    if (decision === "reject") {
      setRejectTouched(true);
      if (rejectReason.length < 20) return;
    }
    setSubmitted(true);
    setSubmittedDecision(decision);
  }

  if (submitted) {
    return (
      <div className="p-6 lg:p-8 max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-8 py-10 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${submittedDecision === "approve" ? "bg-green-100" : "bg-red-100"}`}>
              {submittedDecision === "approve" ? (
                <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Decision Submitted
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              You have <strong>{submittedDecision === "approve" ? "approved" : "rejected"}</strong> the leave request for{" "}
              <strong>{req.employeeName}</strong>.
            </p>
            <p className="text-xs text-gray-400">
              {req.employeeName} has been notified by email. This decision cannot be changed.
            </p>
          </div>
          <div className="px-8 pb-8">
            <button
              onClick={() => router.push("/manager/pending")}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
              style={{ backgroundColor: "#1a3a5c" }}
            >
              Back to Pending Approvals
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <button
        onClick={() => router.push("/manager/pending")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Pending Approvals
      </button>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h1 className="font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
                  Leave Request
                </h1>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{req.id}</p>
              </div>
              <StatusBadge status={req.status} size="md" />
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-[#1a3a5c] flex items-center justify-center text-white text-sm font-semibold" aria-hidden="true">
                  {req.employeeName.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{req.employeeName}</div>
                  <div className="text-xs text-gray-500">{req.department} &middot; {req.office}</div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  { label: "Leave Type", value: req.leaveType },
                  { label: "Days Requested", value: `${req.workingDays} working days` },
                  { label: "Start Date", value: formatDate(req.startDate) },
                  { label: "End Date", value: formatDate(req.endDate) },
                  { label: "Submitted", value: formatDate(req.submittedDate) },
                ].map((item) => (
                  <div key={item.label} className="col-span-2 sm:col-span-1">
                    <dt className="text-xs text-gray-400 mb-0.5">{item.label}</dt>
                    <dd className="font-medium text-gray-900">{item.value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="text-xs text-gray-400 mb-1">Reason</p>
                <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                  {req.reason}
                </p>
              </div>

              {req.hasDocument && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Supporting Document</p>
                  <span className="inline-flex items-center gap-2 text-sm text-[#1a3a5c] font-medium hover:underline cursor-pointer">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    medical_certificate.pdf
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">Make a Decision</h2>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setDecision("approve")}
                className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                  decision === "approve"
                    ? "bg-green-600 border-green-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50"
                }`}
              >
                Approve
              </button>
              <button
                onClick={() => setDecision("reject")}
                className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                  decision === "reject"
                    ? "bg-red-600 border-red-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50"
                }`}
              >
                Reject
              </button>
            </div>

            {decision === "approve" && (
              <div className="mb-4">
                <label htmlFor="approveNote" className="block text-xs font-medium text-gray-600 mb-1.5">
                  Note for employee <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="approveNote"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Approved. Have a great holiday!"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
                />
              </div>
            )}

            {decision === "reject" && (
              <div className="mb-4">
                <label htmlFor="rejectReason" className="block text-xs font-medium text-gray-600 mb-1.5">
                  Rejection reason <span className="text-red-500">*</span>{" "}
                  <span className="text-gray-400">(min 20 characters)</span>
                </label>
                <textarea
                  id="rejectReason"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  onBlur={() => setRejectTouched(true)}
                  placeholder="Provide a clear reason for rejection..."
                  className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${rejectReasonError ? "border-red-400" : "border-gray-200"}`}
                  aria-invalid={!!rejectReasonError}
                  aria-describedby="reject-error"
                />
                <div className="mt-1 flex justify-between items-start">
                  <div id="reject-error">
                    {rejectReasonError && <p className="text-xs text-red-600" role="alert">{rejectReasonError}</p>}
                  </div>
                  <span className={`text-xs ml-2 flex-shrink-0 ${rejectReason.length >= 20 ? "text-green-600" : "text-gray-400"}`}>
                    {rejectReason.length}/20 min
                  </span>
                </div>
              </div>
            )}

            {decision && (
              <button
                onClick={handleSubmit}
                disabled={decision === "reject" && rejectReason.length < 20}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  decision === "approve"
                    ? "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                    : "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                }`}
              >
                Confirm {decision === "approve" ? "Approval" : "Rejection"}
              </button>
            )}

            {!decision && (
              <p className="text-xs text-gray-400 text-center py-2">Select Approve or Reject to proceed.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
