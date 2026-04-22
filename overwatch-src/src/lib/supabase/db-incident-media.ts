/**
 * Incident Media Attachments
 *
 * Handles photo/video/audio file uploads attached to incident reports.
 * Files are stored in Supabase Storage (incidents bucket) with metadata
 * tracked in the incident_media table for chain-of-custody.
 *
 * Table: incident_media (must be created via SQL migration)
 *   id, incident_id, file_url, file_type, file_name, file_size,
 *   uploaded_by, hash, created_at
 */

import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

export interface IncidentMedia {
  id: string;
  incidentId: string;
  fileUrl: string;
  fileType: string;   // "photo" | "video" | "audio" | "document"
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploaderName: string;
  hash: string | null; // SHA-256 for evidence integrity
  createdAt: string;
}

// ─── Upload ───────────────────────────────────────────────

/**
 * Upload a media file and attach it to an incident.
 * Computes SHA-256 hash for evidence chain-of-custody.
 */
export async function uploadIncidentMedia(
  incidentId: string,
  companyId: string,
  file: File,
  fileType: "photo" | "video" | "audio" | "document"
): Promise<IncidentMedia | null> {
  const userId = await ensureInternalUser();
  if (!userId) return null;

  const supabase = createClient();
  const id = crypto.randomUUID();
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${companyId}/${incidentId}/${id}.${ext}`;

  // Compute SHA-256 hash for evidence integrity
  let hash: string | null = null;
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Hash computation failed — proceed without it
  }

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from("incident-media")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadErr) {
    console.error("[IncidentMedia] Upload failed:", uploadErr.message);
    return null;
  }

  // Create metadata record
  const { data, error: insertErr } = await supabase
    .from("incident_media")
    .insert({
      id,
      incident_id: incidentId,
      file_url: `incident-media/${storagePath}`,
      file_type: fileType,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: userId,
      hash,
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (insertErr) {
    console.error("[IncidentMedia] Record insert failed:", insertErr.message);
    // Try to clean up the uploaded file
    await supabase.storage.from("incident-media").remove([storagePath]);
    return null;
  }

  return data ? {
    id: data.id,
    incidentId: data.incident_id,
    fileUrl: data.file_url,
    fileType: data.file_type,
    fileName: data.file_name,
    fileSize: data.file_size,
    uploadedBy: data.uploaded_by,
    uploaderName: "", // Populated separately
    hash: data.hash,
    createdAt: data.created_at,
  } : null;
}

// ─── Queries ──────────────────────────────────────────────

/**
 * Get all media attachments for an incident.
 */
export async function getIncidentMedia(incidentId: string): Promise<IncidentMedia[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("incident_media")
    .select("*, users!incident_media_uploaded_by_fkey(first_name, last_name)")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });

  if (error) { logDbReadError("incident-media", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((m: any) => ({
    id: m.id,
    incidentId: m.incident_id,
    fileUrl: m.file_url,
    fileType: m.file_type,
    fileName: m.file_name,
    fileSize: m.file_size,
    uploadedBy: m.uploaded_by,
    uploaderName: m.users ? `${m.users.first_name} ${m.users.last_name}` : "Unknown",
    hash: m.hash,
    createdAt: m.created_at,
  }));
}

/**
 * Delete a media attachment (removes file + record).
 */
export async function deleteIncidentMedia(mediaId: string): Promise<boolean> {
  const supabase = createClient();

  // Get the file URL first
  const { data: media } = await supabase
    .from("incident_media")
    .select("file_url")
    .eq("id", mediaId)
    .maybeSingle();

  if (media?.file_url) {
    // Remove from storage
    const path = media.file_url.replace("incident-media/", "");
    await supabase.storage.from("incident-media").remove([path]);
  }

  // Delete the record
  const { error } = await supabase
    .from("incident_media")
    .delete()
    .eq("id", mediaId);

  return !error;
}
