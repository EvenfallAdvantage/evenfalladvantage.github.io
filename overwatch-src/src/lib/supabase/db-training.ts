import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";
import type { QuizPayload, UserName, CertificationRow } from "@/types";

// ─── Quizzes (Drills) ──────────────────────────────────
// Questions live in training_quiz_questions; answers in training_quiz_answer_keys, which no
// client role can read. quizzes.questions is always [] (CHECK quizzes_no_inline_answers).
// Learners: get_training_quiz + grade_training_quiz (see @/lib/training/quiz).
// Editors (owner/admin/manager/instructor): admin_get_training_quiz_answers /
// admin_save_training_quiz_questions.

export async function getQuizzes(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, company_id, title, description, passing_score, max_attempts, time_limit_min, icon, color, is_active, created_at, updated_at, module_id, category, training_quiz_questions(count)")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) { logDbReadError("quizzes", error); return []; }
  return (data ?? []).map(({ training_quiz_questions, ...q }: Record<string, unknown> & { training_quiz_questions?: { count: number }[] }) => ({
    ...q,
    question_count: Number(training_quiz_questions?.[0]?.count ?? 0),
  }));
}

export async function createQuiz(params: {
  companyId: string;
  title: string;
  description?: string;
  passingScore?: number;
  moduleId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      title: params.title,
      description: params.description ?? null,
      questions: [],
      question_source: "server",
      passing_score: params.passingScore ?? 70,
      module_id: params.moduleId ?? null,
      ...ts(),
    })
    .select("id, title, description, passing_score, module_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateQuiz(quizId: string, updates: { title?: string; description?: string; passingScore?: number; moduleId?: string | null }) {
  const supabase = createClient();
  const payload: QuizPayload = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.passingScore !== undefined) payload.passing_score = updates.passingScore;
  if (updates.moduleId !== undefined) payload.module_id = updates.moduleId;
  const { data, error } = await supabase.from("quizzes").update(payload).eq("id", quizId)
    .select("id, title, description, passing_score, module_id").maybeSingle();
  if (error) throw error;
  return data;
}

/** Server-side; refuses with assessment_in_use while attempts exist (they'd cascade away). */
export async function deleteQuiz(quizId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("training_delete_quiz", { p_quiz_id: quizId });
  if (error) throw error;
}

/** Editor question: options as an array, correct = letter ("A".."H"). */
export type EditableQuizQuestion = { question: string; options: string[]; correct: string; explanation?: string };

/** Questions + answers for the editor (owner/admin/manager/instructor only). */
export async function getQuizQuestionsForEditing(quizId: string): Promise<EditableQuizQuestion[]> {
  const supabase = createClient();
  const [qs, keys] = await Promise.all([
    supabase.rpc("get_training_quiz", { p_quiz_id: quizId }),
    supabase.rpc("admin_get_training_quiz_answers", { p_quiz_id: quizId }),
  ]);
  if (qs.error) throw qs.error;
  if (keys.error) throw keys.error;
  const byId = new Map(((keys.data ?? []) as { question_id: string; correct_answer: string; explanation: string | null }[])
    .map((k) => [k.question_id, k]));
  return ((qs.data ?? []) as { id: string; question_text: string; options: Record<string, string> }[]).map((q) => {
    const letters = Object.keys(q.options ?? {}).sort();
    const k = byId.get(q.id);
    return {
      question: q.question_text,
      options: letters.map((l) => q.options[l]),
      correct: (k?.correct_answer ?? "A").toUpperCase(),
      ...(k?.explanation ? { explanation: k.explanation } : {}),
    };
  });
}

/** Replace all questions + answer keys (server-side). */
export async function saveQuizQuestions(quizId: string, questions: EditableQuizQuestion[]) {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_save_training_quiz_questions", {
    p_quiz_id: quizId,
    p_questions: questions.map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()),
      correct: q.correct,
      ...(q.explanation?.trim() ? { explanation: q.explanation.trim() } : {}),
    })),
  });
  if (error) throw error;
}

// ─── Assessment Question Bank ─────────────────────────

