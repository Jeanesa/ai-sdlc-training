/**
 * Shared leave validation rules (ADR-LMS-MC-E002 dual-layer validation).
 *
 * This is the SINGLE source of truth for the leave submission rule set. The
 * client form (TASK-031) and the POST /api/leaves Route Handler (TASK-025)
 * both call these same validators, so client and server can never diverge.
 * The Rule Handler is the authoritative enforcement layer: it re-validates
 * every rule before any DB write and maps the result to HTTP per the code:
 *   - BALANCE_ZERO  -> 422 (PRD FR-LVR-003 hard block)
 *   - every other code -> 400
 * Server-only additions (conflict DB re-check at write time) live in the
 * handler (TASK-025), NOT in this module.
 *
 * Return shape: every validator returns a discriminated ValidationResult.
 *   - { ok: true }                      -> valid
 *   - { ok: false; code; message }      -> invalid; message is generated HERE
 *     (single source, verbatim per PRD Section 4). The client renders message
 *     inline and uses code for field attribution; the server echoes message.
 *
 * Pure and isomorphic: no DOM, no network, no Date.now, no Supabase.
 * Importable by browser (TASK-031) and Node (TASK-025). `File` is the WHATWG
 * global present in both the browser and Node >= 20 (Next.js Route Handlers),
 * and only file.type / file.size / file.name are ever read — never contents.
 *
 * `today` is INJECTED as a parameter (validateLeaveDates) rather than read
 * from a clock, keeping the module pure and testable. Each layer computes its
 * own LOCAL calendar date ('yyyy-mm-dd' from local y/m/d) — never
 * `new Date().toISOString().split("T")[0]`, which is UTC. Dates are compared
 * DATE-ONLY and lexically (correct for well-formed 'yyyy-mm-dd'), and
 * startDate == today is VALID, so a same-day submission is never falsely
 * rejected at a UTC date boundary.
 *
 * Declared-MIME caveat: validateSupportingFile inspects the DECLARED
 * `file.type` (Content-Type), which is spoofable. There is NO content
 * sniffing. The storage bucket (TASK-018 allowed_mime_types PDF + image/*,
 * file_size_limit 5242880) and TASK-024 uploadSupportingDoc re-validate as
 * defense in depth.
 *
 * Canonical vocabulary: LEAVE_TYPE must equal leave_types.name in seed.sql
 * exactly (verified). These full names are stored in leaves.leave_type, used
 * for the leave_balances lookup/join, and submitted verbatim by the form
 * dropdown.
 *
 * Contract (the signature can't express it):
 *   - Dates are well-formed 'yyyy-mm-dd'. Malformed or empty input fails
 *     closed with MALFORMED_DATE (a defensive floor — the browser date picker
 *     and the handler's multipart parsing both guarantee well-formed dates).
 *   - validateBalance(leaveType, null) means "no balance row exists": Unpaid
 *     Leave has no row (unlimited, exempt); a missing Annual/Sick row is
 *     treated as 0 and blocks.
 */
export type ValidationCode =
  | "MALFORMED_DATE"
  | "PAST_START_DATE"
  | "END_BEFORE_START"
  | "REASON_REQUIRED"
  | "REASON_TOO_SHORT"
  | "BALANCE_ZERO"
  | "FILE_TOO_LARGE"
  | "FILE_WRONG_TYPE"
  | "FILE_ONLY_FOR_SICK_LEAVE";

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: ValidationCode; message: string };

export const ANNUAL_LEAVE = "Annual Leave";
export const SICK_LEAVE = "Sick Leave";
export const EMERGENCY_LEAVE = "Emergency Leave";
export const UNPAID_LEAVE = "Unpaid Leave";

export const LEAVE_TYPE = [
  ANNUAL_LEAVE,
  SICK_LEAVE,
  EMERGENCY_LEAVE,
  UNPAID_LEAVE,
] as const;

export const BLOCKABLE_LEAVE_TYPES = [ANNUAL_LEAVE, SICK_LEAVE] as const;

export const EXEMPT_LEAVE_TYPES = [EMERGENCY_LEAVE, UNPAID_LEAVE] as const;

export const MAX_SUPPORTING_FILE_BYTES = 5_242_880;

