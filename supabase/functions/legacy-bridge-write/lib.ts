/**
 * Pure logic for legacy-bridge-write (no network / Deno APIs, unit-tested in
 * lib_test.ts).
 */

export type Permission = "self" | "instructor_link" | "instructor";

/** Overwatch role ranks; must match public.role_rank() and src/lib/permissions.ts. */
export const ROLE_RANK: Record<string, number> = {
  owner: 60, admin: 50, instructor: 45, manager: 40, lead: 30, breaker: 20, staff: 10, client: 5,
};
export const rank = (role: string | null | undefined) => (role ? ROLE_RANK[role] ?? 0 : 0);

/** Instructor HQ rule: training-provider company AND (instructor OR admin+). Same as canManageLegacyCourses(). */
export function canManageLegacyCourses(role: string | null, isTrainingProvider: boolean): boolean {
  if (!isTrainingProvider || !role) return false;
  return role === "instructor" || rank(role) >= rank("admin");
}

/** autoLinkByRole() links an instructor record for these roles. */
export function canLinkInstructor(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "instructor" || role === "manager";
}

type ColumnKind = "text" | "longtext" | "int" | "num" | "bool" | "date" | "time" | "uuid" | "text[]" | "uuid?";
type Columns = Record<string, ColumnKind>;

export interface OpSpec {
  permission: Permission;
  table?: string;
  kind: "insert" | "update" | "delete" | "upsert" | "custom";
  /** Columns accepted from the client for insert/upsert values or update patches. */
  columns?: Columns;
  /** Required columns for insert. */
  required?: string[];
  /** Key fields identifying the row(s) for update/delete/upsert. */
  keys?: Columns;
  /** Server-set values merged into inserts. */
  defaults?: Record<string, unknown>;
  onConflict?: string;
  returnId?: boolean;
}

const COURSE_COLS: Columns = {
  course_code: "text", course_name: "text", description: "longtext", short_description: "text",
  price: "num", duration_hours: "num", difficulty_level: "text", target_audience: "text",
  learning_objectives: "text[]",
};
const MODULE_COLS: Columns = {
  module_code: "text", module_name: "text", description: "longtext", difficulty_level: "text",
  duration_minutes: "int", default_course_id: "uuid",
};
const SLIDE_COLS: Columns = {
  title: "text", content: "longtext", slide_number: "int", slide_type: "text", image_url: "text",
};
const CLASS_COLS: Columns = {
  class_name: "text", description: "longtext", scheduled_date: "date", start_time: "time",
  end_time: "time", location: "text", capacity: "int",
};
const ASSESSMENT_COLS: Columns = {
  assessment_name: "text", module_id: "uuid?", total_questions: "int", passing_score: "num",
};

/**
 * Column names are the REAL EADB columns (checked against the live schema on
 * 2026-10-06): module_slides.content, scheduled_classes.capacity,
 * class_attendance.attendance_status. The Overwatch client maps its older
 * names (content_html, max_students, status) before calling.
 *
 * Every write the Overwatch legacy bridge makes to the 10 EADB tables whose
 * anon write policies migrations/eadb/20261006120500 removes. Nothing else is
 * reachable through this function.
 */
