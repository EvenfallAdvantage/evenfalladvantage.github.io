/**
 * CSV Import Utility
 * Parses CSV text into typed row objects with validation.
 */

export type CSVParseResult<T> = {
  rows: T[];
  errors: { line: number; message: string }[];
  headers: string[];
};

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCSV(text: string): CSVParseResult<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: [{ line: 0, message: "Empty file" }], headers: [] };

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length !== headers.length) {
      errors.push({ line: i + 1, message: `Expected ${headers.length} fields, got ${fields.length}` });
      continue;
    }
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j];
    }
    rows.push(row);
  }

  return { rows, errors, headers };
}

// ─── Raw CSV parsing (for column mapping flow) ──────

export type CSVRawResult = {
  headers: string[];
  rows: string[][];
  errors: { line: number; message: string }[];
};

/** Parse CSV text into raw headers + row arrays (no field mapping). */
export function parseCSVRaw(text: string): CSVRawResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], errors: [{ line: 0, message: "Empty file" }] };

  const headers = parseCSVLine(lines[0]);
  const rows: string[][] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length !== headers.length) {
      errors.push({ line: i + 1, message: `Expected ${headers.length} fields, got ${fields.length}` });
      continue;
    }
    rows.push(fields);
  }

  return { headers, rows, errors };
}

// ─── Column mapping helpers ─────────────────────────

export const STAFF_FIELDS = [
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone", required: false },
  { key: "role", label: "Role", required: false },
  { key: "title", label: "Title", required: false },
  { key: "guard_card_number", label: "Guard Card Number", required: false },
  { key: "status", label: "Hire Status", required: false },
  { key: "nickname", label: "Nickname / Handle", required: false },
  { key: "city", label: "City", required: false },
  { key: "shirt_size", label: "Shirt Size", required: false },
  { key: "region", label: "Region", required: false },
] as const;

// Headers that should NEVER match any individual name field
const SKIP_HEADERS = new Set(["full name", "fullname", "name", "full_name"]);

const FIELD_ALIASES: Record<string, string[]> = {
  first_name: ["first name", "first", "legal name", "fname", "given name", "given"],
  last_name: ["last name", "last", "legal last name", "legal last", "lname", "surname", "family name", "family"],
  email: ["email", "e-mail", "mail"],
  phone: ["phone", "tel", "mobile", "cell", "phone #", "phone#"],
  nickname: ["handle", "moniker", "nickname", "callsign", "alias", "handle/moniker"],
  city: ["city", "town", "location"],
  shirt_size: ["shirt", "uniform", "size", "shirt size"],
  region: ["region", "area", "zone"],
  status: ["hire status", "status", "employment"],
  guard_card_number: ["guard card", "gc", "guard card number", "gc status", "gc number"],
  role: ["role", "position"],
  title: ["title", "job title"],
};

/** Suggest auto-mappings from CSV headers to our staff fields via fuzzy matching. */
export function suggestMapping(csvHeaders: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const field of STAFF_FIELDS) {
    const normalized = field.key.toLowerCase().replace(/_/g, "");
    const aliases = FIELD_ALIASES[field.key] ?? [];

    const match = csvHeaders.find((h) => {
      const hn = h.toLowerCase().replace(/[_\s\-]/g, "");
      const hLower = h.toLowerCase().trim();
      // Skip ambiguous headers for name fields
      if ((field.key === "first_name" || field.key === "last_name") && SKIP_HEADERS.has(hLower)) return false;
      // Exact key match (stripped)
      if (hn === normalized) return true;
      // Alias match first (more specific, prefer these)
      for (const alias of aliases) {
        const an = alias.replace(/[_\s\-]/g, "");
        if (hn === an || hLower === alias) return true;
      }
      return false;
    });
    mapping[field.key] = match ?? null;
  }
  return mapping;
}

/** Normalize external hire-status values to valid applicant status values. */
export function normalizeStatus(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === "active" || lower === "hired") return "hired";
  if (lower === "approved for hire" || lower === "offered" || lower === "offer") return "offered";
  if (lower === "inactive" || lower === "rejected" || lower === "terminated") return "rejected";
  if (lower === "withdrawn") return "withdrawn";
  if (lower === "reviewing") return "reviewing";
  if (lower === "interviewing" || lower === "interview") return "interviewing";
  return "applied";
}

