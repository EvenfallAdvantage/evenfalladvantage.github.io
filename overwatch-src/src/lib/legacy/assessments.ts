import { getLegacyClient } from "./client";
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
}): Promise<{ success: boolean; id?: string }> {
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
}>): Promise<{ success: boolean }> {
  const client = getLegacyClient();
  const { error } = await client.from("assessments").update(updates).eq("id", assessmentId);
  if (error) { console.error("Legacy: updateAssessment error:", error); return { success: false }; }
  return { success: true };
}

/** Save an assessment result in legacy */
export async function saveLegacyAssessmentResult(resultData: {
  student_id: string;
  assessment_id: string;
  score: number;
  passed: boolean;
  state_code?: string;
  answers?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
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
