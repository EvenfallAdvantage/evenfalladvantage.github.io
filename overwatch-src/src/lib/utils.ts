import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseUTC } from "./parse-utc"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// DB timestamps without a zone (timestamp columns written as UTC) must be read
// as UTC, or they land hours in the future and show "just now".
export function timeAgo(iso: string) {
  const at = parseUTC(iso);
  const diff = Date.now() - at.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return at.toLocaleDateString([], { month: "short", day: "numeric" });
}
