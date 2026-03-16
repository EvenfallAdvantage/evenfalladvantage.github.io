import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";

// ─── Quizzes (Drills) ──────────────────────────────────

export async function getQuizzes(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("quizzes")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createQuiz(params: {
  companyId: string;
  title: string;
  description?: string;
  questions?: unknown[];
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
      questions: params.questions ?? [],
      passing_score: params.passingScore ?? 70,
      module_id: params.moduleId ?? null,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateQuiz(quizId: string, updates: { questions?: unknown[]; title?: string; description?: string; passingScore?: number; moduleId?: string | null }) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.questions !== undefined) payload.questions = updates.questions;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.passingScore !== undefined) payload.passing_score = updates.passingScore;
  if (updates.moduleId !== undefined) payload.module_id = updates.moduleId;
  const { data, error } = await supabase.from("quizzes").update(payload).eq("id", quizId).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteQuiz(quizId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
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
  const { data } = await supabase
    .from("assessment_questions")
    .select("category")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .not("category", "is", null);
  const cats = new Set((data ?? []).map((d: { category: string }) => d.category));
  return [...cats].sort();
}

export async function importQuestionsToQuiz(quizId: string, questionIds: string[]) {
  const supabase = createClient();
  // Fetch the selected questions
  const { data: questions, error: fetchErr } = await supabase
    .from("assessment_questions")
    .select("*")
    .in("id", questionIds);
  if (fetchErr) throw fetchErr;
  if (!questions || questions.length === 0) return;

  // Fetch current quiz
  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .select("questions")
    .eq("id", quizId)
    .maybeSingle();
  if (quizErr) throw quizErr;

  // Convert assessment_questions to quiz JSONB format and append
  const existing = (quiz?.questions ?? []) as { id: string; text: string; options: string[]; correctIndex: number }[];
  const newQs = questions.map((q) => ({
    id: q.id,
    text: q.question_text,
    options: q.options ?? [],
    correctIndex: (q.options ?? []).indexOf(q.correct_answer),
  }));
  const merged = [...existing, ...newQs];
  const { error: updateErr } = await supabase
    .from("quizzes")
    .update({ questions: merged, updated_at: new Date().toISOString() })
    .eq("id", quizId);
  if (updateErr) throw updateErr;
}

// ─── Quiz attempts ──────────────────────────────────

export async function submitQuizAttempt(params: {
  quizId: string;
  answers: Record<string, unknown>;
  score: number;
  passed: boolean;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({
      id: crypto.randomUUID(),
      quiz_id: params.quizId,
      user_id: userId,
      answers: params.answers,
      score: params.score,
      passed: params.passed,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

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
  const { data } = await query.limit(20);
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
  return (data ?? []).map((m) => ({
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

export async function reorderModuleSlides(slides: { id: string; sortOrder: number }[]) {
  const supabase = createClient();
  for (const s of slides) {
    const { error } = await supabase
      .from("module_slides")
      .update({ sort_order: s.sortOrder, updated_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) throw error;
  }
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
  return (data ?? []).map((d) => ({ ...d, training_modules: undefined }));
}

export async function getAllModuleProgress(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("student_module_progress")
    .select("*, training_modules!inner(company_id)")
    .eq("training_modules.company_id", companyId);
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, training_modules: undefined }));
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
  const { data } = await supabase
    .from("certifications")
    .select("*")
    .eq("user_id", userId)
    .order("expiry_date", { ascending: true });
  return data ?? [];
}

export async function getCompanyCertifications(companyId: string) {
  const supabase = createClient();
  // Get all member user IDs
  const { data: members } = await supabase
    .from("company_memberships")
    .select("user_id, users(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (!members || members.length === 0) return [];
  const userIds = members.map((m: { user_id: string }) => m.user_id);
  const { data: certs } = await supabase
    .from("certifications")
    .select("*")
    .in("user_id", userIds)
    .order("expiry_date", { ascending: true });
  // Attach user names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMap: Record<string, any> = {};
  for (const m of members) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userMap[m.user_id] = (m as any).users;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (certs ?? []).map((c: any) => ({ ...c, users: userMap[c.user_id] ?? null }));
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
    .select("*, users(first_name, last_name)")
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
  const { data } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
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
