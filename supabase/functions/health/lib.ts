/** Pure helpers for the public health endpoint (unit-tested in lib_test.ts). */
export type CheckName = "database" | "auth" | "storage";
export interface CheckResult { ok: boolean; ms: number }
export type Overall = "ok" | "degraded" | "down";

/** All ok → ok; database down → down (the app can't work); anything else → degraded. */
export function overallStatus(checks: Record<CheckName, CheckResult>): Overall {
  if (Object.values(checks).every((c) => c.ok)) return "ok";
  return checks.database.ok ? "degraded" : "down";
}

/** Run a probe with a timeout; never throws, never returns error details. */
export async function timed(probe: () => Promise<boolean>, timeoutMs = 5000): Promise<CheckResult> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ok = await Promise.race([
      probe().catch(() => false),
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
    return { ok, ms: Math.round(performance.now() - start) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
