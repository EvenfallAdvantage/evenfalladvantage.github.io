import { getLegacyClient } from "./client";
import { legacyRead, viaLegacyBridge } from "./bridge";
import type { LegacyModule, LegacySlide, LegacyModuleProgress } from "./types";

/** Get all training modules from legacy */
export async function getLegacyModules(): Promise<LegacyModule[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("training_modules")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Legacy: getModules error:", error);
    return [];
  }
  return data ?? [];
}

/** Get slides for a module */
export async function getLegacySlides(moduleId: string): Promise<LegacySlide[]> {
  const client = getLegacyClient();

  const { data, error } = await client
    .from("module_slides")
    .select("*")
    .eq("module_id", moduleId)
    .order("slide_number", { ascending: true });

  if (error) {
    console.error("Legacy: getSlides error:", error);
    return [];
  }
  return data ?? [];
}

/** A student's module progress (Instructor HQ). */
export async function getLegacyProgress(studentId: string): Promise<LegacyModuleProgress[]> {
  return legacyRead("student.progress", { keys: { student_id: studentId } }, () => directGetLegacyProgress(studentId), []);
}

/** The signed-in user's OWN module progress (studentId: fallback only). */
export async function getMyLegacyProgress(studentId: string): Promise<LegacyModuleProgress[]> {
  return legacyRead("me.progress", {}, () => directGetLegacyProgress(studentId), []);
}

async function directGetLegacyProgress(studentId: string): Promise<LegacyModuleProgress[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("student_module_progress")
    .select(`
      *,
      training_modules (
        module_name,
        module_code,
        description
      )
    `)
    .eq("student_id", studentId);

  if (error) {
    console.error("Legacy: getProgress error:", error);
    return [];
  }
  return data ?? [];
}

/** Update module progress in legacy DB */
export async function updateLegacyProgress(
  studentId: string,
  moduleId: string,
  progressData: {
    progress_percentage: number;
    current_slide?: number;
    completed_at?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  // Server path: the function resolves the caller's own student row from the
  // session (studentId is only used by the pre-bridge fallback below).
  const viaBridge = await viaLegacyBridge("progress.save", {
    keys: { module_id: moduleId },
    values: {
      progress_percentage: progressData.progress_percentage,
      ...(progressData.current_slide !== undefined ? { current_slide: progressData.current_slide } : {}),
    },
  });
  if (viaBridge) return viaBridge.success ? { success: true } : { success: false, error: viaBridge.error };

  const client = getLegacyClient();

  const status = progressData.progress_percentage === 100 ? "completed" : "in_progress";

  // Upsert
  const { data: existing } = await client
    .from("student_module_progress")
    .select("id")
    .eq("student_id", studentId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (existing) {
    const { error } = await client
      .from("student_module_progress")
      .update({ ...progressData, status })
      .eq("student_id", studentId)
      .eq("module_id", moduleId);

    if (error) {
      console.error("Legacy: updateProgress error:", error);
      return { success: false };
    }
  } else {
    const { error } = await client
      .from("student_module_progress")
      .insert({
        student_id: studentId,
        module_id: moduleId,
        ...progressData,
        status,
      });

    if (error) {
      console.error("Legacy: insertProgress error:", error);
      return { success: false };
    }
  }

  return { success: true };
}

/** Create a training module in legacy */
export async function createLegacyModule(moduleData: {
  module_code: string;
  module_name: string;
  description?: string;
  difficulty_level?: string;
  duration_minutes?: number;
  default_course_id?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const viaBridge = await viaLegacyBridge("module.create", { values: moduleData });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();
  const { data, error } = await client
    .from("training_modules")
    .insert({ ...moduleData, is_active: true, display_order: 999 })
    .select("id")
    .single();
  if (error) { console.error("Legacy: createModule error:", error); return { success: false }; }
  return { success: true, id: data.id };
}

/** Update a training module in legacy */
export async function updateLegacyModule(moduleId: string, updates: Partial<{
  module_name: string;
  description: string;
  difficulty_level: string;
  duration_minutes: number;
  is_active: boolean;
  display_order: number;
}>): Promise<{ success: boolean; error?: string }> {
  const viaBridge = await viaLegacyBridge("module.update", { keys: { id: moduleId }, values: updates });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();
  const { error } = await client.from("training_modules").update(updates).eq("id", moduleId);
  if (error) { console.error("Legacy: updateModule error:", error); return { success: false }; }
  return { success: true };
}

/** Map the Overwatch slide shape to EADB module_slides columns (content_html -> content). */
export function toSlideRow<T extends { content_html?: string }>(slide: T): Omit<T, "content_html"> & { content?: string } {
  const { content_html, ...rest } = slide;
  return content_html === undefined ? rest : { ...rest, content: content_html };
}

/** Create a slide in legacy */
export async function createLegacySlide(slideData: {
  module_id: string;
  title: string;
  content_html?: string;
  slide_number: number;
  slide_type?: string;
  image_url?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  // EADB column is `content`; `content_html` never existed there (inserts with it failed).
  const row = toSlideRow(slideData);
  const viaBridge = await viaLegacyBridge("slide.create", { values: row });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();
  const { data, error } = await client
    .from("module_slides")
    .insert(row)
    .select("id")
    .single();
  if (error) { console.error("Legacy: createSlide error:", error); return { success: false }; }
  return { success: true, id: data.id };
}

/** Update a slide in legacy */
export async function updateLegacySlide(slideId: string, updates: Partial<{
  title: string;
  content_html: string;
  slide_number: number;
  slide_type: string;
  image_url: string;
}>): Promise<{ success: boolean; error?: string }> {
  const row = toSlideRow(updates);
  const viaBridge = await viaLegacyBridge("slide.update", { keys: { id: slideId }, values: row });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();
  const { error } = await client.from("module_slides").update(row).eq("id", slideId);
  if (error) { console.error("Legacy: updateSlide error:", error); return { success: false }; }
  return { success: true };
}

/** Delete a slide in legacy */
export async function deleteLegacySlide(slideId: string): Promise<{ success: boolean; error?: string }> {
  const viaBridge = await viaLegacyBridge("slide.delete", { keys: { id: slideId } });
  if (viaBridge) return viaBridge;
  const client = getLegacyClient();
  const { error } = await client.from("module_slides").delete().eq("id", slideId);
  if (error) { console.error("Legacy: deleteSlide error:", error); return { success: false }; }
  return { success: true };
}