export const OPS: Record<string, OpSpec> = {
  "course.create": { permission: "instructor", table: "courses", kind: "insert", columns: COURSE_COLS,
    required: ["course_code", "course_name"], defaults: { is_active: true, is_featured: false, display_order: 999 }, returnId: true },
  "course.update": { permission: "instructor", table: "courses", kind: "update", keys: { id: "uuid" },
    columns: { ...COURSE_COLS, is_active: "bool", is_featured: "bool", display_order: "int" } },

  "module.create": { permission: "instructor", table: "training_modules", kind: "insert", columns: MODULE_COLS,
    required: ["module_code", "module_name"], defaults: { is_active: true, display_order: 999 }, returnId: true },
  "module.update": { permission: "instructor", table: "training_modules", kind: "update", keys: { id: "uuid" },
    columns: { module_name: "text", description: "longtext", difficulty_level: "text", duration_minutes: "int", is_active: "bool", display_order: "int" } },

  "slide.create": { permission: "instructor", table: "module_slides", kind: "insert",
    columns: { module_id: "uuid", ...SLIDE_COLS }, required: ["module_id", "title", "slide_number"], returnId: true },
  "slide.update": { permission: "instructor", table: "module_slides", kind: "update", keys: { id: "uuid" }, columns: SLIDE_COLS },
  "slide.delete": { permission: "instructor", table: "module_slides", kind: "delete", keys: { id: "uuid" } },

  "class.create": { permission: "instructor", table: "scheduled_classes", kind: "insert",
    columns: { instructor_id: "uuid", ...CLASS_COLS }, required: ["instructor_id", "class_name", "scheduled_date", "start_time"],
    defaults: { status: "scheduled" }, returnId: true },
  "class.update": { permission: "instructor", table: "scheduled_classes", kind: "update", keys: { id: "uuid" },
    columns: { ...CLASS_COLS, status: "text" } },
  "class.enroll": { permission: "instructor", table: "class_enrollments", kind: "upsert",
    keys: { class_id: "uuid", student_id: "uuid" }, defaults: { enrollment_status: "enrolled" }, onConflict: "class_id,student_id" },
  "class.unenroll": { permission: "instructor", table: "class_enrollments", kind: "delete",
    keys: { class_id: "uuid", student_id: "uuid" } },
  "class.attendance": { permission: "instructor", table: "class_attendance", kind: "upsert",
    keys: { class_id: "uuid", student_id: "uuid" }, columns: { attendance_status: "text", notes: "longtext" },
    required: ["attendance_status"], onConflict: "class_id,student_id" },

  "assessment.create": { permission: "instructor", table: "assessments", kind: "insert", columns: ASSESSMENT_COLS,
    required: ["assessment_name", "total_questions", "passing_score"], returnId: true },
  "assessment.update": { permission: "instructor", table: "assessments", kind: "update", keys: { id: "uuid" }, columns: ASSESSMENT_COLS },

  // Custom ops (handled in index.ts):
  "certificate.issue": { permission: "instructor", kind: "custom",
    columns: { student_id: "uuid", certificate_type: "text", certificate_name: "text", state_issued: "text", expiration_date: "date" },
    required: ["student_id", "certificate_type", "certificate_name"] },
  "instructor.ensure": { permission: "instructor_link", kind: "custom", columns: { first_name: "text", last_name: "text" } },
  "student.ensure": { permission: "self", kind: "custom", columns: { first_name: "text", last_name: "text" } },
};

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"];
export const SLIDE_TYPES = ["text", "image", "video", "mixed"];
export const CLASS_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
// deno-lint-ignore no-control-regex
const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

function coerce(kind: ColumnKind, v: unknown): { ok: true; value: unknown } | { ok: false } {
  if (v === null) return kind === "uuid?" || kind === "longtext" || kind === "text" ? { ok: true, value: null } : { ok: false };
  switch (kind) {
    case "text":
      return typeof v === "string" && v.length <= 500 ? { ok: true, value: v.replace(CTRL_RE, "") } : { ok: false };
    case "longtext":
      return typeof v === "string" && v.length <= 200_000 ? { ok: true, value: v.replace(CTRL_RE, "") } : { ok: false };
    case "int":
      return typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= 1_000_000 ? { ok: true, value: v } : { ok: false };
    case "num":
      return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 10_000_000 ? { ok: true, value: v } : { ok: false };
    case "bool":
      return typeof v === "boolean" ? { ok: true, value: v } : { ok: false };
    case "date":
      return typeof v === "string" && DATE_RE.test(v) ? { ok: true, value: v } : { ok: false };
    case "time":
      return typeof v === "string" && TIME_RE.test(v) ? { ok: true, value: v } : { ok: false };
    case "uuid":
    case "uuid?":
      return isUuid(v) ? { ok: true, value: v } : { ok: false };
    case "text[]":
      return Array.isArray(v) && v.length <= 50 && v.every((x) => typeof x === "string" && x.length <= 500)
        ? { ok: true, value: v.map((x) => (x as string).replace(CTRL_RE, "")) } : { ok: false };
  }
}

