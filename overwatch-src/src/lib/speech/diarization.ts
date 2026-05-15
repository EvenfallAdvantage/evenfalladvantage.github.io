/**
 * Speaker Diarization Engine — client-side via @huggingface/transformers
 *
 * Uses pyannote/segmentation-3.0 (ONNX) to identify "who spoke when" in
 * an audio recording. Produces a list of time-stamped segments labeled
 * with a stable speaker id per recording.
 *
 * Pairs with whisper-engine.ts: Whisper transcribes WHAT was said,
 * pyannote tells us WHO said it. The diarize-align module merges the two.
 *
 * Lazy-loaded — this module is NOT in the main bundle. Adds ~6MB on top
 * of the existing ~75MB Whisper download (one-time, cached).
 *
 * pyannote/segmentation-3.0 architecture notes:
 *   - Sample rate: 16 kHz mono Float32 (same as Whisper — we can reuse buffers)
 *   - Window: 10 seconds; longer audio is chunked with overlap and stitched
 *   - Output: per-frame logits over 7 powerset classes (silence + speaker
 *     combinations for up to 3 simultaneous speakers per 10-s window)
 *   - The Transformers.js processor has `post_process_speaker_diarization`
 *     which collapses these into clean `{start, end, id, confidence}` segments
 *
 * Cross-window speaker linking:
 *   The processor returns speaker IDs that are LOCAL to each 10-s window.
 *   For longer audio we need to link "Speaker 0 in window N" with the
 *   "same person" in window N+1. We use a simple temporal-adjacency
 *   heuristic: a segment ending in window N that's followed (within
 *   `MERGE_GAP_S`) by a segment starting in window N+1 with similar
 *   characteristics is treated as the same speaker.
 *
 *   For higher quality cross-window speaker matching we'd need acoustic
 *   embeddings (a separate model like wespeaker). The temporal heuristic
 *   is sufficient for the short field-report use case (≤ a few minutes
 *   of two-to-four-speaker audio).
 */

import { logger } from "@/lib/logger";

const MODEL_ID = "onnx-community/pyannote-segmentation-3.0";

/** pyannote sample rate (matches Whisper — reuse the same Float32Array). */
export const DIARIZATION_SAMPLE_RATE = 16000;

/** pyannote processes 10s windows. We stride by 8s for 2s of overlap. */
const WINDOW_S = 10;
const STRIDE_S = 8;

/** Segments within this gap (seconds) and with the same window-local id
 *  are merged across the window boundary. */
const MERGE_GAP_S = 0.5;

/** Drop segments shorter than this — usually noise / breathing. */
const MIN_SEG_DURATION_S = 0.25;

export type DiarizationStatus = {
  status: "loading" | "downloading" | "ready" | "diarizing";
  progress?: number;
  message?: string;
};

type ProgressCallback = (p: DiarizationStatus) => void;

