import { StubDispatcher } from "./stub";

/**
 * LeaveNotificationPayload — Epic-2-minimal payload shared by the manager-facing
 * notifications (FR-NOTIF-001/003). Fields map to the PRD email content: employee
 * name, canonical leave type (leave_types.name, e.g. 'Annual Leave'), inclusive
 * 'yyyy-mm-dd' dates, the Mon–Fri working-day count (TASK-019), and the request
 * link. All fields are required; no recipientEmployeeId or leaveId yet — EPIC-6
 * TASK-085 adds those as a payload-field-level change without touching the method
 * signatures.
 */
export interface LeaveNotificationPayload {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  requestLink: string;
}

export type NewRequestPayload = LeaveNotificationPayload;
export type CancelRequestPayload = LeaveNotificationPayload;

/**
 * NotificationDispatcher — the ARCH §3 Notification Dispatcher component contract.
 * Each method is fire-and-forget and returns a Promise<void> that the call site
 * (TASK-025/029) must not await before the API responds (FR-NOTIF-005
 * non-blocking semantics).
 */
export interface NotificationDispatcher {
  sendNewRequestToManager(payload: NewRequestPayload): Promise<void>;
  sendCancelToManager(payload: CancelRequestPayload): Promise<void>;
}

/**
 * Default dispatcher binding for Epic 2 — the no-op stub. EPIC-6 TASK-091 flips
 * this single binding to an env-driven real-vs-stub switch; call sites are
 * unchanged.
 */
export const notificationDispatcher: NotificationDispatcher = new StubDispatcher();
