"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import {
  deriveYearOptions,
  filterRequests,
  formatDateOnly,
  formatIsoDate,
  type LeaveHistoryRow,
  type StatusFilter,
} from "./my-requests-helpers";
import type { LeaveStatus } from "@/types";

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const ALL_YEARS = "ALL";

type DocLinkState = "idle" | "loading" | "ready" | "error";

export default function MyRequests() {
  const router = useRouter();
  const [rows, setRows] = useState<LeaveHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<string>(ALL_YEARS);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [docState, setDocState] = useState<DocLinkState>("idle");
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leaves");
      if (!res.ok) {
        setError("Could not load your leave requests. Please try again.");
        return;
      }
      const data = (await res.json()) as LeaveHistoryRow[];
      setRows(data);
    } catch {
      setError("Could not load your leave requests. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function refetch() {
    try {
      const res = await fetch("/api/leaves");
      if (res.ok) {
        const data = (await res.json()) as LeaveHistoryRow[];
        setRows(data);
      }
    } catch {
      // swallow — the cancel already succeeded; do not show an error
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const detail = selectedReq !== null ? (rows.find((r) => r.id === selectedReq) ?? null) : null;

  useEffect(() => {
    if (detail === null || detail.supportingDocPath === null) {
      setDocState("idle");
      setDocUrl(null);
      setDocError(null);
      return;
    }
    let cancelled = false;
    const reqId = detail.id;
    setDocState("loading");
    setDocUrl(null);
    setDocError(null);
    async function loadDoc() {
      try {
        const res = await fetch(`/api/leaves/${reqId}/supporting-doc`);
        if (cancelled) return;
        if (!res.ok) {
          setDocState("error");
          setDocError("Could not load the supporting document link.");
          return;
        }
        const data = (await res.json()) as { url: string };
        if (!cancelled) {
          setDocUrl(data.url);
          setDocState("ready");
        }
      } catch {
        if (!cancelled) {
          setDocState("error");
          setDocError("Could not load the supporting document link.");
        }
      }
    }
    void loadDoc();
    return () => {
      cancelled = true;
    };
  }, [detail]);

  useEffect(() => {
    setShowCancelConfirm(false);
    setCancelError(null);
    setCancelMessage(null);
  }, [selectedReq]);

  const yearOptions = deriveYearOptions(rows);
  const filtered = filterRequests(rows, { status: statusFilter, year: yearFilter });

  async function handleCancel() {
    if (detail === null) return;
    setCancelError(null);
    setCancelMessage(null);
    try {
      const res = await fetch(`/api/leaves/${detail.id}/cancel`, { method: "POST" });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === detail.id ? { ...r, status: "CANCELLED" as LeaveStatus } : r,
          ),
        );
        setSelectedReq(null);
        void refetch();
        return;
      }
      if (res.status === 409) {
        const body = (await res.json()) as { id: string; status: LeaveStatus };
        setRows((prev) =>
          prev.map((r) =>
            r.id === detail.id ? { ...r, status: body.status } : r,
          ),
        );
        setCancelMessage(
          `This request has already been ${body.status.toLowerCase()}.`,
        );
        void refetch();
        return;
      }
      const body = (await res.json()) as { error?: { message?: string } };
      setCancelError(body.error?.message ?? "Could not cancel the request. Please try again.");
    } catch {
      setCancelError("Could not cancel the request. Please try again.");
    }
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
              <StatusBadge status={detail.status} size="md" />
              {[
                { label: "Leave Type", value: detail.leaveType },
                { label: "Start Date", value: formatDateOnly(detail.startDate) },
                { label: "End Date", value: formatDateOnly(detail.endDate) },
                { label: "Working Days", value: `${detail.workingDays} days` },
                { label: "Submitted", value: formatIsoDate(detail.createdAt) },
              ].map((row) => (
                <div key={row.label} className="flex gap-4">
                  <span className="w-32 text-gray-400 flex-shrink-0">{row.label}</span>
                  <span className="text-gray-900 font-medium flex-1">{row.value}</span>
                </div>
              ))}
              {docState === "loading" && (
                <div className="flex gap-4">
                  <span className="w-32 text-gray-400 flex-shrink-0">Document</span>
                  <span className="text-gray-500">Loading document link...</span>
                </div>
              )}
              {docState === "ready" && docUrl !== null && (
                <div className="flex gap-4">
                  <span className="w-32 text-gray-400 flex-shrink-0">Document</span>
                  <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-[#1a3a5c] font-medium underline">
                    View document
                  </a>
                </div>
              )}
              {docState === "error" && (
                <div className="flex gap-4">
                  <span className="w-32 text-gray-400 flex-shrink-0">Document</span>
                  <span className="text-red-600">{docError}</span>
                </div>
              )}
              {detail.managerNote && (
                <div className="mt-3 px-4 py-3 bg-green-50 border border-green-100 rounded-lg">
                  <p className="text-xs font-semibold text-green-700 mb-1">Manager Note</p>
                  <p className="text-sm text-green-800">{detail.managerNote}</p>
                </div>
              )}
              {detail.status === "PENDING" && !showCancelConfirm && (
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              )}
              {detail.status === "PENDING" && showCancelConfirm && (
                <div className="pt-3 border-t border-gray-100 space-y-3">
                  {cancelError !== null && (
                    <p className="text-sm text-red-600">{cancelError}</p>
                  )}
                  {cancelMessage !== null && (
                    <p className="text-sm text-amber-600">{cancelMessage}</p>
                  )}
                  <p className="text-sm text-gray-700">Are you sure you want to cancel this request?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCancel()}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
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
          <option value={ALL_YEARS}>All</option>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
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
        {loading ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">Loading your leave requests...</p>
          </div>
        ) : error !== null ? (
          <div className="py-16 text-center">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={() => void loadRows()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: "#1a3a5c" }}
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
            </svg>
            <p className="text-sm text-gray-500">You have no leave requests yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
            </svg>
            <p className="text-sm text-gray-500">No requests match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Leave request history">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Leave Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Start Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">End Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedReq(req.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedReq(req.id)}
                    role="button"
                    aria-label={`View details for ${req.id}`}
                  >
                    <td className="px-4 py-3 text-gray-800 font-medium">{req.leaveType}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{formatDateOnly(req.startDate)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{formatDateOnly(req.endDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{req.workingDays}d</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatIsoDate(req.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
