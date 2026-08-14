import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { requireSelfServiceUser } from "@/lib/auth/self-service";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const MANAGER_ID = "20000000-0000-4000-8000-000000000001";

interface FakeClientInput {
  getUser: { data: { user: { id: string } | null }; error: unknown };
  profile: { data: { role: string; manager_id: string | null } | null; error: unknown };
}

function installFakeClient(input: FakeClientInput): {
  supabase: SupabaseClient;
  from: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(input.profile);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const getUser = vi.fn().mockResolvedValue(input.getUser);
  const supabase = {
    auth: { getUser },
    from,
  } as unknown as SupabaseClient;
  return { supabase, from };
}

describe("requireSelfServiceUser", () => {
  it("returns the caller for an employee with a manager_id", async () => {
    const { supabase } = installFakeClient({
      getUser: { data: { user: { id: USER_ID } }, error: null },
      profile: { data: { role: "employee", manager_id: MANAGER_ID }, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toEqual({ id: USER_ID, role: "employee", managerId: MANAGER_ID });
  });

  it("returns the caller for a manager with a null manager_id", async () => {
    const { supabase } = installFakeClient({
      getUser: { data: { user: { id: USER_ID } }, error: null },
      profile: { data: { role: "manager", manager_id: null }, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toEqual({ id: USER_ID, role: "manager", managerId: null });
  });

  it("returns the caller for an hr_admin with a null manager_id", async () => {
    const { supabase } = installFakeClient({
      getUser: { data: { user: { id: USER_ID } }, error: null },
      profile: { data: { role: "hr_admin", manager_id: null }, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toEqual({ id: USER_ID, role: "hr_admin", managerId: null });
  });

  it("returns null for a sys_admin caller", async () => {
    const { supabase } = installFakeClient({
      getUser: { data: { user: { id: USER_ID } }, error: null },
      profile: { data: { role: "sys_admin", manager_id: null }, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toBeNull();
  });

  it("returns null for an unauthenticated caller without querying profiles", async () => {
    const { supabase, from } = installFakeClient({
      getUser: { data: { user: null }, error: null },
      profile: { data: { role: "employee", manager_id: null }, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns null when getUser returns an error", async () => {
    const { supabase, from } = installFakeClient({
      getUser: { data: { user: null }, error: { name: "AuthApiError", message: "no session" } },
      profile: { data: { role: "employee", manager_id: null }, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns null when the profile row is missing", async () => {
    const { supabase } = installFakeClient({
      getUser: { data: { user: { id: USER_ID } }, error: null },
      profile: { data: null, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toBeNull();
  });

  it("returns null when the profile query returns an error", async () => {
    const { supabase } = installFakeClient({
      getUser: { data: { user: { id: USER_ID } }, error: null },
      profile: { data: null, error: { name: "PostgresError", message: "query failed" } },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toBeNull();
  });

  it("returns null for a drift role value (hradmin)", async () => {
    const { supabase } = installFakeClient({
      getUser: { data: { user: { id: USER_ID } }, error: null },
      profile: { data: { role: "hradmin", manager_id: null }, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toBeNull();
  });

  it("returns null for a garbage role value", async () => {
    const { supabase } = installFakeClient({
      getUser: { data: { user: { id: USER_ID } }, error: null },
      profile: { data: { role: "garbage", manager_id: null }, error: null },
    });

    const result = await requireSelfServiceUser(supabase);

    expect(result).toBeNull();
  });
});
