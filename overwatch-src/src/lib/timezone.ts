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
 * Strategy: treat the input as if it were UTC, then determine the target
 * timezone's offset at that instant and adjust accordingly.
 *
 * Example: localToUTC("2026-04-18T09:00", "America/Los_Angeles")
 *   → "2026-04-18T16:00:00.000Z"  (9 AM PT = 4 PM UTC during PDT)
 */
export function localToUTC(localDatetime: string, timezone: string): string {
  // Parse the input as if it were UTC
  const asUTC = new Date(localDatetime + "Z");

  // Find what time it would be in the target timezone at this UTC instant
  const inTZ = new Date(
    asUTC.toLocaleString("en-US", { timeZone: timezone }),
  );

  // The difference tells us the timezone offset at this moment
  const offsetMs = inTZ.getTime() - asUTC.getTime();

  // Subtract the offset to get the true UTC time
  const utc = new Date(asUTC.getTime() - offsetMs);

  return utc.toISOString();
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
