import { loadEnv } from "./env";

export default async function globalSetup(): Promise<void> {
  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Run `supabase start`, then provide the " +
        "Supabase env vars in .env.local or CI before running the integration suite.",
    );
  }
  const healthUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`;
  let status = 0;
  try {
    const res = await fetch(healthUrl);
    status = res.status;
  } catch {
    throw new Error(
      `Supabase emulator is not reachable at ${healthUrl}. Run \`supabase start\` and ` +
        "`supabase db reset` before the integration suite.",
    );
  }
  if (status !== 200) {
    throw new Error(
      `Supabase emulator health check failed (HTTP ${status} at ${healthUrl}). Run ` +
        "`supabase start` and `supabase db reset` before the integration suite.",
    );
  }
}
