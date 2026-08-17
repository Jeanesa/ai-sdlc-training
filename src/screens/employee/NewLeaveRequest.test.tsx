// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const mockBalanceQuery = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        is: () => ({
          eq: mockBalanceQuery,
        }),
      }),
    }),
  }),
}));

import NewLeaveRequest from "@/screens/employee/NewLeaveRequest";

const ALL_BALANCES = [
  { leave_type: "Annual Leave", total_days: 15, used_days: 10 },
  { leave_type: "Sick Leave", total_days: 10, used_days: 10 },
  { leave_type: "Emergency Leave", total_days: 5, used_days: 0 },
];

function approvedLeave(overrides: { startDate: string; endDate: string }) {
  return {
    id: "leave-1",
    leaveType: "Annual Leave",
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    workingDays: 3,
    status: "APPROVED",
    createdAt: "2026-07-01T09:00:00.000Z",
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

function isPostCall(call: unknown[]) {
  const opts = call[1] as { method?: string } | undefined;
  return opts?.method === "POST";
}

beforeEach(() => {
  pushMock.mockReset();
  mockBalanceQuery.mockReset();
  mockBalanceQuery.mockResolvedValue({ data: ALL_BALANCES, error: null });

  fetchMock = vi.fn().mockImplementation(function (_url: string, opts?: { method?: string }) {
    if (opts?.method !== "POST") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function selectLeaveType(value: string) {
  fireEvent.change(screen.getByLabelText(/Leave Type/), { target: { value } });
}

function setStartDate(value: string) {
  fireEvent.change(screen.getByLabelText(/Start Date/), { target: { value } });
}

function setEndDate(value: string) {
  fireEvent.change(screen.getByLabelText(/End Date/), { target: { value } });
}

function setReason(value: string) {
  fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value } });
}

function submitForm() {
  fireEvent.submit(screen.getByRole("button", { name: "Submit Request" }).closest("form")!);
}

function futureDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function waitForBalanceLoaded() {
  await waitFor(() => expect(mockBalanceQuery).toHaveBeenCalled());
}

describe("NewLeaveRequest — inline validation errors", () => {
  it("shows a past-start-date error and does NOT fire POST /api/leaves", async () => {
    render(<NewLeaveRequest />);

    selectLeaveType("Annual Leave");
    setStartDate("2020-01-01");
    setEndDate("2020-01-05");
    setReason("Valid reason text for testing");
    submitForm();

    expect(await screen.findByText("Start date must not be in the past.")).toBeTruthy();

    const postCalls = fetchMock.mock.calls.filter(isPostCall);
    expect(postCalls).toHaveLength(0);
  });

  it("shows an end-before-start error and does NOT fire POST /api/leaves", async () => {
    render(<NewLeaveRequest />);

    selectLeaveType("Annual Leave");
    setStartDate("2026-09-05");
    setEndDate("2026-09-01");
    setReason("Valid reason text for testing");
    submitForm();

    expect(await screen.findByText("End date must be on or after start date.")).toBeTruthy();

    const postCalls = fetchMock.mock.calls.filter(isPostCall);
    expect(postCalls).toHaveLength(0);
  });

  it("shows a reason-too-short error and does NOT fire POST /api/leaves", async () => {
    render(<NewLeaveRequest />);

    selectLeaveType("Annual Leave");
    setStartDate("2026-09-01");
    setEndDate("2026-09-05");
    setReason("Short");
    submitForm();

    expect(await screen.findByText("Reason must be at least 10 characters.")).toBeTruthy();

    const postCalls = fetchMock.mock.calls.filter(isPostCall);
    expect(postCalls).toHaveLength(0);
  });

  it("shows a file-type error and does NOT fire POST /api/leaves", async () => {
    render(<NewLeaveRequest />);

    selectLeaveType("Sick Leave");
    await waitForBalanceLoaded();

    setStartDate("2026-09-01");
    setEndDate("2026-09-05");
    setReason("Valid reason text for testing");

    const badFile = new File(["x"], "readme.txt", { type: "text/plain" });
    const input = screen.getByLabelText("Upload supporting document");
    Object.defineProperty(input, "files", { value: [badFile] });
    fireEvent.change(input);

    submitForm();

    expect(await screen.findByText("Only PDF and image files are accepted.")).toBeTruthy();

    const postCalls = fetchMock.mock.calls.filter(isPostCall);
    expect(postCalls).toHaveLength(0);
  });
});

describe("NewLeaveRequest — working-day preview", () => {
  it("updates the working-days count on date change using the shared countWorkingDays (UTC)", async () => {
    render(<NewLeaveRequest />);

    selectLeaveType("Annual Leave");
    setStartDate("2026-09-01");
    setEndDate("2026-09-03");

    const findWorkingDaysText = () =>
      screen.findByText((_text, node) => {
        const span = node as HTMLElement;
        return (
          span.tagName === "SPAN" &&
          /\d+\s+working\s+days?\s+requested/.test(span.textContent ?? "")
        );
      });

    expect(await findWorkingDaysText()).toBeTruthy();

    setEndDate("2026-09-05");
    expect(await findWorkingDaysText()).toBeTruthy();
  });
});

describe("NewLeaveRequest — dropdown and canonical value", () => {
  it("dropdown lists LEAVE_TYPE values and submit sends the canonical name as leaveType", async () => {
    mockBalanceQuery.mockResolvedValue({
      data: [
        { leave_type: "Annual Leave", total_days: 15, used_days: 10 },
        { leave_type: "Sick Leave", total_days: 10, used_days: 5 },
        { leave_type: "Emergency Leave", total_days: 5, used_days: 0 },
      ],
      error: null,
    });
    fetchMock.mockImplementation(function (_url: string, opts?: { method?: string }) {
      if (opts?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              id: "req-abc",
              leaveType: "Sick Leave",
              startDate: "2026-09-01",
              endDate: "2026-09-05",
              workingDays: 5,
              status: "PENDING",
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NewLeaveRequest />);

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("Annual Leave");
    expect(options).toContain("Sick Leave");
    expect(options).toContain("Emergency Leave");
    expect(options).toContain("Unpaid Leave");

    await waitForBalanceLoaded();

    selectLeaveType("Sick Leave");
    setStartDate("2026-09-01");
    setEndDate("2026-09-05");
    setReason("Valid reason text for testing");
    submitForm();

    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    const postCall = fetchMock.mock.calls.find(isPostCall);
    const formData = postCall?.[1]?.body as FormData;
    expect(formData.get("leaveType")).toBe("Sick Leave");
  });
});

describe("NewLeaveRequest — balance display and submit gate", () => {
  it("disables submit when Annual Leave balance is 0 and shows zero-balance message", async () => {
    mockBalanceQuery.mockResolvedValue({
      data: [
        { leave_type: "Annual Leave", total_days: 10, used_days: 10 },
        { leave_type: "Sick Leave", total_days: 10, used_days: 5 },
        { leave_type: "Emergency Leave", total_days: 5, used_days: 0 },
      ],
      error: null,
    });
    render(<NewLeaveRequest />);

    selectLeaveType("Annual Leave");

    await waitFor(() => expect(mockBalanceQuery).toHaveBeenCalled());

    const submitBtn = screen.getByRole("button", { name: "Submit Request" });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("You have no remaining Annual Leave balance for this year.")).toBeTruthy();
  });

  it("disables submit when Sick Leave balance is 0 and shows zero-balance message", async () => {
    mockBalanceQuery.mockResolvedValue({
      data: [
        { leave_type: "Annual Leave", total_days: 10, used_days: 5 },
        { leave_type: "Sick Leave", total_days: 10, used_days: 10 },
        { leave_type: "Emergency Leave", total_days: 5, used_days: 0 },
      ],
      error: null,
    });
    render(<NewLeaveRequest />);

    selectLeaveType("Sick Leave");

    await waitFor(() => expect(mockBalanceQuery).toHaveBeenCalled());

    const submitBtn = screen.getByRole("button", { name: "Submit Request" });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("You have no remaining Sick Leave balance for this year.")).toBeTruthy();
  });

  it("Emergency Leave is submittable when balance row has zero remaining", async () => {
    mockBalanceQuery.mockResolvedValue({
      data: [
        { leave_type: "Annual Leave", total_days: 10, used_days: 5 },
        { leave_type: "Sick Leave", total_days: 10, used_days: 5 },
        { leave_type: "Emergency Leave", total_days: 5, used_days: 5 },
      ],
      error: null,
    });
    render(<NewLeaveRequest />);

    selectLeaveType("Emergency Leave");

    await waitFor(() => expect(mockBalanceQuery).toHaveBeenCalled());

    const submitBtn = screen.getByRole("button", { name: "Submit Request" });
    expect(submitBtn.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(/Not subject to balance restriction/)).toBeTruthy();
  });

  it("Unpaid Leave is submittable with no balance row and shows no-limit message", async () => {
    mockBalanceQuery.mockResolvedValue({
      data: [
        { leave_type: "Annual Leave", total_days: 10, used_days: 5 },
        { leave_type: "Sick Leave", total_days: 10, used_days: 5 },
        { leave_type: "Emergency Leave", total_days: 5, used_days: 0 },
      ],
      error: null,
    });
    render(<NewLeaveRequest />);

    selectLeaveType("Unpaid Leave");

    await waitFor(() => expect(mockBalanceQuery).toHaveBeenCalled());

    const submitBtn = screen.getByRole("button", { name: "Submit Request" });
    expect(submitBtn.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("Unpaid Leave has no balance limit.")).toBeTruthy();
  });
});

describe("NewLeaveRequest — conflict warning", () => {
  it("shows a non-blocking conflict warning when dates overlap an approved leave", async () => {
    const approvedStart = futureDate(2);
    const approvedEnd = futureDate(5);
    const requestStart = futureDate(3);
    const requestEnd = futureDate(4);

    fetchMock.mockImplementation(function (_url: string, opts?: { method?: string }) {
      if (opts?.method !== "POST") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              approvedLeave({ startDate: approvedStart, endDate: approvedEnd }),
            ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<NewLeaveRequest />);

    selectLeaveType("Annual Leave");
    setStartDate(requestStart);
    setEndDate(requestEnd);

    expect(await screen.findByText(/Date conflict detected/)).toBeTruthy();

    const submitBtn = screen.getByRole("button", { name: "Submit Request" });
    expect(submitBtn.hasAttribute("disabled")).toBe(false);
  });
});

describe("NewLeaveRequest — submit → 201 → navigate with exactly 6 params", () => {
  it("navigates to /employee/confirmation with EXACTLY the six A2 params and NO reason/hasDocument", async () => {
    fetchMock.mockImplementation(function (_url: string, opts?: { method?: string }) {
      if (opts?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              id: "req-001",
              leaveType: "Annual Leave",
              startDate: "2026-09-01",
              endDate: "2026-09-05",
              workingDays: 5,
              status: "PENDING",
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NewLeaveRequest />);

    await waitForBalanceLoaded();

    selectLeaveType("Annual Leave");
    setStartDate("2026-09-01");
    setEndDate("2026-09-05");
    setReason("Valid reason text for testing");
    submitForm();

    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    const navUrl = pushMock.mock.calls[0]?.[0] as string;
    expect(navUrl.startsWith("/employee/confirmation?")).toBeTruthy();

    const params = new URLSearchParams(navUrl.split("?")[1] ?? "");
    const keys = [...params.keys()];
    expect(keys.sort()).toEqual(
      ["id", "leaveType", "startDate", "endDate", "workingDays", "status"].sort(),
    );
    expect(params.get("id")).toBe("req-001");
    expect(params.get("leaveType")).toBe("Annual Leave");
    expect(params.get("startDate")).toBe("2026-09-01");
    expect(params.get("endDate")).toBe("2026-09-05");
    expect(params.get("workingDays")).toBe("5");
    expect(params.get("status")).toBe("PENDING");

    expect(params.has("reason")).toBe(false);
    expect(params.has("hasDocument")).toBe(false);
  });
});

describe("NewLeaveRequest — server error mapping", () => {
  it("400 → field-level inline errors", async () => {
    fetchMock.mockImplementation(function (_url: string, opts?: { method?: string }) {
      if (opts?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              error: { code: "REASON_TOO_SHORT", message: "Reason must be at least 10 characters." },
              fields: { reason: { code: "REASON_TOO_SHORT", message: "Reason must be at least 10 characters." } },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NewLeaveRequest />);

    await waitForBalanceLoaded();

    selectLeaveType("Annual Leave");
    setStartDate("2026-09-01");
    setEndDate("2026-09-05");
    setReason("Valid reason text for testing");
    submitForm();

    expect(await screen.findByText("Reason must be at least 10 characters.")).toBeTruthy();
  });

  it("422 → balance banner error", async () => {
    fetchMock.mockImplementation(function (_url: string, opts?: { method?: string }) {
      if (opts?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: () =>
            Promise.resolve({
              error: { code: "BALANCE_ZERO", message: "You have no remaining Annual Leave balance for this year" },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<NewLeaveRequest />);

    await waitForBalanceLoaded();

    selectLeaveType("Annual Leave");
    setStartDate("2026-09-01");
    setEndDate("2026-09-05");
    setReason("Valid reason text for testing");
    submitForm();

    expect(
      await screen.findByText("You have no remaining Annual Leave balance for this year"),
    ).toBeTruthy();
  });
});

describe("NewLeaveRequest — notice banner", () => {
  it("renders the notice banner when notice='invalid-request'", () => {
    render(<NewLeaveRequest notice="invalid-request" />);
    expect(screen.getByText("That confirmation link is missing or invalid. Please submit a new request.")).toBeTruthy();
  });

  it("does not render the notice banner when notice is null", () => {
    render(<NewLeaveRequest notice={null} />);
    expect(screen.queryByText("That confirmation link is missing or invalid. Please submit a new request.")).toBeNull();
  });
});

describe("NewLeaveRequest — multi-row balance regression", () => {
  it("selects the correct remaining balance from a multi-row result and filters by year", async () => {
    const currentYear = new Date().getUTCFullYear();
    mockBalanceQuery.mockResolvedValue({
      data: [
        { leave_type: "Annual Leave", total_days: 15, used_days: 4 },
        { leave_type: "Sick Leave", total_days: 10, used_days: 10 },
        { leave_type: "Emergency Leave", total_days: 5, used_days: 0 },
      ],
      error: null,
    });
    render(<NewLeaveRequest />);

    selectLeaveType("Annual Leave");

    await waitFor(() => expect(mockBalanceQuery).toHaveBeenCalledWith("year", currentYear));

    expect(screen.getByText(/Remaining balance:/)).toBeTruthy();
    expect(screen.getByText("11")).toBeTruthy();

    selectLeaveType("Sick Leave");
    expect(screen.getByText("You have no remaining Sick Leave balance for this year.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit Request" }).hasAttribute("disabled")).toBe(true);

    selectLeaveType("Emergency Leave");
    expect(screen.getByText(/Remaining balance:/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit Request" }).hasAttribute("disabled")).toBe(false);
  });
});
