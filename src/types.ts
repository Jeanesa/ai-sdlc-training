export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LeaveTypeName = "Annual Leave" | "Sick Leave" | "Emergency Leave" | "Unpaid Leave";
export type UserRole = "employee" | "manager" | "hradmin" | "sysadmin";
export type AuditAction = "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "OVERRIDDEN";

export type AppView =
  | "auth-login"
  | "employee-dashboard"
  | "employee-new-request"
  | "employee-confirmation"
  | "employee-my-requests"
  | "employee-request-detail"
  | "manager-pending"
  | "manager-request-detail"
  | "manager-team-calendar"
  | "hradmin-all-requests"
  | "hradmin-entitlements"
  | "hradmin-leave-types"
  | "hradmin-audit-log"
  | "sysadmin-users";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: string;
  office: string;
  managerId?: string;
  initials: string;
  avatarColor: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveTypeName;
  startDate: string;
  endDate: string;
  workingDays: number;
  reason: string;
  status: LeaveStatus;
  submittedDate: string;
  managerNote?: string;
  rejectionReason?: string;
  hasDocument?: boolean;
  department: string;
  office: string;
  managerId: string;
}

export interface LeaveBalance {
  leaveType: LeaveTypeName;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface LeaveTypeConfig {
  id: string;
  name: string;
  defaultDays: number;
  allowCarryover: boolean;
  isActive: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: UserRole;
  action: AuditAction;
  recordId: string;
  employeeName: string;
  details: string;
  oldStatus: string | undefined;
  newStatus: string | undefined;
}

export interface EntitlementRow {
  employeeId: string;
  employeeName: string;
  department: string;
  annual: number;
  sick: number;
  emergency: number;
  unpaid: number;
}
