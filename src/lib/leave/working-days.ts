/**
 * countWorkingDays(startDate, endDate) — counts working days in an INCLUSIVE
 * [startDate, endDate] range.
 *
 * A working day is Monday–Friday (getUTCDay 1..5). Weekends are the ONLY
 * exclusion; Philippine public holidays are NOT excluded (Phase 1, A-04/A-05).
 *
 * Timezone-independent and DST-immune: 'yyyy-mm-dd' strings are split into
 * y/m/d and computed via Date.UTC / getUTCDay. Never local Date parsing,
 * never getDay(). This is the TS parity contract for the Epic-3 SQL
 * public.working_days() (TASK-036) — both MUST return identical counts.
 *
 * Pure and framework-free: no DOM, no network, no Date.now, no Supabase.
 * Importable by browser (TASK-031 preview, TASK-028 confirmation) and Node
 * (TASK-040/041 daysRequested display serialization).
 *
 * Contract (the signature can't express it):
 *   - Both endpoints are INCLUSIVE.
 *   - end < start  -> returns 0 (order validation belongs to TASK-020).
 *   - Empty or malformed input -> returns 0.
 *   - Never throws; never returns NaN or a negative number.
 *   - Precondition: well-formed 'yyyy-mm-dd' strings.
 */
export function countWorkingDays(startDate: string, endDate: string): number {
  const start = parseUtcDay(startDate);
  const end = parseUtcDay(endDate);
  if (start === null || end === null || start > end) return 0;

  let count = 0;
  let cur = start;
  while (cur <= end) {
    const day = new Date(cur).getUTCDay();
    if (day >= 1 && day <= 5) count++;
    cur += 86_400_000;
  }
  return count;
}

function parseUtcDay(value: string): number | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  return Date.UTC(y, m - 1, d);
}
