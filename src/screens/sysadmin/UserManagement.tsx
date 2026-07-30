"use client";

import { useState } from "react";
import { USERS, DEPARTMENTS, OFFICES } from "@/data/mockData";
import type { User, UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  employee: "Employee",
  manager: "Line Manager",
  hradmin: "HR Administrator",
  sysadmin: "System Administrator",
};

const ROLE_BADGE: Record<UserRole, string> = {
  employee: "bg-blue-50 text-blue-700",
  manager: "bg-purple-50 text-purple-700",
  hradmin: "bg-rose-50 text-rose-700",
  sysadmin: "bg-gray-100 text-gray-600",
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(USERS);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<User>>({});
  const [toast, setToast] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function startEdit(u: User) {
    setEditing(u.id);
    setEditValues({ fullName: u.fullName, role: u.role, department: u.department, office: u.office });
  }

  function saveEdit(id: string) {
    setUsers((us) => us.map((u) => u.id === id ? { ...u, ...editValues } : u));
    setEditing(null);
    showToast("User profile updated.");
  }

  const filtered = users.filter((u) =>
    !searchTerm || u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          User Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage user accounts, roles, and reporting structure. System Administrators cannot access leave request content.
        </p>
      </div>

      {toast && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800" role="status">
          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          {toast}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div key={role} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "var(--font-mono)" }}>{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{ROLE_LABELS[role]}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="User accounts">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["User", "Email", "Role", "Department", "Office", "Reports To", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => {
                const isEditing = editing === u.id;
                const manager = users.find((m) => m.id === u.managerId);
                return (
                  <tr key={u.id} className={`transition-colors ${isEditing ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: u.avatarColor }}
                          aria-hidden="true"
                        >
                          {u.initials}
                        </div>
                        <div>
                          {isEditing ? (
                            <input
                              value={editValues.fullName ?? u.fullName}
                              onChange={(e) => setEditValues((v) => ({ ...v, fullName: e.target.value }))}
                              className="px-2 py-1 rounded border border-[#1a3a5c] text-sm focus:outline-none"
                              aria-label="Full name"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{u.fullName}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editValues.role ?? u.role}
                          onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value as UserRole }))}
                          className="px-2 py-1 rounded border border-[#1a3a5c] text-xs bg-white focus:outline-none"
                          aria-label="Role"
                        >
                          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGE[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editValues.department ?? u.department}
                          onChange={(e) => setEditValues((v) => ({ ...v, department: e.target.value }))}
                          className="px-2 py-1 rounded border border-[#1a3a5c] text-xs bg-white focus:outline-none"
                          aria-label="Department"
                        >
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <span className="text-gray-700">{u.department}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editValues.office ?? u.office}
                          onChange={(e) => setEditValues((v) => ({ ...v, office: e.target.value }))}
                          className="px-2 py-1 rounded border border-[#1a3a5c] text-xs bg-white focus:outline-none"
                          aria-label="Office"
                        >
                          {OFFICES.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <span className="text-gray-600">{u.office}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {manager ? manager.fullName : <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditing(null)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                          <button onClick={() => saveEdit(u.id)} className="text-xs px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor: "#1a3a5c" }}>Save</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(u)} className="text-xs text-[#1a3a5c] hover:underline font-medium">Edit</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
          {filtered.length} of {users.length} users &middot; System Administrators have access to this view only and cannot read leave request data.
        </div>
      </div>
    </div>
  );
}
