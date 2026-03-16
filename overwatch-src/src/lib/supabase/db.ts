import { createClient } from "./client";

// Helper: generate timestamps for INSERTs (DB defaults don't fire via PostgREST)
function ts() {
  const now = new Date().toISOString();
  return { created_at: now, updated_at: now };
}

// ─── Helper: get current Supabase auth user ID ─────────
async function getAuthUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Helper: get or create internal user ID from auth user
async function ensureInternalUser() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  // Try to find existing user
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("supabase_id", authUser.id)
    .maybeSingle();

  if (existing) return existing.id;

  // Auto-create user record from auth metadata
  const meta = authUser.user_metadata || {};
  const newId = crypto.randomUUID();
  const { data: created, error } = await supabase
    .from("users")
    .insert({
      id: newId,
      supabase_id: authUser.id,
      email: authUser.email ?? null,
      phone: authUser.phone ?? meta.phone ?? null,
      first_name: meta.first_name ?? "",
      last_name: meta.last_name ?? "",
      ...ts(),
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Auto-create user failed:", error.message);
    return null;
  }
  return created.id;
}

// ─── Users ──────────────────────────────────────────────

export async function upsertUser(data: {
  supabaseId: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}) {
  const supabase = createClient();

  // Try to find existing user first (don't overwrite primary key)
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_id", data.supabaseId)
    .maybeSingle();

  if (existing) {
    // Update mutable fields only — never touch id or supabase_id
    const { data: updated, error } = await supabase
      .from("users")
      .update({
        email: data.email ?? existing.email,
        phone: data.phone ?? existing.phone,
        first_name: data.firstName,
        last_name: data.lastName,
        avatar_url: data.avatarUrl ?? existing.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return updated ?? existing;
  }

  // No existing user — create new
  const { data: created, error } = await supabase
    .from("users")
    .insert({
      id: crypto.randomUUID(),
      supabase_id: data.supabaseId,
      email: data.email ?? null,
      phone: data.phone ?? null,
      first_name: data.firstName,
      last_name: data.lastName,
      avatar_url: data.avatarUrl ?? null,
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return created;
}

export async function fetchUserProfile() {
  const authId = await getAuthUserId();
  if (!authId) return null;

  const supabase = createClient();

  // Get user record (or auto-create if missing)
  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_id", authId)
    .maybeSingle();

  if (!user) {
    // Auto-create from auth metadata
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const meta = authUser.user_metadata || {};
    const newId = crypto.randomUUID();
    const { data: created } = await supabase
      .from("users")
      .insert({
        id: newId,
        supabase_id: authId,
        email: authUser.email ?? null,
        phone: authUser.phone ?? meta.phone ?? null,
        first_name: meta.first_name ?? "",
        last_name: meta.last_name ?? "",
        ...ts(),
      })
      .select("*")
      .maybeSingle();
    if (!created) return null;
    user = created;
  }

  // Get memberships with company info
  const { data: memberships } = await supabase
    .from("company_memberships")
    .select(
      `
      id,
      role,
      nickname,
      status,
      company_id,
      companies (
        id,
        name,
        slug,
        logo_url,
        brand_color,
        join_code
      )
    `
    )
    .eq("user_id", user.id);

  return { user, memberships: memberships ?? [] };
}

// ─── Companies ──────────────────────────────────────────

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createCompany(data: {
  name: string;
  brandColor?: string;
}) {
  const supabase = createClient();
  const slug = data.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      id: crypto.randomUUID(),
      name: data.name,
      slug,
      join_code: generateJoinCode(),
      brand_color: data.brandColor ?? "#1d3451",
      timezone: "America/Los_Angeles",
      settings: {},
      ...ts(),
    })
    .select()
    .single();

  if (error) {
    // Slug already exists — find and return the existing company
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("companies")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) return existing;
    }
    throw error;
  }
  return company;
}

export async function findCompanyByJoinCode(code: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("join_code", code.toUpperCase().trim())
    .single();

  if (error) return null;
  return data;
}

// ─── Memberships ────────────────────────────────────────

