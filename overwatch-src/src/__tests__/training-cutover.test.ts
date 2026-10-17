import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// EADB retirement, phase 6: the training layer reads/writes OverwatchDB (no EADB client,
// no legacy-bridge-write), quizzes are graded on the server, and answers never reach learners.

const { client, queryBuilder, setMockResponse } = createMockSupabase();
const COMPANY = "0f03bc15-aa8d-4bd3-956f-90bdd7904091";
let activeCompanyId: string | null = COMPANY;

vi.mock("@/lib/supabase/client", () => ({ createClient: () => client }));
vi.mock("@/stores/auth-store", () => ({ useAuthStore: { getState: () => ({ activeCompanyId }) } }));
vi.mock("@/lib/supabase/db-helpers", () => ({
  ensureInternalUser: async () => "u-1",
  ts: () => ({ created_at: "2026-10-17T00:00:00Z", updated_at: "2026-10-17T00:00:00Z" }),
}));

import {
  getLegacyCourses, createLegacyCourse, updateLegacyCourse, deleteLegacyCourse,
  getLegacySlides, createLegacySlide, toSlideRow, createLegacyModule,
  createLegacyClass, toClassRow, enrollStudentInClass, markAttendance, getClassEnrollments,
  getLegacyStudents, issueLegacyCertificate, getLegacyAssessments, createLegacyAssessment,
  getLegacyAssessmentQuestions, saveLegacyAssessmentQuestions, validateLegacyQuestions, toServerQuestions,
  deleteLegacyAssessment, errorCode, trainingWriteErrorMessage, gradeQuiz,
} from "@/lib/training";
import { getQuizzes, createQuiz, deleteQuiz, bankAnswerLetter } from "@/lib/supabase/db-training";

const rpc = client.rpc as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  activeCompanyId = COMPANY;
  setMockResponse({ data: [], error: null });
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null, status: 200 }));
});

describe("no EADB / bridge left in the app", () => {
  it("the training layer only talks to the Overwatch client", async () => {
    const mod = await import("@/lib/training");
    expect(Object.keys(mod)).not.toContain("getLegacyClient");
    expect(Object.keys(mod)).not.toContain("legacyBridgeWrite");
  });
});

describe("courses", () => {
  it("are scoped to the active company and mapped to the UI shape", async () => {
    setMockResponse({ data: [{ id: "c1", title: "Unarmed Guard Core", course_name: null, price: "50.00", is_active: true }], error: null });
    const rows = await getLegacyCourses();
    expect(client.from).toHaveBeenCalledWith("courses");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", COMPANY);
    expect(queryBuilder.eq).toHaveBeenCalledWith("is_active", true);
    expect(rows[0]).toMatchObject({ id: "c1", course_name: "Unarmed Guard Core", price: 50, course_code: "" });
  });

  it("return nothing without an active company", async () => {
    activeCompanyId = null;
    expect(await getLegacyCourses()).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("create sets company, title and updated_at", async () => {
    setMockResponse({ data: null, error: null });
    const r = await createLegacyCourse({ course_code: "UGC", course_name: "Unarmed" });
    expect(r.success).toBe(true);
    const row = queryBuilder.insert.mock.calls[0][0];
    expect(row).toMatchObject({ company_id: COMPANY, title: "Unarmed", course_name: "Unarmed", course_code: "UGC" });
    expect(row.id).toMatch(/[0-9a-f-]{36}/);
    expect(row.updated_at).toBeTruthy();
  });

  it("an update that RLS hides (0 rows) is reported, not silently 'saved'", async () => {
    setMockResponse({ data: [], error: null });
    expect(await updateLegacyCourse("c1", { is_active: false })).toEqual({ success: false, error: "not_saved" });
  });

  it("delete goes through the server guard and surfaces course_in_use", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23503", message: "course_in_use" }, status: 409 });
    const r = await deleteLegacyCourse("c1");
    expect(rpc).toHaveBeenCalledWith("training_delete_course", { p_course_id: "c1" });
    expect(r).toEqual({ success: false, error: "course_in_use" });
    expect(trainingWriteErrorMessage("delete the course", r.error)).toMatch(/students or payments are attached/);
  });
});

describe("modules and slides", () => {
  it("slides map sort_order/content_html both ways", async () => {
    setMockResponse({ data: [{ id: "s1", module_id: "m1", title: "Intro", content_html: "<p>x</p>", sort_order: 3 }], error: null });
    const [s] = await getLegacySlides("m1");
    expect(s).toMatchObject({ slide_number: 3, content: "<p>x</p>", content_html: "<p>x</p>" });
    expect(toSlideRow({ title: "t", slide_number: 2, content_html: "<b>y</b>" })).toEqual({ title: "t", sort_order: 2, content_html: "<b>y</b>" });
    setMockResponse({ data: { id: "s2" }, error: null });
    await createLegacySlide({ module_id: "m1", title: "New", slide_number: 4 });
    expect(queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ module_id: "m1", sort_order: 4, content_html: "" }));
  });

  it("a new module is added to the course it was created from", async () => {
    setMockResponse({ data: { id: "m9" }, error: null });
    const r = await createLegacyModule({ module_code: "M9", module_name: "Radio", default_course_id: "c1" });
    expect(r).toEqual({ success: true, id: "m9" });
    expect(client.from).toHaveBeenCalledWith("course_modules");
    expect(queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ company_id: COMPANY, course_id: "c1", module_id: "m9" }));
  });
});

