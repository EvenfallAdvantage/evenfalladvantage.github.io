/**
 * Saved signature (Profile → My Signature) for Shift Notes.
 *
 * The officer's own signature lives in the private `signatures` bucket at
 * {auth uid}/signature.png (owner-only storage policies). When they sign
 * Shift Notes, the image is copied onto the sign-off row as a PNG data URL
 * (dar_signoffs.signature_png) so later changes never alter past notes.
 */
import { createClient } from "@/lib/supabase/client";

export const SIGNATURE_BUCKET = "signatures";
export const SIGNATURE_FILE = "signature.png";
/** Data-URL cap; matches the DB CHECK (350k chars ≈ 256 KB PNG). */
export const MAX_SIGNATURE_DATA_URL = 350_000;
const PREFIX = "data:image/png;base64,";

export function isValidSignatureDataUrl(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(PREFIX) && v.length > PREFIX.length + 16 && v.length <= MAX_SIGNATURE_DATA_URL
    && /^[A-Za-z0-9+/]+=*$/.test(v.slice(PREFIX.length));
}

export function signaturePath(authUid: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(authUid)) throw new Error("bad uid");
  return `${authUid}/${SIGNATURE_FILE}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const bin = atob(dataUrl.slice(PREFIX.length));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return PREFIX + btoa(bin);
}

async function myUid(): Promise<string | null> {
  const { data } = await createClient().auth.getUser();
  return data.user?.id ?? null;
}

/** My saved signature as a PNG data URL, or null (none saved / bucket not set up). */
export async function getMySignature(): Promise<string | null> {
  const uid = await myUid();
  if (!uid) return null;
  const { data, error } = await createClient().storage.from(SIGNATURE_BUCKET).download(signaturePath(uid));
  if (error || !data) return null;
  const url = await blobToDataUrl(data);
  return isValidSignatureDataUrl(url) ? url : null;
}

export async function saveMySignature(dataUrl: string): Promise<{ ok: boolean }> {
  if (!isValidSignatureDataUrl(dataUrl)) return { ok: false };
  const uid = await myUid();
  if (!uid) return { ok: false };
  const { error } = await createClient().storage.from(SIGNATURE_BUCKET)
    .upload(signaturePath(uid), dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/png", cacheControl: "0" });
  return { ok: !error };
}

export async function deleteMySignature(): Promise<{ ok: boolean }> {
  const uid = await myUid();
  if (!uid) return { ok: false };
  const { error } = await createClient().storage.from(SIGNATURE_BUCKET).remove([signaturePath(uid)]);
  return { ok: !error };
}
