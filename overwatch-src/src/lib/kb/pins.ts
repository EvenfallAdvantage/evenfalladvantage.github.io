/**
 * "Pin for offline" Field Manual documents. Metadata + text bodies live in
 * localStorage (per company); attached files (PDF/image) are stored as blobs
 * in the Cache API so they open with no signal.
 */
const FILE_CACHE = "ow-kb-pins-v1";
const key = (companyId: string) => `ow-kb-pins:${companyId}`;
/** Skip caching files bigger than this (iOS storage quotas). */
export const MAX_PIN_FILE_BYTES = 25 * 1024 * 1024;

export interface PinnedDoc {
  id: string;
  title: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  folder_name: string | null;
  pinnedAt: string;
  fileCached: boolean;
}

export function getPins(companyId: string): PinnedDoc[] {
  try { return JSON.parse(localStorage.getItem(key(companyId)) || "[]") as PinnedDoc[]; } catch { return []; }
}
function savePins(companyId: string, pins: PinnedDoc[]) {
  try { localStorage.setItem(key(companyId), JSON.stringify(pins)); } catch { /* quota */ }
}
export function isPinned(companyId: string, docId: string): boolean {
  return getPins(companyId).some((p) => p.id === docId);
}

export async function pinDoc(companyId: string, doc: Omit<PinnedDoc, "pinnedAt" | "fileCached"> & { file_size?: number | null }): Promise<PinnedDoc> {
  let fileCached = false;
  if (doc.file_url && typeof caches !== "undefined" && (!doc.file_size || doc.file_size <= MAX_PIN_FILE_BYTES)) {
    try {
      const res = await fetch(doc.file_url, { mode: "cors" });
      if (res.ok) { await (await caches.open(FILE_CACHE)).put(doc.file_url, res); fileCached = true; }
    } catch { /* keep text-only pin */ }
  }
  const pin: PinnedDoc = { id: doc.id, title: doc.title, content: doc.content ?? null, file_url: doc.file_url ?? null, file_name: doc.file_name ?? null, mime_type: doc.mime_type ?? null, folder_name: doc.folder_name ?? null, pinnedAt: new Date().toISOString(), fileCached };
  savePins(companyId, [pin, ...getPins(companyId).filter((p) => p.id !== doc.id)]);
  return pin;
}

export async function unpinDoc(companyId: string, docId: string): Promise<void> {
  const pins = getPins(companyId);
  const pin = pins.find((p) => p.id === docId);
  savePins(companyId, pins.filter((p) => p.id !== docId));
  if (pin?.file_url && typeof caches !== "undefined") { try { await (await caches.open(FILE_CACHE)).delete(pin.file_url); } catch { /* ignore */ } }
}

/** Object URL for a pinned file, or null if it isn't cached. Caller revokes it. */
export async function pinnedFileUrl(fileUrl: string): Promise<string | null> {
  try {
    if (typeof caches === "undefined") return null;
    const res = await (await caches.open(FILE_CACHE)).match(fileUrl);
    return res ? URL.createObjectURL(await res.blob()) : null;
  } catch { return null; }
}
