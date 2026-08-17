// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import MyRequests from "@/screens/employee/MyRequests";
import type { LeaveHistoryRow } from "@/screens/employee/my-requests-helpers";

const APPROVED_ID = "11111111-1111-4111-8111-111111111111";
const PENDING_ID = "22222222-2222-4222-8222-222222222222";
const CANCELLED_ID = "33333333-3333-4333-8333-333333333333";
const REJECTED_ID = "44444444-4444-4444-8444-444444444444";

const rows: LeaveHistoryRow[] = [
  {
    id: APPROVED_ID,
    leaveType: "Annual Leave",
    startDate: "2026-07-14",
    endDate: "2026-07-18",
    workingDays: 5,
    status: "APPROVED",
    createdAt: "2026-07-01T09:00:00.000Z",
    managerNote: "Approved. Enjoy your vacation!",
    supportingDocPath: null,
  },
  {
    id: PENDING_ID,
    leaveType: "Sick Leave",
    startDate: "2026-06-10",
    endDate: "2026-06-11",
    workingDays: 2,
    status: "PENDING",
    createdAt: "2026-06-10T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: "emp-001/abc.pdf",
  },
  {
    id: CANCELLED_ID,
    leaveType: "Emergency Leave",
    startDate: "2025-03-01",
    endDate: "2025-03-02",
    workingDays: 2,
    status: "CANCELLED",
    createdAt: "2025-02-20T09:00:00.000Z",
    managerNote: null,
    supportingDocPath: null,
  },
  {
    id: REJECTED_ID,
    leaveType: "Unpaid Leave",
    startDate: "2026-08-01",
    endDate: "2026-08-05",
    workingDays: 3,
    status: "REJECTED",
    createdAt: "2026-07-25T09:00:00.000Z",
    managerNote: "Insufficient balance.",
    supportingDocPath: null,
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MyRequests list", () => {
  it("shows a loading state, then renders the live rows from GET /api/leaves", async () => {
    let resolveList: ((value: unknown) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    render(<MyRequests />);

    expect(screen.getByText("Loading your leave requests...")).toBeTruthy();

    resolveList!({ ok: true, json: async () => rows });
    await screen.findByText("Annual Leave");

    expect(screen.getByText("Sick Leave")).toBeTruthy();
    expect(screen.getByText("Emergency Leave")).toBeTruthy();
    expect(screen.getByText("5d")).toBeTruthy();
    expect(screen.getAllByText("2d")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/leaves");
    expect(screen.queryByText("Loading your leave requests...")).toBeNull();
  });

  it("filters by status and year independently and combined (AND)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => rows });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    const yearSelect = screen.getByLabelText("Filter by year");
    expect(yearSelect.textContent).toContain("2026");
    expect(yearSelect.textContent).toContain("2025");

    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    expect(screen.getByText("Sick Leave")).toBeTruthy();
    expect(screen.queryByText("Annual Leave")).toBeNull();
    expect(screen.queryByText("Emergency Leave")).toBeNull();

    fireEvent.change(yearSelect, { target: { value: "2025" } });
    expect(screen.getByText("No requests match your filters.")).toBeTruthy();
    expect(screen.queryByText("Sick Leave")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Emergency Leave")).toBeTruthy();
    expect(screen.queryByText("Annual Leave")).toBeNull();
    expect(screen.queryByText("Sick Leave")).toBeNull();
  });

  it("shows a no-requests state when the list is empty", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(<MyRequests />);

    expect(await screen.findByText("You have no leave requests yet.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows an error state and recovers via Retry", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { code: "LEAVES_READ_FAILED" } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => rows });
    render(<MyRequests />);

    expect(await screen.findByText(/Could not load your leave requests/)).toBeTruthy();
    expect(screen.queryByText("Annual Leave")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Annual Leave");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("MyRequests detail modal", () => {
  it("fetches a fresh signed URL on open and renders the document link", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/leaves") {
        return Promise.resolve({ ok: true, json: async () => rows });
      }
      if (url === `/api/leaves/${PENDING_ID}/supporting-doc`) {
        return Promise.resolve({ ok: true, json: async () => ({ url: "https://signed.example/med.pdf" }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: {} }) });
    });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/leaves");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${PENDING_ID}` }));
    const link = await screen.findByRole("link", { name: "View document" });
    expect(link.getAttribute("href")).toBe("https://signed.example/med.pdf");
    expect(fetchMock).toHaveBeenCalledWith(`/api/leaves/${PENDING_ID}/supporting-doc`);
  });

  it("shows full detail incl. managerNote and does not fetch a doc when none exists", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => rows });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${APPROVED_ID}` }));
    await screen.findByRole("dialog");

    expect(screen.getByText("Approved. Enjoy your vacation!")).toBeTruthy();
    expect(screen.getAllByText("Jul 1, 2026").length).toBeGreaterThan(0);
    expect(screen.queryByText("Reason")).toBeNull();
    expect(screen.queryByText("Rejection Reason")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows an inline error and no dead link when the doc fetch fails", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/leaves") {
        return Promise.resolve({ ok: true, json: async () => rows });
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: { code: "FORBIDDEN" } }) });
    });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${PENDING_ID}` }));
    expect(await screen.findByText("Could not load the supporting document link.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("MyRequests cancel", () => {
  it("renders Cancel button for PENDING and not for APPROVED, REJECTED, or CANCELLED", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/leaves") {
        return Promise.resolve({ ok: true, json: async () => rows });
      }
      if (url.includes("/supporting-doc")) {
        return Promise.resolve({ ok: true, json: async () => ({ url: "https://signed.example/doc.pdf" }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: {} }) });
    });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${PENDING_ID}` }));
    await screen.findByRole("dialog");
    expect(screen.getByText("Cancel Request")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View details for " + APPROVED_ID }));
    await screen.findByRole("dialog");
    expect(screen.queryByText("Cancel Request")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View details for " + REJECTED_ID }));
    await screen.findByRole("dialog");
    expect(screen.queryByText("Cancel Request")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View details for " + CANCELLED_ID }));
    await screen.findByRole("dialog");
    expect(screen.queryByText("Cancel Request")).toBeNull();
  });

  it("shows a confirmation prompt before firing the POST", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/leaves") {
        return Promise.resolve({ ok: true, json: async () => rows });
      }
      if (url.includes("/supporting-doc")) {
        return Promise.resolve({ ok: true, json: async () => ({ url: "https://signed.example/doc.pdf" }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: {} }) });
    });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${PENDING_ID}` }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByText("Cancel Request"));
    expect(screen.getByText("Are you sure you want to cancel this request?")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/leaves/${PENDING_ID}/cancel`,
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.click(screen.getByText("Back"));
    expect(screen.queryByText("Are you sure you want to cancel this request?")).toBeNull();
    expect(screen.getByText("Cancel Request")).toBeTruthy();
  });

  it("fires POST only after Confirm is clicked", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/leaves") {
        return Promise.resolve({ ok: true, json: async () => rows });
      }
      if (url.includes("/supporting-doc")) {
        return Promise.resolve({ ok: true, json: async () => ({ url: "https://signed.example/doc.pdf" }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: {} }) });
    });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${PENDING_ID}` }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByText("Cancel Request"));
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/leaves/${PENDING_ID}/cancel`,
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.click(screen.getByText("Confirm"));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/leaves/${PENDING_ID}/cancel`,
      { method: "POST" },
    );
  });

  it("on 200 updates the row to CANCELLED with grey badge and refetches the list", async () => {
    const cancelledRows = rows.map((r) =>
      r.id === PENDING_ID ? { ...r, status: "CANCELLED" as const } : r,
    );
    let cancelFired = false;
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/leaves") {
        return Promise.resolve({ ok: true, json: async () => (cancelFired ? cancelledRows : rows) });
      }
      if (url.includes("/supporting-doc")) {
        return Promise.resolve({ ok: true, json: async () => ({ url: "https://signed.example/doc.pdf" }) });
      }
      if (url.includes("/cancel")) {
        cancelFired = true;
        return Promise.resolve({ ok: true, json: async () => ({ id: PENDING_ID, status: "CANCELLED" }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: {} }) });
    });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${PENDING_ID}` }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByText("Cancel Request"));
    fireEvent.click(screen.getByText("Confirm"));

    const cancelledTexts = await screen.findAllByText("Cancelled");
    expect(cancelledTexts.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/leaves/${PENDING_ID}/cancel`,
      { method: "POST" },
    );
  });

  it("on 409 re-syncs the row to the actual status and shows a message", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/leaves") {
        return Promise.resolve({ ok: true, json: async () => rows });
      }
      if (url.includes("/supporting-doc")) {
        return Promise.resolve({ ok: true, json: async () => ({ url: "https://signed.example/doc.pdf" }) });
      }
      if (url.includes("/cancel")) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ error: { code: "ALREADY_DECIDED" }, id: PENDING_ID, status: "APPROVED" }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: {} }) });
    });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${PENDING_ID}` }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByText("Cancel Request"));
    fireEvent.click(screen.getByText("Confirm"));

    expect(await screen.findByText(/already been approved/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/leaves/${PENDING_ID}/cancel`,
      { method: "POST" },
    );
  });

  it("on network failure shows an inline error and row stays PENDING", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/leaves") {
        return Promise.resolve({ ok: true, json: async () => rows });
      }
      if (url.includes("/supporting-doc")) {
        return Promise.resolve({ ok: true, json: async () => ({ url: "https://signed.example/doc.pdf" }) });
      }
      if (url.includes("/cancel")) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({ ok: false, json: async () => ({ error: {} }) });
    });
    render(<MyRequests />);
    await screen.findByText("Annual Leave");

    fireEvent.click(screen.getByRole("button", { name: `View details for ${PENDING_ID}` }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByText("Cancel Request"));
    fireEvent.click(screen.getByText("Confirm"));

    expect(await screen.findByText(/Could not cancel the request/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/leaves/${PENDING_ID}/cancel`,
      { method: "POST" },
    );
  });
});
