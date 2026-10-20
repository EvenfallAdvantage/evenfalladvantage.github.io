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
import { sha256Hex, hashesMatch, type CaptureMeta } from "@/lib/evidence/integrity";
import { getSignedFileUrl } from "./db-helpers";

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
  capturedAt?: string | null;
  captureLat?: number | null;
  captureLng?: number | null;
  captureAccuracy?: number | null;
  captureSource?: string | null;
}

export interface CustodyEvent {
  id: string;
  action: string;
  actorName: string;
  hash: string | null;
  note: string | null;
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
  fileType: "photo" | "video" | "audio" | "document",
  capture?: CaptureMeta,
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
    hash = await sha256Hex(await file.arrayBuffer());
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
  const base = {
    id,
    incident_id: incidentId,
    file_url: `incident-media/${storagePath}`,
    file_type: fileType,
    file_name: file.name,
    file_size: file.size,
    uploaded_by: userId,
    hash,
    ...ts(),
  };
  const captureCols = capture ? {
    captured_at: capture.capturedAt,
    capture_lat: capture.lat,
    capture_lng: capture.lng,
    capture_accuracy_m: capture.accuracy,
    capture_source: capture.source,
  } : {};
  let { data, error: insertErr } = await supabase.from("incident_media").insert({ ...base, ...captureCols }).select().maybeSingle();
  // Before migration 20261020033000 the capture columns don't exist yet: retry without them.
  if (insertErr && capture && (insertErr.code === "PGRST204" || insertErr.code === "42703")) {
    ({ data, error: insertErr } = await supabase.from("incident_media").insert(base).select().maybeSingle());
  }

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
    capturedAt: data.captured_at ?? capture?.capturedAt ?? null,
    captureLat: data.capture_lat ?? capture?.lat ?? null,
    captureLng: data.capture_lng ?? capture?.lng ?? null,
    captureAccuracy: data.capture_accuracy_m ?? capture?.accuracy ?? null,
    captureSource: data.capture_source ?? capture?.source ?? null,
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
    capturedAt: m.captured_at ?? null,
    captureLat: m.capture_lat ?? null,
    captureLng: m.capture_lng ?? null,
    captureAccuracy: m.capture_accuracy_m ?? null,
    captureSource: m.capture_source ?? null,
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

// ─── Chain of custody ─────────────────────────────────────

/** Record a custody event (viewed / downloaded / verified / exported). Never throws. */
export async function logEvidenceEvent(mediaId: string, action: "viewed" | "downloaded" | "verified" | "exported", hash?: string | null, note?: string) {
  try {
    const { error } = await createClient().rpc("log_evidence_event", { p_media_id: mediaId, p_action: action, p_hash: hash ?? null, p_note: note ?? null });
    if (error && error.code !== "PGRST202") console.warn("[custody] log failed", error.message);
  } catch { /* best effort */ }
}

export async function getCustodyLog(mediaId: string): Promise<CustodyEvent[] | null> {
  const { data, error } = await createClient()
    .from("evidence_custody_log")
    .select("id, action, hash, note, created_at, users:actor_id(first_name, last_name)")
    .eq("media_id", mediaId)
    .order("created_at", { ascending: true });
  if (error) { if (error.code !== "42P01" && error.code !== "PGRST205") logDbReadError("custody-log", error); return null; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((e: any) => ({
    id: e.id, action: e.action, hash: e.hash, note: e.note, createdAt: e.created_at,
    actorName: e.users ? `${e.users.first_name ?? ""} ${e.users.last_name ?? ""}`.trim() || "Unknown" : "System",
  }));
}

/**
 * Re-download the stored file, re-hash it and compare with the hash taken at
 * upload. The server re-checks the claim before logging it as verified.
 */
export async function verifyIncidentMedia(m: Pick<IncidentMedia, "id" | "fileUrl" | "hash">): Promise<{ ok: boolean; computed: string | null }> {
  try {
    const url = await getSignedFileUrl(m.fileUrl, 120);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const computed = await sha256Hex(await res.arrayBuffer());
    const ok = hashesMatch(computed, m.hash);
    await logEvidenceEvent(m.id, "verified", computed);
    return { ok, computed };
  } catch {
    return { ok: false, computed: null };
  }
}
