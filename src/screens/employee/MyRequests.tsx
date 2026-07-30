"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeaveStatus } from "@/types";
import { MY_REQUESTS } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_FILTERS: { label: string; value: LeaveStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const YEARS = ["2026", "2025"];

export default function MyRequests() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "ALL">("ALL");
  const [yearFilter, setYearFilter] = useState("2026");
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  const filtered = MY_REQUESTS.filter((r) => {
    const statusMatch = statusFilter === "ALL" || r.status === statusFilter;
    const yearMatch = r.startDate.startsWith(yearFilter);
    return statusMatch && yearMatch;
  });

  const detail = selectedReq ? MY_REQUESTS.find((r) => r.id === selectedReq) : null;

  function handleCancel(id: string) {
    setCancelledIds((prev) => new Set([...prev, id]));
    setCancelConfirm(null);
    setSelectedReq(null);
  }

  function getEffectiveStatus(req: (typeof MY_REQUESTS)[0]) {
    return cancelledIds.has(req.id) ? "CANCELLED" : req.status;
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Request detail">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>Request Detail</h2>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{detail.id}</p>
              </div>
              <button onClick={() => setSelectedReq(null)} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm">
              <StatusBadge status={getEffectiveStatus(detail) as LeaveStatus} size="md" />
              {[
                { label: "Leave Type", value: detail.leaveType },
                { label: "Start Date", value: formatDate(detail.startDate) },
                { label: "End Date", value: formatDate(detail.endDate) },
                { label: "Working Days", value: `${detail.workingDays} days` },
                { label: "Submitted", value: formatDate(detail.submittedDate) },
                { label: "Reason", value: detail.reason },
              ].map((row) => (
                <div key={row.label} className="flex gap-4">
                  <span className="w-32 text-gray-400 flex-shrink-0">{row.label}</span>
                  <span className="text-gray-900 font-medium flex-1">{row.value}</span>
                </div>
              ))}
              {detail.hasDocument && (
                <div className="flex gap-4">
                  <span className="w-32 text-gray-400 flex-shrink-0">Document</span>
                  <span className="text-[#1a3a5c] font-medium underline cursor-pointer">medical_cert.pdf</span>
                </div>
              )}
              {detail.managerNote && (
                <div className="mt-3 px-4 py-3 bg-green-50 border border-green-100 rounded-lg">
                  <p className="text-xs font-semibold text-green-700 mb-1">Manager Note</p>
                  <p className="text-sm text-green-800">{detail.managerNote}</p>
                </div>
              )}
              {detail.rejectionReason && (
                <div className="mt-3 px-4 py-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-800">{detail.rejectionReason}</p>
                </div>
              )}
            </div>

            {getEffectiveStatus(detail) === "PENDING" && (
              <div className="px-6 pb-6">
                {cancelConfirm === detail.id ? (
                  <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <p className="text-sm text-red-800 mb-3">Are you sure you want to cancel this request?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setCancelConfirm(null)} className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">Keep</button>
                      <button onClick={() => handleCancel(detail.id)} className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700">Yes, Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCancelConfirm(detail.id)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          My Requests
        </h1>
        <p className="text-sm text-gray-500 mt-1">Your full leave request history.</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statusFilter === f.value
                  ? "bg-[#1a3a5c] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              aria-pressed={statusFilter === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
          aria-label="Filter by year"
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <button
          onClick={() => router.push("/employee/new-request")}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "#1a3a5c" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Request
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
            </svg>
            <p className="text-sm text-gray-500">No requests match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Leave request history">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">End</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((req) => {
                  const effectiveStatus = getEffectiveStatus(req);
                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedReq(req.id)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedReq(req.id)}
                      role="button"
                      aria-label={`View details for ${req.id}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{req.id}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{req.leaveType}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{formatDate(req.startDate)}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{formatDate(req.endDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{req.workingDays}d</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={effectiveStatus as LeaveStatus} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDate(req.submittedDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
