import { activeCompanyId, db, fail, nowIso, rowsOrMissing, type WriteResult } from "./shared";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";
import type { LegacyModule, LegacyModuleProgress, LegacySlide } from "./types";

export async function getLegacyModules(): Promise<LegacyModule[]> {
  const companyId = activeCompanyId();
  if (!companyId) return [];
  const { data, error } = await db().from("training_modules").select("*")
    .eq("company_id", companyId).eq("is_active", true).order("display_order", { ascending: true });
  if (error) { console.error("Training: getModules error:", error); return []; }
  return (data ?? []) as LegacyModule[];
}

export function toSlide(r: Record<string, unknown>): LegacySlide {
  return {
    id: r.id as string, module_id: r.module_id as string, title: (r.title as string) ?? "",
    content: (r.content_html as string | null) ?? null, content_html: (r.content_html as string | null) ?? null,
    slide_number: Number(r.sort_order ?? 0), slide_type: (r.slide_type as string | null) ?? null,
    image_url: (r.image_url as string | null) ?? null, audio_url: (r.audio_url as string | null) ?? null,
  };
}

export async function getLegacySlides(moduleId: string): Promise<LegacySlide[]> {
  const { data, error } = await db().from("module_slides").select("*")
    .eq("module_id", moduleId).order("sort_order", { ascending: true });
  if (error) { console.error("Training: getSlides error:", error); return []; }
  return (data ?? []).map(toSlide);
}

/** A learner's module progress (Instructor HQ; owner/admin/manager/instructor only). */
export async function getLegacyProgress(studentId: string): Promise<LegacyModuleProgress[]> {
  const companyId = activeCompanyId();
  if (!companyId) return [];
  const { data, error } = await db().rpc("training_learner_progress", { p_company_id: companyId, p_user_id: studentId });
  if (error) { console.error("Training: getProgress error:", error); return []; }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, student_id: studentId, module_id: r.module_id as string, status: r.status as string,
    progress_percentage: Number(r.progress_percentage ?? 0), current_slide: (r.current_slide as number | null) ?? null,
    completed_at: (r.completed_at as string | null) ?? null, last_accessed_at: (r.last_accessed_at as string | null) ?? null,
    training_modules: { module_name: r.module_name as string, module_code: r.module_code as string, description: null },
  }));
}

/** The signed-in user's own module progress in the active company. */
export async function getMyLegacyProgress(): Promise<LegacyModuleProgress[]> {
  const companyId = activeCompanyId();
  const userId = await ensureInternalUser();
  if (!companyId || !userId) return [];
  const { data, error } = await db().from("student_module_progress")
    .select("*, training_modules!inner(module_name, module_code, description, company_id)")
    .eq("user_id", userId).eq("training_modules.company_id", companyId);
  if (error) { console.error("Training: getMyProgress error:", error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => {
    const m = r.training_modules as { module_name: string; module_code: string; description: string | null };
    return {
      id: r.id as string, student_id: r.user_id as string, module_id: r.module_id as string,
      status: (r.status as string) ?? "not_started", progress_percentage: Number(r.progress_percentage ?? 0),
      current_slide: (r.current_slide as number | null) ?? null, completed_at: (r.completed_at as string | null) ?? null,
      last_accessed_at: (r.last_accessed_at as string | null) ?? null,
      training_modules: { module_name: m.module_name, module_code: m.module_code, description: m.description },
    };
  });
}

/** Create a module. With default_course_id it is also added to the end of that course. */
export async function createLegacyModule(moduleData: {
  module_code: string;
  module_name: string;
  description?: string;
  difficulty_level?: string;
  duration_minutes?: number;
  default_course_id?: string;
}): Promise<WriteResult> {
  const companyId = activeCompanyId();
  if (!companyId) return { success: false, error: "missing_company" };
  const supabase = db();
  const { data, error } = await supabase.from("training_modules")
    .insert({ ...moduleData, company_id: companyId, is_active: true, display_order: 999 })
    .select("id").single();
  if (error) return fail("createModule", error);
  if (moduleData.default_course_id) {
    const { count } = await supabase.from("course_modules").select("id", { count: "exact", head: true })
      .eq("course_id", moduleData.default_course_id);
    const { error: linkErr } = await supabase.from("course_modules").insert({
      company_id: companyId, course_id: moduleData.default_course_id, module_id: data.id,
      module_order: (count ?? 0) + 1, is_required: true,
    });
    if (linkErr) return { ...fail("linkModule", linkErr), id: data.id };
  }
  return { success: true, id: data.id };
}

export async function updateLegacyModule(moduleId: string, updates: Partial<{
  module_name: string;
  description: string;
  difficulty_level: string;
  duration_minutes: number;
  is_active: boolean;
  display_order: number;
}>): Promise<WriteResult> {
  const { data, error } = await db().from("training_modules").update({ ...updates, updated_at: nowIso() })
    .eq("id", moduleId).select("id");
  if (error) return fail("updateModule", error);
  return rowsOrMissing(data);
}

type SlideFields = { title: string; content_html: string; slide_number: number; slide_type: string; image_url: string; audio_url: string };

/** UI slide fields -> module_slides columns (slide_number -> sort_order). */
export function toSlideRow(s: Partial<SlideFields>): Record<string, unknown> {
  const { slide_number, ...rest } = s;
  return slide_number === undefined ? { ...rest } : { ...rest, sort_order: slide_number };
}

export async function createLegacySlide(slideData: Partial<SlideFields> & { module_id: string; title: string; slide_number: number }): Promise<WriteResult> {
  const { module_id, ...fields } = slideData;
  const { data, error } = await db().from("module_slides")
    .insert({ module_id, content_html: "", ...toSlideRow(fields) }).select("id").single();
  if (error) return fail("createSlide", error);
  return { success: true, id: data.id };
}

export async function updateLegacySlide(slideId: string, updates: Partial<SlideFields>): Promise<WriteResult> {
  const { data, error } = await db().from("module_slides").update({ ...toSlideRow(updates), updated_at: nowIso() })
    .eq("id", slideId).select("id");
  if (error) return fail("updateSlide", error);
  return rowsOrMissing(data);
}

export async function deleteLegacySlide(slideId: string): Promise<WriteResult> {
  const { data, error } = await db().from("module_slides").delete().eq("id", slideId).select("id");
  if (error) return fail("deleteSlide", error);
  return rowsOrMissing(data);
}
