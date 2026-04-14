import { parseUTC } from "@/lib/parse-utc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Timesheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Shift = any;

export function formatDuration(ms: number) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatTime(iso: string) {
  return parseUTC(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string) {
  return parseUTC(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatFullDate(iso: string) {
  return parseUTC(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function calcHoursNum(clockInISO: string, clockOutISO: string) {
  return Math.max(0, (parseUTC(clockOutISO).getTime() - parseUTC(clockInISO).getTime()) / 3600000);
}

export function calcHours(clockInISO: string, clockOutISO: string) {
  return calcHoursNum(clockInISO, clockOutISO).toFixed(2);
}

export function getWeekDates(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
