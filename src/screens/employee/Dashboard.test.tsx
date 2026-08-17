// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import Dashboard from "@/screens/employee/Dashboard";
import type { LeaveHistoryRow } from "@/screens/employee/my-requests-helpers";
import type { User } from "@/types";

const USER: User = {
  id: "emp-001",
  email: "ana.reyes@stratpoint.com",
  fullName: "Ana Reyes",
  role: "employee",
  department: "Engineering",
  office: "Makati HQ",
  managerId: "mgr-001",
  initials: "AR",
  avatarColor: "#3b82f6",
};

const ROWS: LeaveHistoryRow[] = [
  {
    id: "REQ-007",
    leaveType: "Annual Leave",
    startDate: "2026-08-10",
    endDate: "2026-08-12",
    workingDays: 3,
    status: "APPROVED",
    createdAt: "2026-08-01T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: null,
  },
  {
    id: "REQ-006",
    leaveType: "Sick Leave",
    startDate: "2026-07-28",
    endDate: "2026-07-29",
    workingDays: 2,
    status: "PENDING",
    createdAt: "2026-07-27T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: null,
  },
  {
    id: "REQ-005",
    leaveType: "Emergency Leave",
    startDate: "2026-07-20",
    endDate: "2026-07-21",
    workingDays: 2,
    status: "REJECTED",
    createdAt: "2026-07-19T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: null,
  },
  {
    id: "REQ-004",
    leaveType: "Annual Leave",
    startDate: "2026-07-14",
    endDate: "2026-07-18",
    workingDays: 5,
    status: "CANCELLED",
    createdAt: "2026-07-13T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: null,
  },
  {
    id: "REQ-003",
    leaveType: "Sick Leave",
    startDate: "2026-06-10",
    endDate: "2026-06-11",
    workingDays: 2,
    status: "APPROVED",
    createdAt: "2026-06-09T09:00:00.000Z",
    managerNote: "Approved.",
    supportingDocPath: null,
  },
  {
    id: "REQ-002",
    leaveType: "Annual Leave",
    startDate: "2026-05-05",
    endDate: "2026-05-07",
    workingDays: 3,
    status: "PENDING",
    createdAt: "2026-05-04T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: null,
  },
  {
    id: "REQ-001",
    leaveType: "Unpaid Leave",
    startDate: "2026-04-01",
    endDate: "2026-04-02",
    workingDays: 2,
    status: "APPROVED",
    createdAt: "2026-03-31T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: null,
  },
];

const FIRST_FIVE = ROWS.slice(0, 5);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pushMock.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Dashboard recent requests", () => {
  it("shows loading, then renders exactly the 5 most-recent rows from GET /api/leaves", async () => {
    let resolveList: ((value: unknown) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    render(<Dashboard user={USER} />);

    expect(screen.getByText("Loading your leave requests...")).toBeTruthy();

    resolveList!({ ok: true, json: async () => ROWS });
    await screen.findByText("REQ-007");

    expect(fetchMock).toHaveBeenCalledWith("/api/leaves");
    expect(screen.queryByText("Loading your leave requests...")).toBeNull();

    const table = screen.getByRole("table", { name: "Recent leave requests" });
    const dataRows = table.querySelectorAll("tbody tr");
    expect(dataRows).toHaveLength(5);

    expect(screen.getByText("REQ-007")).toBeTruthy();
    expect(screen.getByText("REQ-006")).toBeTruthy();
    expect(screen.getByText("REQ-005")).toBeTruthy();
    expect(screen.getByText("REQ-004")).toBeTruthy();
    expect(screen.getByText("REQ-003")).toBeTruthy();
    expect(screen.queryByText("REQ-002")).toBeNull();
    expect(screen.queryByText("REQ-001")).toBeNull();
  });

  it("renders StatusBadge for each status present in the 5 rows", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ROWS });
    render(<Dashboard user={USER} />);
    await screen.findByText("REQ-007");

    expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Rejected")).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("navigates to /employee/my-requests when a row is clicked", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ROWS });
    render(<Dashboard user={USER} />);
    await screen.findByText("REQ-007");

    fireEvent.click(screen.getByRole("button", { name: "View REQ-007" }));
    expect(pushMock).toHaveBeenCalledWith("/employee/my-requests");
  });

  it("navigates to /employee/my-requests when 'View all' is clicked", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ROWS });
    render(<Dashboard user={USER} />);
    await screen.findByText("REQ-007");

    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(pushMock).toHaveBeenCalledWith("/employee/my-requests");
  });

  it("shows the empty state when the API returns no requests", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(<Dashboard user={USER} />);

    expect(await screen.findByText("No leave requests yet")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an error state and recovers via Retry", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => FIRST_FIVE });
    render(<Dashboard user={USER} />);

    expect(await screen.findByText(/Could not load your leave requests/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("REQ-007");
    expect(screen.queryByText(/Could not load your leave requests/)).toBeNull();
    const table = screen.getByRole("table", { name: "Recent leave requests" });
    expect(table.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows an error state on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<Dashboard user={USER} />);

    expect(await screen.findByText(/Could not load your leave requests/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("balance widget still renders even when the leave fetch returns empty", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(<Dashboard user={USER} />);
    await screen.findByText("No leave requests yet");

    expect(screen.getByText(/Leave Balances/)).toBeTruthy();
    expect(screen.getByText("Annual Leave")).toBeTruthy();
    expect(screen.getByText("Sick Leave")).toBeTruthy();
    expect(screen.getByText("Emergency Leave")).toBeTruthy();
    expect(screen.getByText("Unpaid Leave")).toBeTruthy();
  });
});