export type Validated =
  | { ok: true; keys: Record<string, unknown>; values: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Validate the client args for an op: `args.keys` (row identity) and
 * `args.values` (insert values / update patch). Unknown columns are rejected
 * (not silently dropped) so client/server drift is visible.
 */
export function validateArgs(spec: OpSpec, args: unknown): Validated {
  if (!args || typeof args !== "object" || Array.isArray(args)) return { ok: false, error: "args_must_be_object" };
  const a = args as { keys?: unknown; values?: unknown };
  const keysIn = (a.keys ?? {}) as Record<string, unknown>;
  const valuesIn = (a.values ?? {}) as Record<string, unknown>;
  if (typeof keysIn !== "object" || Array.isArray(keysIn) || typeof valuesIn !== "object" || Array.isArray(valuesIn)) {
    return { ok: false, error: "args_must_be_object" };
  }
  const keys: Record<string, unknown> = {};
  for (const [k, kind] of Object.entries(spec.keys ?? {})) {
    const c = coerce(kind, keysIn[k]);
    if (!c.ok || c.value === null) return { ok: false, error: `invalid_key:${k}` };
    keys[k] = c.value;
  }
  for (const k of Object.keys(keysIn)) if (!(spec.keys ?? {})[k]) return { ok: false, error: `unknown_key:${k}` };

  const values: Record<string, unknown> = {};
  const cols = spec.columns ?? {};
  for (const [k, v] of Object.entries(valuesIn)) {
    if (!Object.prototype.hasOwnProperty.call(cols, k)) return { ok: false, error: `unknown_column:${k}` };
    if (v === undefined) continue;
    const c = coerce(cols[k], v);
    if (!c.ok) return { ok: false, error: `invalid_value:${k}` };
    values[k] = c.value;
  }
  for (const r of spec.required ?? []) {
    if (values[r] === undefined || values[r] === null || values[r] === "") return { ok: false, error: `missing:${r}` };
  }
  if (spec.kind === "update" && Object.keys(values).length === 0) return { ok: false, error: "empty_update" };
  if (spec.table === "class_attendance" && !ATTENDANCE_STATUSES.includes(values.attendance_status as string)) {
    return { ok: false, error: "invalid_value:attendance_status" };
  }
  if (spec.table === "module_slides" && values.slide_type !== undefined && !SLIDE_TYPES.includes(values.slide_type as string)) {
    return { ok: false, error: "invalid_value:slide_type" };
  }
  if (spec.table === "scheduled_classes" && values.status !== undefined && !CLASS_STATUSES.includes(values.status as string)) {
    return { ok: false, error: "invalid_value:status" };
  }
  return { ok: true, keys, values };
}

/** Is this caller allowed to run an op with the given permission level? */
export function isAllowed(
  permission: Permission,
  ctx: { role: string | null; isTrainingProvider: boolean },
): boolean {
  if (permission === "self") return true; // any verified Overwatch user, acting on their own uid/email
  if (permission === "instructor_link") return canLinkInstructor(ctx.role);
  return canManageLegacyCourses(ctx.role, ctx.isTrainingProvider);
}

const DEFAULT_ORIGINS = [
  "https://www.evenfalladvantage.com",
  "https://evenfalladvantage.com",
  "http://localhost:3000",
];

export function corsHeaders(origin: string | null, extra?: string | null): Record<string, string> {
  const allowed = [...DEFAULT_ORIGINS, ...(extra ?? "").split(",").map((s) => s.trim()).filter(Boolean)];
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-overwatch-company",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export function originAllowed(origin: string | null, extra?: string | null): boolean {
  if (!origin) return true; // non-browser callers still need a valid Overwatch session
  return !!corsHeaders(origin, extra)["Access-Control-Allow-Origin"];
}

/** Random, unguessable certificate number / verification code (server side). */
export function certificateCodes(now = Date.now(), rand: (n: number) => string = randomAlnum) {
  return {
    certificate_number: `EA-${now.toString(36).toUpperCase()}-${rand(6)}`,
    verification_code: `V-${rand(10)}`,
  };
}

export function randomAlnum(n: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
