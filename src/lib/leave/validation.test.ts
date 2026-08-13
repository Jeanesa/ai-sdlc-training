import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BLOCKABLE_LEAVE_TYPES,
  EXEMPT_LEAVE_TYPES,
  LEAVE_TYPE,
  validateBalance,
  validateLeaveDates,
  validateReason,
  validateSupportingFile,
} from "./validation";

const TODAY = "2026-05-19";

function localTodayIn(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  let year = "";
  let month = "";
  let day = "";
  for (const part of parts) {
    if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
  }
  return `${year}-${month}-${day}`;
}

function dayBefore(iso: string): string {
  const parts = iso.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10);
}

describe("LEAVE_TYPE canonical constants", () => {
  it("LEAVE_TYPE deep-equals the canonical names in order (mirrors seed.sql leave_types.name)", () => {
    expect(LEAVE_TYPE).toEqual([
      "Annual Leave",
      "Sick Leave",
      "Emergency Leave",
      "Unpaid Leave",
    ]);
  });

  it("BLOCKABLE_LEAVE_TYPES is Annual Leave and Sick Leave", () => {
    expect(BLOCKABLE_LEAVE_TYPES).toEqual(["Annual Leave", "Sick Leave"]);
  });

  it("EXEMPT_LEAVE_TYPES is Emergency Leave and Unpaid Leave", () => {
    expect(EXEMPT_LEAVE_TYPES).toEqual(["Emergency Leave", "Unpaid Leave"]);
  });
});

describe("validateLeaveDates", () => {
  it("returns PAST_START_DATE when start date is before today", () => {
    expect(validateLeaveDates("2026-05-18", "2026-05-20", TODAY)).toEqual({
      ok: false,
      code: "PAST_START_DATE",
      message: "Start date must not be in the past.",
    });
  });

  it("returns END_BEFORE_START when end date is before start date", () => {
    expect(validateLeaveDates("2026-05-20", "2026-05-19", TODAY)).toEqual({
      ok: false,
      code: "END_BEFORE_START",
      message: "End date must be on or after start date.",
    });
  });

  it("returns the first failing rule when both past start and end < start fail", () => {
    expect(validateLeaveDates("2026-05-18", "2026-05-17", TODAY)).toEqual({
      ok: false,
      code: "PAST_START_DATE",
      message: "Start date must not be in the past.",
    });
  });

  it("returns ok for a valid future range", () => {
    expect(validateLeaveDates("2026-06-01", "2026-06-05", TODAY)).toEqual({
      ok: true,
    });
  });

  it("allows start date equal to today (lenient boundary)", () => {
    expect(validateLeaveDates("2026-05-19", "2026-06-01", TODAY)).toEqual({
      ok: true,
    });
  });

  it("allows start date equal to end date equal to today", () => {
    expect(validateLeaveDates("2026-05-19", "2026-05-19", TODAY)).toEqual({
      ok: true,
    });
  });

  it("returns MALFORMED_DATE for non-date input (fail closed)", () => {
    expect(validateLeaveDates("not-a-date", "2026-06-01", TODAY)).toEqual({
      ok: false,
      code: "MALFORMED_DATE",
      message: "Start date and end date must be valid dates.",
    });
  });

  it("returns MALFORMED_DATE for calendar-invalid dates", () => {
    expect(validateLeaveDates("2026-13-05", "2026-06-01", TODAY)).toEqual({
      ok: false,
      code: "MALFORMED_DATE",
      message: "Start date and end date must be valid dates.",
    });
    expect(validateLeaveDates("2026-05-32", "2026-06-01", TODAY)).toEqual({
      ok: false,
      code: "MALFORMED_DATE",
      message: "Start date and end date must be valid dates.",
    });
  });

  it("returns MALFORMED_DATE for empty input", () => {
    expect(validateLeaveDates("", "2026-06-01", TODAY)).toEqual({
      ok: false,
      code: "MALFORMED_DATE",
      message: "Start date and end date must be valid dates.",
    });
    expect(validateLeaveDates("2026-06-01", "", TODAY)).toEqual({
      ok: false,
      code: "MALFORMED_DATE",
      message: "Start date and end date must be valid dates.",
    });
  });

  it("returns MALFORMED_DATE when the end date is malformed", () => {
    expect(validateLeaveDates("2026-05-19", "2026-13-01", TODAY)).toEqual({
      ok: false,
      code: "MALFORMED_DATE",
      message: "Start date and end date must be valid dates.",
    });
  });

  it("passing result is exactly { ok: true } with no extra fields", () => {
    const result = validateLeaveDates("2026-06-01", "2026-06-05", TODAY);
    expect(result).toEqual({ ok: true });
    expect(Object.keys(result)).toEqual(["ok"]);
  });
});

