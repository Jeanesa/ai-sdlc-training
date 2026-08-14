"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { LEAVE_TYPE } from "@/lib/leave/validation";
import type { LeaveStatus } from "@/types";

const LEAVE_STATUSES: readonly LeaveStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

function formatDate(d: string | undefined) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s + "T00:00:00").getTime());
}

export default function Confirmation() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const id = searchParams.get("id") ?? "";
  const leaveType = searchParams.get("leaveType") ?? "";
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const rawWorkingDays = searchParams.get("workingDays") ?? "";
  const status = searchParams.get("status") ?? "";

  const workingDays = Number(rawWorkingDays);
  const workingDaysValid =
    rawWorkingDays !== "" &&
    Number.isFinite(workingDays) &&
    Number.isInteger(workingDays) &&
    workingDays >= 0;

  const valid =
    id.trim() !== "" &&
    (LEAVE_TYPE as readonly string[]).includes(leaveType) &&
    isIsoDate(startDate) &&
    isIsoDate(endDate) &&
    workingDaysValid &&
    (LEAVE_STATUSES as readonly string[]).includes(status);

  useEffect(() => {
    if (!valid) {
      router.replace("/employee/new-request?notice=invalid-request");
    }
  }, [router, valid]);

  if (!valid) return null;

  return (
    <div className="p-6 lg:p-8 max-w-xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-8 pt-10 pb-6 text-center" style={{ borderBottom: "1px solid #f0f4f8" }}>
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Request Submitted
          </h1>
          <p className="text-sm text-gray-500">
            Your leave request has been sent to your manager for review.
          </p>
        </div>

        <div className="px-8 py-5 text-center bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Request ID</p>
          <p
            className="text-2xl font-semibold tracking-wider text-gray-900 break-all"
            style={{ fontFamily: "var(--font-mono)" }}
            aria-label={`Request ID: ${id}`}
          >
            {id}
          </p>
        </div>

        <div className="px-8 py-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Request Summary</h2>

          <div className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500 flex-shrink-0">Leave Type</span>
            <span className="text-gray-900 font-medium text-right">{leaveType}</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500 flex-shrink-0">Start Date</span>
            <span className="text-gray-900 font-medium text-right">{formatDate(startDate)}</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500 flex-shrink-0">End Date</span>
            <span className="text-gray-900 font-medium text-right">{formatDate(endDate)}</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500 flex-shrink-0">Working Days</span>
            <span className="text-gray-900 font-medium text-right">
              {workingDays} {workingDays === 1 ? "day" : "days"}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-sm items-center">
            <span className="text-gray-500 flex-shrink-0">Status</span>
            <StatusBadge status={status as LeaveStatus} />
          </div>
        </div>

        <div className="mx-8 mb-6 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Your manager has been notified by email. You will receive an email once a decision is made.
        </div>

        <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.push("/employee/new-request")}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-center"
          >
            New Request
          </button>
          <button
            onClick={() => router.push("/employee/my-requests")}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:ring-offset-2 text-center"
            style={{ backgroundColor: "#1a3a5c" }}
          >
            View My Requests
          </button>
        </div>
      </div>
    </div>
  );
}
