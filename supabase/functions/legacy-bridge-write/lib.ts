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

type ColumnKind = "text" | "longtext" | "int" | "num" | "bool" | "date" | "time" | "uuid" | "text[]" | "uuid?" | "questions";
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
  /** Server-set values merged into inserts (override client values). */
  defaults?: Record<string, unknown>;
  /** Insert values used only when the client didn't send that column. */
  fallbacks?: Record<string, unknown>;
  onConflict?: string;
  returnId?: boolean;
  /** Read-only op (returns data, writes nothing). */
  read?: boolean;
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
  class_name: "text", class_type: "text", description: "longtext", scheduled_date: "date", start_time: "time",
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
 * anon write policies migrations/eadb/20261006120500 removes, plus the
 * caller's own student_module_progress (progress.save), plus the read ops
 * below. Nothing else is reachable through this function.
 */
export const OPS: Record<string, OpSpec> = {
  "course.create": { permission: "instructor", table: "courses", kind: "insert", columns: COURSE_COLS,
    required: ["course_code", "course_name"], defaults: { is_active: true, is_featured: false, display_order: 999 }, returnId: true },
  "course.update": { permission: "instructor", table: "courses", kind: "update", keys: { id: "uuid" },
    columns: { ...COURSE_COLS, is_active: "bool", is_featured: "bool", display_order: "int" } },
  // Custom (index.ts): refuses with 409 course_in_use while students, payments or
  // reviews reference the course (their FKs would cascade / null out); otherwise
  // deletes it. course_modules links and completion requirements cascade.
  "course.delete": { permission: "instructor", table: "courses", kind: "custom", keys: { id: "uuid" } },

  "module.create": { permission: "instructor", table: "training_modules", kind: "insert", columns: MODULE_COLS,
    required: ["module_code", "module_name"], defaults: { is_active: true, display_order: 999 }, returnId: true },
  "module.update": { permission: "instructor", table: "training_modules", kind: "update", keys: { id: "uuid" },
    columns: { module_name: "text", description: "longtext", difficulty_level: "text", duration_minutes: "int", is_active: "bool", display_order: "int" } },

  "slide.create": { permission: "instructor", table: "module_slides", kind: "insert",
    columns: { module_id: "uuid", ...SLIDE_COLS }, required: ["module_id", "title", "slide_number"], returnId: true },
  "slide.update": { permission: "instructor", table: "module_slides", kind: "update", keys: { id: "uuid" }, columns: SLIDE_COLS },
  "slide.delete": { permission: "instructor", table: "module_slides", kind: "delete", keys: { id: "uuid" } },

  "class.create": { permission: "instructor", table: "scheduled_classes", kind: "insert",
    columns: { instructor_id: "uuid", ...CLASS_COLS }, required: ["instructor_id", "class_name", "scheduled_date", "start_time", "end_time"],
    // scheduled_classes.class_type is NOT NULL with no default (23502 otherwise).
    defaults: { status: "scheduled" }, fallbacks: { class_type: "training" }, returnId: true },
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
  // Custom (index.ts). Questions live in TWO places in EADB: the student portal
  // reads assessment_questions rows (option_a..d, correct_answer A-D); the static
  // admin editor reads/writes assessments.questions_json. set_questions writes
  // both so every reader sees the same quiz; get_questions prefers the rows
  // (anon can't read assessment_questions, so this goes through the bridge).
  "assessment.set_questions": { permission: "instructor", table: "assessments", kind: "custom", keys: { id: "uuid" },
    columns: { questions: "questions" }, required: ["questions"] },
  "assessment.get_questions": { permission: "instructor", table: "assessments", kind: "custom", keys: { id: "uuid" } },
  // Custom (index.ts): refuses with 409 assessment_in_use while any student has a
  // result for it (assessment_results would cascade away). Otherwise deletes its
  // assessment_questions rows and the assessment (questions_json goes with it).
  "assessment.delete": { permission: "instructor", table: "assessments", kind: "custom", keys: { id: "uuid" } },

  // Custom ops (handled in index.ts):
  "certificate.issue": { permission: "instructor", kind: "custom",
    columns: { student_id: "uuid", certificate_type: "text", certificate_name: "text", state_issued: "text", expiration_date: "date" },
    required: ["student_id", "certificate_type", "certificate_name"] },
  "instructor.ensure": { permission: "instructor_link", kind: "custom", columns: { first_name: "text", last_name: "text" } },
  "student.ensure": { permission: "self", kind: "custom", columns: { first_name: "text", last_name: "text" } },
  // Custom (index.ts): the caller's OWN module progress (training viewer). The
  // student row is resolved from the session (uid, then email), never the client.
  "progress.save": { permission: "self", table: "student_module_progress", kind: "custom", keys: { module_id: "uuid" },
    columns: { progress_percentage: "num", current_slide: "int" }, required: ["progress_percentage"] },

  // ---- Reads (custom, index.ts). EADB per-person tables are not readable with
  // the anon key once migrations/eadb/20261010180000 is applied, so Overwatch
  // reads them here. "me.*" = the caller's OWN student record only (resolved
  // from the session; no client-supplied id). The rest = Instructor HQ.
  "me.student": { permission: "self", kind: "custom", read: true },
  "me.enrollments": { permission: "self", kind: "custom", read: true },
  "me.progress": { permission: "self", kind: "custom", read: true },
  "me.results": { permission: "self", kind: "custom", read: true },
  "me.certificates": { permission: "self", kind: "custom", read: true },
  "students.list": { permission: "instructor", kind: "custom", read: true },
  "student.progress": { permission: "instructor", kind: "custom", read: true, keys: { student_id: "uuid" } },
  "classes.list": { permission: "instructor", kind: "custom", read: true,
    columns: { instructor_id: "uuid", from_date: "date" } },
  "class.enrollments.list": { permission: "instructor", kind: "custom", read: true, keys: { class_id: "uuid" } },
  "class.attendance.list": { permission: "instructor", kind: "custom", read: true, keys: { class_id: "uuid" } },
};

