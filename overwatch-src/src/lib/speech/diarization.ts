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
import { loadTransformers } from "./transformers-loader";
import { extractFeatures, type AcousticFeatures } from "./acoustic-features";

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
  /** True when pyannote heard two people at once here (crosstalk). The
   *  same time span is emitted once per overlapping speaker. */
  overlap?: boolean;
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
      await loadTransformers();

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
 * pyannote/segmentation-3.0 is a POWERSET model: each frame's class is a
 * set of active (window-local) speakers, NOT a speaker id.
 *   0 = nobody (silence), 1..3 = one speaker, 4..6 = two at once.
 * Treating the class index as a speaker id (the old behaviour) turned every
 * pause into its own "speaker", so the trailing word of a sentence (whose
 * Whisper timestamp runs into the pause) got the pause's label and showed
 * up as a separate speaker.
 */
const POWERSET: number[][] = [[], [0], [1], [2], [0, 1], [0, 2], [1, 2]];

type WindowSeg = { local: number[]; start: number; end: number; confidence: number };

/**
 * Run pyannote on a single window of audio (≤10s at 16kHz mono).
 * Returns voiced regions with their window-local speaker set and times
 * relative to the START of the window. Silence is dropped.
 */
async function diarizeWindow(window: Float32Array): Promise<WindowSeg[]> {
  if (!modelInstance || !processorInstance) {
    throw new Error("Diarization model not loaded");
  }
  const inputs = await processorInstance(window);
  const { logits } = await modelInstance(inputs);
  const result: Array<Array<{ id: number; start: number; end: number; confidence: number }>> =
    processorInstance.post_process_speaker_diarization(logits, window.length);
  const raw = result[0] ?? [];
  return raw
    .map(r => ({ local: POWERSET[r.id] ?? [], start: r.start, end: r.end, confidence: r.confidence }))
    .filter(r => r.local.length > 0);
}

/** Feature distance used to link window-local speakers to global ones. */
function voiceDistance(a: AcousticFeatures, b: AcousticFeatures): number {
  // Pitch is the most stable cue across a recording; spectral shape moves
  // a lot with what is being said, so it gets a much wider scale.
  const df0 = a.f0 > 0 && b.f0 > 0 ? (a.f0 - b.f0) / 40 : 0;
  const dc = (a.centroid - b.centroid) / 1500;
  const dr = (a.rolloff - b.rolloff) / 3000;
  const dz = (a.zcr - b.zcr) / 0.1;
  return Math.sqrt(df0 * df0 + dc * dc + dr * dr + dz * dz);
}

/** Above this voice distance (≈80 Hz pitch gap) a window-local speaker becomes a NEW speaker
 *  (unless the expected-speaker cap is already reached). */
const NEW_SPEAKER_DISTANCE = 2.0;
/** A time-based link is overridden when the voice is at least this far off
 *  and another known speaker is at least twice as close. */
const VOICE_OVERRIDE_DISTANCE = 1.5;
/** Pitch gap (Hz) under which two voices are treated as the same person in auto mode. */
const SAME_PITCH_HZ = 25;
/** Seconds of shared time in the window overlap needed to link by time. */
const LINK_OVERLAP_S = 0.3;

