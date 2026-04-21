import { getLegacyClient } from "./client";
import type { LegacyStudent } from "./types";

/** Get all students from legacy */
export async function getLegacyStudents(): Promise<LegacyStudent[]> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("students")
    .select(`
      *,
      student_profiles(*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Legacy: getStudents error:", error);
    return [];
  }
  return data ?? [];
}

/** Create a student account in the legacy DB (for auto-linking) */
export async function createLegacyStudentProfile(
  userId: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<{ success: boolean; error?: string }> {
  const client = getLegacyClient();

  // Check if student already exists
  const { data: existing } = await client
    .from("students")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return { success: true }; // Already exists
  }

  // Create student record (upsert to handle race conditions)
  const { error: studentError } = await client
    .from("students")
    .upsert({
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
    }, { onConflict: "id" });

  if (studentError) {
    // 23505 = duplicate key — student already exists, treat as success
    if (studentError.code === "23505") {
      return { success: true };
    }
    console.error("Legacy: createStudent error:", studentError);
    return { success: false, error: studentError.message };
  }

  // Create profile
  const { error: profileError } = await client
    .from("student_profiles")
    .insert({ student_id: userId });

  if (profileError) {
    console.warn("Legacy: createProfile warning:", profileError.message);
    // Non-fatal — student exists
  }

  return { success: true };
}

/** Find a legacy student by email */
export async function findLegacyStudentByEmail(email: string): Promise<LegacyStudent | null> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("students")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
