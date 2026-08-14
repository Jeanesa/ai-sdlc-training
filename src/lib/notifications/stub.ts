import type {
  CancelRequestPayload,
  LeaveNotificationPayload,
  NewRequestPayload,
  NotificationDispatcher,
} from "./index";

const STUB_PREFIX = "[notifications:stub]";

/**
 * StubDispatcher — no-op NotificationDispatcher implementing FR-NOTIF-005
 * non-blocking semantics: each method returns a pre-resolved Promise, never throws,
 * and emits exactly ONE structured console.warn line (stable prefix + trigger +
 * serialized payload) so the intended email is visible in local logs. console.warn
 * is the lint-clean channel (eslint no-console allow-list); console.error is
 * reserved for EPIC-6 D6 delivery-failure logging.
 *
 * Deliberately dependency-free: never imports resend, APP_URL, or a Supabase
 * client, keeping the TASK-066/095 stub-seam regression guards valid.
 */
export class StubDispatcher implements NotificationDispatcher {
  sendNewRequestToManager(payload: NewRequestPayload): Promise<void> {
    return this.log("sendNewRequestToManager", payload);
  }

  sendCancelToManager(payload: CancelRequestPayload): Promise<void> {
    return this.log("sendCancelToManager", payload);
  }

  private log(trigger: string, payload: LeaveNotificationPayload): Promise<void> {
    console.warn(`${STUB_PREFIX} ${trigger}`, JSON.stringify(payload));
    return Promise.resolve();
  }
}