/** Transform raw CSV rows into StaffImportRow[] using a user-confirmed column mapping. */
export function applyMapping(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string | null>,
): StaffImportRow[] {
  return rows.map((row) => {
    const get = (field: string): string => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx >= 0 ? (row[idx] ?? "").trim() : "";
    };
    const rawStatus = get("status");
    return {
      first_name: get("first_name"),
      last_name: get("last_name"),
      email: get("email"),
      phone: get("phone") || undefined,
      role: get("role") || "staff",
      title: get("title") || undefined,
      guard_card_number: get("guard_card_number") || undefined,
      status: rawStatus ? normalizeStatus(rawStatus) : undefined,
      nickname: get("nickname") || undefined,
      city: get("city") || undefined,
      shirt_size: get("shirt_size") || undefined,
      region: get("region") || undefined,
    };
  });
}

// ─── Staff import validation ─────────────────────────

export type StaffImportRow = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role?: string;
  title?: string;
  guard_card_number?: string;
  status?: string;
  nickname?: string;
  city?: string;
  shirt_size?: string;
  region?: string;
};

const VALID_ROLES = ["staff", "lead", "manager", "admin", "owner", "instructor", "breaker"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStaffRows(
  rawRows: Record<string, string>[],
): { valid: StaffImportRow[]; errors: { line: number; message: string }[] } {
  const valid: StaffImportRow[] = [];
  const errors: { line: number; message: string }[] = [];
  const seenEmails = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const line = i + 2; // +1 for header, +1 for 1-indexed

    if (!r.first_name?.trim()) { errors.push({ line, message: "Missing first_name" }); continue; }
    if (!r.last_name?.trim()) { errors.push({ line, message: "Missing last_name" }); continue; }
    if (!r.email?.trim() || !EMAIL_RE.test(r.email.trim())) { errors.push({ line, message: "Invalid or missing email" }); continue; }

    const email = r.email.trim().toLowerCase();
    if (seenEmails.has(email)) { errors.push({ line, message: `Duplicate email: ${email}` }); continue; }
    seenEmails.add(email);

    const role = (r.role?.trim().toLowerCase() || "staff");
    if (!VALID_ROLES.includes(role)) { errors.push({ line, message: `Invalid role "${r.role}" (use: ${VALID_ROLES.join(", ")})` }); continue; }

    valid.push({
      first_name: r.first_name.trim(),
      last_name: r.last_name.trim(),
      email,
      phone: r.phone?.trim() || undefined,
      role,
      title: r.title?.trim() || undefined,
      guard_card_number: r.guard_card_number?.trim() || undefined,
      status: r.status?.trim() || undefined,
      nickname: r.nickname?.trim() || undefined,
      city: r.city?.trim() || undefined,
      shirt_size: r.shirt_size?.trim() || undefined,
      region: r.region?.trim() || undefined,
    });
  }

  return { valid, errors };
}

// ─── Shift CSV import ────────────────────────────────

export const SHIFT_FIELDS = [
  { key: "date", label: "Date", required: true },
  { key: "start_time", label: "Start Time", required: true },
  { key: "end_time", label: "End Time", required: true },
  { key: "role", label: "Role / Position", required: false },
  { key: "staff_email", label: "Assigned Staff Email", required: false },
  { key: "staff_name", label: "Assigned Staff Name", required: false },
  { key: "notes", label: "Notes", required: false },
] as const;

export type ShiftImportRow = {
  date: string;
  start_time: string;
  end_time: string;
  role?: string;
  staff_email?: string;
  staff_name?: string;
  notes?: string;
};

const SHIFT_FIELD_ALIASES: Record<string, string[]> = {
  date: ["date", "shift date", "day"],
  start_time: ["start", "start time", "begin", "from", "clock in"],
  end_time: ["end", "end time", "finish", "to", "clock out"],
  role: ["role", "position", "post", "assignment"],
  staff_email: ["email", "staff email", "assigned email"],
  staff_name: ["name", "staff name", "assigned", "assignee"],
  notes: ["notes", "comments", "instructions"],
};

