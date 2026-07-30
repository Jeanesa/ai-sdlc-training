"use client";

import { useState } from "react";
import { AUDIT_LOG } from "@/data/mockData";
import type { AuditAction } from "@/types";

const ACTION_COLORS: Record<AuditAction, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700 border border-blue-100",
  APPROVED: "bg-green-50 text-green-700 border border-green-100",
  REJECTED: "bg-red-50 text-red-700 border border-red-100",
  CANCELLED: "bg-gray-100 text-gray-600 border border-gray-200",
  OVERRIDDEN: "bg-purple-50 text-purple-700 border border-purple-100",
};

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

const ACTORS = [...new Set(AUDIT_LOG.map((e) => e.actor))];
const ACTIONS: AuditAction[] = ["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "OVERRIDDEN"];

export default function AuditLog() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState<AuditAction | "">("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = AUDIT_LOG.filter((e) => {
    const ts = e.timestamp?.split("T")[0] ?? "";
    if (dateFrom && ts < dateFrom) return false;
    if (dateTo && ts > dateTo) return false;
    if (actor && e.actor !== actor) return false;
    if (action && e.action !== action) return false;
    return true;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const hasFilters = dateFrom || dateTo || actor || action;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
            Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tamper-evident record of all leave state and entitlement changes. Labor-law compliance trail.
          </p>
        </div>
        <button
          onClick={() => alert("CSV export triggered \u2014 " + filtered.length + " audit entries")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Actor</label>
            <select value={actor} onChange={(e) => setActor(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]">
              <option value="">All actors</option>
              {ACTORS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action Type</label>
            <select value={action} onChange={(e) => setAction(e.target.value as AuditAction | "")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]">
              <option value="">All actions</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-gray-500">{filtered.length} of {AUDIT_LOG.length} entries</span>
            <button onClick={() => { setDateFrom(""); setDateTo(""); setActor(""); setAction(""); }} className="text-xs text-[#1a3a5c] hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p className="text-sm text-gray-400">No audit entries match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Audit log entries">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Timestamp (UTC)", "Actor", "Action", "Record", "Employee", "Details", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((entry) => {
                  const { date, time } = formatTimestamp(entry.timestamp);
                  const isExpanded = expanded === entry.id;
                  return (
                    <tr key={entry.id}>
                      <td colSpan={7} className="p-0">
                        <table className="w-full">
                          <tbody>
                            <tr
                              className="hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => setExpanded(isExpanded ? null : entry.id)}
                              aria-expanded={isExpanded}
                            >
                              <td className="px-4 py-3 whitespace-nowrap align-top">
                                <div className="text-xs text-gray-700 font-mono">{date}</div>
                                <div className="text-xs text-gray-400 font-mono">{time}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap align-top">
                                <div className="text-xs font-medium text-gray-900">{entry.actor}</div>
                                <div className="text-xs text-gray-400 capitalize">{entry.actorRole.replace("hradmin", "HR Admin").replace("sysadmin", "Sys Admin")}</div>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ACTION_COLORS[entry.action]}`}>
                                  {entry.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap align-top">{entry.recordId}</td>
                              <td className="px-4 py-3 text-gray-700 whitespace-nowrap align-top">{entry.employeeName}</td>
                              <td className="px-4 py-3 text-gray-600 max-w-xs align-top">
                                <div className="truncate">{entry.details}</div>
                              </td>
                              <td className="px-4 py-3 text-gray-400 align-top">
                                <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={7} className="px-4 pb-3 bg-gray-50">
                                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs font-mono">
                                    <div className="grid sm:grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-gray-400 uppercase tracking-wide text-xs mb-1 font-sans">Previous Status</p>
                                        <p className="text-gray-700">{entry.oldStatus ?? "null"}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-400 uppercase tracking-wide text-xs mb-1 font-sans">New Status</p>
                                        <p className="text-gray-700">{entry.newStatus ?? "null"}</p>
                                      </div>
                                    </div>
                                    <p className="text-gray-400 text-xs mt-2 font-sans">
                                      Full before/after JSONB snapshots stored in audit_log table. Timestamp: {entry.timestamp}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </td>
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
