"use client";

import { useRouter } from "next/navigation";
import { PENDING_FOR_MANAGER } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(d: string) {
  const diff = Date.now() - new Date(d + "T00:00:00").getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function PendingApprovals() {
  const router = useRouter();
  const sorted = [...PENDING_FOR_MANAGER].sort(
    (a, b) => new Date(a.submittedDate).getTime() - new Date(b.submittedDate).getTime(),
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
            Pending Approvals
          </h1>
          {sorted.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-400 text-amber-900 text-sm font-bold">
              {sorted.length}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Leave requests from your direct reports awaiting your decision. Sorted oldest first.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-700 mb-1">All clear!</h2>
          <p className="text-sm text-gray-400">No pending leave requests from your direct reports.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Pending leave requests">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Leave Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Dates</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Submitted</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-amber-50/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/manager/requests/${req.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/manager/requests/${req.id}`)}
                    role="button"
                    aria-label={`Review ${req.id} from ${req.employeeName}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: "#1a3a5c" }}
                          aria-hidden="true"
                        >
                          {req.employeeName.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{req.employeeName}</div>
                          <div className="text-xs text-gray-400">{req.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{req.leaveType}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {formatDate(req.startDate)} &ndash; {formatDate(req.endDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{req.workingDays}d</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-gray-600 text-xs">{formatDate(req.submittedDate)}</div>
                      <div className="text-gray-400 text-xs">{daysSince(req.submittedDate)}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status="PENDING" /></td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-[#1a3a5c] hover:underline">Review &rarr;</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
