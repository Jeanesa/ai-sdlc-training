"use client";

import { useState } from "react";
import { LEAVE_TYPES } from "@/data/mockData";
import type { LeaveTypeConfig } from "@/types";

export default function LeaveTypes() {
  const [types, setTypes] = useState<LeaveTypeConfig[]>(LEAVE_TYPES);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<LeaveTypeConfig>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState({ name: "", defaultDays: "", allowCarryover: false });
  const [newTypeErrors, setNewTypeErrors] = useState<{ name?: string; days?: string }>({});
  const [toast, setToast] = useState("");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function startEdit(t: LeaveTypeConfig) {
    setEditing(t.id);
    setEditValues({ name: t.name, defaultDays: t.defaultDays, allowCarryover: t.allowCarryover });
  }

  function saveEdit(id: string) {
    setTypes((ts) => ts.map((t) => t.id === id ? { ...t, ...editValues } : t));
    setEditing(null);
    showToast("Leave type updated.");
  }

  function toggleActive(id: string) {
    setTypes((ts) => ts.map((t) => t.id === id ? { ...t, isActive: !t.isActive } : t));
    const t = types.find((x) => x.id === id);
    showToast(t ? `"${t.name}" ${t.isActive ? "deactivated" : "reactivated"}.` : "Updated.");
  }

  function handleAdd() {
    const errors: { name?: string; days?: string } = {};
    if (!newType.name.trim()) errors.name = "Name is required.";
    if (!newType.defaultDays || isNaN(parseInt(newType.defaultDays))) errors.days = "Valid number of days required.";
    setNewTypeErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const id = "lt-" + Date.now();
    setTypes((ts) => [...ts, {
      id,
      name: newType.name.trim(),
      defaultDays: parseInt(newType.defaultDays),
      allowCarryover: newType.allowCarryover,
      isActive: true,
    }]);
    setNewType({ name: "", defaultDays: "", allowCarryover: false });
    setShowAdd(false);
    showToast(`"${newType.name.trim()}" added.`);
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
            Leave Types
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage leave types. Deactivated types are hidden from the employee submission form but not deleted.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0"
          style={{ backgroundColor: "#1a3a5c" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add Type
        </button>
      </div>

      {toast && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800" role="status">
          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          {toast}
        </div>
      )}

      {showAdd && (
        <div className="bg-white rounded-xl border border-[#1a3a5c]/20 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Add New Leave Type</h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newType.name}
                onChange={(e) => setNewType((n) => ({ ...n, name: e.target.value }))}
                placeholder="e.g. Maternity Leave"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${newTypeErrors.name ? "border-red-400" : "border-gray-200"}`}
              />
              {newTypeErrors.name && <p className="mt-0.5 text-xs text-red-600">{newTypeErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Default Days <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                value={newType.defaultDays}
                onChange={(e) => setNewType((n) => ({ ...n, defaultDays: e.target.value }))}
                placeholder="0"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] ${newTypeErrors.days ? "border-red-400" : "border-gray-200"}`}
              />
              {newTypeErrors.days && <p className="mt-0.5 text-xs text-red-600">{newTypeErrors.days}</p>}
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newType.allowCarryover}
                  onChange={(e) => setNewType((n) => ({ ...n, allowCarryover: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-[#1a3a5c] focus:ring-[#1a3a5c]"
                />
                <span className="text-sm text-gray-700">Allow carryover</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowAdd(false); setNewTypeErrors({}); }} className="px-4 py-2 rounded-lg text-sm text-gray-700 border border-gray-200 hover:bg-gray-50">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: "#1a3a5c" }}>
              Add Leave Type
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Leave types">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Name", "Default Days / Year", "Carryover", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {types.map((t) => (
                <tr key={t.id} className={`transition-colors ${!t.isActive ? "opacity-50" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-3">
                    {editing === t.id ? (
                      <input
                        value={editValues.name ?? t.name}
                        onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                        className="px-2 py-1 rounded border border-[#1a3a5c] text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3a5c]"
                        aria-label="Leave type name"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{t.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing === t.id ? (
                      <input
                        type="number"
                        min="0"
                        value={editValues.defaultDays ?? t.defaultDays}
                        onChange={(e) => setEditValues((v) => ({ ...v, defaultDays: parseInt(e.target.value) || 0 }))}
                        className="w-16 px-2 py-1 rounded border border-[#1a3a5c] text-sm text-center focus:outline-none"
                        aria-label="Default days"
                      />
                    ) : (
                      <span className="font-mono text-gray-800">{t.defaultDays === 0 ? "\u2014" : t.defaultDays + " days"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing === t.id ? (
                      <input
                        type="checkbox"
                        checked={editValues.allowCarryover ?? t.allowCarryover}
                        onChange={(e) => setEditValues((v) => ({ ...v, allowCarryover: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-[#1a3a5c]"
                        aria-label="Allow carryover"
                      />
                    ) : (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${t.allowCarryover ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {t.allowCarryover ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${t.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing === t.id ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditing(null)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                        <button onClick={() => saveEdit(t.id)} className="text-xs px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor: "#1a3a5c" }}>Save</button>
                      </div>
                    ) : (
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => startEdit(t)} className="text-xs text-[#1a3a5c] hover:underline font-medium">Edit</button>
                        <button
                          onClick={() => toggleActive(t.id)}
                          className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                          aria-label={t.isActive ? `Deactivate ${t.name}` : `Reactivate ${t.name}`}
                        >
                          {t.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            Deactivated leave types are hidden from employees but preserved in historical records (soft deactivation &mdash; no data deleted).
          </p>
        </div>
      </div>
    </div>
  );
}
