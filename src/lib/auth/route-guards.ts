export type DbRole = "employee" | "manager" | "hr_admin" | "sys_admin";

export function isDbRole(value: string | null | undefined): value is DbRole {
  return value === "employee" || value === "manager" || value === "hr_admin" || value === "sys_admin";
}

interface RouteRule {
  requiresRole: boolean;
  allowedRoles: DbRole[];
}

const ROUTE_RULES: Readonly<Record<string, RouteRule>> = {
  "/sysadmin": { requiresRole: true, allowedRoles: ["sys_admin"] },
  "/hradmin": { requiresRole: true, allowedRoles: ["hr_admin"] },
  "/manager": { requiresRole: true, allowedRoles: ["manager", "hr_admin", "sys_admin"] },
  "/employee": { requiresRole: false, allowedRoles: [] },
};

export const DASHBOARD_BY_ROLE: Readonly<Record<DbRole, string>> = {
  employee: "/employee/dashboard",
  manager: "/manager/pending",
  hr_admin: "/hradmin/all-requests",
  sys_admin: "/sysadmin/users",
};
export const GUARDED_PREFIXES: readonly string[] = ["/sysadmin", "/hradmin", "/manager", "/employee"];

function dashboardFor(role: DbRole): string {
  return DASHBOARD_BY_ROLE[role] ?? "/employee/dashboard";
}

export function matchesGuardedRoute(pathname: string): boolean {
  return GUARDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export type GuardAction =
  | { type: "allow" }
  | { type: "redirect-login" }
  | { type: "redirect-dashboard"; dashboard: string };

export interface GuardDecisionInput {
  pathname: string;
  hasSession: boolean;
  role: DbRole | null;
}

export function decide({ pathname, hasSession, role }: GuardDecisionInput): GuardAction {
  const rule = GUARDED_PREFIXES.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!rule) {
    return { type: "allow" };
  }
  const routeRule = ROUTE_RULES[rule];
  if (!routeRule) {
    return { type: "redirect-login" };
  }
  if (!hasSession) {
    return { type: "redirect-login" };
  }
  if (!routeRule.requiresRole) {
    return { type: "allow" };
  }
  if (role && routeRule.allowedRoles.includes(role)) {
    return { type: "allow" };
  }
  if (role && isDbRole(role)) {
    return { type: "redirect-dashboard", dashboard: dashboardFor(role) };
  }
  return { type: "redirect-login" };
}
