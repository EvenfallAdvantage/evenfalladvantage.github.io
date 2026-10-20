/**
 * Diarization-Transcript Alignment
 *
 * Given:
 *   - A list of timestamped words from Whisper (whisper-engine)
 *   - A list of speaker segments from pyannote (diarization)
 *
 * Produce a list of "speaker turns": contiguous spans of text from the
 * same speaker, ordered by time. Each turn carries the speaker id,
 * the merged text of all words that fall inside it, and the time range.
 *
 * Algorithm: for each Whisper word, find the diarization segment whose
 * time range it overlaps most. Group consecutive words by the assigned
 * speaker into "turns".
 *
 * If diarization is empty (e.g. model failed to load), every word is
 * assigned to a single "0" speaker — the caller can then suppress the
 * speaker labels entirely or fall back to plain-text display.
 */

import type { DiarizationSegment } from "./diarization";
import type { WhisperWord } from "./whisper-engine";
import { acousticRematch } from "./acoustic-rematch";

export type SpeakerTurn = {
  speaker: string;
  text: string;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
};

/**
 * Find the best speaker for a Whisper word (initial / time-based assignment).
 *
 * Standard approach: assign each word to the speaker whose segment has
 * the most temporal overlap with the word. This is the textbook
 * algorithm used by all major diarization-alignment libraries (pyannote
 * Python, NVIDIA NeMo, etc.).
 *
 * If no segment overlaps, fall back to the nearest segment by time
 * distance. If multiple segments tie, prefer the previous word's
 * speaker (stickiness) to reduce mid-turn flickering.
 *
 * Boundary refinement (acoustic re-matching using pitch + spectral
 * features) happens as a separate post-pass in `alignWordsToSpeakers`,
 * not here. Keep this function purely time-based and well-understood.
 */
function assignSpeaker(
  word: WhisperWord,
  segments: DiarizationSegment[],
  previousSpeaker: string | null,
): string {
  if (segments.length === 0) return "0";
  // Crosstalk markers (two speakers at once) don't say who owns a word;
  // use solo segments when any exist.
  const solo = segments.filter(s => !s.overlap);
  if (solo.length > 0) segments = solo;

  let bestSpeaker = segments[0].speaker;
  let bestOverlap = -Infinity;
  for (const seg of segments) {
    const overlap = Math.min(word.end, seg.end) - Math.max(word.start, seg.start);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSpeaker = seg.speaker;
    }
  }

  // If there's a tie or near-tie, prefer the previous speaker.
  if (previousSpeaker && previousSpeaker !== bestSpeaker) {
    const prevOverlap = segments
      .filter(s => s.speaker === previousSpeaker)
      .reduce((max, s) => {
        const o = Math.min(word.end, s.end) - Math.max(word.start, s.start);
        return o > max ? o : max;
      }, -Infinity);
    // "Near-tie" = previous speaker has at least 80% as much overlap
    if (prevOverlap > 0 && prevOverlap >= bestOverlap * 0.8) {
      return previousSpeaker;
    }
  }

  // No overlap at all → nearest segment by time distance
  if (bestOverlap <= 0) {
    let nearestDist = Infinity;
    for (const seg of segments) {
      const dist = word.start < seg.start
        ? seg.start - word.start
        : word.start > seg.end ? word.start - seg.end : 0;
      if (dist < nearestDist) {
        nearestDist = dist;
        bestSpeaker = seg.speaker;
      }
    }
  }

  return bestSpeaker;
}

/**
 * Merge Whisper words with diarization segments into speaker turns.
 *
 * Words within the same span of speaker continuity are concatenated.
 * Returns turns sorted by start time. Empty input → empty output.
 *
 * Pipeline:
 *   1. Greedy time-based assignment (assignSpeaker)
 *   2. Acoustic re-matching (optional, when `audio` is provided): for
 *      each word, extract pitch + spectral features and reassign to the
 *      acoustically-closest speaker. Fixes boundary words that pyannote
 *      mis-labeled because its segment boundary was slightly off.
 *   3. Group into speaker turns
 *   4. Flicker absorption: collapse single-word A-B-A noise turns
 *
 * @param words Whisper word-level timestamps
 * @param segments Pyannote speaker segments
 * @param audio Optional 16 kHz mono Float32 audio buffer. When provided,
 *   enables acoustic re-matching for higher accuracy at boundary words.
 *   Omit to fall back to pure time-based alignment.
 */
/** Per-word acoustic re-matching (see stage 2). Off by default. */
const ACOUSTIC_REMATCH = false;

