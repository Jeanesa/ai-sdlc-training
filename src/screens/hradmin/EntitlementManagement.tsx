"use client";

import { useState } from "react";
import { ENTITLEMENTS } from "@/data/mockData";
import type { EntitlementRow } from "@/types";

export default function EntitlementManagement() {
  const [rows, setRows] = useState<EntitlementRow[]>(ENTITLEMENTS);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<EntitlementRow>>({});
  const [saved, setSaved] = useState("");
  const [uploadStep, setUploadStep] = useState<"idle" | "preview" | "success">("idle");
  const [dragOver, setDragOver] = useState(false);

  function startEdit(row: EntitlementRow) {
    setEditing(row.employeeId);
    setEditValues({ annual: row.annual, sick: row.sick, emergency: row.emergency, unpaid: row.unpaid });
  }

  function saveEdit(employeeId: string) {
    setRows((r) => r.map((row) => row.employeeId === employeeId ? { ...row, ...editValues } : row));
    setEditing(null);
    setSaved(`Entitlement for ${rows.find((r) => r.employeeId === employeeId)?.employeeName} updated.`);
    setTimeout(() => setSaved(""), 3000);
  }

  function handleNumericInput(field: keyof EntitlementRow, value: string) {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0) {
      setEditValues((v) => ({ ...v, [field]: num }));
    }
  }

  const COLS: { key: keyof EntitlementRow; label: string }[] = [
    { key: "annual", label: "Annual" },
    { key: "sick", label: "Sick" },
    { key: "emergency", label: "Emergency" },
    { key: "unpaid", label: "Unpaid" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          Entitlement Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Set and edit annual leave entitlements per employee. All changes are audit-logged.
        </p>
      </div>

      {saved && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800" role="status">
          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          {saved}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm">2026 Entitlements (days)</h2>
          <span className="text-xs text-gray-400">Click Edit to modify an employee.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Leave entitlements">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Department</th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</th>
                ))}
                <th className="px-4 py-3" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.employeeId} className={`transition-colors ${editing === row.employeeId ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#1a3a5c] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" aria-hidden="true">
                        {row.employeeName.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="font-medium text-gray-900">{row.employeeName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{row.department}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-center">
                      {editing === row.employeeId ? (
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={editValues[c.key] ?? row[c.key]}
                          onChange={(e) => handleNumericInput(c.key, e.target.value)}
                          className="w-16 text-center px-2 py-1 rounded border border-[#1a3a5c] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#1a3a5c]"
                          aria-label={`${c.label} days for ${row.employeeName}`}
                        />
                      ) : (
                        <span className="font-mono text-gray-800">{row[c.key]}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    {editing === row.employeeId ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditing(null)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(row.employeeId)}
                          className="text-xs px-2.5 py-1.5 rounded-lg text-white"
                          style={{ backgroundColor: "#1a3a5c" }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(row)}
                        className="text-xs text-[#1a3a5c] hover:underline font-medium"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Bulk CSV Import</h2>
          <p className="text-xs text-gray-400 mt-0.5">Upload a CSV file to update entitlements for multiple employees at once.</p>
        </div>

        <div className="p-6">
          {uploadStep === "idle" && (
            <>
              <div className="mb-4 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">Expected CSV format:</p>
                <code className="text-xs text-gray-600" style={{ fontFamily: "var(--font-mono)" }}>
                  employee_id,annual_days,sick_days,emergency_days,unpaid_days
                </code>
              </div>

              <div
                className={`border-2 border-dashed rounded-xl px-6 py-10 text-center transition-colors cursor-pointer ${
                  dragOver ? "border-[#1a3a5c] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); setUploadStep("preview"); }}
                onClick={() => setUploadStep("preview")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setUploadStep("preview")}
                aria-label="Upload CSV file"
              >
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">Drop your CSV file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">.csv files only</p>
              </div>
            </>
          )}

          {uploadStep === "preview" && (
            <div>
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-700">
                <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                <span><strong>entitlements_2026.csv</strong> &mdash; 5 rows validated. Ready to import.</span>
              </div>
              <div className="rounded-lg border border-gray-100 overflow-hidden mb-4">
                <table className="w-full text-xs" aria-label="CSV preview">
                  <thead><tr className="bg-gray-50">
                    {["Employee ID", "Annual", "Sick", "Emergency", "Unpaid"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {ENTITLEMENTS.map((r) => (
                      <tr key={r.employeeId} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-600">{r.employeeId}</td>
                        <td className="px-3 py-2 text-gray-800">{r.annual}</td>
                        <td className="px-3 py-2 text-gray-800">{r.sick}</td>
                        <td className="px-3 py-2 text-gray-800">{r.emergency}</td>
                        <td className="px-3 py-2 text-gray-800">{r.unpaid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setUploadStep("idle")}
                  className="px-4 py-2 rounded-lg text-sm text-gray-700 border border-gray-200 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => setUploadStep("success")}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: "#1a3a5c" }}
                >
                  Confirm Import
                </button>
              </div>
            </div>
          )}

          {uploadStep === "success" && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Import Successful</h3>
              <p className="text-sm text-gray-500 mb-4">5 entitlement records updated. Changes have been logged in the audit trail and affected employees notified.</p>
              <button onClick={() => setUploadStep("idle")} className="text-sm text-[#1a3a5c] hover:underline">Import another file</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
