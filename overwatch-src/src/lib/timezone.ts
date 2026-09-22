/**
 * Timezone utilities for event/shift time handling.
 *
 * Events and companies store a `timezone` string (IANA, e.g. "America/Los_Angeles").
 * All shift times are persisted in UTC.  These helpers convert between
 * "local time in an event's timezone" and UTC so that admins in any browser
 * timezone see the correct wall-clock time for the event location.
 */

/** Common US timezones for the dropdown selector. */
export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
] as const;

/**
 * Convert a "YYYY-MM-DDTHH:mm" string (intended as local time in `timezone`)
 * to a UTC ISO string for storage.
 *
 * Strategy: read the wall-clock that `timezone` shows at a candidate UTC
 * instant, then correct by the difference. Iterating twice converges even
 * across DST transitions.
 *
 * Example: localToUTC("2026-04-18T09:00", "America/Los_Angeles")
 *   → "2026-04-18T16:00:00.000Z"  (9 AM PT = 4 PM UTC during PDT)
 */
export function localToUTC(localDatetime: string, timezone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localDatetime);
  if (!m) {
    // Unknown format: keep legacy behaviour as a fallback.
    const parsed = new Date(localDatetime + "Z");
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);

  // Desired wall clock, expressed in UTC coordinates (i.e. "as if UTC").
  const target = Date.UTC(year, month - 1, day, hour, minute);

  // Find the UTC instant whose wall clock in `timezone` equals `target`.
  // Two correction passes are enough: the only way an error remains after
  // the first pass is at a DST boundary, where the second pass closes it.
  let instant = target;
  for (let i = 0; i < 2; i++) {
    const wall = wallClockUtc(instant, timezone);
    instant += target - wall;
  }

  return new Date(instant).toISOString();
}

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClockUtc(instantMs: number, timezone: string): number {
  let fmt = wallClockFormatters.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    wallClockFormatters.set(timezone, fmt);
  }

  const parts = fmt.formatToParts(new Date(instantMs));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  return Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
}

/**
 * Format a UTC ISO string in a specific timezone for display.
 *
 * Example: formatInTimezone("2026-04-18T16:00:00Z", "America/Los_Angeles",
 *            { hour: "2-digit", minute: "2-digit" })
 *   → "09:00 AM"
 */
export function formatInTimezone(
  utcIso: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(utcIso).toLocaleString("en-US", {
    timeZone: timezone,
    ...options,
  });
}

/**
 * Format a UTC date as a `datetime-local` input value (YYYY-MM-DDTHH:mm)
 * in a specific timezone.  Used to pre-fill edit forms.
 */
export function utcToLocalInput(utcIso: string, timezone: string): string {
  const d = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Resolve the effective timezone for an event.
 * Falls back: event.timezone → company timezone → browser timezone.
 */
export function resolveTimezone(
  eventTimezone?: string | null,
  companyTimezone?: string | null,
): string {
  if (eventTimezone) return eventTimezone;
  if (companyTimezone) return companyTimezone;
  // Fall back to browser timezone (preserves legacy behaviour)
  if (typeof Intl !== "undefined") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return "America/New_York";
}

/**
 * Short timezone abbreviation for display, e.g. "PT", "ET".
 */
export function tzAbbrev(timezone: string): string {
  const match = US_TIMEZONES.find((t) => t.value === timezone);
  if (match) {
    // Extract abbreviation from label, e.g. "Eastern (ET)" → "ET"
    const m = match.label.match(/\(([^)]+)\)/);
    return m ? m[1] : timezone;
  }
  // For non-US timezones, use Intl short name
  try {
    const s = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return s?.value ?? timezone;
  } catch {
    return timezone;
  }
}
