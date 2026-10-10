import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  CLASS_TYPES, OPS, READ_SELECTS, canManageLegacyCourses, certificateCodes, corsHeaders, isAllowed, nextProgress, nextTotalQuestions, normalizeQuestions,
  originAllowed, questionRows, rowsToQuestions, validateArgs,
} from "./lib.ts";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

Deno.test("Instructor HQ rule matches canManageLegacyCourses()", () => {
  assert(canManageLegacyCourses("instructor", true));
  assert(canManageLegacyCourses("admin", true));
  assert(canManageLegacyCourses("owner", true));
  assertFalse(canManageLegacyCourses("manager", true));
  assertFalse(canManageLegacyCourses("staff", true));
  assertFalse(canManageLegacyCourses("owner", false), "non training-provider company");
  assertFalse(canManageLegacyCourses(null, true));
});

Deno.test("permission levels", () => {
  assert(isAllowed("self", { role: null, isTrainingProvider: false }));
  assert(isAllowed("instructor_link", { role: "manager", isTrainingProvider: false }));
  assertFalse(isAllowed("instructor_link", { role: "staff", isTrainingProvider: true }));
  assertFalse(isAllowed("instructor", { role: "manager", isTrainingProvider: true }));
  assert(isAllowed("instructor", { role: "instructor", isTrainingProvider: true }));
});

Deno.test("every op targets one of the 10 tables or is a custom op", () => {
  const tables = new Set(["assessments", "certificates", "class_attendance", "class_enrollments", "courses",
    "instructors", "module_slides", "scheduled_classes", "students", "training_modules"]);
  for (const [name, spec] of Object.entries(OPS)) {
    if (spec.kind === "custom") continue;
    assert(tables.has(spec.table!), `${name} -> ${spec.table}`);
    if (spec.kind === "update" || spec.kind === "delete") assert(Object.keys(spec.keys ?? {}).length > 0, `${name} needs keys`);
  }
});

Deno.test("course.create validates columns and requires code + name", () => {
  const ok = validateArgs(OPS["course.create"], { values: { course_code: "C1", course_name: "Basics", price: 10, learning_objectives: ["a"] } });
  assert(ok.ok);
  assertEquals(validateArgs(OPS["course.create"], { values: { course_code: "C1" } }), { ok: false, error: "missing:course_name" });
  assertEquals(validateArgs(OPS["course.create"], { values: { course_code: "C1", course_name: "x", is_active: false } }),
    { ok: false, error: "unknown_column:is_active" }, "is_active is server-set on create");
  assertEquals(validateArgs(OPS["course.create"], { values: { course_code: "C1", course_name: "x", price: "free" } }),
    { ok: false, error: "invalid_value:price" });
});

Deno.test("updates need a uuid id and a non-empty patch; unknown columns are rejected", () => {
  assertEquals(validateArgs(OPS["course.update"], { keys: { id: "1 or 1=1" }, values: { course_name: "x" } }), { ok: false, error: "invalid_key:id" });
  assertEquals(validateArgs(OPS["course.update"], { keys: { id: U1 }, values: {} }), { ok: false, error: "empty_update" });
  assertEquals(validateArgs(OPS["course.update"], { keys: { id: U1 }, values: { id: U2 } }), { ok: false, error: "unknown_column:id" });
  assertEquals(validateArgs(OPS["course.update"], { keys: { id: U1, other: 1 }, values: { is_active: false } }), { ok: false, error: "unknown_key:other" });
  assert(validateArgs(OPS["course.update"], { keys: { id: U1 }, values: { is_active: false } }).ok);
});

