import { existsSync } from "node:fs";
import { join } from "node:path";

export function loadEnv(): void {
  if (typeof process.loadEnvFile !== "function") {
    return;
  }
  const localEnv = join(process.cwd(), ".env.local");
  if (existsSync(localEnv)) {
    process.loadEnvFile(localEnv);
  }
}
