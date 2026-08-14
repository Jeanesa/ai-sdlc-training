import { describe, expect, it } from "vitest";
import {
  deriveYearOptions,
  filterRequests,
  formatDateOnly,
  formatIsoDate,
  type LeaveHistoryRow,
} from "./my-requests-helpers";

function makeRow(partial: Partial<LeaveHistoryRow>): LeaveHistoryRow {
  return {
    id: "default-id",
    leaveType: "Annual Leave",
    startDate: "2026-06-01",
    endDate: "2026-06-01",
    workingDays: 1,
    status: "PENDING",
    createdAt: "2026-01-15T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: null,
    ...partial,
  };
}

describe("filterRequests", () => {
  const rows = [
    makeRow({ id: "a", startDate: "2026-07-14", status: "APPROVED" }),
    makeRow({ id: "b", startDate: "2026-06-10", status: "PENDING" }),
    makeRow({ id: "c", startDate: "2025-08-01", status: "REJECTED" }),
    makeRow({ id: "d", startDate: "2025-01-02", status: "CANCELLED" }),
  ];

  it("returns all rows when both filters are All", () => {
    const result = filterRequests(rows, { status: "ALL", year: "ALL" });
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by a single status", () => {
    expect(filterRequests(rows, { status: "APPROVED", year: "ALL" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterRequests(rows, { status: "CANCELLED", year: "ALL" }).map((r) => r.id)).toEqual(["d"]);
  });

  it("filters by a single year anchored on startDate", () => {
    expect(filterRequests(rows, { status: "ALL", year: "2026" }).map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterRequests(rows, { status: "ALL", year: "2025" }).map((r) => r.id)).toEqual(["c", "d"]);
  });

  it("combines status and year with AND semantics", () => {
    expect(filterRequests(rows, { status: "PENDING", year: "2025" })).toEqual([]);
    expect(filterRequests(rows, { status: "CANCELLED", year: "2025" }).map((r) => r.id)).toEqual(["d"]);
    expect(filterRequests(rows, { status: "PENDING", year: "2026" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("does not mutate the input array", () => {
    const snapshot = rows.map((r) => ({ ...r }));
    filterRequests(rows, { status: "ALL", year: "ALL" });
    expect(rows).toEqual(snapshot);
  });

  it("returns an empty array for an empty input", () => {
    expect(filterRequests([], { status: "ALL", year: "ALL" })).toEqual([]);
  });
});

describe("deriveYearOptions", () => {
  it("derives unique startDate years sorted descending", () => {
    const rows = [
      makeRow({ id: "a", startDate: "2026-07-14" }),
      makeRow({ id: "b", startDate: "2026-01-01" }),
      makeRow({ id: "c", startDate: "2025-06-01" }),
    ];
    expect(deriveYearOptions(rows)).toEqual(["2026", "2025"]);
  });

  it("anchors on startDate, not createdAt", () => {
    const rows = [makeRow({ id: "a", startDate: "2026-01-05", createdAt: "2025-12-30T00:00:00.000Z" })];
    expect(deriveYearOptions(rows)).toEqual(["2026"]);
  });

  it("returns an empty list for no rows", () => {
    expect(deriveYearOptions([])).toEqual([]);
  });
});

describe("formatDateOnly", () => {
  it("formats a YYYY-MM-DD string in en-PH short format", () => {
    expect(formatDateOnly("2026-06-03")).toBe("Jun 3, 2026");
  });
});

describe("formatIsoDate", () => {
  it("formats an ISO timestamp as a Manila calendar date", () => {
    expect(formatIsoDate("2030-06-03T09:00:00.000Z")).toBe("Jun 3, 2030");
  });

  it("does not produce an Invalid Date for a valid ISO timestamp", () => {
    const result = formatIsoDate("2030-06-03T09:00:00.000Z");
    expect(result).not.toMatch(/Invalid Date/);
  });
});