Deno.test("slides, classes and attendance use the real EADB column names", () => {
  assert(validateArgs(OPS["slide.create"], { values: { module_id: U1, title: "T", slide_number: 1, content: "<p>x</p>", slide_type: "text" } }).ok);
  assertEquals(validateArgs(OPS["slide.update"], { keys: { id: U1 }, values: { content_html: "x" } }), { ok: false, error: "unknown_column:content_html" });
  assertEquals(validateArgs(OPS["slide.update"], { keys: { id: U1 }, values: { slide_type: "quiz" } }), { ok: false, error: "invalid_value:slide_type" });
  assert(validateArgs(OPS["class.create"], { values: { instructor_id: U1, class_name: "A", scheduled_date: "2026-10-10", start_time: "09:00", end_time: "17:00", capacity: 20 } }).ok);
  assertEquals(validateArgs(OPS["class.create"], { values: { instructor_id: U1, class_name: "A", scheduled_date: "10/10/2026", start_time: "09:00" } }),
    { ok: false, error: "invalid_value:scheduled_date" });
  assertEquals(validateArgs(OPS["class.update"], { keys: { id: U1 }, values: { status: "deleted" } }), { ok: false, error: "invalid_value:status" });
  assert(validateArgs(OPS["class.attendance"], { keys: { class_id: U1, student_id: U2 }, values: { attendance_status: "late" } }).ok);
  assertEquals(validateArgs(OPS["class.attendance"], { keys: { class_id: U1, student_id: U2 }, values: { attendance_status: "gone" } }),
    { ok: false, error: "invalid_value:attendance_status" });
});

Deno.test("certificate.issue does not accept issued_by or codes from the client", () => {
  for (const col of ["issued_by", "certificate_number", "verification_code", "status"]) {
    assertEquals(validateArgs(OPS["certificate.issue"], {
      values: { student_id: U1, certificate_type: "t", certificate_name: "n", [col]: "x" },
    }), { ok: false, error: `unknown_column:${col}` });
  }
  const c = certificateCodes(0, (n) => "A".repeat(n));
  assertEquals(c, { certificate_number: "EA-0-AAAAAA", verification_code: "V-AAAAAAAAAA" });
});

Deno.test("student.ensure / instructor.ensure accept only names (uid + email come from the session)", () => {
  assert(validateArgs(OPS["student.ensure"], { values: { first_name: "A", last_name: "B" } }).ok);
  assertEquals(validateArgs(OPS["student.ensure"], { values: { email: "x@y.z" } }), { ok: false, error: "unknown_column:email" });
  assertEquals(validateArgs(OPS["instructor.ensure"], { values: { id: U1 } }), { ok: false, error: "unknown_column:id" });
});

Deno.test("CORS only for the Overwatch origins", () => {
  assertEquals(corsHeaders("https://www.evenfalladvantage.com")["Access-Control-Allow-Origin"], "https://www.evenfalladvantage.com");
  assertEquals(corsHeaders("https://evil.example")["Access-Control-Allow-Origin"], undefined);
  assertFalse(originAllowed("https://evil.example"));
  assert(originAllowed("https://staging.example", "https://staging.example"));
  assert(originAllowed(null));
});

Deno.test("args must be plain objects", () => {
  assertEquals(validateArgs(OPS["slide.delete"], []), { ok: false, error: "args_must_be_object" });
  assertEquals(validateArgs(OPS["slide.delete"], { keys: [] }), { ok: false, error: "args_must_be_object" });
  assert(validateArgs(OPS["slide.delete"], { keys: { id: U1 } }).ok);
});

// ── 2026-10-06 Instructor HQ fixes ──────────────────────────────────────────

const Q = { question: "What is 2+2?", options: ["1", "2", "3", "4"], correctAnswer: 3, explanation: "basic" };

