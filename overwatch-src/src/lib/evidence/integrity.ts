/** Evidence integrity helpers (pure / browser-only, no Supabase). */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const h = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export type CaptureSource = "camera" | "library" | "file";
export type CaptureMeta = {
  capturedAt: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  source: CaptureSource;
};

/** Camera shots are stamped "now"; picked files keep the file's own modified time. */
export function captureMetaFor(file: File, source: CaptureSource, fix: { lat: number; lng: number; accuracy: number } | null, now = Date.now()): CaptureMeta {
  const at = source === "camera" || !file.lastModified ? now : Math.min(file.lastModified, now);
  return {
    capturedAt: new Date(at).toISOString(),
    lat: source === "camera" ? fix?.lat ?? null : null,
    lng: source === "camera" ? fix?.lng ?? null : null,
    accuracy: source === "camera" ? fix?.accuracy ?? null : null,
    source,
  };
}

export function shortHash(h: string | null | undefined, n = 12): string {
  return h ? `${h.slice(0, n)}…` : "no hash";
}

export const CUSTODY_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  viewed: "Viewed",
  downloaded: "Downloaded",
  verified: "Integrity verified",
  verify_failed: "Integrity check FAILED",
  exported: "Exported",
  deleted: "Deleted",
};

export function quickFix(timeoutMs = 6000): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((res) => {
    const t = setTimeout(() => res(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      () => { clearTimeout(t); res(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}
