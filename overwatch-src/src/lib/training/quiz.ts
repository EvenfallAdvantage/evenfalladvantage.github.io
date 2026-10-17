import { db } from "./shared";

/** One question as learners see it: no answer, no correctIndex. */
export type QuizQuestion = { id: string; question_number: number; question_text: string; options: Record<string, string> };

export type GradeResult = {
  correct: number; total: number; score: number; passed: boolean;
  questions: { id: string; is_correct: boolean; correct_answer: string; explanation: string | null }[];
};

export type GradeOutcome =
  | { ok: true; result: GradeResult }
  | { ok: false; error: "quiz_not_found" | "no_attempts_left" | "forbidden" | "error"; message: string };

export async function getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const { data, error } = await db().rpc("get_training_quiz", { p_quiz_id: quizId });
  if (error) throw error;
  return (data ?? []) as QuizQuestion[];
}

/** Grade on the server and record the attempt. answers = { [questionId]: "A" | "B" ... }. */
export async function gradeQuiz(quizId: string, answers: Record<string, string>, stateCode?: string): Promise<GradeOutcome> {
  const { data, error, status } = await db().rpc("grade_training_quiz", {
    p_quiz_id: quizId, p_answers: answers, p_state_code: stateCode ?? null,
  });
  if (!error) return { ok: true, result: data as GradeResult };
  if (status === 404 || error.code === "quiz_not_found") return { ok: false, error: "quiz_not_found", message: "This quiz no longer exists or isn't available to you." };
  if (status === 403 || error.code === "no_attempts_left") return { ok: false, error: "no_attempts_left", message: "You have no attempts left for this quiz." };
  if (error.code === "42501") return { ok: false, error: "forbidden", message: "You don't have access to this quiz." };
  console.error("Training: gradeQuiz error:", error);
  return { ok: false, error: "error", message: "Couldn't grade the quiz. Please try again." };
}
