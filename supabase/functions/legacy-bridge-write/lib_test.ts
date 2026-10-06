import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { OPS, canManageLegacyCourses, certificateCodes, corsHeaders, isAllowed, originAllowed, validateArgs } from "./lib.ts";

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
  assert(validateArgs(OPS["class.create"], { values: { instructor_id: U1, class_name: "A", scheduled_date: "2026-10-10", start_time: "09:00", capacity: 20 } }).ok);
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