describe("validateLeaveDates timezone stability", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
    vi.resetModules();
  });

  it("results depend only on the injected today, not the ambient clock", async () => {
    process.env.TZ = "Asia/Manila";
    vi.resetModules();
    const { validateLeaveDates: validatePHT } = await import("./validation");
    const todayPHT = localTodayIn("Asia/Manila");
    expect(validatePHT(todayPHT, todayPHT, todayPHT)).toEqual({ ok: true });
    expect(validatePHT(dayBefore(todayPHT), todayPHT, todayPHT)).toEqual({
      ok: false,
      code: "PAST_START_DATE",
      message: "Start date must not be in the past.",
    });

    process.env.TZ = "America/New_York";
    vi.resetModules();
    const { validateLeaveDates: validateNY } = await import("./validation");
    const todayNY = localTodayIn("America/New_York");
    expect(validateNY(todayNY, todayNY, todayNY)).toEqual({ ok: true });
    expect(validateNY(dayBefore(todayNY), todayNY, todayNY)).toEqual({
      ok: false,
      code: "PAST_START_DATE",
      message: "Start date must not be in the past.",
    });
  });
});

describe("validateReason", () => {
  it("returns REASON_REQUIRED for an empty reason", () => {
    expect(validateReason("")).toEqual({
      ok: false,
      code: "REASON_REQUIRED",
      message: "Reason is required.",
    });
  });

  it("returns REASON_REQUIRED for whitespace-only input (trimmed)", () => {
    expect(validateReason("   ")).toEqual({
      ok: false,
      code: "REASON_REQUIRED",
      message: "Reason is required.",
    });
  });

  it("returns REASON_TOO_SHORT for a 9-character reason", () => {
    expect(validateReason("ninechars")).toEqual({
      ok: false,
      code: "REASON_TOO_SHORT",
      message: "Reason must be at least 10 characters.",
    });
  });

  it("returns REASON_TOO_SHORT when the trimmed length is 9", () => {
    expect(validateReason("  ninechars  ")).toEqual({
      ok: false,
      code: "REASON_TOO_SHORT",
      message: "Reason must be at least 10 characters.",
    });
  });

  it("passes an exactly-10-character reason (boundary)", () => {
    expect(validateReason("tenchars!!")).toEqual({ ok: true });
  });

  it("passes an 11+ character reason", () => {
    expect(validateReason("eleven characters")).toEqual({ ok: true });
  });
});

describe("validateBalance", () => {
  it("blocks Annual Leave at 0 with the PRD verbatim message (no trailing period)", () => {
    expect(validateBalance("Annual Leave", 0)).toEqual({
      ok: false,
      code: "BALANCE_ZERO",
      message: "You have no remaining Annual Leave balance for this year",
    });
  });

  it("blocks Sick Leave at 0 with the canonical name interpolated", () => {
    const result = validateBalance("Sick Leave", 0);
    expect(result).toEqual({
      ok: false,
      code: "BALANCE_ZERO",
      message: "You have no remaining Sick Leave balance for this year",
    });
  });

  it("passes Annual Leave and Sick Leave with positive balance", () => {
    expect(validateBalance("Annual Leave", 5)).toEqual({ ok: true });
    expect(validateBalance("Sick Leave", 15)).toEqual({ ok: true });
  });

  it("blocks Annual Leave when the balance row is missing (null treated as 0)", () => {
    expect(validateBalance("Annual Leave", null)).toEqual({
      ok: false,
      code: "BALANCE_ZERO",
      message: "You have no remaining Annual Leave balance for this year",
    });
  });

  it("blocks Sick Leave when the balance row is missing (null treated as 0)", () => {
    expect(validateBalance("Sick Leave", null)).toEqual({
      ok: false,
      code: "BALANCE_ZERO",
      message: "You have no remaining Sick Leave balance for this year",
    });
  });

  it("blocks a negative balance", () => {
    expect(validateBalance("Annual Leave", -1)).toEqual({
      ok: false,
      code: "BALANCE_ZERO",
      message: "You have no remaining Annual Leave balance for this year",
    });
  });

  it("exempts Emergency Leave regardless of balance", () => {
    expect(validateBalance("Emergency Leave", 0)).toEqual({ ok: true });
    expect(validateBalance("Emergency Leave", null)).toEqual({ ok: true });
    expect(validateBalance("Emergency Leave", 3)).toEqual({ ok: true });
  });

  it("exempts Unpaid Leave regardless of balance (no row = unlimited)", () => {
    expect(validateBalance("Unpaid Leave", null)).toEqual({ ok: true });
    expect(validateBalance("Unpaid Leave", 0)).toEqual({ ok: true });
    expect(validateBalance("Unpaid Leave", -2)).toEqual({ ok: true });
  });

  it("fails closed on an unknown leave type with null balance", () => {
    expect(validateBalance("Maternity Leave", null)).toEqual({
      ok: false,
      code: "BALANCE_ZERO",
      message: "You have no remaining Maternity Leave balance for this year",
    });
  });

  it("interpolates the passed leaveType verbatim into the message", () => {
    const result = validateBalance("Sick Leave", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(
        `You have no remaining ${"Sick Leave"} balance for this year`,
      );
    }
  });
});

