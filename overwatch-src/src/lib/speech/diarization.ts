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

/** Drop segments shorter than this — usually noise / breathing / room tone
 *  misclassified as a third speaker. Bumped from 0.25s after observed
 *  misalignment where 0.3s "ghost" segments at turn boundaries captured
 *  the trailing word of the real speaker. */
const MIN_SEG_DURATION_S = 0.4;

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

export interface DiarizeOptions {
  /**
   * If set, reduce the speaker count to at most this many by merging the
   * lowest-airtime speakers into their nearest temporal neighbors. Useful
   * when the user knows the recording has exactly N speakers — eliminates
   * "ghost speakers" introduced by background noise misclassification.
   *
   * `undefined` / 0 = auto (no cap, let pyannote decide).
   */
  expectedSpeakers?: number;
}

/**
 * Diarize a full-length audio buffer.
 *
 * @param audio 16kHz mono Float32 samples (same shape as Whisper input)
 * @param onProgress Optional callback for download/inference progress
 * @param options Optional knobs (expectedSpeakers, etc.)
 * @returns Array of segments sorted by start time, with stable speaker ids
 */
export async function diarize(
  audio: Float32Array,
  onProgress?: ProgressCallback,
  options: DiarizeOptions = {},
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
      return postProcess(segs.map(s => ({ ...s })), options.expectedSpeakers);
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

  return postProcess(all, options.expectedSpeakers);
}

/**
 * Drop short segments, merge adjacent same-speaker segments, optionally
 * reduce to the expected speaker count, and renumber speakers in order
 * of first appearance so the labels are stable and human-friendly
 * (0, 1, 2 instead of arbitrary internal IDs).
 */
function postProcess(segments: DiarizationSegment[], expectedSpeakers?: number): DiarizationSegment[] {
  // Drop slivers
  const filtered = segments.filter(s => s.end - s.start >= MIN_SEG_DURATION_S);

  // Merge same-speaker adjacent
  let merged = mergeAdjacent(filtered);

  // Optionally reduce to expected speaker count by merging the
  // lowest-airtime speakers into temporal neighbors.
  if (expectedSpeakers && expectedSpeakers > 0) {
    merged = reduceToExpectedSpeakers(merged, expectedSpeakers);
    // Re-merge in case the reduction made same-speaker segments adjacent
    merged = mergeAdjacent(merged);
  }

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

/**
 * Reduce the segment list to at most `target` distinct speakers by
 * repeatedly absorbing the speaker with the lowest total airtime into
 * its most-frequent temporal neighbor.
 *
 * Algorithm:
 *   while distinct speakers > target:
 *     1. Compute total airtime per speaker.
 *     2. Pick the speaker with minimum airtime (call it `victim`).
 *     3. For each segment owned by `victim`, count its temporal neighbors
 *        (the previous and next segments by start time) and pick the
 *        neighbor speaker that appears most often.
 *     4. Reassign every `victim` segment to that neighbor speaker.
 *
 * This is O(n × N) where N = current speaker count; fine for typical
 * recording sizes (a few minutes, a few hundred segments).
 */
function reduceToExpectedSpeakers(segments: DiarizationSegment[], target: number): DiarizationSegment[] {
  if (segments.length === 0) return segments;
  let working = segments.slice();
  while (true) {
    const distinct = new Set(working.map(s => s.speaker));
    if (distinct.size <= target) break;

    // 1. Airtime per speaker
    const airtime = new Map<string, number>();
    for (const s of working) {
      airtime.set(s.speaker, (airtime.get(s.speaker) ?? 0) + (s.end - s.start));
    }
    // 2. Lowest-airtime speaker = the victim
    let victim: string | null = null;
    let victimAirtime = Infinity;
    for (const [speaker, t] of airtime) {
      if (t < victimAirtime) {
        victimAirtime = t;
        victim = speaker;
      }
    }
    if (!victim) break;

    // 3. Vote on best replacement among temporal neighbors of every victim segment
    const sorted = [...working].sort((a, b) => a.start - b.start);
    const votes = new Map<string, number>();
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].speaker !== victim) continue;
      const prev = sorted[i - 1];
      const next = sorted[i + 1];
      if (prev && prev.speaker !== victim) {
        votes.set(prev.speaker, (votes.get(prev.speaker) ?? 0) + 1);
      }
      if (next && next.speaker !== victim) {
        votes.set(next.speaker, (votes.get(next.speaker) ?? 0) + 1);
      }
    }
    // Pick winner. If victim segments have no non-victim neighbors (rare —
    // would mean the victim is the only speaker in a sub-region), pick
    // the speaker with the most overall airtime as a tiebreak.
    let winner: string | null = null;
    let winnerVotes = 0;
    for (const [speaker, v] of votes) {
      if (v > winnerVotes) { winnerVotes = v; winner = speaker; }
    }
    if (!winner) {
      let mostAirtime = 0;
      for (const [speaker, t] of airtime) {
        if (speaker === victim) continue;
        if (t > mostAirtime) { mostAirtime = t; winner = speaker; }
      }
    }
    if (!winner) break; // pathological: only one speaker left

    // 4. Reassign every victim segment
    working = working.map(s => s.speaker === victim ? { ...s, speaker: winner! } : s);
  }
  return working;
}