export async function createMembership(data: {
  userId: string;
  companyId: string;
  role?: string;
}) {
  const supabase = createClient();
  const { data: membership, error } = await supabase
    .from("company_memberships")
    .insert({
      id: crypto.randomUUID(),
      user_id: data.userId,
      company_id: data.companyId,
      role: data.role ?? "staff",
      status: "active",
      work_preferences: [],
      notification_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (error) {
    // Duplicate (user_id, company_id) — find and return existing
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("company_memberships")
        .select("*")
        .eq("user_id", data.userId)
        .eq("company_id", data.companyId)
        .maybeSingle();
      if (existing) return existing;
    }
    throw error;
  }
  return membership;
}

// ─── Full registration flow ─────────────────────────────

export async function registerUserInDB(params: {
  supabaseId: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  companyName: string;
}) {
  // 1. Create user record
  const user = await upsertUser({
    supabaseId: params.supabaseId,
    email: params.email,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
  });

  // 2. Create company
  const company = await createCompany({ name: params.companyName });

  // 3. Create membership as owner
  const membership = await createMembership({
    userId: user.id,
    companyId: company.id,
    role: "owner",
  });

  return { user, company, membership };
}

// ─── Timesheets (Watch Log) ──────────────────────────────

export async function getActiveTimesheet() {
  const userId = await ensureInternalUser();
  if (!userId) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", userId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function clockIn() {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("timesheets")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      clock_in: new Date().toISOString(),
      clock_method: "app",
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function clockOut(timesheetId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", timesheetId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRecentTimesheets(limit = 10) {
  const userId = await ensureInternalUser();
  if (!userId) return [];

  const supabase = createClient();

  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", userId)
    .order("clock_in", { ascending: false })
    .limit(limit);

  return data ?? [];
}

// ─── Roster (Directory) ─────────────────────────────────

export async function getCompanyMembers(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("company_memberships")
    .select(
      `
      id, role, nickname, status, title,
      users (
        id, first_name, last_name, email, phone, avatar_url
      )
    `
    )
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("role", { ascending: true });

  return data ?? [];
}

// ─── Posts (Briefing) ───────────────────────────────────

export async function getPosts(companyId: string, limit = 20) {
  const supabase = createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      `
      id, type, title, content, image_url, link_url, is_pinned, created_at,
      users (id, first_name, last_name, avatar_url)
    `
    )
    .eq("company_id", companyId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function createPost(data: {
  companyId: string;
  content: string;
  title?: string;
  type?: string;
  imageUrl?: string;
  linkUrl?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createClient();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      id: crypto.randomUUID(),
      company_id: data.companyId,
      user_id: userId,
      content: data.content,
      title: data.title ?? null,
      type: data.type ?? "update",
      image_url: data.imageUrl ?? null,
      link_url: data.linkUrl ?? null,
      ...ts(),
    })
    .select(
      `
      id, type, title, content, image_url, link_url, is_pinned, created_at,
      users (id, first_name, last_name, avatar_url)
    `
    )
    .maybeSingle();

  if (error) throw error;
  return post;
}

export async function togglePinPost(postId: string, pinned: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Post Comments ──────────────────────────────────────

export async function getPostComments(postId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("post_comments")
    .select("*, users(id, first_name, last_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function addPostComment(postId: string, content: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      id: crypto.randomUUID(),
      post_id: postId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
    })
    .select("*, users(id, first_name, last_name, avatar_url)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deletePostComment(commentId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

// ─── Post Reactions ─────────────────────────────────────

export async function getPostReactions(postId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("post_reactions")
    .select("*, users(id, first_name, last_name)")
    .eq("post_id", postId);
  return data ?? [];
}

export async function togglePostReaction(postId: string, type: string = "like") {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    // Remove reaction
    await supabase.from("post_reactions").delete().eq("id", existing.id);
    return { action: "removed" };
  } else {
    // Add reaction
    await supabase.from("post_reactions").insert({
      id: crypto.randomUUID(),
      post_id: postId,
      user_id: userId,
      type,
      created_at: new Date().toISOString(),
    });
    return { action: "added" };
  }
}

// ─── Profile update ─────────────────────────────────────

export async function updateUserProfile(updates: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}) {
  // Ensure user exists first
  await ensureInternalUser();
  const authId = await getAuthUserId();
  if (!authId) throw new Error("Not authenticated");

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {};
  if (updates.firstName !== undefined) payload.first_name = updates.firstName;
  if (updates.lastName !== undefined) payload.last_name = updates.lastName;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("supabase_id", authId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Forms (Field Reports) ─────────────────────────────

export async function getForms(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("forms")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createForm(params: {
  companyId: string;
  name: string;
  description?: string;
  fields?: unknown[];
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("forms")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      description: params.description ?? null,
      fields: params.fields ?? [],
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getFormSubmissions(formId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("form_submissions")
    .select("*, users(first_name, last_name)")
    .eq("form_id", formId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function submitForm(params: {
  formId: string;
  data: Record<string, unknown>;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .insert({
      id: crypto.randomUUID(),
      form_id: params.formId,
      user_id: userId,
      data: params.data,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

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

export async function updateForm(formId: string, updates: { fields?: unknown[]; name?: string; description?: string }) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = { updated_at: new Date().toISOString() };
  if (updates.fields !== undefined) payload.fields = updates.fields;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  const { data, error } = await supabase.from("forms").update(payload).eq("id", formId).select().maybeSingle();
  if (error) throw error;
  return data;
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

// ─── Knowledge Base (Field Manual) ─────────────────────

export async function getKBFolders(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("kb_folders")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function getKBDocuments(folderId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("kb_documents")
    .select("*, users(first_name, last_name)")
    .eq("folder_id", folderId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function createKBFolder(params: {
  companyId: string;
  name: string;
  parentId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kb_folders")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      parent_id: params.parentId ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createKBDocument(params: {
  folderId: string;
  title: string;
  content?: string;
  fileUrl?: string;
  type?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kb_documents")
    .insert({
      id: crypto.randomUUID(),
      folder_id: params.folderId,
      title: params.title,
      content: params.content ?? null,
      file_url: params.fileUrl ?? null,
      type: params.type ?? "page",
      created_by_id: userId,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Chat Channels (Comms) ─────────────────────────────

export async function getChatChannels(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function createChatChannel(params: {
  companyId: string;
  name: string;
  description?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_channels")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      description: params.description ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getChatMessages(channelId: string, limit = 50) {
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("*, users(id, first_name, last_name, avatar_url)")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

export async function sendChatMessage(params: {
  channelId: string;
  content: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      id: crypto.randomUUID(),
      channel_id: params.channelId,
      user_id: userId,
      content: params.content,
      created_at: new Date().toISOString(),
    })
    .select("*, users(id, first_name, last_name, avatar_url)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Events (Operations) ──────────────────────────────

export async function getEvents(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("events")
    .select("*, clients(name)")
    .eq("company_id", companyId)
    .order("start_date", { ascending: true });
  return data ?? [];
}

export async function createEvent(params: {
  companyId: string;
  name: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      description: params.description ?? null,
      location: params.location ?? null,
      start_date: params.startDate,
      end_date: params.endDate,
      status: "draft",
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateEventStatus(eventId: string, status: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Assets (Armory) ──────────────────────────────────

export async function getAssets(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("assets")
    .select("*, users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function createAsset(params: {
  companyId: string;
  name: string;
  assetType?: string;
  serialNumber?: string;
}) {
  const supabase = createClient();
  const qrCode = `ASSET-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from("assets")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      asset_type: params.assetType ?? null,
      serial_number: params.serialNumber ?? null,
      qr_code: qrCode,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Time Off ─────────────────────────────────────────

export async function getTimeOffRequests() {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("time_off_requests")
    .select("*, time_off_policies(name, type)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Company settings ─────────────────────────────────

export async function getCompanyDetails(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  return data;
}

export async function updateCompany(companyId: string, updates: {
  name?: string;
  brandColor?: string;
  timezone?: string;
  logoUrl?: string;
}) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.brandColor !== undefined) payload.brand_color = updates.brandColor;
  if (updates.timezone !== undefined) payload.timezone = updates.timezone;
  if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
  const { data, error } = await supabase
    .from("companies")
    .update(payload)
    .eq("id", companyId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Join company flow ──────────────────────────────────

export async function joinCompanyByCode(params: {
  supabaseId: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  joinCode: string;
}) {
  // 1. Find company
  const company = await findCompanyByJoinCode(params.joinCode);
  if (!company) throw new Error("Invalid company code");

  // 2. Upsert user
  const user = await upsertUser({
    supabaseId: params.supabaseId,
    email: params.email,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
  });

  // 3. Create membership as staff
  const membership = await createMembership({
    userId: user.id,
    companyId: company.id,
    role: "staff",
  });

  return { user, company, membership };
}

// ─── Schedule (Shifts + Events for user) ─────────────

export async function getUserShifts(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, events(id, name, location, company_id)")
    .eq("assigned_user_id", userId)
    .order("start_time", { ascending: true });
  return (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.events?.company_id === companyId
  );
}

export async function getUpcomingEvents(companyId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("company_id", companyId)
    .gte("end_date", now)
    .order("start_date", { ascending: true })
    .limit(20);
  return data ?? [];
}

// ─── Time Off (create request) ───────────────────────

export async function getTimeOffPolicies(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("time_off_policies")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function createTimeOffRequest(params: {
  policyId: string;
  startDate: string;
  endDate: string;
  note?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_requests")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      policy_id: params.policyId,
      start_date: params.startDate,
      end_date: params.endDate,
      note: params.note ?? null,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("*, time_off_policies(name, type)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Form submissions by user (for Profile tab) ─────

export async function getUserFormSubmissions() {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("form_submissions")
    .select("*, forms(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
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

// ─── Company stats (for Intel page) ─────────────────

export async function getCompanyStats(companyId: string) {
  const supabase = createClient();

  // Get member user IDs for this company to scope timesheets
  const { data: memberRows } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  const memberUserIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);

  const [members, events, assets, forms] = await Promise.all([
    supabase.from("company_memberships").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("forms").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
  ]);

  let totalHours = 0;
  if (memberUserIds.length > 0) {
    const { data: sheets } = await supabase
      .from("timesheets")
      .select("clock_in, clock_out")
      .in("user_id", memberUserIds)
      .not("clock_out", "is", null)
      .limit(500);
    for (const t of sheets ?? []) {
      if (t.clock_in && t.clock_out) {
        totalHours += (new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime()) / 3600000;
      }
    }
  }

  return {
    memberCount: members.count ?? 0,
    eventCount: events.count ?? 0,
    assetCount: assets.count ?? 0,
    formCount: forms.count ?? 0,
    totalHoursLogged: Math.round(totalHours * 10) / 10,
  };
}

// ─── Time-off policy CRUD (admin) ────────────────────

export async function createTimeOffPolicy(params: {
  companyId: string;
  name: string;
  type: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_policies")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      type: params.type,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Leave request approve / deny (admin) ────────────

export async function reviewTimeOffRequest(requestId: string, status: "approved" | "denied") {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_requests")
    .update({ status, reviewed_by_id: userId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .select("*, time_off_policies(name, type)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllTimeOffRequests(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("time_off_requests")
    .select("*, time_off_policies!inner(name, type, company_id), users(first_name, last_name)")
    .eq("time_off_policies.company_id", companyId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Timesheet approval (admin) ──────────────────────

export async function getCompanyTimesheets(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("timesheets")
    .select("*, users!timesheets_user_id_fkey(first_name, last_name, company_memberships!inner(company_id))")
    .order("clock_in", { ascending: false })
    .limit(50);
  // Filter to company members
  return (data ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (t: any) => t.users?.company_memberships?.some((m: any) => m.company_id === companyId)
  );
}

export async function approveTimesheet(timesheetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .update({ approved: true, approved_by_id: userId, approved_at: new Date().toISOString() })
    .eq("id", timesheetId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Shift CRUD + assignment (admin) ─────────────────

export async function getEventShifts(eventId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, users(first_name, last_name)")
    .eq("event_id", eventId)
    .order("start_time", { ascending: true });
  return data ?? [];
}

export async function createShift(params: {
  eventId: string;
  role?: string;
  startTime: string;
  endTime: string;
  assignedUserId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shifts")
    .insert({
      id: crypto.randomUUID(),
      event_id: params.eventId,
      role: params.role ?? null,
      start_time: params.startTime,
      end_time: params.endTime,
      assigned_user_id: params.assignedUserId ?? null,
      status: params.assignedUserId ? "confirmed" : "open",
      ...ts(),
    })
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Asset checkout / checkin ────────────────────────

export async function checkoutAsset(assetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: "checked_out", current_holder_id: userId, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  // Log the checkout
  await supabase.from("asset_logs").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    user_id: userId,
    action: "checkout",
    created_at: new Date().toISOString(),
  }).then(() => {});
  return data;
}

export async function checkinAsset(assetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: "available", current_holder_id: null, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select()
    .maybeSingle();
  if (error) throw error;
  // Log the checkin
  await supabase.from("asset_logs").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    user_id: userId,
    action: "checkin",
    created_at: new Date().toISOString(),
  }).then(() => {});
  return data;
}

// ─── Form submission review (admin) ──────────────────

export async function reviewFormSubmission(submissionId: string, note: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .update({ status: "reviewed", reviewed_by_id: userId, reviewed_at: new Date().toISOString(), review_note: note })
    .eq("id", submissionId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Notifications ──────────────────────────────────

export async function getNotifications(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getUnreadNotificationCount(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return 0;
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("read", false);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const supabase = createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
}

export async function markAllNotificationsRead(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return;
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("read", false);
}

export async function createNotification(params: {
  userId: string;
  companyId: string;
  title: string;
  body?: string;
  type: string;
  actionUrl?: string;
}) {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").insert({
    id: crypto.randomUUID(),
    user_id: params.userId,
    company_id: params.companyId,
    title: params.title,
    body: params.body ?? null,
    type: params.type,
    action_url: params.actionUrl ?? null,
    read: false,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
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

// ─── Incidents ───────────────────────────────────────

export async function getIncidents(companyId: string, status?: string) {
  const supabase = createClient();
  let q = supabase
    .from("incidents")
    .select("*, reported_user:users!incidents_reported_by_fkey(first_name, last_name), assigned_user:users!incidents_assigned_to_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return data ?? [];
}

export async function getIncident(incidentId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("incidents")
    .select("*, reported_user:users!incidents_reported_by_fkey(first_name, last_name), assigned_user:users!incidents_assigned_to_fkey(first_name, last_name)")
    .eq("id", incidentId)
    .maybeSingle();
  return data;
}

export async function createIncident(companyId: string, params: {
  title: string; description?: string; type?: string;
  severity?: string; priority?: string; location?: string; eventId?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase.from("incidents").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    reported_by: userId,
    title: params.title,
    description: params.description ?? null,
    type: params.type ?? "general",
    severity: params.severity ?? "low",
    priority: params.priority ?? "medium",
    status: "open",
    location: params.location ?? null,
    event_id: params.eventId ?? null,
    ...ts(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateIncident(incidentId: string, updates: Record<string, unknown>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("incidents")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", incidentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getIncidentUpdates(incidentId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("incident_updates")
    .select("*, users(first_name, last_name)")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function addIncidentUpdate(incidentId: string, content: string, type = "note") {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase.from("incident_updates").insert({
    id: crypto.randomUUID(),
    incident_id: incidentId,
    user_id: userId,
    content,
    type,
    created_at: new Date().toISOString(),
  }).select("*, users(first_name, last_name)").maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteIncident(incidentId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("incidents").delete().eq("id", incidentId);
  if (error) throw error;
}

// ─── Checkpoints & Patrol ────────────────────────────

export async function getCheckpoints(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("checkpoints")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function createCheckpoint(companyId: string, params: {
  name: string; description?: string; location?: string; eventId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.from("checkpoints").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    name: params.name,
    description: params.description ?? null,
    location: params.location ?? null,
    event_id: params.eventId ?? null,
    qr_code: `CP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    is_active: true,
    created_at: new Date().toISOString(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteCheckpoint(checkpointId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("checkpoints").delete().eq("id", checkpointId);
  if (error) throw error;
}

export async function getPatrolRoutes(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("patrol_routes")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export async function createPatrolRoute(companyId: string, params: {
  name: string; description?: string; checkpointIds: string[]; frequencyMin?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.from("patrol_routes").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    name: params.name,
    description: params.description ?? null,
    checkpoint_ids: params.checkpointIds,
    frequency_min: params.frequencyMin ?? 60,
    is_active: true,
    ...ts(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deletePatrolRoute(routeId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("patrol_routes").delete().eq("id", routeId);
  if (error) throw error;
}

export async function logPatrolScan(companyId: string, checkpointId: string, params?: {
  routeId?: string; notes?: string; status?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase.from("patrol_logs").insert({
    id: crypto.randomUUID(),
    company_id: companyId,
    checkpoint_id: checkpointId,
    user_id: userId,
    route_id: params?.routeId ?? null,
    notes: params?.notes ?? null,
    status: params?.status ?? "ok",
    scanned_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPatrolLogs(companyId: string, limit = 50) {
  const supabase = createClient();
  const { data } = await supabase
    .from("patrol_logs")
    .select("*, checkpoints(name, location), users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("scanned_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ─── Dashboard Metrics ───────────────────────────────

export async function getDashboardMetrics(companyId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayISO = todayStart.toISOString();

  const [
    { count: activePersonnel },
    { count: openIncidents },
    { count: todayPatrols },
    { count: pendingReports },
    { count: totalStaff },
    { count: upcomingShifts },
  ] = await Promise.all([
    supabase.from("timesheets").select("id", { count: "exact", head: true })
      .is("clock_out", null),
    supabase.from("incidents").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).in("status", ["open", "investigating"]),
    supabase.from("patrol_logs").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).gte("scanned_at", todayISO),
    supabase.from("form_submissions").select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase.from("company_memberships").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "active"),
    supabase.from("shifts").select("id", { count: "exact", head: true })
      .gte("start_time", now).eq("status", "open"),
  ]);

  return {
    activePersonnel: activePersonnel ?? 0,
    openIncidents: openIncidents ?? 0,
    todayPatrols: todayPatrols ?? 0,
    pendingReports: pendingReports ?? 0,
    totalStaff: totalStaff ?? 0,
    upcomingShifts: upcomingShifts ?? 0,
  };
}

// ─── DELETE functions ────────────────────────────────

export async function deletePost(postId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function deleteEvent(eventId: string) {
  const supabase = createClient();
  // Shifts cascade-delete via FK
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

export async function deleteShift(shiftId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
  if (error) throw error;
}

export async function deleteAsset(assetId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw error;
}

export async function deleteForm(formId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("forms").delete().eq("id", formId);
  if (error) throw error;
}

export async function deleteQuiz(quizId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
  if (error) throw error;
}

export async function deleteKBFolder(folderId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("kb_folders").delete().eq("id", folderId);
  if (error) throw error;
}

export async function deleteKBDocument(docId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("kb_documents").delete().eq("id", docId);
  if (error) throw error;
}

export async function deleteChatChannel(channelId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("chat_channels").delete().eq("id", channelId);
  if (error) throw error;
}

export async function deleteTimeOffPolicy(policyId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("time_off_policies").delete().eq("id", policyId);
  if (error) throw error;
}

export async function deleteTimeOffRequest(requestId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("time_off_requests").delete().eq("id", requestId);
  if (error) throw error;
}

// ─── Member management (admin) ──────────────────────

export async function updateMemberRole(membershipId: string, role: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_memberships")
    .update({ role })
    .eq("id", membershipId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function removeMember(membershipId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("company_memberships").delete().eq("id", membershipId);
  if (error) throw error;
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

// ─── Certificate Verification ───────────────────────

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

// ─── Issue Certificate (auto from quiz/module) ──────

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