/** PostgREST select lists for the read ops (fixed server-side; never from the client). */
export const READ_SELECTS = {
  student: "id, email, first_name, last_name, created_at",
  enrollments: "*, courses (*)",
  progress: "*, training_modules (module_name, module_code, description)",
  results: "*, assessments (assessment_name, module_id, total_questions, passing_score)",
  certificates: "*",
  studentsList: "*, student_profiles (*)",
  classes: "*, instructor:instructors (first_name, last_name, email), enrollments:class_enrollments (count)",
  classEnrollments: "student_id, enrollment_status, student:students (first_name, last_name, email)",
  classAttendance: "student_id, attendance_status, notes, created_at, student:students (first_name, last_name, email)",
} as const;

/**
 * Next student_module_progress values. Percent is clamped to 0..100 and a
 * completed module never goes back to in_progress (re-watching keeps it done).
 */
export function nextProgress(
  existing: { status?: string | null; progress_percentage?: number | null; completed_at?: string | null } | null,
  pct: number,
  currentSlide: number | null,
  now: string,
): { status: "in_progress" | "completed"; progress_percentage: number; current_slide?: number; completed_at: string | null } {
  const p = Math.max(0, Math.min(100, Math.round(Number.isFinite(pct) ? pct : 0)));
  const wasDone = existing?.status === "completed";
  const done = wasDone || p === 100;
  return {
    status: done ? "completed" : "in_progress",
    progress_percentage: done ? 100 : p,
    ...(currentSlide !== null && Number.isInteger(currentSlide) && currentSlide >= 0 ? { current_slide: currentSlide } : {}),
    completed_at: done ? (wasDone && existing?.completed_at ? existing.completed_at : now) : null,
  };
}

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"];
export const SLIDE_TYPES = ["text", "image", "video", "mixed"];
export const CLASS_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"];
/** Same values as the static instructor portal's Class Type select. */
export const CLASS_TYPES = ["training", "review", "scenario", "proctored_exam"];

export const MAX_QUESTIONS = 200;
export type Question = { question: string; options: [string, string, string, string]; correctAnswer: number; explanation?: string };
const LETTERS = ["A", "B", "C", "D"];

/**
 * Validate + normalize a quiz: 1..200 questions, each with question text, exactly
 * 4 non-empty options and correctAnswer 0-3 (the questions_json shape the static
 * admin editor already uses). Returns null if anything is off.
 */
export function normalizeQuestions(v: unknown): Question[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_QUESTIONS) return null;
  const out: Question[] = [];
  for (const q of v) {
    if (!q || typeof q !== "object") return null;
    const { question, options, correctAnswer, explanation } = q as Record<string, unknown>;
    if (typeof question !== "string" || !question.trim() || question.length > 2000) return null;
    if (!Array.isArray(options) || options.length !== 4) return null;
    if (!options.every((o) => typeof o === "string" && o.trim() && o.length <= 1000)) return null;
    if (typeof correctAnswer !== "number" || !Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) return null;
    if (explanation !== undefined && explanation !== null && (typeof explanation !== "string" || explanation.length > 4000)) return null;
    const clean = (s: string) => s.replace(CTRL_RE, "").trim();
    const item: Question = {
      question: clean(question), options: (options as string[]).map(clean) as Question["options"], correctAnswer,
    };
    if (typeof explanation === "string" && explanation.trim()) item.explanation = clean(explanation);
    out.push(item);
  }
  return out;
}

/** questions -> assessment_questions rows (question_number 1..n). */
export function questionRows(assessmentId: string, qs: Question[]) {
  return qs.map((q, i) => ({
    assessment_id: assessmentId, question_number: i + 1, question_text: q.question,
    option_a: q.options[0], option_b: q.options[1], option_c: q.options[2], option_d: q.options[3],
    correct_answer: LETTERS[q.correctAnswer], explanation: q.explanation ?? null,
  }));
}

/** assessment_questions rows -> questions (ordered by question_number). */
export function rowsToQuestions(rows: Array<Record<string, unknown>>): Question[] {
  return [...rows]
    .sort((a, b) => Number(a.question_number) - Number(b.question_number))
    .map((r) => {
      const q: Question = {
        question: String(r.question_text ?? ""),
        options: [r.option_a, r.option_b, r.option_c, r.option_d].map((o) => String(o ?? "")) as Question["options"],
        correctAnswer: Math.max(0, LETTERS.indexOf(String(r.correct_answer ?? "A"))),
      };
      if (typeof r.explanation === "string" && r.explanation) q.explanation = r.explanation;
      return q;
    });
}

/** Keep the instructor's "questions per attempt" unless it exceeds the new bank size. */
export function nextTotalQuestions(current: number | null | undefined, count: number): number {
  return current && current > 0 && current <= count ? current : count;
}

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
    case "questions": {
      const qs = normalizeQuestions(v);
      return qs ? { ok: true, value: qs } : { ok: false };
    }
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
  if (spec.table === "scheduled_classes" && values.class_type !== undefined && !CLASS_TYPES.includes(values.class_type as string)) {
    return { ok: false, error: "invalid_value:class_type" };
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