export async function getAssessmentQuestions(companyId: string, filters?: {
  moduleId?: string; category?: string; difficulty?: string;
}) {
  const supabase = createClient();
  let q = supabase
    .from("assessment_questions")
    .select("*, training_modules(module_name, module_code)")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (filters?.moduleId) q = q.eq("module_id", filters.moduleId);
  if (filters?.category) q = q.eq("category", filters.category);
  if (filters?.difficulty) q = q.eq("difficulty", filters.difficulty);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createAssessmentQuestion(companyId: string, params: {
  questionText: string; questionType?: string; options?: string[];
  correctAnswer: string; explanation?: string; difficulty?: string;
  category?: string; moduleId?: string; tags?: string[];
}) {
  const supabase = createClient();
  const { data, error } = await supabase.from("assessment_questions").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    module_id: params.moduleId ?? null,
    question_text: params.questionText,
    question_type: params.questionType ?? "multiple_choice",
    options: params.options ?? [],
    correct_answer: params.correctAnswer,
    explanation: params.explanation ?? null,
    difficulty: params.difficulty ?? "medium",
    category: params.category ?? null,
    tags: params.tags ?? [],
    is_active: true,
    ...ts(),
  }).select("*, training_modules(module_name, module_code)").maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateAssessmentQuestion(questionId: string, updates: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assessment_questions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", questionId)
    .select("*, training_modules(module_name, module_code)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteAssessmentQuestion(questionId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("assessment_questions").delete().eq("id", questionId);
  if (error) throw error;
}

export async function getQuestionCategories(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assessment_questions")
    .select("category")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .not("category", "is", null);
  if (error) { logDbReadError("question categories", error); return []; }
  const cats = new Set((data ?? []).map((d: { category: string }) => d.category));
  return [...cats].sort();
}

/** Bank answer (option text, or a letter) -> letter. */
export function bankAnswerLetter(options: string[], correctAnswer: string): string | null {
  const idx = options.indexOf(correctAnswer);
  if (idx >= 0) return String.fromCharCode(65 + idx);
  const letter = correctAnswer.trim().toUpperCase();
  return /^[A-H]$/.test(letter) && letter.charCodeAt(0) - 65 < options.length ? letter : null;
}

/** Append bank questions to a quiz (server-side save; answers never sent to learners). */
export async function importQuestionsToQuiz(quizId: string, questionIds: string[]) {
  const supabase = createClient();
  const { data: questions, error: fetchErr } = await supabase
    .from("assessment_questions")
    .select("id, question_text, options, correct_answer, explanation")
    .in("id", questionIds);
  if (fetchErr) throw fetchErr;
  if (!questions || questions.length === 0) return;
  const existing = await getQuizQuestionsForEditing(quizId);
  const added: EditableQuizQuestion[] = [];
  for (const q of questions as { question_text: string; options: string[] | null; correct_answer: string; explanation: string | null }[]) {
    const options = q.options ?? [];
    const correct = bankAnswerLetter(options, q.correct_answer);
    if (!correct || options.length < 2) continue; // not a usable multiple-choice question
    added.push({ question: q.question_text, options, correct, ...(q.explanation ? { explanation: q.explanation } : {}) });
  }
  if (added.length === 0) return;
  await saveQuizQuestions(quizId, [...existing, ...added]);
}

// ─── Quiz attempts ──────────────────────────────────

// Attempts are written only by grade_training_quiz (server-side grading); clients can't
// insert or edit quiz_attempts.

export async function getUserQuizAttempts(quizId?: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  let query = supabase
    .from("quiz_attempts")
    .select("*, quizzes(title)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (quizId) query = query.eq("quiz_id", quizId);
  const { data, error } = await query.limit(20);
  if (error) { logDbReadError("quiz attempts", error); return []; }
  return data ?? [];
}

// ─── Training Modules (LMS) ──────────────────────────

export async function getTrainingModules(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_modules")
    .select("*, module_slides(id)")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m: Record<string, unknown> & { module_slides?: { id: string }[] }) => ({
    ...m,
    slide_count: m.module_slides?.length ?? 0,
    module_slides: undefined,
  }));
}