export function alignWordsToSpeakers(
  words: WhisperWord[],
  segments: DiarizationSegment[],
  audio?: Float32Array,
): SpeakerTurn[] {
  if (words.length === 0) return [];

  // Sort words by start time defensively
  const sortedWords = [...words].sort((a, b) => a.start - b.start);

  // Stage 1: greedy time-based assignment
  let currentSpeaker: string | null = null;
  const initialAssignments: { word: WhisperWord; speaker: string }[] = [];
  for (const word of sortedWords) {
    const speaker = assignSpeaker(word, segments, currentSpeaker);
    initialAssignments.push({ word, speaker });
    currentSpeaker = speaker;
  }

  // Stage 2: acoustic re-matching if audio is available. Compares each
  // word's voice characteristics (pitch, spectral centroid, etc.) against
  // per-speaker profiles built from confidently-assigned words. Catches
  // the most common alignment bug: boundary words wrongly attributed to
  // the adjacent speaker because pyannote's segment edges aren't perfect.
  //
  // Disabled by default: with the powerset fix in diarization.ts the time
  // labels are already right, and on test interviews the per-word pitch /
  // spectral re-match flipped correct words (distinct-voice interview: 5
  // wrong words with it, 1 without). Sentence smoothing below handles the
  // boundary-word case instead. Kept behind a flag for experiments.
  const finalAssignments = audio && ACOUSTIC_REMATCH
    ? acousticRematch(initialAssignments, segments, audio)
    : initialAssignments;

  // Stage 3: sentence smoothing. Speaker changes snap to sentence ends or
  // real pauses; a sentence is never split between speakers unless the
  // change happens at crosstalk (an interruption).
  const smoothed = smoothBySentence(finalAssignments, segments);

  // Stage 4: group consecutive same-speaker words into turns
  const turns: SpeakerTurn[] = [];
  for (const { word, speaker } of smoothed) {
    const last = turns[turns.length - 1];
    if (last && last.speaker === speaker) {
      last.text = (last.text + " " + word.text).replace(/\s+/g, " ").trim();
      last.end = word.end;
    } else {
      turns.push({ speaker, text: word.text.trim(), start: word.start, end: word.end });
    }
  }

  // Stage 5: flicker absorption, re-merge, then mark interruptions.
  return markInterruptions(mergeSameSpeaker(absorbFlickerTurns(turns)), segments);
}

/** Pause (s) between words that counts as a sentence break even without punctuation. */
const SENTENCE_PAUSE_S = 0.6;
/** How close (s) a speaker change must be to crosstalk to allow a mid-sentence split. */
const CROSSTALK_SLACK_S = 0.5;

function nearCrosstalk(t: number, segments: DiarizationSegment[]): boolean {
  return segments.some(s => s.overlap && t >= s.start - CROSSTALK_SLACK_S && t <= s.end + CROSSTALK_SLACK_S);
}

/**
 * Give every sentence a single speaker (duration-weighted vote of its words).
 * Fixes "last word of the sentence goes to the next speaker": Whisper's
 * final-word timestamp often runs into the following pause/turn, so the
 * time-based label of that one word is unreliable while the rest of the
 * sentence is not. Exception: when the label change inside a sentence sits
 * on crosstalk and both sides have ≥2 words, keep the split (interruption).
 */
function smoothBySentence(
  assigned: { word: WhisperWord; speaker: string }[],
  segments: DiarizationSegment[],
): { word: WhisperWord; speaker: string }[] {
  const out: { word: WhisperWord; speaker: string }[] = [];
  let sentence: { word: WhisperWord; speaker: string }[] = [];
  const flush = () => {
    if (sentence.length === 0) return;
    // Split into runs of same speaker
    const runs: { word: WhisperWord; speaker: string }[][] = [];
    for (const a of sentence) {
      const r = runs[runs.length - 1];
      if (r && r[0].speaker === a.speaker) r.push(a); else runs.push([a]);
    }
    // Keep interruption boundaries; vote within each piece.
    const pieces: { word: WhisperWord; speaker: string }[][] = [[]];
    for (let i = 0; i < runs.length; i++) {
      const cur = pieces[pieces.length - 1];
      if (i > 0 && cur.length >= 2 && runs[i].length >= 2 && nearCrosstalk(runs[i][0].word.start, segments)) {
        pieces.push([...runs[i]]);
      } else {
        cur.push(...runs[i]);
      }
    }
    for (const p of pieces) {
      const vote = new Map<string, number>();
      for (const a of p) vote.set(a.speaker, (vote.get(a.speaker) ?? 0) + Math.max(0.05, a.word.end - a.word.start));
      let win = p[0].speaker; let best = -1;
      for (const [sp, v] of vote) if (v > best) { best = v; win = sp; }
      for (const a of p) out.push({ word: a.word, speaker: win });
    }
    sentence = [];
  };
  for (let i = 0; i < assigned.length; i++) {
    const a = assigned[i];
    const next = assigned[i + 1];
    sentence.push(a);
    const endsSentence = /[.?!]["')\]]*$/.test(a.word.text);
    const pause = next ? next.word.start - a.word.end >= SENTENCE_PAUSE_S : true;
    if (endsSentence || pause || !next) flush();
  }
  flush();
  return out;
}

/** Merge consecutive turns that ended up with the same speaker. */
function mergeSameSpeaker(turns: SpeakerTurn[]): SpeakerTurn[] {
  const out: SpeakerTurn[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.speaker === t.speaker) {
      last.text = (last.text + " " + t.text).replace(/\s+/g, " ").trim();
      last.end = Math.max(last.end, t.end);
    } else out.push({ ...t });
  }
  return out;
}