describe("classes", () => {
  it("map to training_classes columns", async () => {
    expect(toClassRow({ max_students: 12, instructor_id: "u-2", class_name: "X" })).toEqual({ capacity: 12, instructor_user_id: "u-2", class_name: "X" });
    setMockResponse({ data: { id: "k1" }, error: null });
    await createLegacyClass({ instructor_id: "u-1", class_name: "Night", scheduled_date: "2026-10-20", start_time: "09:00" });
    expect(queryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ company_id: COMPANY, instructor_user_id: "u-1", class_type: "training", status: "scheduled" }));
  });

  it("enroll and attendance upsert on (class_id,user_id)", async () => {
    setMockResponse({ data: null, error: null });
    await enrollStudentInClass("k1", "u-3");
    expect(queryBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({ company_id: COMPANY, class_id: "k1", user_id: "u-3" }), { onConflict: "class_id,user_id" });
    await markAttendance("k1", "u-3", "late", "traffic");
    expect(queryBuilder.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ attendance_status: "late", notes: "traffic", marked_by: "u-1" }), { onConflict: "class_id,user_id" });
  });

  it("rosters come from training_class_roster", async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: "u-3", first_name: "A", last_name: "B", email: "a@b", enrollment_status: "enrolled", attendance_status: null }], error: null, status: 200 });
    expect(await getClassEnrollments("k1")).toEqual([{ student_id: "u-3", enrollment_status: "enrolled", student: { first_name: "A", last_name: "B", email: "a@b" } }]);
    expect(rpc).toHaveBeenCalledWith("training_class_roster", { p_class_id: "k1" });
  });
});

describe("students and certificates", () => {
  it("learners come from training_list_learners; imported ones are flagged", async () => {
    rpc.mockResolvedValueOnce({ data: [{ user_id: "u-5", email: "x@y", first_name: "X", last_name: "Y", has_login: false }], error: null, status: 200 });
    const [s] = await getLegacyStudents();
    expect(rpc).toHaveBeenCalledWith("training_list_learners", { p_company_id: COMPANY });
    expect(s).toMatchObject({ id: "u-5", has_login: false });
  });

  it("certificates are issued server-side (number/code/issuer generated there)", async () => {
    rpc.mockResolvedValueOnce({ data: "cert-1", error: null, status: 200 });
    const r = await issueLegacyCertificate({ student_id: "u-5", certificate_type: "guard_card", certificate_name: "Guard Card", state_issued: "CA" });
    expect(r).toEqual({ success: true, id: "cert-1" });
    expect(rpc).toHaveBeenCalledWith("training_issue_certificate", expect.objectContaining({ p_company_id: COMPANY, p_user_id: "u-5", p_category: "guard_card", p_state: "CA" }));
  });
});

