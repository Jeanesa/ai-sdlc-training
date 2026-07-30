"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppView, UserRole, User } from "@/types";

interface NavItem {
  view: AppView;
  label: string;
  icon: React.ReactNode;
  badge: number | undefined;
}

interface Props {
  user: User;
  currentView: AppView;
  pendingCount?: number;
  children: React.ReactNode;
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
const VIEW_ROUTES: Record<string, string> = {
  "auth-login": "/auth/login",
  "employee-dashboard": "/employee/dashboard",
  "employee-new-request": "/employee/new-request",
  "employee-confirmation": "/employee/confirmation",
  "employee-my-requests": "/employee/my-requests",
  "employee-request-detail": "/employee/my-requests",
  "manager-pending": "/manager/pending",
  "manager-request-detail": "/manager/pending",
  "manager-team-calendar": "/manager/team-calendar",
  "hradmin-all-requests": "/hradmin/all-requests",
  "hradmin-entitlements": "/hradmin/entitlements",
  "hradmin-leave-types": "/hradmin/leave-types",
  "hradmin-audit-log": "/hradmin/audit-log",
  "sysadmin-users": "/sysadmin/users",
};

function getNavItems(role: UserRole, pendingCount = 0): NavItem[] {
  const badge = pendingCount || undefined;
  switch (role) {
    case "employee":
      return [
        { view: "employee-dashboard", label: "Dashboard", icon: <HomeIcon />, badge: undefined },
        { view: "employee-new-request", label: "New Request", icon: <PlusIcon />, badge: undefined },
        { view: "employee-my-requests", label: "My Requests", icon: <ListIcon />, badge: undefined },
      ];
    case "manager":
      return [
        { view: "manager-pending", label: "Pending Approvals", icon: <CheckIcon />, badge },
        { view: "manager-team-calendar", label: "Team Calendar", icon: <CalendarIcon />, badge: undefined },
      ];
    case "hradmin":
      return [
        { view: "hradmin-all-requests", label: "All Requests", icon: <FilterIcon />, badge: undefined },
        { view: "hradmin-entitlements", label: "Entitlements", icon: <GridIcon />, badge: undefined },
        { view: "hradmin-leave-types", label: "Leave Types", icon: <TagIcon />, badge: undefined },
        { view: "hradmin-audit-log", label: "Audit Log", icon: <ShieldIcon />, badge: undefined },
      ];
    case "sysadmin":
      return [
        { view: "sysadmin-users", label: "User Management", icon: <UsersIcon />, badge: undefined },
      ];
    default:
      return [];
  }
}

const roleLabels: Record<UserRole, string> = {
  employee: "Employee",
  manager: "Line Manager",
  hradmin: "HR Administrator",
  sysadmin: "System Administrator",
};

export default function Layout({ user, currentView, pendingCount = 0, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const navItems = getNavItems(user.role, pendingCount);

  function handleNavigate(view: AppView) {
    const route = VIEW_ROUTES[view];
    if (route) router.push(route);
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <rect x="3" y="4" width="18" height="18" rx="2" opacity="0.3" />
              <rect x="7" y="8" width="4" height="4" rx="0.5" />
              <rect x="13" y="8" width="4" height="4" rx="0.5" />
              <rect x="7" y="14" width="4" height="4" rx="0.5" />
              <rect x="13" y="14" width="4" height="4" rx="0.5" />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight" style={{ fontFamily: "var(--font-display)" }}>Meridian LMS</div>
            <div className="text-white/50 text-xs">{roleLabels[user.role]}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => { handleNavigate(item.view); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={isActive ? "text-white" : "text-white/50"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-400 text-amber-900 text-xs font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: user.avatarColor }}
            aria-hidden="true"
          >
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{user.fullName}</div>
            <div className="text-white/40 text-xs truncate">{user.email}</div>
          </div>
          <button
            onClick={() => router.push("/auth/login")}
            className="text-white/40 hover:text-white transition-colors p-1 rounded"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f4f8]">
      <aside
        className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ backgroundColor: "#0f2540" }}
        aria-label="Sidebar navigation"
      >
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative flex flex-col w-64 flex-shrink-0 z-50"
            style={{ backgroundColor: "#0f2540" }}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
          <span className="font-semibold text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
            Meridian LMS
          </span>
          {user.role === "manager" && pendingCount > 0 && (
            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-amber-400 text-amber-900 text-xs font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