/**
 * Where one speaker takes over during crosstalk, end the cut-off turn with
 * an em dash (if it had no sentence-ending punctuation) and prefix the
 * next turn with "[crosstalk]". No words are added or removed.
 */
function markInterruptions(turns: SpeakerTurn[], segments: DiarizationSegment[]): SpeakerTurn[] {
  if (!segments.some(s => s.overlap)) return turns;
  for (let i = 1; i < turns.length; i++) {
    const prev = turns[i - 1];
    const cur = turns[i];
    const hit = segments.some(s => s.overlap && s.start <= cur.start + CROSSTALK_SLACK_S && s.end >= prev.end - CROSSTALK_SLACK_S - 1);
    if (!hit) continue;
    if (!/[.?!]$/.test(prev.text)) prev.text = prev.text.replace(/[,;:]$/, "") + "—";
    if (!cur.text.startsWith("[crosstalk]")) cur.text = "[crosstalk] " + cur.text;
  }
  return turns;
}

/**
 * Absorb very-short turns that are sandwiched between two same-speaker
 * turns. A turn qualifies as "flicker" if:
 *   - it's < FLICKER_DURATION_S long, AND
 *   - both neighbors exist and have the same speaker (different from this turn's), AND
 *   - the gap between the neighbors (if this turn were removed) is small
 *
 * The flicker turn's text is appended to whichever neighbor is closer in time.
 */
const FLICKER_DURATION_S = 1.0;
function absorbFlickerTurns(turns: SpeakerTurn[]): SpeakerTurn[] {
  if (turns.length < 3) return turns;
  const out: SpeakerTurn[] = [];
  for (let i = 0; i < turns.length; i++) {
    const cur = turns[i];
    const prev = out[out.length - 1];
    const next = turns[i + 1];
    const isFlicker =
      cur.end - cur.start < FLICKER_DURATION_S
      && prev && next
      && prev.speaker === next.speaker
      && prev.speaker !== cur.speaker;
    if (isFlicker) {
      // Decide whether to append to prev or to next. Pick the closer one
      // by time gap; tie goes to prev (already in `out`).
      const gapToPrev = cur.start - prev.end;
      const gapToNext = next.start - cur.end;
      if (gapToPrev <= gapToNext) {
        prev.text = (prev.text + " " + cur.text).replace(/\s+/g, " ").trim();
        prev.end = cur.end;
      } else {
        // Defer absorption to next iteration by mutating `next` (turns[i+1])
        turns[i + 1] = {
          ...next,
          text: (cur.text + " " + next.text).replace(/\s+/g, " ").trim(),
          start: cur.start,
        };
      }
      continue;
    }
    out.push({ ...cur });
  }
  return out;
}

/**
 * Render a list of speaker turns as a plain-text transcript with
 * inline speaker labels. Reversible: the format is also parseable back
 * into turns by `parseInlineTranscript()` below.
 *
 * Format:
 *   [Speaker 1] First thing he said.
 *   [Speaker 2] Then a response.
 *   [Speaker 1] Continued.
 *
 * Speaker labels are 1-indexed (human-friendly) even though the
 * underlying ids are 0-indexed.
 */
export function turnsToInlineText(turns: SpeakerTurn[]): string {
  return turns
    .map(t => `[Speaker ${Number(t.speaker) + 1}] ${t.text}`)
    .join("\n");
}

/**
 * Inverse of `turnsToInlineText` — parse a transcript with inline speaker
 * labels back into structured turns. Lines without a leading `[Speaker N]`
 * prefix are appended to the previous turn (i.e. multi-line speaker turns
 * are supported).
 *
 * Time ranges are not recoverable from the inline text; turns parsed this
 * way have `start: 0, end: 0`. Use for display-only round-trips.
 */
export function parseInlineTranscript(text: string): SpeakerTurn[] {
  const lines = text.split(/\r?\n/);
  const turns: SpeakerTurn[] = [];
  const re = /^\[Speaker\s+(\d+)\]\s*(.*)$/i;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = re.exec(line);
    if (m) {
      const speakerNum = Math.max(1, parseInt(m[1], 10) || 1);
      turns.push({
        speaker: String(speakerNum - 1),
        text: m[2].trim(),
        start: 0,
        end: 0,
      });
    } else if (turns.length > 0) {
      // Continuation of the previous speaker (allows manual line breaks)
      turns[turns.length - 1].text += " " + line;
      turns[turns.length - 1].text = turns[turns.length - 1].text.replace(/\s+/g, " ").trim();
    } else {
      // No prior turn — assign to Speaker 1 by default
      turns.push({ speaker: "0", text: line, start: 0, end: 0 });
    }
  }
  return turns;
}

/**
 * Count the unique speakers in a list of turns.
 */
export function countSpeakers(turns: SpeakerTurn[]): number {
  return new Set(turns.map(t => t.speaker)).size;
}