/** Suggest auto-mappings from CSV headers to shift fields via fuzzy matching. */
export function suggestShiftMapping(csvHeaders: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const field of SHIFT_FIELDS) {
    const normalized = field.key.toLowerCase().replace(/_/g, "");
    const aliases = SHIFT_FIELD_ALIASES[field.key] ?? [];

    const match = csvHeaders.find((h) => {
      const hn = h.toLowerCase().replace(/[_\s\-]/g, "");
      const hLower = h.toLowerCase().trim();
      if (hn === normalized) return true;
      for (const alias of aliases) {
        const an = alias.replace(/[_\s\-]/g, "");
        if (hn === an || hLower === alias) return true;
      }
      return false;
    });
    mapping[field.key] = match ?? null;
  }
  return mapping;
}

export function applyShiftMapping(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string | null>,
): ShiftImportRow[] {
  return rows.map((row) => {
    const get = (field: string) => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx >= 0 ? (row[idx] ?? "").trim() : "";
    };
    return {
      date: get("date"),
      start_time: get("start_time"),
      end_time: get("end_time"),
      role: get("role") || undefined,
      staff_email: get("staff_email") || undefined,
      staff_name: get("staff_name") || undefined,
      notes: get("notes") || undefined,
    };
  });
}

// ─── Date / time parsing ────────────────────────────────────────
// Permissive multi-format parser. Goal: accept whatever Excel coughed
// up without making the user reformat the sheet. Output is always the
// strict ISO form (YYYY-MM-DD and HH:MM:SS) so downstream code is
// unchanged.

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Two-digit year → 4-digit. Shifts are scheduled in this century. */
function expandYear(y: number): number {
  if (y >= 100) return y;
  // 0-99 → 2000-2099. (No edge case for 1990s — security companies
  // aren't scheduling shifts in the past century.)
  return 2000 + y;
}

interface ParsedYMD { year: number; month: number; day: number }

/**
 * Try to parse a date string. Returns a partial result that signals
 * either a concrete year/month/day OR a numeric triple that is still
 * ambiguous between M/D/Y and D/M/Y. The caller (parseDateRows) does
 * a second pass to resolve the ambiguity using context from other rows.
 */
type ParseAttempt =
  | { kind: "ok"; value: ParsedYMD }
  | { kind: "ambiguous_numeric"; a: number; b: number; year: number } // a/b/year — could be M/D or D/M
  | { kind: "year_first_numeric"; year: number; a: number; b: number } // year/a/b — unambiguous (a=month)
  | { kind: "invalid"; reason: string };

function tryParseDate(raw: string): ParseAttempt {
  const s = raw.trim();
  if (!s) return { kind: "invalid", reason: "empty" };

  // ISO "YYYY-MM-DD" or "YYYY-M-D" or "YYYY/MM/DD" or "YYYY.MM.DD"
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    return { kind: "year_first_numeric", year, a: month, b: day };
  }

  // Numeric M/D/Y or D/M/Y with any separator. Year may be 2 or 4 digits.
  const numeric = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (numeric) {
    const a = parseInt(numeric[1], 10);
    const b = parseInt(numeric[2], 10);
    const year = expandYear(parseInt(numeric[3], 10));
    return { kind: "ambiguous_numeric", a, b, year };
  }

  // Text month forms: "May 21, 2026" / "May 21 2026" / "21 May 2026"
  // / "21-May-2026" / "21 May, 2026". Order is determined by where
  // the month name appears.
  // Month-first: "Mon D[,] YYYY"
  const monthFirst = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (monthFirst) {
    const month = MONTH_NAMES[monthFirst[1].toLowerCase()];
    if (month) {
      return {
        kind: "ok",
        value: { year: expandYear(parseInt(monthFirst[3], 10)), month, day: parseInt(monthFirst[2], 10) },
      };
    }
  }
  // Day-first: "D Mon YYYY" or "D-Mon-YYYY"
  const dayFirst = s.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s,-]+(\d{2,4})$/);
  if (dayFirst) {
    const month = MONTH_NAMES[dayFirst[2].toLowerCase()];
    if (month) {
      return {
        kind: "ok",
        value: { year: expandYear(parseInt(dayFirst[3], 10)), month, day: parseInt(dayFirst[1], 10) },
      };
    }
  }

  return { kind: "invalid", reason: `unrecognized date format` };
}

