// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useSearchParamsMock, setSearchParams, replaceMock, pushMock } = vi.hoisted(() => {
  let current = new URLSearchParams();
  return {
    useSearchParamsMock: () => current,
    setSearchParams: (params: URLSearchParams) => {
      current = params;
    },
    replaceMock: vi.fn(),
    pushMock: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: useSearchParamsMock,
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

import Confirmation from "@/screens/employee/Confirmation";

const REQUEST_ID = "5f3c8c0e-6a1f-4d2e-9b8a-2c1d3e4f5a6b";

function validParams(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    id: REQUEST_ID,
    leaveType: "Sick Leave",
    startDate: "2026-06-10",
    endDate: "2026-06-11",
    workingDays: "2",
    status: "PENDING",
    ...overrides,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  replaceMock.mockReset();
  pushMock.mockReset();
  setSearchParams(validParams());
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Confirmation", () => {
  it("renders the request ID and all five summary fields from valid params", () => {
    render(<Confirmation />);

    expect(screen.getByText(REQUEST_ID)).toBeTruthy();
    expect(screen.getByText("Sick Leave")).toBeTruthy();
    expect(screen.getByText("Wednesday, June 10, 2026")).toBeTruthy();
    expect(screen.getByText("Thursday, June 11, 2026")).toBeTruthy();
    expect(screen.getByText("2 days")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();

    expect(screen.queryByText("Reason")).toBeNull();
    expect(screen.queryByText("Supporting Document")).toBeNull();
    expect(screen.queryByText("Submitted")).toBeNull();

    expect(replaceMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to /employee/new-request?notice=invalid-request when workingDays is non-numeric", async () => {
    setSearchParams(validParams({ workingDays: "abc" }));
    render(<Confirmation />);

    await vi.waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/employee/new-request?notice=invalid-request");

    expect(screen.queryByText(REQUEST_ID)).toBeNull();
    expect(screen.queryByText("Pending")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects when a required param (id) is missing", async () => {
    const params = validParams();
    params.delete("id");
    setSearchParams(params);
    render(<Confirmation />);

    await vi.waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/employee/new-request?notice=invalid-request");

    expect(screen.queryByText(REQUEST_ID)).toBeNull();
    expect(screen.queryByText("Pending")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
