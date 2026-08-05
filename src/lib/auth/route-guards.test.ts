import { describe, expect, it } from "vitest";

import {
  DASHBOARD_BY_ROLE,
  GUARDED_PREFIXES,
  decide,
  isDbRole,
  matchesGuardedRoute,
  type DbRole,
} from "@/lib/auth/route-guards";

describe("isDbRole", () => {
  it("accepts every database role value", () => {
    expect(["employee", "manager", "hr_admin", "sys_admin"].every((role) => isDbRole(role))).toBe(true);
  });

  it("rejects unknown and non-string values", () => {
    expect(isDbRole("hradmin")).toBe(false);
    expect(isDbRole("sysadmin")).toBe(false);
    expect(isDbRole("admin")).toBe(false);
    expect(isDbRole("")).toBe(false);
    expect(isDbRole(null)).toBe(false);
    expect(isDbRole(undefined)).toBe(false);
  });
});

describe("matchesGuardedRoute", () => {
  const cases: Array<[string, boolean]> = [
    ["/sysadmin", true],
    ["/sysadmin/users", true],
    ["/hradmin", true],
    ["/hradmin/all-requests", true],
    ["/manager", true],
    ["/manager/pending", true],
    ["/employee", true],
    ["/employee/dashboard", true],
    ["/auth/login", false],
    ["/", false],
    ["/sysadminx", false],
    ["/sysadmin/users/extra", true],
  ];

  it.each(cases)("matches %s -> %s", (pathname, expected) => {
    expect(matchesGuardedRoute(pathname)).toBe(expected);
  });
});

describe("decide", () => {
  const cases: Array<[string, boolean, DbRole | null, string]> = [
    ["/", false, null, "allow"],
    ["/unknown", false, null, "allow"],
    ["/employee/dashboard", false, null, "redirect-login"],
    ["/employee/dashboard", true, null, "allow"],
    ["/employee/dashboard", true, "employee", "allow"],
    ["/employee/dashboard", true, "manager", "allow"],
    ["/sysadmin/users", false, null, "redirect-login"],
    ["/sysadmin/users", true, null, "redirect-login"],
    ["/sysadmin/users", true, "sys_admin", "allow"],
    ["/sysadmin/users", true, "hr_admin", "redirect-dashboard"],
    ["/sysadmin/users", true, "manager", "redirect-dashboard"],
    ["/sysadmin/users", true, "employee", "redirect-dashboard"],
    ["/hradmin/all-requests", true, "hr_admin", "allow"],
    ["/hradmin/all-requests", true, "sys_admin", "redirect-dashboard"],
    ["/manager/pending", true, "employee", "redirect-dashboard"],
    ["/manager/pending", true, "manager", "allow"],
    ["/manager/pending", true, "hr_admin", "allow"],
    ["/manager/pending", true, "sys_admin", "allow"],
    ["/manager/pending", true, null, "redirect-login"],
  ];

  it.each(cases)("path=%s hasSession=%s role=%s -> %s", (pathname, hasSession, role, expectedType) => {
    expect(decide({ pathname, hasSession, role }).type).toBe(expectedType);
  });
});

describe("decide redirect targets", () => {
  it("redirects a wrong-role manager to /manager/pending", () => {
    expect(decide({ pathname: "/hradmin/all-requests", hasSession: true, role: "manager" })).toEqual({
      type: "redirect-dashboard",
      dashboard: "/manager/pending",
    });
  });

  it("redirects an unauthenticated user to the login page", () => {
    expect(decide({ pathname: "/sysadmin/users", hasSession: false, role: null })).toEqual({
      type: "redirect-login",
    });
  });
});

describe("dashboard map", () => {
  it("maps every role to its own dashboard", () => {
    expect(DASHBOARD_BY_ROLE.employee).toBe("/employee/dashboard");
    expect(DASHBOARD_BY_ROLE.manager).toBe("/manager/pending");
    expect(DASHBOARD_BY_ROLE.hr_admin).toBe("/hradmin/all-requests");
    expect(DASHBOARD_BY_ROLE.sys_admin).toBe("/sysadmin/users");
  });
});

describe("GUARDED_PREFIXES", () => {
  it("covers sysadmin, hradmin, manager and employee", () => {
    expect(GUARDED_PREFIXES).toEqual(["/sysadmin", "/hradmin", "/manager", "/employee"]);
  });
});
