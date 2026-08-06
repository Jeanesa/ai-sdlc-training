import { beforeAll, describe, expect, it } from "vitest";

import { createAnonClient, createServiceClient, waitForOtpEmail } from "./helpers";

const magicEmail = `e2e.magic.${Date.now()}@stratpoint.com`;

describe("magic link authentication (integration)", () => {
  beforeAll(async () => {
    const service = createServiceClient();
    const { error } = await service.auth.admin.createUser({
      email: magicEmail,
      email_confirm: true,
      password: "Task-016-MagicLink!",
    });
    if (error && !/already registered|already exists|duplicate/i.test(error.message ?? "")) {
      throw error;
    }
  });

  it("signInWithOtp for a @stratpoint.com address succeeds and delivers an OTP email", async () => {
    const anon = createAnonClient();
    const { error } = await anon.auth.signInWithOtp({ email: magicEmail });
    expect(error).toBeNull();
    await waitForOtpEmail(magicEmail, 10_000);
  });
});
