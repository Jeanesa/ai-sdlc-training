"use client";

import { useState } from "react";
import type { LeaveStatus, LeaveTypeName } from "@/types";
import { ALL_REQUESTS, DEPARTMENTS } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const STATUSES: (LeaveStatus | "")[] = ["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const LEAVE_TYPES: (LeaveTypeName | "")[] = ["", "Annual Leave", "Sick Leave", "Emergency Leave", "Unpaid Leave"];

export default function AllRequests() {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveTypeName | "">("");
  const [status, setStatus] = useState<LeaveStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overrideReq, setOverrideReq] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<LeaveStatus>("APPROVED");
  const [overrideTouched, setOverrideTouched] = useState(false);
  const [overrideSuccess, setOverrideSuccess] = useState("");
  const [loading] = useState(false);

  const filtered = ALL_REQUESTS.filter((r) => {
    if (search && !r.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
    if (dept && r.department !== dept) return false;
    if (leaveType && r.leaveType !== leaveType) return false;
    if (status && r.status !== status) return false;
    if (dateFrom && r.startDate < dateFrom) return false;
    if (dateTo && r.endDate > dateTo) return false;
    return true;
  });

  const overrideReasonError = overrideTouched && overrideReason.length < 20
    ? "Override reason must be at least 20 characters."
    : "";

  function handleOverride() {
    setOverrideTouched(true);
    if (overrideReason.length < 20) return;
    setOverrideSuccess(`Status overridden to ${overrideStatus} for ${overrideReq}.`);
    setOverrideReq(null);
    setOverrideReason("");
    setOverrideTouched(false);
    setTimeout(() => setOverrideSuccess(""), 4000);
  }

  function clearFilters() {
    setSearch(""); setDept(""); setLeaveType(""); setStatus(""); setDateFrom(""); setDateTo("");
  }

  const hasFilters = search || dept || leaveType || status || dateFrom || dateTo;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {overrideReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Override Status</h2>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{overrideReq}</p>
              </div>
              <button onClick={() => { setOverrideReq(null); setOverrideReason(""); setOverrideTouched(false); }}
                className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex gap-2 items-start">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Status overrides are logged in the audit trail with your account, timestamp, and this reason.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as LeaveStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
                >
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Override Reason <span className="text-red-500">*</span>{" "}
                  <span className="text-gray-400 font-normal">(min 20 characters)</span>
                </label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  onBlur={() => setOverrideTouched(true)}
                  placeholder="Explain why this status override is necessary..."
                  className={`w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${overrideReasonError ? "border-red-400" : "border-gray-200"}`}
                />
                <div className="mt-1 flex justify-between">
                  {overrideReasonError && <p className="text-xs text-red-600" role="alert">{overrideReasonError}</p>}
                  <span className={`text-xs ml-auto ${overrideReason.length >= 20 ? "text-green-600" : "text-gray-400"}`}>
                    {overrideReason.length}/20 min
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setOverrideReq(null); setOverrideReason(""); setOverrideTouched(false); }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleOverride}
                disabled={overrideReason.length < 20}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#1a3a5c" }}
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>All Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Organisation-wide leave request view with filters and export.</p>
        </div>
        <button
          onClick={() => alert("CSV export triggered \u2014 " + filtered.length + " records")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {overrideSuccess && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800" role="status">
          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          {overrideSuccess}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Employee name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] col-span-1 sm:col-span-2 xl:col-span-1"
            aria-label="Filter by employee name"
          />
          <select value={dept} onChange={(e) => setDept(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            aria-label="Filter by department">
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveTypeName | "")}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            aria-label="Filter by leave type">
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t || "All types"}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as LeaveStatus | "")}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            aria-label="Filter by status">
            {STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            aria-label="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
            aria-label="To date" />
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-gray-500">{filtered.length} of {ALL_REQUESTS.length} results</span>
            <button onClick={clearFilters} className="text-xs text-[#1a3a5c] hover:underline">Clear all filters</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <svg className="animate-spin w-6 h-6 text-gray-300 mx-auto" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <p className="text-sm text-gray-400">No requests match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="All leave requests">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["ID", "Employee", "Department", "Type", "Start", "End", "Days", "Status", "Submitted", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{r.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.employeeName}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.department}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.leaveType}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.startDate)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.endDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.workingDays}d</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(r.submittedDate)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setOverrideReq(r.id); setOverrideReason(""); setOverrideTouched(false); }}
                        className="text-xs text-gray-400 hover:text-[#1a3a5c] hover:underline whitespace-nowrap"
                      >
                        Override
                      </button>
                    </td>
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
