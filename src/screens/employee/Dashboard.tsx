"use client";

import { useRouter } from "next/navigation";
import type { User } from "@/types";
import { MY_BALANCES, MY_REQUESTS } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";

interface Props {
  user: User;
}

const LEAVE_TYPE_META: Record<string, { color: string; bg: string; icon: string }> = {
  "Annual Leave": { color: "#3b82f6", bg: "#eff6ff", icon: "\u{1F334}" },
  "Sick Leave": { color: "#f97316", bg: "#fff7ed", icon: "\u{1F3E5}" },
  "Emergency Leave": { color: "#8b5cf6", bg: "#f5f3ff", icon: "\u26A1" },
  "Unpaid Leave": { color: "#6b7280", bg: "#f9fafb", icon: "\u{1F4CB}" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function Dashboard({ user }: Props) {
  const router = useRouter();
  const recentRequests = MY_REQUESTS.slice(0, 5);
  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-0.5">{greeting},</p>
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          {user.fullName}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{user.department} &middot; {user.office}</p>
      </div>

      <section aria-labelledby="balances-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="balances-heading" className="text-base font-semibold text-gray-800">
            Leave Balances &mdash; 2026
          </h2>
          <span className="text-xs text-gray-400">Current calendar year</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {MY_BALANCES.map((balance) => {
            const meta = LEAVE_TYPE_META[balance.leaveType] ?? { color: "#6b7280", bg: "#f9fafb", icon: "\u{1F4CB}" };
            const isUnlimited = balance.leaveType === "Unpaid Leave";
            const pct = isUnlimited ? 0 : Math.round(((balance.totalDays - balance.usedDays) / balance.totalDays) * 100);

            return (
              <div
                key={balance.leaveType}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-lg" aria-hidden="true">{meta.icon}</span>
                  {!isUnlimited && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: meta.color, backgroundColor: meta.bg }}
                    >
                      {balance.remainingDays}d left
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-0.5">{balance.leaveType}</div>

                {isUnlimited ? (
                  <div className="text-xl font-semibold text-gray-700">Unlimited</div>
                ) : (
                  <>
                    <div className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-mono)" }}>
                      {balance.remainingDays}
                      <span className="text-sm font-normal text-gray-400">/{balance.totalDays}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: meta.color }}
                        role="progressbar"
                        aria-valuenow={balance.remainingDays}
                        aria-valuemin={0}
                        aria-valuemax={balance.totalDays}
                        aria-label={`${balance.leaveType}: ${balance.remainingDays} of ${balance.totalDays} days remaining`}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-gray-400">
                      <span>{balance.usedDays} used</span>
                      <span>{balance.remainingDays} remaining</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex gap-3 mb-8">
        <button
          onClick={() => router.push("/employee/new-request")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:ring-offset-2"
          style={{ backgroundColor: "#1a3a5c" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Request
        </button>
        <button
          onClick={() => router.push("/employee/my-requests")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:ring-offset-2"
        >
          View all requests
        </button>
      </div>

      <section aria-labelledby="recent-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="recent-heading" className="text-base font-semibold text-gray-800">Recent Requests</h2>
          <button
            onClick={() => router.push("/employee/my-requests")}
            className="text-sm text-[#1a3a5c] hover:underline"
          >
            View all
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {recentRequests.length === 0 ? (
            <div className="py-16 text-center">
              <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p className="text-sm text-gray-400">No leave requests yet</p>
              <button
                onClick={() => router.push("/employee/new-request")}
                className="mt-3 text-sm text-[#1a3a5c] font-medium hover:underline"
              >
                Submit your first request
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Recent leave requests">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Request ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Dates</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Days</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentRequests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push("/employee/my-requests")}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && router.push("/employee/my-requests")}
                      role="button"
                      aria-label={`View ${req.id}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{req.id}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{req.leaveType}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {formatDate(req.startDate)} &ndash; {formatDate(req.endDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{req.workingDays}d</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