describe("validateSupportingFile", () => {
  it("passes a valid PDF within the size limit", () => {
    const file = new File([new Uint8Array(1024)], "doc.pdf", {
      type: "application/pdf",
    });
    expect(validateSupportingFile(file, "Sick Leave")).toEqual({ ok: true });
  });

  it("passes a valid PNG image", () => {
    const file = new File([new Uint8Array(1024)], "scan.png", {
      type: "image/png",
    });
    expect(validateSupportingFile(file, "Sick Leave")).toEqual({ ok: true });
  });

  it("passes any image/* type (prefix match, not the narrow mock list)", () => {
    const file = new File([new Uint8Array(1024)], "scan.heic", {
      type: "image/heic",
    });
    expect(validateSupportingFile(file, "Sick Leave")).toEqual({ ok: true });
  });

  it("passes a file exactly at the 5MB limit", () => {
    const file = new File([new Uint8Array(5_242_880)], "doc.pdf", {
      type: "application/pdf",
    });
    expect(validateSupportingFile(file, "Sick Leave")).toEqual({ ok: true });
  });

  it("returns FILE_TOO_LARGE above the 5MB limit", () => {
    const file = new File([new Uint8Array(5_242_881)], "doc.pdf", {
      type: "application/pdf",
    });
    expect(validateSupportingFile(file, "Sick Leave")).toEqual({
      ok: false,
      code: "FILE_TOO_LARGE",
      message: "File size must not exceed 5MB.",
    });
  });

  it("returns FILE_WRONG_TYPE for non-PDF/image declared types", () => {
    const text = new File([new Uint8Array(1024)], "notes.txt", {
      type: "text/plain",
    });
    expect(validateSupportingFile(text, "Sick Leave")).toEqual({
      ok: false,
      code: "FILE_WRONG_TYPE",
      message: "Only PDF and image files are accepted.",
    });
    const octet = new File([new Uint8Array(1024)], "bin.dat", {
      type: "application/octet-stream",
    });
    expect(validateSupportingFile(octet, "Sick Leave")).toEqual({
      ok: false,
      code: "FILE_WRONG_TYPE",
      message: "Only PDF and image files are accepted.",
    });
  });

  it("returns FILE_WRONG_TYPE before FILE_TOO_LARGE when both fail", () => {
    const file = new File([new Uint8Array(5_242_881)], "notes.txt", {
      type: "text/plain",
    });
    expect(validateSupportingFile(file, "Sick Leave")).toEqual({
      ok: false,
      code: "FILE_WRONG_TYPE",
      message: "Only PDF and image files are accepted.",
    });
  });

  it("passes when no file is provided (file is optional)", () => {
    expect(validateSupportingFile(null, "Sick Leave")).toEqual({ ok: true });
  });

  it("returns FILE_ONLY_FOR_SICK_LEAVE for a file on a non-Sick type", () => {
    const pdf = new File([new Uint8Array(1024)], "doc.pdf", {
      type: "application/pdf",
    });
    expect(validateSupportingFile(pdf, "Emergency Leave")).toEqual({
      ok: false,
      code: "FILE_ONLY_FOR_SICK_LEAVE",
      message: "Supporting documents are only accepted for Sick Leave.",
    });
    const png = new File([new Uint8Array(1024)], "scan.png", {
      type: "image/png",
    });
    expect(validateSupportingFile(png, "Annual Leave")).toEqual({
      ok: false,
      code: "FILE_ONLY_FOR_SICK_LEAVE",
      message: "Supporting documents are only accepted for Sick Leave.",
    });
  });

  it("returns FILE_ONLY_FOR_SICK_LEAVE before FILE_TOO_LARGE on a non-Sick type", () => {
    const file = new File([new Uint8Array(6 * 1024 * 1024)], "doc.pdf", {
      type: "application/pdf",
    });
    expect(validateSupportingFile(file, "Emergency Leave")).toEqual({
      ok: false,
      code: "FILE_ONLY_FOR_SICK_LEAVE",
      message: "Supporting documents are only accepted for Sick Leave.",
    });
  });
});
