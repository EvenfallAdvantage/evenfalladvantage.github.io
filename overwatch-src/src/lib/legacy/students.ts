import { getLegacyClient } from "./client";
import { legacyRead, viaLegacyBridge } from "./bridge";
import type { LegacyStudent } from "./types";

/** Get all students from legacy (Instructor HQ). */
export async function getLegacyStudents(): Promise<LegacyStudent[]> {
  return legacyRead("students.list", {}, directGetLegacyStudents, []);
}

async function directGetLegacyStudents(): Promise<LegacyStudent[]> {
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
  // Server path always uses the signed-in user's own uid + email (userId/email
  // here are the same values; the function takes them from the session).
  const viaBridge = await viaLegacyBridge("student.ensure", { values: { first_name: firstName, last_name: lastName } });
  if (viaBridge) return viaBridge.success ? { success: true } : { success: false, error: viaBridge.error };
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

/**
 * The SIGNED-IN user's own legacy student record. Every caller passes the
 * user's own email; through the bridge the record is resolved from the session
 * (the email argument is only used by the pre-bridge fallback).
 */
export async function findLegacyStudentByEmail(email: string): Promise<LegacyStudent | null> {
  return legacyRead<LegacyStudent | null>("me.student", {}, () => directFindLegacyStudentByEmail(email), null);
}

async function directFindLegacyStudentByEmail(email: string): Promise<LegacyStudent | null> {
  const client = getLegacyClient();
  const { data, error } = await client
    .from("students")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
