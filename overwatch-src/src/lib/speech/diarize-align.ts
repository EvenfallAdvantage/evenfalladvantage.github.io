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
 * Whisper's word `end` timestamps are unreliable: they inflate to include
 * silence/breath after the actual speech, sometimes by 1-2 full seconds.
 * The word `start` timestamp is reliable — it marks when the audible
 * speech began. So we anchor speaker assignment to the word's START,
 * not its midpoint or its full overlap range.
 *
 * This was the root cause of the bug where speaker A's last word
 * ("selected.") got mis-attributed to speaker B: Whisper claimed
 * "selected." ended at 5.5s, even though A actually finished speaking
 * at 4.0s and B started at 4.5s. Midpoint anchoring put it at 4.6s
 * (= Speaker B), but the word's start at 3.7s correctly places it in
 * Speaker A's segment.
 *
 * Stickiness: when the start anchor lands in a region where multiple
 * speakers' segments overlap (rare, from windowed pyannote output),
 * prefer the previous word's speaker.
 */
function assignSpeaker(
  word: WhisperWord,
  segments: DiarizationSegment[],
  previousSpeaker: string | null,
): string {
  if (segments.length === 0) return "0";

  // Primary anchor: word START. Reliable because Whisper doesn't
  // backdate the start of a word, only inflates the end.
  const containingStart = segments.filter(s => s.start <= word.start && s.end >= word.start);
  if (containingStart.length === 1) {
    return containingStart[0].speaker;
  }
  if (containingStart.length > 1) {
    if (previousSpeaker && containingStart.some(s => s.speaker === previousSpeaker)) {
      return previousSpeaker;
    }
    const best = containingStart.reduce((a, b) =>
      (a.confidence ?? 0) >= (b.confidence ?? 0) ? a : b,
    );
    return best.speaker;
  }

  // Fallback 1: word starts in a gap between segments. Try the midpoint.
  const midpoint = (word.start + word.end) / 2;
  const containingMid = segments.filter(s => s.start <= midpoint && s.end >= midpoint);
  if (containingMid.length > 0) {
    if (previousSpeaker && containingMid.some(s => s.speaker === previousSpeaker)) {
      return previousSpeaker;
    }
    return containingMid[0].speaker;
  }

  // Fallback 2: word is entirely outside any segment. Prefer previous
  // speaker if there is one (the user almost certainly is still talking),
  // otherwise find the nearest segment by time distance.
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
