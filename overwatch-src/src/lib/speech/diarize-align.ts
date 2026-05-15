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

export type SpeakerTurn = {
  speaker: string;
  text: string;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
};

/**
 * Find the best speaker for a Whisper word.
 *
 * Why not just "max overlap"? Whisper's word timestamps inflate the
 * trailing word's `end` time to include silence/breath after the actual
 * speech. This caused a real bug: every speaker turn's final word was
 * being mis-attributed to whichever speaker pyannote labeled the silence
 * that followed.
 *
 * Fix: anchor the word to its MIDPOINT (or, when the midpoint falls in
 * a gap between segments, the word's START). Midpoint is robust to the
 * trailing-silence inflation because it ignores how long Whisper claims
 * the word lasted — what matters is where the audible part of the word
 * actually sits.
 *
 * Then apply "stickiness": if the previous word's speaker also has any
 * meaningful overlap with this word, prefer keeping that speaker unless
 * the midpoint-winner is decisively better. Reduces single-word "speaker
 * flickering" at turn boundaries.
 */
function assignSpeaker(
  word: WhisperWord,
  segments: DiarizationSegment[],
  previousSpeaker: string | null,
): string {
  if (segments.length === 0) return "0";

  const midpoint = (word.start + word.end) / 2;

  // 1. Find segments that contain the midpoint
  const containing = segments.filter(s => s.start <= midpoint && s.end >= midpoint);
  if (containing.length === 1) {
    return containing[0].speaker;
  }
  if (containing.length > 1) {
    // Multiple segments contain the midpoint (overlap from windowing).
    // Apply stickiness: prefer previous speaker if it's one of them.
    if (previousSpeaker && containing.some(s => s.speaker === previousSpeaker)) {
      return previousSpeaker;
    }
    // Otherwise, pick the one with the highest confidence.
    const best = containing.reduce((a, b) =>
      (a.confidence ?? 0) >= (b.confidence ?? 0) ? a : b,
    );
    return best.speaker;
  }

  // 2. Midpoint falls in a gap between segments. Try the word's START.
  const containingStart = segments.filter(s => s.start <= word.start && s.end >= word.start);
  if (containingStart.length > 0) {
    if (previousSpeaker && containingStart.some(s => s.speaker === previousSpeaker)) {
      return previousSpeaker;
    }
    return containingStart[0].speaker;
  }

  // 3. Word is entirely outside any segment. Find the nearest segment by
  // time distance to the word's start.
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
 */
export function alignWordsToSpeakers(
  words: WhisperWord[],
  segments: DiarizationSegment[],
): SpeakerTurn[] {
  if (words.length === 0) return [];

  // Sort words by start time defensively
  const sortedWords = [...words].sort((a, b) => a.start - b.start);

  const turns: SpeakerTurn[] = [];
  let currentSpeaker: string | null = null;
  let currentText: string[] = [];
  let currentStart = 0;
  let currentEnd = 0;

  for (const word of sortedWords) {
    const speaker = assignSpeaker(word, segments, currentSpeaker);
    if (speaker !== currentSpeaker) {
      // Flush previous turn
      if (currentSpeaker !== null && currentText.length > 0) {
        turns.push({
          speaker: currentSpeaker,
          text: currentText.join(" ").replace(/\s+/g, " ").trim(),
          start: currentStart,
          end: currentEnd,
        });
      }
      currentSpeaker = speaker;
      currentText = [word.text];
      currentStart = word.start;
      currentEnd = word.end;
    } else {
      currentText.push(word.text);
      currentEnd = word.end;
    }
  }

  // Flush the last turn
  if (currentSpeaker !== null && currentText.length > 0) {
    turns.push({
      speaker: currentSpeaker,
      text: currentText.join(" ").replace(/\s+/g, " ").trim(),
      start: currentStart,
      end: currentEnd,
    });
  }

  // Post-alignment cleanup: absorb very short "flicker" turns into their
  // longer neighbors when the neighbor on both sides is the same speaker.
  // Example: [A: "hello there"] [B: "okay"] [A: "how are you"] where B's
  // turn is ~0.3s — almost certainly a misclassification, glue it into A.
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