function voiceOf(audio: Float32Array, spans: { start: number; end: number }[]): AcousticFeatures {
  const parts: Float32Array[] = [];
  let total = 0;
  for (const s of spans) {
    const a = Math.max(0, Math.floor(s.start * DIARIZATION_SAMPLE_RATE));
    const b = Math.min(audio.length, Math.floor(s.end * DIARIZATION_SAMPLE_RATE));
    if (b > a) { parts.push(audio.subarray(a, b)); total += b - a; }
    if (total > DIARIZATION_SAMPLE_RATE * 6) break;
  }
  const buf = new Float32Array(total);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return extractFeatures(buf);
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
 * Audio is processed in 10 s windows with 2 s overlap. Window-local speaker
 * ids are arbitrary per window, so each local speaker is linked to a global
 * speaker by (1) shared time in the overlap zone, else (2) the closest voice
 * fingerprint (pitch + spectral shape), else (3) a new speaker. Each window
 * only contributes its "core" span (overlap split down the middle) so two
 * windows never vote on the same instant.
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
  const halfOverlapS = (WINDOW_S - STRIDE_S) / 2;
  const durationS = audio.length / sampleRate;
  const maxSpeakers = options.expectedSpeakers && options.expectedSpeakers > 0 ? options.expectedSpeakers : Infinity;

  const all: DiarizationSegment[] = [];
  const voices = new Map<string, { f: AcousticFeatures; n: number }>();
  let nextGlobal = 0;
  /** Previous window's FULL (untrimmed) solo segments, for overlap-zone linking. */
  let prevFull: { speaker: string; start: number; end: number }[] = [];

  const totalWindows = audio.length <= windowSamples
    ? 1
    : Math.max(1, Math.ceil((audio.length - windowSamples) / strideSamples) + 1);
  let windowIndex = 0;
  for (let offsetSamples = 0; offsetSamples < audio.length; offsetSamples += strideSamples) {
    const end = Math.min(offsetSamples + windowSamples, audio.length);
    const slice = audio.subarray(offsetSamples, end);
    let inputSlice = slice;
    if (slice.length < windowSamples && totalWindows > 1) {
      inputSlice = new Float32Array(windowSamples);
      inputSlice.set(slice, 0);
    }
    const offsetS = offsetSamples / sampleRate;
    const isFirst = offsetSamples === 0;
    const isLast = end >= audio.length;
    const coreStart = isFirst ? 0 : offsetS + halfOverlapS;
    const coreEnd = isLast ? durationS : offsetS + WINDOW_S - halfOverlapS;
    try {
      const segs = (await diarizeWindow(inputSlice)).map(s => ({
        ...s,
        start: offsetS + s.start,
        end: Math.min(offsetS + s.end, durationS),
      })).filter(s => s.end > s.start);

      // Link each window-local speaker to a global id.
      const locals = [...new Set(segs.flatMap(s => s.local))];
      const map = new Map<number, string>();
      const used = new Set<string>();
      // Order: most airtime first so the strongest evidence links first.
      const air = (l: number) => segs.filter(s => s.local.length === 1 && s.local[0] === l).reduce((t, s) => t + s.end - s.start, 0);
      locals.sort((a, b) => air(b) - air(a));
      for (const l of locals) {
        const solo = segs.filter(s => s.local.length === 1 && s.local[0] === l);
        // (1) shared time with already-placed global segments (overlap zone)
        const shared = new Map<string, number>();
        for (const s of solo) {
          for (const g of prevFull) {
            const o = Math.min(s.end, g.end) - Math.max(s.start, g.start);
            if (o > 0) shared.set(g.speaker, (shared.get(g.speaker) ?? 0) + o);
          }
        }
        let pick: string | null = null;
        let best = LINK_OVERLAP_S;
        for (const [g, o] of shared) if (!used.has(g) && o >= best) { best = o; pick = g; }
        const v = solo.length ? voiceOf(audio, solo) : null;
        // A time link loses to the voice when the voice clearly disagrees
        // (pyannote's window edges can briefly put the wrong person there).
        if (pick && v && !v.unreliable && voices.get(pick) && !voices.get(pick)!.f.unreliable) {
          const dPick = voiceDistance(v, voices.get(pick)!.f);
          for (const [g, gv] of voices) {
            if (g === pick || used.has(g) || gv.f.unreliable) continue;
            const d = voiceDistance(v, gv.f);
            if (dPick > VOICE_OVERRIDE_DISTANCE && d < dPick / 2) pick = g;
          }
        }
        // (2) closest voice
        if (!pick && v && !v.unreliable) {
          let bestD = Infinity;
          for (const [g, gv] of voices) {
            if (used.has(g)) continue;
            const d = voiceDistance(v, gv.f);
            if (d < bestD) { bestD = d; pick = g; }
          }
          // Only start a new speaker when the voice is far off AND the pitch
          // really differs. Phone mic processing (AGC / noise suppression)
          // shifts spectral shape between turns of the same person, but
          // barely moves pitch.
          const pickF0 = pick ? voices.get(pick)!.f.f0 : 0;
          const pitchClose = pickF0 > 0 && v.f0 > 0 && Math.abs(pickF0 - v.f0) < SAME_PITCH_HZ;
          if (pick && bestD > NEW_SPEAKER_DISTANCE && !pitchClose && voices.size < maxSpeakers) pick = null;
        }
        // (3) new speaker
        if (!pick) {
          if (voices.size >= maxSpeakers && voices.size > 0) {
            pick = [...voices.keys()].find(g => !used.has(g)) ?? [...voices.keys()][0];
          } else {
            pick = String(nextGlobal++);
          }
        }
        used.add(pick);
        map.set(l, pick);
        if (v && !v.unreliable) {
          const cur = voices.get(pick);
          if (!cur) voices.set(pick, { f: v, n: 1 });
          else {
            const n = cur.n + 1;
            cur.f = {
              f0: (cur.f.f0 * cur.n + v.f0) / n,
              centroid: (cur.f.centroid * cur.n + v.centroid) / n,
              rolloff: (cur.f.rolloff * cur.n + v.rolloff) / n,
              zcr: (cur.f.zcr * cur.n + v.zcr) / n,
              unreliable: false,
            };
            cur.n = n;
          }
        } else if (!voices.has(pick)) {
          voices.set(pick, { f: { f0: 0, centroid: 0, rolloff: 0, zcr: 0, unreliable: true }, n: 0 });
        }
      }

      prevFull = segs.filter(s => s.local.length === 1).map(s => ({ speaker: map.get(s.local[0])!, start: s.start, end: s.end }));

      // Keep only this window's core span.
      for (const s of segs) {
        const a = Math.max(s.start, coreStart);
        const b = Math.min(s.end, coreEnd);
        if (b <= a) continue;
        for (const l of s.local) {
          all.push({ speaker: map.get(l)!, start: a, end: b, confidence: s.confidence, ...(s.local.length > 1 ? { overlap: true } : {}) });
        }
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
    if (isLast) break;
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
  // Crosstalk markers are kept as-is (short overlaps are still meaningful);
  // only solo segments go through sliver-dropping and merging.
  const overlaps = segments.filter(s => s.overlap);
  // Drop slivers
  const filtered = segments.filter(s => !s.overlap && s.end - s.start >= MIN_SEG_DURATION_S);

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
  return [...merged, ...overlaps]
    .filter(s => remap.has(s.speaker))
    .map(s => ({ ...s, speaker: remap.get(s.speaker)! }))
    .sort((a, b) => a.start - b.start);
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
