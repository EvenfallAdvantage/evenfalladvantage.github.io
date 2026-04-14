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

const FIELD_ALIASES: Record<string, string[]> = {
  first_name: ["first", "legal name", "fname", "given"],
  last_name: ["last", "legal last", "lname", "surname", "family"],
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
      // Exact key match (stripped)
      if (hn === normalized) return true;
      // Substring match
      if (hn.includes(normalized) || normalized.includes(hn)) return true;
      // Alias match (compare against lowercased header with original spacing)
      for (const alias of aliases) {
        const an = alias.replace(/[_\s\-]/g, "");
        if (hn === an || hn.includes(an) || hLower === alias) return true;
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
  if (lower === "approved for hire" || lower === "offer") return "offer";
  if (lower === "inactive" || lower === "rejected" || lower === "terminated") return "rejected";
  if (lower === "reviewing" || lower === "interview") return lower;
  return "new";
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