describe("assessments / quizzes keep answers on the server", () => {
  it("lists never select the questions column", async () => {
    await getLegacyAssessments();
    await getQuizzes(COMPANY);
    for (const [cols] of queryBuilder.select.mock.calls) {
      expect(String(cols)).not.toMatch(/(^|[ ,])(\*|questions)([ ,]|$)/);
    }
  });

  it("new quizzes are server-sourced with no inline questions", async () => {
    setMockResponse({ data: { id: "q1" }, error: null });
    await createLegacyAssessment({ assessment_name: "Radio", passing_score: 80 });
    expect(queryBuilder.insert).toHaveBeenLastCalledWith(expect.objectContaining({ question_source: "server", questions: [], company_id: COMPANY }));
    await createQuiz({ companyId: COMPANY, title: "Drill" });
    expect(queryBuilder.insert).toHaveBeenLastCalledWith(expect.objectContaining({ question_source: "server", questions: [] }));
  });

  it("the editor loads questions + keys through the admin RPC and saves letters", async () => {
    rpc.mockImplementation((fn: string) => Promise.resolve(fn === "get_training_quiz"
      ? { data: [{ id: "x1", question_number: 1, question_text: "2+2?", options: { A: "3", B: "4", C: "5" } }], error: null }
      : { data: [{ question_id: "x1", correct_answer: "b", explanation: "maths" }], error: null }));
    const r = await getLegacyAssessmentQuestions("q1");
    expect(r.questions).toEqual([{ question: "2+2?", options: ["3", "4", "5", ""], correctAnswer: 1, explanation: "maths" }]);
    expect(validateLegacyQuestions(r.questions)).toEqual([]);
    expect(toServerQuestions(r.questions)).toEqual([{ question: "2+2?", options: ["3", "4", "5"], correct: "B", explanation: "maths" }]);
    rpc.mockResolvedValueOnce({ data: 1, error: null });
    await saveLegacyAssessmentQuestions("q1", r.questions);
    expect(rpc).toHaveBeenLastCalledWith("admin_save_training_quiz_questions", { p_quiz_id: "q1", p_questions: [{ question: "2+2?", options: ["3", "4", "5"], correct: "B", explanation: "maths" }] });
  });

  it("validation rejects a correct answer on an empty slot and gaps", () => {
    expect(validateLegacyQuestions([{ question: "q", options: ["a", "b", "", ""], correctAnswer: 3 }])).toEqual(["Question 1 needs a correct answer."]);
    expect(validateLegacyQuestions([{ question: "q", options: ["a", "", "c", ""], correctAnswer: 0 }])[0]).toMatch(/gap/);
  });

  it("delete uses the guarded RPC (quiz and drill)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23503", message: "assessment_in_use" } });
    expect(await deleteLegacyAssessment("q1")).toEqual({ success: false, error: "assessment_in_use" });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await deleteQuiz("q2");
    expect(rpc).toHaveBeenLastCalledWith("training_delete_quiz", { p_quiz_id: "q2" });
  });

  it("bank answers convert to letters (text or letter); unusable ones are skipped", () => {
    expect(bankAnswerLetter(["red", "blue"], "blue")).toBe("B");
    expect(bankAnswerLetter(["red", "blue"], "a")).toBe("A");
    expect(bankAnswerLetter(["red", "blue"], "C")).toBeNull();
  });
});

describe("gradeQuiz", () => {
  it("returns the server's result", async () => {
    const result = { correct: 1, total: 2, score: 50, passed: false, questions: [] };
    rpc.mockResolvedValueOnce({ data: result, error: null, status: 200 });
    expect(await gradeQuiz("q1", { x1: "B" })).toEqual({ ok: true, result });
    expect(rpc).toHaveBeenCalledWith("grade_training_quiz", { p_quiz_id: "q1", p_answers: { x1: "B" }, p_state_code: null });
  });

  it("maps a missing quiz (HTTP 404) to quiz_not_found, not a generic failure", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "quiz_not_found", message: "Quiz not found" }, status: 404 });
    expect(await gradeQuiz("nope", {})).toMatchObject({ ok: false, error: "quiz_not_found" });
  });

  it("maps no attempts left (HTTP 403)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "no_attempts_left", message: "No attempts left" }, status: 403 });
    expect(await gradeQuiz("q1", {})).toMatchObject({ ok: false, error: "no_attempts_left" });
  });
});

describe("errorCode", () => {
  it("normalises server errors", () => {
    expect(errorCode({ code: "42501", message: "new row violates row-level security policy" })).toBe("forbidden");
    expect(errorCode({ code: "22023", message: "invalid_value:correct_answer" })).toBe("invalid_value:correct_answer");
    expect(errorCode({ code: "23505", message: "duplicate key" })).toBe("conflict");
    expect(trainingWriteErrorMessage("save the questions", "invalid_value:correct_answer")).toBe('Couldn\'t save the questions: check the "correct answer" field.');
  });
});
