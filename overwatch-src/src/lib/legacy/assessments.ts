import { getLegacyClient } from "./client";
import { viaLegacyBridge } from "./bridge";
import type { LegacyAssessment, LegacyAssessmentResult } from "./types";

/** Get assessment results for a student */
export async function getLegacyAssessmentResults(studentId: string): Promise<LegacyAssessmentResult[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("assessment_results")
    .select(`
      *,
      assessments (
        assessment_name,
        module_id,
        total_questions,
        passing_score
      )
    `)
    .eq("student_id", studentId)
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("Legacy: getAssessmentResults error:", error);
    return [];
  }
  return data ?? [];
}

/** Get all assessments */
export async function getLegacyAssessments(): Promise<LegacyAssessment[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("assessments")
    .select("*")
    .order("assessment_name", { ascending: true });

  if (error) {
    console.error("Legacy: getAssessments error:", error);
    return [];
  }
  return data ?? [];
}

/** Create an assessment in legacy */
export async function createLegacyAssessment(assessmentData: {
  assessment_name: string;
  module_id?: string;
  total_questions: number;
  passing_score: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const viaBridge = await viaLegacyBridge("assessment.create", { values: assessmentData });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();
  const { data, error } = await client
    .from("assessments")
    .insert(assessmentData)
    .select("id")
    .single();
  if (error) { console.error("Legacy: createAssessment error:", error); return { success: false }; }
  return { success: true, id: data.id };
}

/** Update an assessment in legacy */
export async function updateLegacyAssessment(assessmentId: string, updates: Partial<{
  assessment_name: string;
  module_id: string | null;
  total_questions: number;
  passing_score: number;
}>): Promise<{ success: boolean; error?: string }> {
  const viaBridge = await viaLegacyBridge("assessment.update", { keys: { id: assessmentId }, values: updates });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();
  const { error } = await client.from("assessments").update(updates).eq("id", assessmentId);
  if (error) { console.error("Legacy: updateAssessment error:", error); return { success: false }; }
  return { success: true };
}

/**
 * One multiple-choice question, in the `questions_json` shape the static admin
 * assessment editor already uses (4 options, correctAnswer = index 0-3).
 */
export type LegacyQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswer: number;
  explanation?: string;
};

/**
 * Load an assessment's questions. Via the bridge they come from
 * assessment_questions (what the student portal reads; anon can't read that
 * table), falling back to questions_json. Without the bridge, questions_json only.
 */
export async function getLegacyAssessmentQuestions(
  assessmentId: string,
): Promise<{ success: boolean; questions: LegacyQuestion[]; error?: string }> {
  const viaBridge = await viaLegacyBridge("assessment.get_questions", { keys: { id: assessmentId } });
  if (viaBridge) {
    if (!viaBridge.success) return { success: false, questions: [], error: viaBridge.error };
    const qs = (viaBridge.data as { questions?: LegacyQuestion[] } | undefined)?.questions;
    return { success: true, questions: Array.isArray(qs) ? qs : [] };
  }
  const client = getLegacyClient();
  const { data, error } = await client.from("assessments").select("questions_json").eq("id", assessmentId).maybeSingle();
  if (error) { console.error("Legacy: getAssessmentQuestions error:", error); return { success: false, questions: [] }; }
  const qs = (data as { questions_json?: unknown } | null)?.questions_json;
  return { success: true, questions: Array.isArray(qs) ? (qs as LegacyQuestion[]) : [] };
}

/** Problems that would make the server reject the quiz (empty list = OK). */
export function validateLegacyQuestions(questions: LegacyQuestion[]): string[] {
  if (questions.length === 0) return ["Add at least one question."];
  const problems: string[] = [];
  questions.forEach((q, i) => {
    const n = i + 1;
    if (!q.question.trim()) problems.push(`Question ${n} has no text.`);
    if (q.options.length !== 4 || q.options.some((o) => !o.trim())) problems.push(`Question ${n} needs all 4 answers filled in.`);
    if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer > 3) problems.push(`Question ${n} needs a correct answer.`);
  });
  return problems;
}

/**
 * Save the full question list (replaces the old one). Server-only: it writes
 * assessment_questions (student portal) and questions_json (static editor)
 * together, and anon can't write assessment_questions.
 */
export async function saveLegacyAssessmentQuestions(
  assessmentId: string,
  questions: LegacyQuestion[],
): Promise<{ success: boolean; error?: string }> {
  const clean = questions.map((q) => ({
    question: q.question.trim(),
    options: q.options.map((o) => o.trim()) as LegacyQuestion["options"],
    correctAnswer: q.correctAnswer,
    ...(q.explanation?.trim() ? { explanation: q.explanation.trim() } : {}),
  }));
  const viaBridge = await viaLegacyBridge("assessment.set_questions", { keys: { id: assessmentId }, values: { questions: clean } });
  if (!viaBridge) return { success: false, error: "bridge_required" };
  return viaBridge.success ? { success: true } : { success: false, error: viaBridge.error };
}

/**
 * Delete an assessment and its questions (assessment_questions rows and
 * questions_json). Server-only: EADB has no anon DELETE policy on assessments.
 * The bridge refuses with `assessment_in_use` while students have results for
 * it (they would cascade away).
 */
export async function deleteLegacyAssessment(assessmentId: string): Promise<{ success: boolean; error?: string }> {
  const viaBridge = await viaLegacyBridge("assessment.delete", { keys: { id: assessmentId } });
  if (!viaBridge) return { success: false, error: "bridge_required" };
  return viaBridge.success ? { success: true } : { success: false, error: viaBridge.error };
}

/** Save an assessment result in legacy */
export async function saveLegacyAssessmentResult(resultData: {
  student_id: string;
  assessment_id: string;
  score: number;
  passed: boolean;
  state_code?: string;
  answers?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  const client = getLegacyClient();
  const { error } = await client
    .from("assessment_results")
    .insert({
      ...resultData,
      completed_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Legacy: saveAssessmentResult error:", error);
    return { success: false };
  }
  return { success: true };
}