Deno.test("class.create accepts class_type, falls back to 'training', rejects unknown types", () => {
  const base = { instructor_id: U1, class_name: "Night shift", scheduled_date: "2026-10-20", start_time: "09:00", end_time: "11:00" };
  assert(validateArgs(OPS["class.create"], { values: base }).ok, "class_type optional (server fallback)");
  assertEquals(OPS["class.create"].fallbacks, { class_type: "training" });
  for (const t of CLASS_TYPES) assert(validateArgs(OPS["class.create"], { values: { ...base, class_type: t } }).ok, t);
  assertEquals(validateArgs(OPS["class.create"], { values: { ...base, class_type: "party" } }), { ok: false, error: "invalid_value:class_type" });
  assert(validateArgs(OPS["class.update"], { keys: { id: U1 }, values: { class_type: "review" } }).ok);
  const { end_time: _e, ...noEnd } = base;
  assertEquals(validateArgs(OPS["class.create"], { values: noEnd }), { ok: false, error: "missing:end_time" }, "end_time is NOT NULL too");
});

Deno.test("course.delete needs a uuid key and nothing else", () => {
  assertEquals(OPS["course.delete"].kind, "custom");
  assert(validateArgs(OPS["course.delete"], { keys: { id: U1 } }).ok);
  assertEquals(validateArgs(OPS["course.delete"], { keys: {} }), { ok: false, error: "invalid_key:id" });
  assertEquals(validateArgs(OPS["course.delete"], { keys: { id: U1 }, values: { is_active: false } }), { ok: false, error: "unknown_column:is_active" });
});

Deno.test("assessment.delete needs a uuid key and nothing else", () => {
  assertEquals(OPS["assessment.delete"].kind, "custom");
  assertEquals(OPS["assessment.delete"].permission, "instructor");
  assert(validateArgs(OPS["assessment.delete"], { keys: { id: U1 } }).ok);
  assertEquals(validateArgs(OPS["assessment.delete"], { keys: { id: "x" } }), { ok: false, error: "invalid_key:id" });
  assertEquals(validateArgs(OPS["assessment.delete"], { keys: { id: U1, module_id: U2 } }), { ok: false, error: "unknown_key:module_id" });
  assertEquals(validateArgs(OPS["assessment.delete"], { keys: { id: U1 }, values: { assessment_name: "x" } }),
    { ok: false, error: "unknown_column:assessment_name" });
});

Deno.test("assessment.set_questions validates the quiz", () => {
  const ok = validateArgs(OPS["assessment.set_questions"], { keys: { id: U1 }, values: { questions: [Q] } });
  assert(ok.ok);
  if (ok.ok) assertEquals(ok.values.questions, [Q]);
  const bad = (questions: unknown) => validateArgs(OPS["assessment.set_questions"], { keys: { id: U1 }, values: { questions } });
  assertEquals(bad([]), { ok: false, error: "invalid_value:questions" }, "at least one question");
  assertEquals(bad([{ ...Q, options: ["a", "b", "c"] }]), { ok: false, error: "invalid_value:questions" }, "exactly 4 options");
  assertEquals(bad([{ ...Q, options: ["a", "b", "c", " "] }]), { ok: false, error: "invalid_value:questions" }, "no blank option");
  assertEquals(bad([{ ...Q, correctAnswer: 4 }]), { ok: false, error: "invalid_value:questions" });
  assertEquals(bad([{ ...Q, question: "" }]), { ok: false, error: "invalid_value:questions" });
  assertEquals(bad(Array(201).fill(Q)), { ok: false, error: "invalid_value:questions" });
  assertEquals(validateArgs(OPS["assessment.set_questions"], { keys: { id: U1 }, values: {} }), { ok: false, error: "missing:questions" });
  assertEquals(validateArgs(OPS["assessment.get_questions"], { keys: { id: "nope" } }), { ok: false, error: "invalid_key:id" });
});

Deno.test("questions <-> assessment_questions rows round-trip", () => {
  const qs = normalizeQuestions([Q, { question: " Q2 ", options: ["a", "b", "c", "d"], correctAnswer: 0 }])!;
  assertEquals(qs[1].question, "Q2");
  const rows = questionRows(U2, qs);
  assertEquals(rows[0], { assessment_id: U2, question_number: 1, question_text: "What is 2+2?", option_a: "1", option_b: "2",
    option_c: "3", option_d: "4", correct_answer: "D", explanation: "basic" });
  assertEquals(rows[1].correct_answer, "A");
  assertEquals(rows[1].explanation, null);
  assertEquals(rowsToQuestions([...rows].reverse()), qs, "sorted by question_number");
});