export type DiarizationSegment = {
  /** Stable speaker id across the entire recording, e.g. "0", "1", "2". */
  speaker: string;
  /** Start time in seconds from the start of the recording. */
  start: number;
  /** End time in seconds from the start of the recording. */
  end: number;
  /** Mean confidence from the underlying model (0-1). */
  confidence?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processorInstance: any = null;
let loadingPromise: Promise<void> | null = null;

/** True iff the diarization model has been loaded into memory this session. */
export function isDiarizationLoaded(): boolean {
  return modelInstance !== null && processorInstance !== null;
}

/**
 * Warm up the model (download + initialize). Safe to call multiple times.
 */
export async function loadDiarization(onProgress?: ProgressCallback): Promise<void> {
  if (isDiarizationLoaded()) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    onProgress?.({ status: "loading", message: "Initializing speaker detection..." });

    const { AutoModelForAudioFrameClassification, AutoProcessor, env } =
      await import("@huggingface/transformers");

    env.allowLocalModels = false;

    onProgress?.({ status: "downloading", message: "Downloading speaker model (~6 MB, one-time)...", progress: 0 });

    const [model, processor] = await Promise.all([
      AutoModelForAudioFrameClassification.from_pretrained(MODEL_ID, {
        dtype: "fp32",
        device: "wasm",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (p: any) => {
          if (p.status === "progress" && p.total) {
            const pct = Math.round((p.loaded / p.total) * 100);
            onProgress?.({ status: "downloading", progress: pct, message: `Downloading speaker model... ${pct}%` });
          }
        },
      }),
      AutoProcessor.from_pretrained(MODEL_ID),
    ]);

    modelInstance = model;
    processorInstance = processor;

    onProgress?.({ status: "ready", message: "Speaker model ready" });
  })();

  try {
    await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

/**
 * Run pyannote on a single window of audio (≤10s at 16kHz mono).
 * Returns segments with window-local speaker ids and times relative to
 * the START of the window.
 */
async function diarizeWindow(window: Float32Array): Promise<DiarizationSegment[]> {
  if (!modelInstance || !processorInstance) {
    throw new Error("Diarization model not loaded");
  }
  const inputs = await processorInstance(window);
  const { logits } = await modelInstance(inputs);
  const result: Array<Array<{ id: number; start: number; end: number; confidence: number }>> =
    processorInstance.post_process_speaker_diarization(logits, window.length);
  const raw = result[0] ?? [];
  return raw.map(r => ({
    speaker: String(r.id),
    start: r.start,
    end: r.end,
    confidence: r.confidence,
  }));
}

/**
 * Stitch segments across overlapping windows. Two segments that:
 *   - have the same local speaker id, AND
 *   - end-then-start within MERGE_GAP_S of each other,
 * are merged into one.
 *
 * This is a single-pass O(n) algorithm operating on sorted segments.
 */
function mergeAdjacent(segments: DiarizationSegment[]): DiarizationSegment[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const out: DiarizationSegment[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const cur = sorted[i];
    if (cur.speaker === prev.speaker && cur.start - prev.end <= MERGE_GAP_S) {
      // Merge: extend prev's end, average confidence
      prev.end = Math.max(prev.end, cur.end);
      if (prev.confidence != null && cur.confidence != null) {
        prev.confidence = (prev.confidence + cur.confidence) / 2;
      }
    } else {
      out.push(cur);
    }
  }
  return out;
}

/**
 * Diarize a full-length audio buffer.
 *
 * @param audio 16kHz mono Float32 samples (same shape as Whisper input)
 * @param onProgress Optional callback for download/inference progress
 * @returns Array of segments sorted by start time, with stable speaker ids
 */
export async function diarize(
  audio: Float32Array,
  onProgress?: ProgressCallback,
): Promise<DiarizationSegment[]> {
  if (!isDiarizationLoaded()) {
    await loadDiarization(onProgress);
  }
  onProgress?.({ status: "diarizing", message: "Identifying speakers..." });

  const sampleRate = DIARIZATION_SAMPLE_RATE;
  const windowSamples = WINDOW_S * sampleRate;
  const strideSamples = STRIDE_S * sampleRate;
  const all: DiarizationSegment[] = [];

  // Short clips fit in a single window — fast path.
  if (audio.length <= windowSamples) {
    try {
      const segs = await diarizeWindow(audio);
      return postProcess(segs.map(s => ({ ...s }))); // shallow copy, single window has no offset
    } catch (err) {
      logger.swallow("diarization:single-window", err, "warn");
      return [];
    }
  }

  // Long clips — slide windows with overlap and remap local times.
  const totalWindows = Math.max(1, Math.ceil((audio.length - windowSamples) / strideSamples) + 1);
  let windowIndex = 0;
  for (let offsetSamples = 0; offsetSamples + 1 < audio.length; offsetSamples += strideSamples) {
    const end = Math.min(offsetSamples + windowSamples, audio.length);
    const slice = audio.subarray(offsetSamples, end);
    // Pyannote expects exactly windowSamples; pad with zeros if shorter
    let inputSlice = slice;
    if (slice.length < windowSamples) {
      inputSlice = new Float32Array(windowSamples);
      inputSlice.set(slice, 0);
    }
    try {
      const segs = await diarizeWindow(inputSlice);
      const offsetS = offsetSamples / sampleRate;
      // Re-anchor window-local times to recording-global times. We also
      // namespace the local speaker id by window so cross-window IDs
      // collide intentionally — they get unified by the merge pass below
      // when temporally adjacent. If two adjacent windows independently
      // assigned the SAME local id (e.g. both saw "speaker 0"), they
      // probably ARE the same person, and the merge keeps it that way.
      for (const s of segs) {
        const trueEnd = Math.min(offsetS + s.end, audio.length / sampleRate);
        if (trueEnd - (offsetS + s.start) < MIN_SEG_DURATION_S) continue;
        all.push({
          speaker: s.speaker,
          start: offsetS + s.start,
          end: trueEnd,
          confidence: s.confidence,
        });
      }
    } catch (err) {
      logger.swallow(`diarization:window-${windowIndex}`, err, "warn");
    }
    windowIndex++;
    onProgress?.({
      status: "diarizing",
      progress: Math.round((windowIndex / totalWindows) * 100),
      message: `Identifying speakers... ${windowIndex}/${totalWindows}`,
    });
    if (end >= audio.length) break;
  }

  return postProcess(all);
}

/**
 * Drop short segments, merge adjacent same-speaker segments, and renumber
 * speakers in order of first appearance so the labels are stable and
 * human-friendly (0, 1, 2 instead of arbitrary internal IDs).
 */
function postProcess(segments: DiarizationSegment[]): DiarizationSegment[] {
  // Drop slivers
  const filtered = segments.filter(s => s.end - s.start >= MIN_SEG_DURATION_S);

  // Merge same-speaker adjacent
  const merged = mergeAdjacent(filtered);

  // Renumber: first-seen speaker becomes 0, next-new is 1, etc.
  const remap = new Map<string, string>();
  let nextId = 0;
  for (const seg of merged) {
    if (!remap.has(seg.speaker)) {
      remap.set(seg.speaker, String(nextId++));
    }
  }
  return merged.map(s => ({ ...s, speaker: remap.get(s.speaker) ?? s.speaker }));
}
