import { activeCompanyId, db, fail, nowIso, rowsOrMissing, type WriteResult } from "./shared";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";
import type { LegacyAssessment, LegacyAssessmentResult } from "./types";

/**
 * Assessments are OverwatchDB `quizzes`. Questions live in training_quiz_questions and the
 * answers in training_quiz_answer_keys, which clients can't read: learners get questions via
 * get_training_quiz and are graded by grade_training_quiz; instructors edit through the
 * admin_* RPCs.
 */
type QuizRow = Record<string, unknown> & { id: string; title: string; training_quiz_questions?: { count: number }[] };

const qCount = (r: QuizRow) => Number(r.training_quiz_questions?.[0]?.count ?? 0);

export async function getLegacyAssessments(): Promise<LegacyAssessment[]> {
  const companyId = activeCompanyId();
  if (!companyId) return [];
  const { data, error } = await db().from("quizzes")
    .select("id, title, module_id, passing_score, training_quiz_questions(count)")
    .eq("company_id", companyId).order("title", { ascending: true });
  if (error) { console.error("Training: getAssessments error:", error); return []; }
  return ((data ?? []) as QuizRow[]).map((r) => ({
    id: r.id, assessment_name: r.title, module_id: (r.module_id as string | null) ?? null,
    total_questions: qCount(r), passing_score: Number(r.passing_score ?? 70),
  }));
}

/** The signed-in user's results in the active company. */
export async function getLegacyAssessmentResults(): Promise<LegacyAssessmentResult[]> {
  const companyId = activeCompanyId();
  const userId = await ensureInternalUser();
  if (!companyId || !userId) return [];
  const { data, error } = await db().from("quiz_attempts")
    .select("id, user_id, quiz_id, score, passed, state_code, completed_at, started_at, quizzes!inner(title, module_id, passing_score, company_id, training_quiz_questions(count))")
    .eq("user_id", userId).eq("quizzes.company_id", companyId)
    .order("completed_at", { ascending: false });
  if (error) { console.error("Training: getAssessmentResults error:", error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => {
    const z = r.quizzes as QuizRow;
    return {
      id: r.id as string, student_id: r.user_id as string, assessment_id: r.quiz_id as string,
      score: Number(r.score ?? 0), passed: r.passed === true, state_code: (r.state_code as string | null) ?? null,
      completed_at: String(r.completed_at ?? r.started_at ?? ""),
      assessments: { assessment_name: z.title, module_id: (z.module_id as string | null) ?? null,
        total_questions: qCount(z), passing_score: Number(z.passing_score ?? 70) },
    };
  });
}

export async function createLegacyAssessment(assessmentData: {
  assessment_name: string;
  module_id?: string;
  passing_score: number;
}): Promise<WriteResult> {
  const companyId = activeCompanyId();
  if (!companyId) return { success: false, error: "missing_company" };
  const id = crypto.randomUUID();
  const { error } = await db().from("quizzes").insert({
    id, company_id: companyId, title: assessmentData.assessment_name, module_id: assessmentData.module_id ?? null,
    passing_score: assessmentData.passing_score, max_attempts: 0, question_source: "server", questions: [],
    updated_at: nowIso(),
  });
  if (error) return fail("createAssessment", error);
  return { success: true, id };
}

export async function updateLegacyAssessment(assessmentId: string, updates: Partial<{
  assessment_name: string;
  module_id: string | null;
  passing_score: number;
}>): Promise<WriteResult> {
  const row: Record<string, unknown> = { updated_at: nowIso() };
  if (updates.assessment_name !== undefined) row.title = updates.assessment_name;
  if (updates.module_id !== undefined) row.module_id = updates.module_id;
  if (updates.passing_score !== undefined) row.passing_score = updates.passing_score;
  const { data, error } = await db().from("quizzes").update(row).eq("id", assessmentId).select("id");
  if (error) return fail("updateAssessment", error);
  return rowsOrMissing(data);
}

/** Editor shape: 4 answer slots, correctAnswer = slot index 0-3. */
export type LegacyQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswer: number;
  explanation?: string;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Questions + answers for editing (owner/admin/manager/instructor only). */
export async function getLegacyAssessmentQuestions(
  assessmentId: string,
): Promise<{ success: boolean; questions: LegacyQuestion[]; error?: string }> {
  const supabase = db();
  const [qs, keys] = await Promise.all([
    supabase.rpc("get_training_quiz", { p_quiz_id: assessmentId }),
    supabase.rpc("admin_get_training_quiz_answers", { p_quiz_id: assessmentId }),
  ]);
  if (qs.error || keys.error) {
    const r = fail("getAssessmentQuestions", qs.error ?? keys.error);
    return { success: false, questions: [], error: r.error };
  }
  const byId = new Map(((keys.data ?? []) as { question_id: string; correct_answer: string; explanation: string | null }[])
    .map((k) => [k.question_id, k]));
  const questions = ((qs.data ?? []) as { id: string; question_text: string; options: Record<string, string> }[]).map((q) => {
    const opts = LETTERS.slice(0, 4).map((l) => q.options?.[l] ?? "") as LegacyQuestion["options"];
    const k = byId.get(q.id);
    const idx = k ? LETTERS.indexOf(k.correct_answer.toUpperCase()) : -1;
    return { question: q.question_text, options: opts, correctAnswer: idx >= 0 && idx < 4 ? idx : -1,
      ...(k?.explanation ? { explanation: k.explanation } : {}) };
  });
  return { success: true, questions };
}

/** Problems that would make the server reject the quiz (empty list = OK). */
export function validateLegacyQuestions(questions: LegacyQuestion[]): string[] {
  if (questions.length === 0) return ["Add at least one question."];
  const problems: string[] = [];
  questions.forEach((q, i) => {
    const n = i + 1;
    const filled = q.options.map((o) => o.trim());
    if (!q.question.trim()) problems.push(`Question ${n} has no text.`);
    if (filled.filter(Boolean).length < 2) problems.push(`Question ${n} needs at least 2 answers.`);
    else if (filled.some((o, j) => !o && filled.slice(j + 1).some(Boolean))) problems.push(`Question ${n} has a gap between answers; fill them in order.`);
    if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer > 3 || !filled[q.correctAnswer]) {
      problems.push(`Question ${n} needs a correct answer.`);
    }
  });
  return problems;
}

/** Editor questions -> admin_save_training_quiz_questions payload (empty trailing slots dropped). */
export function toServerQuestions(questions: LegacyQuestion[]) {
  return questions.map((q) => ({
    question: q.question.trim(),
    options: q.options.map((o) => o.trim()).filter(Boolean),
    correct: LETTERS[q.correctAnswer],
    ...(q.explanation?.trim() ? { explanation: q.explanation.trim() } : {}),
  }));
}

/** Replace the quiz's questions and answer keys (server-side, keeps question ids by position). */
export async function saveLegacyAssessmentQuestions(assessmentId: string, questions: LegacyQuestion[]): Promise<WriteResult> {
  const { error } = await db().rpc("admin_save_training_quiz_questions", {
    p_quiz_id: assessmentId, p_questions: toServerQuestions(questions),
  });
  if (error) return fail("saveAssessmentQuestions", error);
  return { success: true };
}

/** Server-side: refuses with assessment_in_use while attempts exist. */
export async function deleteLegacyAssessment(assessmentId: string): Promise<WriteResult> {
  const { error } = await db().rpc("training_delete_quiz", { p_quiz_id: assessmentId });
  if (error) return fail("deleteAssessment", error);
  return { success: true };
}
