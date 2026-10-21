/**
 * Speech model pre-download. Audio never leaves the device; only the model
 * files (Whisper tiny.en ~75 MB, pyannote segmentation ~6 MB) are fetched
 * once from the Hugging Face CDN and kept in the browser's Cache API by
 * transformers.js ("transformers-cache").
 */
export const WHISPER_MODEL_ID = "onnx-community/whisper-tiny.en_timestamped";
export const DIARIZATION_MODEL_ID = "onnx-community/pyannote-segmentation-3.0";
const CACHE_NAME = "transformers-cache";

export type ModelCacheState = "unknown" | "missing" | "partial" | "ready";

/** Which models have their ONNX weights in the cache. */
export function cacheStateFromUrls(urls: string[]): ModelCacheState {
  const has = (id: string) => urls.some((u) => u.includes(id) && /\.onnx(\?|$)/.test(u));
  const w = has(WHISPER_MODEL_ID), d = has(DIARIZATION_MODEL_ID);
  return w && d ? "ready" : w || d ? "partial" : "missing";
}

export async function getSpeechModelCacheState(): Promise<ModelCacheState> {
  try {
    if (typeof caches === "undefined") return "unknown";
    if (!(await caches.has(CACHE_NAME))) return "missing";
    const keys = await (await caches.open(CACHE_NAME)).keys();
    return cacheStateFromUrls(keys.map((r) => r.url));
  } catch { return "unknown"; }
}

export async function isWhisperCached(): Promise<boolean> {
  const s = await getSpeechModelCacheState();
  if (s === "ready") return true;
  if (s !== "partial") return false;
  const keys = await (await caches.open(CACHE_NAME)).keys();
  return keys.some((r) => r.url.includes(WHISPER_MODEL_ID) && /\.onnx(\?|$)/.test(r.url));
}

/** True when the browser says we're on cellular or Data Saver is on. */
export function onMeteredConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as unknown as { connection?: { type?: string; saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.type === "cellular" || c.saveData === true);
}

/** Download + warm both models. Progress is 0–100 across both. */
export async function predownloadSpeechModels(onProgress?: (pct: number, label: string) => void): Promise<void> {
  const { loadModel } = await import("./whisper-engine");
  await loadModel((p) => onProgress?.(Math.round((p.progress ?? 0) * 0.9), p.message ?? "Speech model"));
  const { loadDiarization } = await import("./diarization");
  await loadDiarization((p) => onProgress?.(90 + Math.round((p.progress ?? 0) * 0.1), "Speaker model"));
  onProgress?.(100, "Ready");
}
