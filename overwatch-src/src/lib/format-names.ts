// Central formatting for member names across Overwatch.
//
// The client-facing convention: when a member has a `callsign`, render it as
// "Callsign LastName" (e.g. "Eagle Jones"). Without a callsign the fallback
// is "FirstName LastName".
//
// Both DB rows (snake_case `first_name`/`last_name`) and client objects
// (camelCase `firstName`/`lastName`) are accepted so every render site can
// route through one helper.

export type PersonName = {
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  callsign?: string | null;
};

/** "Callsign LastName" when a callsign exists, else "FirstName LastName".
 * Falls back to "Unknown" when nothing usable is present. */
export function formatMemberName(p: PersonName): string {
  const callsign = (p.callsign ?? "").trim();
  const first = (p.first_name ?? p.firstName ?? "").trim();
  const last = (p.last_name ?? p.lastName ?? "").trim();

  if (callsign) {
    return last ? `${callsign} ${last}` : callsign;
  }
  const full = [first, last].filter(Boolean).join(" ");
  return full || "Unknown";
}

/** Two-letter initials: "CL" from a callsign + last name, else "FL" from
 * first + last. Upper-cased. Returns "?" as a last resort. */
export function memberInitials(p: PersonName): string {
  const callsign = (p.callsign ?? "").trim();
  const first = (p.first_name ?? p.firstName ?? "").trim();
  const last = (p.last_name ?? p.lastName ?? "").trim();

  const a = callsign ? callsign[0] : first[0];
  const b = last[0];
  const initials = ((a ?? "") + (b ?? "")).toUpperCase();
  return initials || "?";
}

/** Convenience for arrays/keys: stable key derived from the display name. */
export function memberNameKey(p: PersonName): string {
  return formatMemberName(p).toLowerCase().replace(/\s+/g, "-");
}