export async function getTrainingModule(moduleId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_modules")
    .select("*")
    .eq("id", moduleId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTrainingModule(companyId: string, params: {
  moduleCode: string; moduleName: string; description?: string;
  icon?: string; durationMinutes?: number; difficultyLevel?: string;
  isRequired?: boolean; displayOrder?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.from("training_modules").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    module_code: params.moduleCode,
    module_name: params.moduleName,
    description: params.description ?? null,
    icon: params.icon ?? "fa-graduation-cap",
    duration_minutes: params.durationMinutes ?? 60,
    difficulty_level: params.difficultyLevel ?? "Intermediate",
    is_required: params.isRequired ?? false,
    display_order: params.displayOrder ?? 0,
    is_active: true,
    ...ts(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateTrainingModule(moduleId: string, updates: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_modules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", moduleId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteTrainingModule(moduleId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("training_modules").delete().eq("id", moduleId);
  if (error) throw error;
}

// ─── Module Slides ───────────────────────────────────

export async function getModuleSlides(moduleId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("module_slides")
    .select("*")
    .eq("module_id", moduleId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createModuleSlide(moduleId: string, params: {
  title: string; contentHtml: string; audioUrl?: string;
  imageUrl?: string; sortOrder?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.from("module_slides").insert({
    id: crypto.randomUUID(),
    module_id: moduleId,
    title: params.title,
    content_html: params.contentHtml,
    audio_url: params.audioUrl ?? null,
    image_url: params.imageUrl ?? null,
    sort_order: params.sortOrder ?? 0,
    ...ts(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateModuleSlide(slideId: string, updates: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("module_slides")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", slideId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteModuleSlide(slideId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("module_slides").delete().eq("id", slideId);
  if (error) throw error;
}

/**
 * Reorder a module's slides. One UPDATE per slide: an `{ id, sort_order }`
 * upsert hits the INSERT side of ON CONFLICT (module_id null -> RLS, title
 * NOT NULL -> 23502). RLS on UPDATE checks the existing row's module/company.
 */
export async function reorderModuleSlides(slides: { id: string; sortOrder: number }[]) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const results = await Promise.all(
    slides.map((s) =>
      supabase
        .from("module_slides")
        .update({ sort_order: s.sortOrder, updated_at: now })
        .eq("id", s.id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// ─── Student Module Progress ─────────────────────────

export async function getMyModuleProgress(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("student_module_progress")
    .select("*, training_modules!inner(company_id)")
    .eq("user_id", userId)
    .eq("training_modules.company_id", companyId);
     if (error) throw error;
  return (data ?? []).map((d: Record<string, unknown>) => ({ ...d, training_modules: undefined }));
}

export async function getAllModuleProgress(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("student_module_progress")
    .select("*, training_modules!inner(company_id)")
    .eq("training_modules.company_id", companyId);
  if (error) throw error;
  return (data ?? []).map((d: Record<string, unknown>) => ({ ...d, training_modules: undefined }));
}

export async function upsertModuleProgress(moduleId: string, params: {
  currentSlide: number; totalSlides: number; completed?: boolean;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const now = new Date().toISOString();
  const pct = params.totalSlides > 0
    ? Math.round(((params.currentSlide + 1) / params.totalSlides) * 100)
    : 0;
  const isComplete = params.completed || pct >= 100;
  const status = isComplete ? "completed" : params.currentSlide > 0 ? "in_progress" : "not_started";

  const { data: existing } = await supabase
    .from("student_module_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (existing) {
    // Don't downgrade completed → in_progress
    const finalStatus = existing.status === "completed" ? "completed" : status;
    const finalPct = existing.status === "completed" ? 100 : pct;
    const { data, error } = await supabase
      .from("student_module_progress")
      .update({
        status: finalStatus,
        progress_percentage: finalPct,
        current_slide: params.currentSlide,
        completed_at: finalStatus === "completed" ? now : null,
        last_accessed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("student_module_progress")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        module_id: moduleId,
        status,
        progress_percentage: pct,
        current_slide: params.currentSlide,
        started_at: now,
        completed_at: isComplete ? now : null,
        last_accessed_at: now,
        ...ts(),
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}

export async function completeModule(moduleId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("student_module_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("student_module_progress")
      .update({
        status: "completed",
        progress_percentage: 100,
        completed_at: now,
        last_accessed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("student_module_progress")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        module_id: moduleId,
        status: "completed",
        progress_percentage: 100,
        current_slide: 0,
        started_at: now,
        completed_at: now,
        last_accessed_at: now,
        ...ts(),
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}

// ─── Certifications ─────────────────────────────────

export async function getUserCertifications() {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("certifications")
    .select("*")
    .eq("user_id", userId)
    .order("expiry_date", { ascending: true });
  if (error) { logDbReadError("certifications", error); return []; }
  return data ?? [];
}

export async function getCompanyCertifications(companyId: string) {
  const supabase = createClient();
  // Get all member user IDs
  const { data: members, error: memErr } = await supabase
    .from("company_memberships")
    .select("user_id, users(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (memErr) { logDbReadError("company certifications (members)", memErr); return []; }
  if (!members || members.length === 0) return [];
  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const { data: certs, error: certErr } = await supabase
    .from("certifications")
    .select("*")
    .in("user_id", userIds)
    .order("expiry_date", { ascending: true });
  if (certErr) { logDbReadError("company certifications", certErr); return []; }
  // Attach user names
  const userMap: Record<string, UserName | null> = {};
  for (const m of members) {
    userMap[m.user_id] = (m as unknown as { users: UserName | null }).users;
  }
  return (certs ?? []).map((c: CertificationRow) => ({ ...c, users: userMap[c.user_id] ?? null }));
}

export async function addCertification(params: {
  certType: string;
  issueDate?: string;
  expiryDate?: string;
  documentUrl?: string;
  certificateNumber?: string;
  issuedBy?: string;
  pdfUrl?: string;
  verificationCode?: string;
  category?: string;
  companyId?: string;
  moduleId?: string;
  quizId?: string;
  stateIssued?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("certifications")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      cert_type: params.certType,
      issue_date: params.issueDate ?? null,
      expiry_date: params.expiryDate ?? null,
      document_url: params.documentUrl ?? null,
      certificate_number: params.certificateNumber ?? null,
      issued_by: params.issuedBy ?? null,
      pdf_url: params.pdfUrl ?? null,
      verification_code: params.verificationCode ?? null,
      category: params.category ?? "general",
      company_id: params.companyId ?? null,
      module_id: params.moduleId ?? null,
      quiz_id: params.quizId ?? null,
      state_issued: params.stateIssued ?? null,
      status: "active",
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteCertification(certId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("certifications").delete().eq("id", certId);
  if (error) throw error;
}

export async function verifyCertificate(verificationCode: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("certifications")
    .select("*, users(first_name, last_name, callsign)")
    .eq("verification_code", verificationCode)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function issueCertificate(params: {
  certType: string;
  issuedBy: string;
  companyId?: string;
  moduleId?: string;
  quizId?: string;
  category?: string;
}) {
  const verificationCode = crypto.randomUUID().split("-").slice(0, 2).join("").toUpperCase();
  const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}`;
  return addCertification({
    certType: params.certType,
    issueDate: new Date().toISOString().split("T")[0],
    issuedBy: params.issuedBy,
    certificateNumber: certNumber,
    verificationCode,
    category: params.category ?? "training",
    companyId: params.companyId,
    moduleId: params.moduleId,
    quizId: params.quizId,
  });
}

// ─── Payment Transactions ───────────────────────────

export async function getUserPayments() {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { logDbReadError("payment transactions", error); return []; }
  return data ?? [];
}

export async function createPaymentTransaction(params: {
  companyId?: string;
  courseId?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  amount: number;
  currency?: string;
  status?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      company_id: params.companyId ?? null,
      course_id: params.courseId ?? null,
      stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
      stripe_customer_id: params.stripeCustomerId ?? null,
      amount: params.amount,
      currency: params.currency ?? "usd",
      status: params.status ?? "pending",
      description: params.description ?? null,
      metadata: params.metadata ?? {},
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePaymentStatus(paymentId: string, status: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Courses ────────────────────────────────────────

export async function getCatalogCourses() {
  const supabase = createClient();
  // Try full catalog query (requires add-course-catalog.sql columns)
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (!error) return data ?? [];
  // Fallback: columns may not exist yet — fetch all courses
  const fallback = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });
  if (fallback.error) { logDbReadError("catalog courses", fallback.error); return []; }
  return fallback.data ?? [];
}

export async function getCourses(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getActiveCourses(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
