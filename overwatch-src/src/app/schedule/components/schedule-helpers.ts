import { parseUTC } from "@/lib/parse-utc";
import { formatInTimezone } from "@/lib/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ev = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Shift = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Asset = any;

export function fmtDate(iso: string, timezone?: string) {
  if (timezone) {
    return formatInTimezone(iso, timezone, { weekday: "short", month: "short", day: "numeric" });
  }
  return parseUTC(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function fmtTime(iso: string, timezone?: string) {
  if (timezone) {
    return formatInTimezone(iso, timezone, { hour: "2-digit", minute: "2-digit" });
  }
  return parseUTC(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function statusColor(s: string) {
  if (s === "published" || s === "confirmed") return "bg-green-500/15 text-green-600";
  if (s === "draft") return "bg-amber-500/15 text-amber-600";
  return "bg-muted text-muted-foreground";
}

export function assetStatusColor(s: string) {
  if (s === "available") return "bg-green-500/15 text-green-600";
  if (s === "checked_out") return "bg-amber-500/15 text-amber-600";
  return "bg-muted text-muted-foreground";
}
