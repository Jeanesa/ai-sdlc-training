import { afterEach, describe, expect, it, vi } from "vitest";
import { countWorkingDays } from "./working-days";

describe("countWorkingDays", () => {
  it("returns 1 for a single weekday", () => {
    expect(countWorkingDays("2026-05-19", "2026-05-19")).toBe(1);
  });

  it("returns 0 for a single weekend day", () => {
    expect(countWorkingDays("2026-05-16", "2026-05-16")).toBe(0);
  });

  it("returns 5 for a full Monday-to-Sunday week", () => {
    expect(countWorkingDays("2026-05-11", "2026-05-17")).toBe(5);
  });

  it("returns 0 for a Saturday-to-Sunday span", () => {
    expect(countWorkingDays("2026-05-16", "2026-05-17")).toBe(0);
  });

  it("returns 3 for a Thursday-to-Monday span crossing a weekend", () => {
    expect(countWorkingDays("2026-05-21", "2026-05-25")).toBe(3);
  });

  it("returns 10 for a two-week Monday-to-Friday span", () => {
    expect(countWorkingDays("2026-05-11", "2026-05-22")).toBe(10);
  });

  it("returns 1 when start equals end on a weekday", () => {
    expect(countWorkingDays("2026-06-03", "2026-06-03")).toBe(1);
  });

  it("returns 0 when end is before start", () => {
    expect(countWorkingDays("2026-05-19", "2026-05-11")).toBe(0);
  });

  it("returns 0 for empty or malformed input", () => {
    expect(countWorkingDays("", "2026-05-19")).toBe(0);
    expect(countWorkingDays("2026-05-19", "")).toBe(0);
    expect(countWorkingDays("not-a-date", "2026-05-19")).toBe(0);
    expect(countWorkingDays("2026-13-05", "2026-05-19")).toBe(0);
    expect(countWorkingDays("2026-05-32", "2026-05-19")).toBe(0);
  });
});

describe("countWorkingDays timezone stability", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
    vi.resetModules();
  });

  it("counts correctly in a timezone behind UTC", async () => {
    process.env.TZ = "America/New_York";
    vi.resetModules();
    const { countWorkingDays: fresh } = await import("./working-days");

    expect(fresh("2026-05-11", "2026-05-17")).toBe(5);
    expect(fresh("2026-05-21", "2026-05-25")).toBe(3);
    expect(fresh("2026-05-19", "2026-05-19")).toBe(1);
  });
});
