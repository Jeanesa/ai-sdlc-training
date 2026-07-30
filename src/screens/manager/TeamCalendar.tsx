"use client";

import { useState } from "react";
import { ALL_REQUESTS } from "@/data/mockData";

const LEAVE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "Annual Leave": { bg: "#dbeafe", text: "#1d4ed8", label: "Annual" },
  "Sick Leave": { bg: "#ffedd5", text: "#c2410c", label: "Sick" },
  "Emergency Leave": { bg: "#ede9fe", text: "#6d28d9", label: "Emergency" },
  "Unpaid Leave": { bg: "#f3f4f6", text: "#374151", label: "Unpaid" },
};

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstWeekday(y: number, m: number) {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function getApprovedLeaveForDay(year: number, month: number, day: number) {
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return ALL_REQUESTS.filter((r) => {
    if (r.status !== "APPROVED") return false;
    return r.startDate <= dateStr && r.endDate >= dateStr;
  });
}

export default function TeamCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const todayStr = now.toISOString().split("T")[0];

  function prev() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstWeekday(year, month);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          Team Calendar
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Approved leave for your direct reports (color-coded by type).
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            onClick={prev}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Previous month"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h2 className="font-semibold text-gray-800 text-lg" style={{ fontFamily: "var(--font-display)" }}>
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={next}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Next month"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="h-20 sm:h-24 rounded-lg bg-gray-50/50" />;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const isWeekend = (idx % 7) >= 5;
              const leaves = getApprovedLeaveForDay(year, month, day);

              return (
                <div
                  key={day}
                  className={`h-20 sm:h-24 rounded-lg p-1 sm:p-1.5 text-xs border transition-colors ${
                    isToday
                      ? "border-[#1a3a5c] bg-[#eff6ff]"
                      : isWeekend
                      ? "border-transparent bg-gray-50"
                      : "border-transparent bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className={`font-semibold mb-1 ${isToday ? "text-[#1a3a5c]" : isWeekend ? "text-gray-300" : "text-gray-600"} text-xs sm:text-sm`}>
                    {day}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {leaves.slice(0, 3).map((r, i) => {
                      const meta = LEAVE_COLORS[r.leaveType] ?? LEAVE_COLORS["Unpaid Leave"]!;
                      const name = r.employeeName.split(" ")[0]!;
                      return (
                        <div
                          key={`${r.id}-${i}`}
                          className="truncate rounded px-1 py-0.5 text-xs font-medium hidden sm:block"
                          style={{ backgroundColor: meta.bg, color: meta.text }}
                          title={`${r.employeeName} \u2013 ${r.leaveType}`}
                        >
                          {name}
                        </div>
                      );
                    })}
                    {leaves.length > 0 && (
                      <div
                        className="sm:hidden w-2 h-2 rounded-full"
                        style={{ backgroundColor: (LEAVE_COLORS[leaves[0]!.leaveType]?.text) ?? "#374151" }}
                        title={`${leaves.length} on leave`}
                        aria-label={`${leaves.length} team member${leaves.length > 1 ? "s" : ""} on leave`}
                      />
                    )}
                    {leaves.length > 3 && (
                      <div className="text-gray-400 text-xs hidden sm:block">+{leaves.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-4">
          <span className="text-xs text-gray-400 font-medium">Leave types:</span>
          {Object.entries(LEAVE_COLORS).map(([type, meta]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: meta.text }} aria-hidden="true" />
              <span className="text-xs text-gray-600">{meta.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