/** Render a {y,m,d} as zero-padded ISO YYYY-MM-DD. */
function formatISODate(p: ParsedYMD): string {
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

/** Calendar validity check (catches Feb 30 et al). */
function isValidYMD(p: ParsedYMD): boolean {
  if (p.month < 1 || p.month > 12) return false;
  if (p.day < 1 || p.day > 31) return false;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return d.getUTCFullYear() === p.year && d.getUTCMonth() === p.month - 1 && d.getUTCDate() === p.day;
}

/**
 * Parse a time string. Accepts:
 *   "HH:MM"             24h         "09:30", "21:00"
 *   "HH:MM:SS"          24h+sec     "09:30:00"
 *   "H:MM"              24h         "9:30"  → 09:30
 *   "h:mm AM/PM"        12h         "9:30 AM"
 *   "h:mm:ss AM/PM"     12h+sec     "9:30:00 PM"
 *   "h AM/PM"           12h, no min "9 AM" → 09:00:00
 * Returns "HH:MM:SS" or null if unrecognized.
 */
function tryParseTime(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // 12-hour with explicit AM/PM
  const ampm = s.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*(am|pm|a\.m\.|p\.m\.)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const sec = ampm[3] ? parseInt(ampm[3], 10) : 0;
    const isPm = /^p/i.test(ampm[4]);
    if (h < 1 || h > 12 || m < 0 || m > 59 || sec < 0 || sec > 59) return null;
    if (h === 12) h = 0;
    if (isPm) h += 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  // 24-hour
  const h24 = s.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    const sec = h24[3] ? parseInt(h24[3], 10) : 0;
    if (h < 0 || h > 23 || m < 0 || m > 59 || sec < 0 || sec > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return null;
}

export type DateConvention = "MDY" | "DMY" | "iso";

export interface ValidateShiftRowsResult {
  valid: ShiftImportRow[];
  errors: { line: number; message: string }[];
  /**
   * Which interpretation the parser chose for ambiguous numeric dates
   * like "5/6/2026". `"iso"` means every row was already unambiguous.
   * The caller can show a banner so the user can sanity-check.
   */
  dateConvention: DateConvention;
  /** True if the dateConvention was guessed from a default rather than
   *  pinned by an unambiguous row (e.g. all rows like "5/6"). The UI
   *  should show a confirmation banner in this case. */
  conventionWasGuessed: boolean;
}

/**
 * Validate + normalize shift rows. Dates and times are returned in
 * strict ISO form (`YYYY-MM-DD`, `HH:MM:SS`) so downstream import code
 * doesn't need to know which input format the user provided.
 *
 * Ambiguity policy: if any unambiguous numeric date in the CSV pins
 * the convention (e.g. "5/21/2026" — must be M/D because 21 > 12),
 * apply that convention to the whole CSV. If every numeric date is
 * ambiguous (every D ≤ 12), default to M/D (US) and set
 * `conventionWasGuessed = true` so the UI can warn the user.
 */
export function validateShiftRows(rows: ShiftImportRow[]): ValidateShiftRowsResult {
  const valid: ShiftImportRow[] = [];
  const errors: { line: number; message: string }[] = [];

  // ─── Pass 1: parse, gather format hints ─────────────────────
  type RowParse = {
    line: number;
    raw: ShiftImportRow;
    date?: ParseAttempt;
    startTime?: string;
    endTime?: string;
    error?: string;
  };
  const parses: RowParse[] = rows.map((r, i) => {
    const line = i + 2; // +2 = header row + 1-indexed
    if (!r.date) return { line, raw: r, error: "Missing date" };
    if (!r.start_time) return { line, raw: r, error: "Missing start time" };
    if (!r.end_time) return { line, raw: r, error: "Missing end time" };

    const date = tryParseDate(r.date);
    if (date.kind === "invalid") {
      return {
        line,
        raw: r,
        error: `Date "${r.date}" — unrecognized format. Try YYYY-MM-DD (e.g. 2026-05-21), M/D/YYYY (5/21/2026), or "May 21, 2026".`,
      };
    }

    const startTime = tryParseTime(r.start_time);
    if (!startTime) {
      return {
        line,
        raw: r,
        error: `Start time "${r.start_time}" — unrecognized format. Try HH:MM (24-hour like 09:30 or 21:00) or h:mm AM/PM (like 9:30 AM).`,
      };
    }

    const endTime = tryParseTime(r.end_time);
    if (!endTime) {
      return {
        line,
        raw: r,
        error: `End time "${r.end_time}" — unrecognized format. Try HH:MM (24-hour like 17:00) or h:mm AM/PM (like 5:00 PM).`,
      };
    }

    return { line, raw: r, date, startTime, endTime };
  });

  // ─── Resolve the date convention from the parsed rows ──────
  // - "year_first_numeric" rows (ISO) are unambiguous → contribute nothing.
  // - "ambiguous_numeric" rows: if a > 12 → must be D/M; if b > 12 → must be M/D.
  //   If both ≤ 12, the row alone is ambiguous.
  let convention: DateConvention | null = null;
  let conventionPinnedByLine: number | null = null;
  for (const p of parses) {
    if (!p.date) continue;
    if (p.date.kind !== "ambiguous_numeric") continue;
    const { a, b } = p.date;
    if (a > 12 && b <= 12) {
      // first field can't be a month → must be D/M/Y
      if (convention === "MDY") {
        errors.push({
          line: p.line,
          message: `Date "${p.raw.date}" conflicts with row ${conventionPinnedByLine} which forced M/D/Y. Use YYYY-MM-DD for clarity.`,
        });
      } else if (convention === null) {
        convention = "DMY";
        conventionPinnedByLine = p.line;
      }
    } else if (b > 12 && a <= 12) {
      // second field can't be a month → must be M/D/Y
      if (convention === "DMY") {
        errors.push({
          line: p.line,
          message: `Date "${p.raw.date}" conflicts with row ${conventionPinnedByLine} which forced D/M/Y. Use YYYY-MM-DD for clarity.`,
        });
      } else if (convention === null) {
        convention = "MDY";
        conventionPinnedByLine = p.line;
      }
    }
  }
  let conventionWasGuessed = false;
  if (convention === null) {
    // Could be all-ISO (no ambiguous_numeric rows at all) or all-ambiguous.
    // Only call it "guessed" if there were ambiguous rows that needed it.
    const anyAmbiguous = parses.some(p => p.date?.kind === "ambiguous_numeric");
    convention = "MDY"; // US default
    conventionWasGuessed = anyAmbiguous;
  }

  // ─── Pass 2: finalize each row using the resolved convention ──
  for (const p of parses) {
    if (p.error) {
      errors.push({ line: p.line, message: p.error });
      continue;
    }
    if (!p.date || !p.startTime || !p.endTime) continue;

    let ymd: ParsedYMD;
    if (p.date.kind === "ok") {
      ymd = p.date.value;
    } else if (p.date.kind === "year_first_numeric") {
      // ISO-shape: year/month/day
      ymd = { year: p.date.year, month: p.date.a, day: p.date.b };
    } else if (p.date.kind === "ambiguous_numeric") {
      // Apply the CSV-wide resolved convention
      const { a, b, year } = p.date;
      if (convention === "MDY") ymd = { year, month: a, day: b };
      else ymd = { year, month: b, day: a };
    } else {
      // "invalid" — already pushed to errors in pass 1, but the
      // exhaustiveness check keeps TS happy.
      continue;
    }

    if (!isValidYMD(ymd)) {
      errors.push({
        line: p.line,
        message: `Date "${p.raw.date}" is not a real calendar date (got year ${ymd.year} month ${ymd.month} day ${ymd.day}).`,
      });
      continue;
    }

    const normDate = formatISODate(ymd);
    // Final sanity: combined date+time produces a real Date instance.
    if (isNaN(new Date(`${normDate}T${p.startTime}`).getTime())) {
      errors.push({ line: p.line, message: `Invalid start datetime: ${normDate} ${p.startTime}` });
      continue;
    }
    if (isNaN(new Date(`${normDate}T${p.endTime}`).getTime())) {
      errors.push({ line: p.line, message: `Invalid end datetime: ${normDate} ${p.endTime}` });
      continue;
    }

    valid.push({
      ...p.raw,
      date: normDate,
      start_time: p.startTime,
      end_time: p.endTime,
    });
  }

  return { valid, errors, dateConvention: convention, conventionWasGuessed };
}
