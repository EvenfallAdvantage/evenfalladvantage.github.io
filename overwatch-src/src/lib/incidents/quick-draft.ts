/** Quick incident report: pure helpers (draft autosave, title/severity defaults). */
export const QUICK_TYPES = [
  { key: "suspicious_activity", label: "Suspicious", severity: "medium" },
  { key: "trespass", label: "Trespass", severity: "medium" },
  { key: "medical", label: "Medical", severity: "high" },
  { key: "theft", label: "Theft", severity: "medium" },
  { key: "vandalism", label: "Damage", severity: "low" },
  { key: "assault", label: "Fight / Assault", severity: "high" },
  { key: "fire", label: "Fire / Smoke", severity: "critical" },
  { key: "alarm", label: "Alarm", severity: "low" },
  { key: "slip_trip_fall", label: "Slip / Fall", severity: "medium" },
  { key: "general", label: "Other", severity: "low" },
] as const;

export type QuickDraft = {
  type: string | null;
  severity: string;
  note: string;
  startedAt: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  locationText: string;
};

const KEY = (companyId: string) => `ow-quick-incident:${companyId}`;
const MAX_AGE_MS = 24 * 3600 * 1000;

export function newDraft(now = new Date()): QuickDraft {
  return { type: null, severity: "low", note: "", startedAt: now.toISOString(), lat: null, lng: null, accuracy: null, locationText: "" };
}

export function defaultSeverity(type: string): string {
  return QUICK_TYPES.find((t) => t.key === type)?.severity ?? "low";
}

export function quickTitle(d: QuickDraft): string {
  const label = QUICK_TYPES.find((t) => t.key === d.type)?.label ?? "Incident";
  const first = d.note.trim().split(/\r?\n/)[0].slice(0, 60);
  return first ? `${label}: ${first}` : `${label} reported`;
}

export function formatGps(d: Pick<QuickDraft, "lat" | "lng" | "accuracy">): string {
  if (d.lat == null || d.lng == null) return "";
  return `GPS ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}${d.accuracy != null ? ` (±${Math.round(d.accuracy)} m)` : ""}`;
}

export function quickDescription(d: QuickDraft): string {
  const lines = [d.note.trim() || "(no notes)", "", `Observed: ${new Date(d.startedAt).toLocaleString()}`];
  const gps = formatGps(d);
  if (gps) lines.push(gps);
  lines.push("Filed with Quick Report.");
  return lines.join("\n");
}

export function saveDraft(companyId: string, d: QuickDraft, store: Storage = localStorage) {
  try { store.setItem(KEY(companyId), JSON.stringify(d)); } catch { /* quota */ }
}
export function loadDraft(companyId: string, now = Date.now(), store: Storage = localStorage): QuickDraft | null {
  try {
    const raw = store.getItem(KEY(companyId)); if (!raw) return null;
    const d = JSON.parse(raw) as QuickDraft;
    if (!d?.startedAt || now - Date.parse(d.startedAt) > MAX_AGE_MS) { store.removeItem(KEY(companyId)); return null; }
    return d;
  } catch { return null; }
}
export function clearDraft(companyId: string, store: Storage = localStorage) {
  try { store.removeItem(KEY(companyId)); } catch { /* ignore */ }
}
export function hasContent(d: QuickDraft | null): boolean {
  return !!d && (!!d.type || !!d.note.trim());
}
