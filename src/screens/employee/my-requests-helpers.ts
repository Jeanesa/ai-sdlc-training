import type { LeaveStatus } from "@/types";

export interface LeaveHistoryRow {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: LeaveStatus;
  createdAt: string;
  managerNote: string | null;
  supportingDocPath: string | null;
}

export type StatusFilter = LeaveStatus | "ALL";
export type YearFilter = string | "ALL";

export function filterRequests(
  rows: LeaveHistoryRow[],
  filters: { status: StatusFilter; year: YearFilter },
): LeaveHistoryRow[] {
  return rows.filter((row) => {
    const statusMatch = filters.status === "ALL" || row.status === filters.status;
    const yearMatch = filters.year === "ALL" || row.startDate.startsWith(filters.year);
    return statusMatch && yearMatch;
  });
}

export function deriveYearOptions(rows: LeaveHistoryRow[]): string[] {
  const years = new Set<string>();
  for (const row of rows) {
    const year = row.startDate.slice(0, 4);
    if (/^\d{4}$/.test(year)) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

const DATE_ONLY_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function formatDateOnly(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", DATE_ONLY_OPTIONS);
}

export function formatIsoDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-PH", {
    ...DATE_ONLY_OPTIONS,
    timeZone: "Asia/Manila",
  });
}