/**
 * validateLeaveDates(startDate, endDate, today) — validates the requested
 * range. Rules run in order, FIRST failure wins:
 *   1. format guard — malformed/empty input -> MALFORMED_DATE (fail closed)
 *   2. startDate < today (lexical) -> PAST_START_DATE (start == today is VALID)
 *   3. endDate < startDate (lexical) -> END_BEFORE_START
 *   4. otherwise -> { ok: true }
 */
export function validateLeaveDates(
  startDate: string,
  endDate: string,
  today: string,
): ValidationResult {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return {
      ok: false,
      code: "MALFORMED_DATE",
      message: "Start date and end date must be valid dates.",
    };
  }
  if (startDate < today) {
    return {
      ok: false,
      code: "PAST_START_DATE",
      message: "Start date must not be in the past.",
    };
  }
  if (endDate < startDate) {
    return {
      ok: false,
      code: "END_BEFORE_START",
      message: "End date must be on or after start date.",
    };
  }
  return { ok: true };
}

/**
 * validateReason(reason) — reason is required and at least 10 characters,
 * measured on the TRIMMED string. 0 (empty/whitespace-only) -> REASON_REQUIRED;
 * 1..9 -> REASON_TOO_SHORT; >= 10 -> { ok: true }.
 */
export function validateReason(reason: string): ValidationResult {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: "REASON_REQUIRED", message: "Reason is required." };
  }
  if (trimmed.length < 10) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      message: "Reason must be at least 10 characters.",
    };
  }
  return { ok: true };
}

/**
 * validateBalance(leaveType, remainingBalance) — hard block (PRD FR-LVR-003)
 * ONLY for Annual Leave and Sick Leave at zero balance. Emergency Leave and
 * Unpaid Leave are ALWAYS exempt regardless of the value (Unpaid Leave has no
 * balance row = unlimited). Any other leaveType (including unknown types)
 * fails closed: blocks when remainingBalance is null (missing row) or <= 0.
 * The message uses the canonical leaveType name, verbatim to PRD Section 4.
 * Membership in LEAVE_TYPE itself is validated by the handler as
 * INVALID_LEAVE_TYPE (TASK-025), not in this module.
 */
export function validateBalance(
  leaveType: string,
  remainingBalance: number | null,
): ValidationResult {
  if (EXEMPT_LEAVE_TYPES.some((type) => type === leaveType)) {
    return { ok: true };
  }
  if (remainingBalance === null || remainingBalance <= 0) {
    return {
      ok: false,
      code: "BALANCE_ZERO",
      message: `You have no remaining ${leaveType} balance for this year`,
    };
  }
  return { ok: true };
}

/**
 * validateSupportingFile(file, leaveType) — the file is OPTIONAL, so
 * file == null -> { ok: true }. Rules run in order, FIRST failure wins:
 *   1. file on a non-Sick Leave type -> FILE_ONLY_FOR_SICK_LEAVE
 *      (server-integrity: a forged file on a non-Sick request is rejected)
 *   2. declared type not application/pdf and not image/* -> FILE_WRONG_TYPE
 *      (image/* prefix agrees with the TASK-018 bucket, not the narrow list)
 *   3. size > 5 MiB (5_242_880) -> FILE_TOO_LARGE
 *   4. otherwise -> { ok: true }
 * Only file.type / file.size / file.name are read — never file contents. The
 * MIME check is on the DECLARED Content-Type (spoofable); storage (TASK-018)
 * and TASK-024 re-validate.
 */
export function validateSupportingFile(
  file: File | null,
  leaveType: string,
): ValidationResult {
  if (file === null) {
    return { ok: true };
  }
  if (leaveType !== SICK_LEAVE) {
    return {
      ok: false,
      code: "FILE_ONLY_FOR_SICK_LEAVE",
      message: "Supporting documents are only accepted for Sick Leave.",
    };
  }
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    return {
      ok: false,
      code: "FILE_WRONG_TYPE",
      message: "Only PDF and image files are accepted.",
    };
  }
  if (file.size > MAX_SUPPORTING_FILE_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: "File size must not exceed 5MB.",
    };
  }
  return { ok: true };
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
