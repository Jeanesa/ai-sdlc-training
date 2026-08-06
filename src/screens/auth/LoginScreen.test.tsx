// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithOtp } = vi.hoisted(() => ({ signInWithOtp: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp } }),
}));

import LoginScreen from "@/screens/auth/LoginScreen";

describe("LoginScreen domain validation", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    signInWithOtp.mockReset();
    window.history.replaceState({}, "", "/login");
  });

  it("rejects a non-@stratpoint.com email without calling signInWithOtp", async () => {
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText("Work email address"), {
      target: { value: "someone@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));

    expect(
      await screen.findByText("Only @stratpoint.com email addresses are permitted."),
    ).toBeTruthy();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("calls signInWithOtp for a @stratpoint.com email and shows the success state", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText("Work email address"), {
      target: { value: "andres.lopez@stratpoint.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));

    await vi.waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "andres.lopez@stratpoint.com",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    });
    expect(await screen.findByText("Check your @stratpoint.com inbox")).toBeTruthy();
  });
});
