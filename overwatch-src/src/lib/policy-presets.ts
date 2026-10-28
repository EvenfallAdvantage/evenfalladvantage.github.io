import type { OvertimeConfig } from "@/lib/supabase/db-overtime";
import type { BreakPolicyConfig } from "@/lib/supabase/db-breaks";

export type OtPresetId = "federal" | "california" | "custom";

export const OT_PRESETS: { id: Exclude<OtPresetId, "custom">; label: string; desc: string; config: Omit<OvertimeConfig, "weekStartDay"> }[] = [
  { id: "federal", label: "Federal (FLSA)", desc: "Overtime after 40 hours a week.", config: { weeklyThreshold: 40, dailyThreshold: 0, doubletimeThreshold: 0, seventhDayRule: false } },
  { id: "california", label: "California", desc: "Overtime after 8 hours a day or 40 a week; double time after 12 hours a day; 7th consecutive day rule.", config: { weeklyThreshold: 40, dailyThreshold: 8, doubletimeThreshold: 12, seventhDayRule: true } },
];

export function detectOtPreset(cfg: OvertimeConfig): OtPresetId {
  const hit = OT_PRESETS.find((p) =>
    p.config.weeklyThreshold === cfg.weeklyThreshold &&
    p.config.dailyThreshold === cfg.dailyThreshold &&
    p.config.doubletimeThreshold === cfg.doubletimeThreshold &&
    p.config.seventhDayRule === !!cfg.seventhDayRule);
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

// ─── Break & Meal Policy Presets ──────────────────────────

export type BreakPresetId = "california" | "federal" | "custom";

export const BREAK_PRESETS: {
  id: Exclude<BreakPresetId, "custom">;
  label: string;
  desc: string;
  config: BreakPolicyConfig;
}[] = [
  {
    id: "california",
    label: "California (CA Labor Code)",
    desc: "30m unpaid lunch after 5h (2nd after 10h); 10m paid rest breaks at 3.5h, 6h, and 10h (up to 3/shift).",
    config: {
      breaksEnabled: true,
      mealBreakMinutes: 30,
      mealBreakPaid: false,
      firstMealAfterHours: 5,
      secondMealAfterHours: 10,
      restBreakMinutes: 10,
      restBreakPaid: true,
      maxRestBreaksPerShift: 3,
      firstRestAfterHours: 3.5,
      secondRestAfterHours: 6,
      thirdRestAfterHours: 10,
    },
  },
  {
    id: "federal",
    label: "Federal / Standard (FLSA)",
    desc: "30m unpaid lunch after 6h; up to two 15m paid rest breaks per shift (4h and 8h).",
    config: {
      breaksEnabled: true,
      mealBreakMinutes: 30,
      mealBreakPaid: false,
      firstMealAfterHours: 6,
      secondMealAfterHours: 0,
      restBreakMinutes: 15,
      restBreakPaid: true,
      maxRestBreaksPerShift: 2,
      firstRestAfterHours: 4,
      secondRestAfterHours: 8,
      thirdRestAfterHours: 0,
    },
  },
];

export function detectBreakPreset(cfg: BreakPolicyConfig): BreakPresetId {
  const hit = BREAK_PRESETS.find((p) =>
    p.config.breaksEnabled === cfg.breaksEnabled &&
    p.config.mealBreakMinutes === cfg.mealBreakMinutes &&
    p.config.mealBreakPaid === cfg.mealBreakPaid &&
    p.config.firstMealAfterHours === cfg.firstMealAfterHours &&
    p.config.secondMealAfterHours === cfg.secondMealAfterHours &&
    p.config.restBreakMinutes === cfg.restBreakMinutes &&
    p.config.restBreakPaid === cfg.restBreakPaid &&
    p.config.maxRestBreaksPerShift === cfg.maxRestBreaksPerShift &&
    p.config.firstRestAfterHours === cfg.firstRestAfterHours &&
    p.config.secondRestAfterHours === cfg.secondRestAfterHours &&
    p.config.thirdRestAfterHours === cfg.thirdRestAfterHours
  );
  return hit?.id ?? "custom";
}

/** Returns an error message, or null when the break policy is valid. */
export function validateBreakPolicy(cfg: BreakPolicyConfig): string | null {
  if (!Number.isFinite(cfg.mealBreakMinutes) || cfg.mealBreakMinutes < 5 || cfg.mealBreakMinutes > 120) {
    return "Meal break duration must be between 5 and 120 minutes";
  }
  if (!Number.isFinite(cfg.restBreakMinutes) || cfg.restBreakMinutes < 5 || cfg.restBreakMinutes > 60) {
    return "Rest break duration must be between 5 and 60 minutes";
  }
  if (!Number.isInteger(cfg.maxRestBreaksPerShift) || cfg.maxRestBreaksPerShift < 0 || cfg.maxRestBreaksPerShift > 10) {
    return "Max rest breaks per shift must be between 0 and 10";
  }
  const hourFields = [
    cfg.firstMealAfterHours,
    cfg.secondMealAfterHours,
    cfg.firstRestAfterHours,
    cfg.secondRestAfterHours,
    cfg.thirdRestAfterHours,
  ];
  if (hourFields.some((h) => !Number.isFinite(h) || h < 0 || h > 24)) {
    return "Shift hour thresholds must be between 0 and 24 hours";
  }
  if (cfg.secondMealAfterHours > 0 && cfg.firstMealAfterHours > 0 && cfg.secondMealAfterHours <= cfg.firstMealAfterHours) {
    return "2nd meal break threshold must be after 1st meal break threshold";
  }
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
