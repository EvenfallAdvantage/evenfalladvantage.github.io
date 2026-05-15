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
 * Strategy (in priority order):
 *   1. Word start in exactly one segment → that speaker.
 *   2. Word start in multiple overlapping segments → previous speaker
 *      preferred (stickiness), else highest-confidence segment.
 *   3. Word start in a gap → try midpoint, same stickiness rules.
 *   4. Word entirely outside any segment → previous speaker if any,
 *      else nearest segment by time distance.
 *
 * Notes on what was tried and removed:
 *   - We previously added a "boundary tolerance" that kept the previous
 *     speaker whenever their segment ended within 0.5s of this word.
 *     That fixed cases where the LAST word of a turn leaked to the next
 *     speaker, but caused the OPPOSITE bug: the FIRST word of a new
 *     speaker leaked back to the previous one. Acoustic re-matching
 *     (acoustic-rematch.ts) is a more accurate way to handle the same
 *     class of bug — it uses voice features rather than blind temporal
 *     bias, so it switches direction correctly per word.
 *
 *   - Word START is used as the anchor (not midpoint) because Whisper's
 *     END timestamps are inflated by trailing silence/breath, while the
 *     START timestamp accurately marks when audible speech begins.
 */
function assignSpeaker(
  word: WhisperWord,
  segments: DiarizationSegment[],
  previousSpeaker: string | null,
): string {
  if (segments.length === 0) return "0";

  // 1. Word start in exactly one segment → that speaker.
  const containingStart = segments.filter(s => s.start <= word.start && s.end >= word.start);
  if (containingStart.length === 1) {
    return containingStart[0].speaker;
  }
  if (containingStart.length > 1) {
    // Multiple segments overlap at word.start. Prefer previous speaker.
    if (previousSpeaker && containingStart.some(s => s.speaker === previousSpeaker)) {
      return previousSpeaker;
    }
    const best = containingStart.reduce((a, b) =>
      (a.confidence ?? 0) >= (b.confidence ?? 0) ? a : b,
    );
    return best.speaker;
  }

  // 2. Word starts in a gap between segments. Try midpoint.
  const midpoint = (word.start + word.end) / 2;
  const containingMid = segments.filter(s => s.start <= midpoint && s.end >= midpoint);
  if (containingMid.length > 0) {
    if (previousSpeaker && containingMid.some(s => s.speaker === previousSpeaker)) {
      return previousSpeaker;
    }
    return containingMid[0].speaker;
  }

  // 3. Word is entirely outside any segment. Stickiness wins.
  if (previousSpeaker) return previousSpeaker;
  let bestSpeaker = segments[0].speaker;
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
  const finalAssignments = audio
    ? acousticRematch(initialAssignments, segments, audio)
    : initialAssignments;

  // Stage 3: group consecutive same-speaker words into turns
  const turns: SpeakerTurn[] = [];
  let groupSpeaker: string | null = null;
  let groupText: string[] = [];
  let groupStart = 0;
  let groupEnd = 0;
  for (const { word, speaker } of finalAssignments) {
    if (speaker !== groupSpeaker) {
      if (groupSpeaker !== null && groupText.length > 0) {
        turns.push({
          speaker: groupSpeaker,
          text: groupText.join(" ").replace(/\s+/g, " ").trim(),
          start: groupStart,
          end: groupEnd,
        });
      }
      groupSpeaker = speaker;
      groupText = [word.text];
      groupStart = word.start;
      groupEnd = word.end;
    } else {
      groupText.push(word.text);
      groupEnd = word.end;
    }
  }
  if (groupSpeaker !== null && groupText.length > 0) {
    turns.push({
      speaker: groupSpeaker,
      text: groupText.join(" ").replace(/\s+/g, " ").trim(),
      start: groupStart,
      end: groupEnd,
    });
  }

  // Stage 4: flicker absorption — handles A-B-A patterns where B is
  // brief (typically a noise misclassification).
  return absorbFlickerTurns(turns);
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