Deno.test("total_questions keeps the per-attempt count unless the bank shrank below it", () => {
  assertEquals(nextTotalQuestions(15, 20), 15);
  assertEquals(nextTotalQuestions(10, 5), 5);
  assertEquals(nextTotalQuestions(0, 7), 7);
  assertEquals(nextTotalQuestions(null, 7), 7);
});

Deno.test("progress.save: own progress only, module uuid + percent required, no student_id from the client", () => {
  const spec = OPS["progress.save"];
  assertEquals(spec.permission, "self");
  assert(validateArgs(spec, { keys: { module_id: "11111111-1111-4111-8111-111111111111" }, values: { progress_percentage: 40, current_slide: 3 } }).ok);
  assert(!validateArgs(spec, { keys: { module_id: "nope" }, values: { progress_percentage: 40 } }).ok);
  assert(!validateArgs(spec, { keys: { module_id: "11111111-1111-4111-8111-111111111111" }, values: {} }).ok);
  assert(!validateArgs(spec, { keys: { module_id: "11111111-1111-4111-8111-111111111111" }, values: { progress_percentage: 40, student_id: "x" } }).ok);
});

Deno.test("nextProgress clamps, completes at 100 and never un-completes", () => {
  const now = "2026-10-10T00:00:00.000Z";
  assertEquals(nextProgress(null, 140, 2, now), { status: "completed", progress_percentage: 100, current_slide: 2, completed_at: now });
  assertEquals(nextProgress(null, -5, null, now), { status: "in_progress", progress_percentage: 0, completed_at: null });
  assertEquals(nextProgress(null, 42.4, 1, now).progress_percentage, 42);
  const done = { status: "completed", progress_percentage: 100, completed_at: "2026-01-01T00:00:00.000Z" };
  assertEquals(nextProgress(done, 10, 1, now), { status: "completed", progress_percentage: 100, current_slide: 1, completed_at: "2026-01-01T00:00:00.000Z" });
});

Deno.test("read ops: me.* take no ids from the client; instructor reads need valid keys", () => {
  for (const op of ["me.student", "me.enrollments", "me.progress", "me.results", "me.certificates"]) {
    const spec = OPS[op];
    assertEquals(spec.permission, "self", op);
    assert(spec.read, op);
    assertEquals(spec.keys, undefined, op);
    assertEquals(spec.columns, undefined, op);
    assert(!validateArgs(spec, { values: { student_id: U1 } }).ok, `${op} must reject a client student_id`);
  }
  for (const op of ["students.list", "student.progress", "classes.list", "class.enrollments.list", "class.attendance.list"]) {
    assertEquals(OPS[op].permission, "instructor", op);
    assert(OPS[op].read, op);
  }
  assert(validateArgs(OPS["student.progress"], { keys: { student_id: U1 } }).ok);
  assert(!validateArgs(OPS["student.progress"], { keys: { student_id: "x" } }).ok);
  assert(validateArgs(OPS["classes.list"], { values: { instructor_id: U1, from_date: "2026-10-10" } }).ok);
  assert(!validateArgs(OPS["classes.list"], { values: { from_date: "tomorrow" } }).ok);
  assert(validateArgs(OPS["class.attendance.list"], { keys: { class_id: U2 } }).ok);
});

Deno.test("read selects never come from the client and stay on the expected tables", () => {
  for (const sel of Object.values(READ_SELECTS)) assert(!/[;]|--/.test(sel));
  assert(READ_SELECTS.classEnrollments.includes("student:students (first_name, last_name, email)"));
});
