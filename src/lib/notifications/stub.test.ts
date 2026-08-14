import { afterEach, describe, expect, it, vi } from "vitest";

import { type NewRequestPayload, notificationDispatcher } from "@/lib/notifications";
import { StubDispatcher } from "./stub";

const EMPLOYEE_NAME = "Jean Doe";
const REQUEST_LINK = "/employee/requests/50000000-0000-4000-8000-000000000001";

const NEW_REQUEST_PAYLOAD: NewRequestPayload = {
  employeeName: EMPLOYEE_NAME,
  leaveType: "Annual Leave",
  startDate: "2026-05-19",
  endDate: "2026-05-21",
  workingDays: 3,
  requestLink: REQUEST_LINK,
};

const CANCEL_REQUEST_PAYLOAD: NewRequestPayload = {
  employeeName: EMPLOYEE_NAME,
  leaveType: "Annual Leave",
  startDate: "2026-05-19",
  endDate: "2026-05-21",
  workingDays: 3,
  requestLink: REQUEST_LINK,
};

describe("notificationDispatcher singleton", () => {
  it("is wired to the StubDispatcher", () => {
    expect(notificationDispatcher).toBeInstanceOf(StubDispatcher);
  });
});

describe("StubDispatcher.sendNewRequestToManager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves immediately without throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      notificationDispatcher.sendNewRequestToManager(NEW_REQUEST_PAYLOAD),
    ).resolves.toBeUndefined();
  });

  it("emits exactly one structured console.warn carrying the full payload", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await notificationDispatcher.sendNewRequestToManager(NEW_REQUEST_PAYLOAD);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[notifications:stub] sendNewRequestToManager",
      JSON.stringify(NEW_REQUEST_PAYLOAD),
    );
    const serialized = warn.mock.calls[0]?.[1];
    expect(JSON.parse(String(serialized))).toEqual(NEW_REQUEST_PAYLOAD);
    expect(error).not.toHaveBeenCalled();
  });
});

describe("StubDispatcher.sendCancelToManager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves immediately without throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      notificationDispatcher.sendCancelToManager(CANCEL_REQUEST_PAYLOAD),
    ).resolves.toBeUndefined();
  });

  it("emits exactly one structured console.warn carrying the full payload", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await notificationDispatcher.sendCancelToManager(CANCEL_REQUEST_PAYLOAD);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[notifications:stub] sendCancelToManager",
      JSON.stringify(CANCEL_REQUEST_PAYLOAD),
    );
    const serialized = warn.mock.calls[0]?.[1];
    expect(JSON.parse(String(serialized))).toEqual(CANCEL_REQUEST_PAYLOAD);
    expect(error).not.toHaveBeenCalled();
  });
});
