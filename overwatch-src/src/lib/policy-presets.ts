import type { OvertimeConfig } from "@/lib/supabase/db-overtime";

export type OtPresetId = "federal" | "california" | "custom";

export const OT_PRESETS: { id: Exclude<OtPresetId, "custom">; label: string; desc: string; config: Omit<OvertimeConfig, "weekStartDay"> }[] = [
  { id: "federal", label: "Federal (FLSA)", desc: "Overtime after 40 hours a week.", config: { weeklyThreshold: 40, dailyThreshold: 0, doubletimeThreshold: 0 } },
  { id: "california", label: "California", desc: "Overtime after 8 hours a day or 40 a week; double time after 12 hours a day.", config: { weeklyThreshold: 40, dailyThreshold: 8, doubletimeThreshold: 12 } },
];

export function detectOtPreset(cfg: OvertimeConfig): OtPresetId {
  const hit = OT_PRESETS.find((p) =>
    p.config.weeklyThreshold === cfg.weeklyThreshold &&
    p.config.dailyThreshold === cfg.dailyThreshold &&
    p.config.doubletimeThreshold === cfg.doubletimeThreshold);
  return hit?.id ?? "custom";
}

/** Returns an error message, or null when the config is usable. */
export function validateOvertimeConfig(cfg: OvertimeConfig): string | null {
  const nums = [cfg.weeklyThreshold, cfg.dailyThreshold, cfg.doubletimeThreshold];
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return "Hours must be zero or more";
  if (cfg.weeklyThreshold > 168) return "Weekly threshold can't exceed 168 hours";
  if (cfg.dailyThreshold > 24 || cfg.doubletimeThreshold > 24) return "Daily thresholds can't exceed 24 hours";
  if (cfg.doubletimeThreshold > 0 && cfg.dailyThreshold > 0 && cfg.doubletimeThreshold <= cfg.dailyThreshold)
    return "Double time must start after daily overtime";
  if (!Number.isInteger(cfg.weekStartDay) || cfg.weekStartDay < 0 || cfg.weekStartDay > 6) return "Pick a week start day";
  return null;
}

/** Parse a money input. "" → null (clear). Returns undefined when invalid. */
export function parseRate(input: string): number | null | undefined {
  const t = input.trim().replace(/^\$/, "");
  if (!t) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return undefined;
  return Number(t);
}

/** Parse an optional non-negative number. "" → null, invalid → undefined. */
export function parseOptionalNumber(input: string, max = 10000): number | null | undefined {
  const t = input.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return n;
}

export const ACCRUAL_PERIODS = ["per_hour_worked", "per_pay_period", "monthly", "yearly"] as const;
export const ACCRUAL_PERIOD_LABEL: Record<string, string> = {
  per_hour_worked: "per hour worked",
  per_pay_period: "per pay period",
  monthly: "per month",
  yearly: "per year",
};
