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

/** Find the speaker segment whose time range overlaps `word` the most. */
function assignSpeaker(word: WhisperWord, segments: DiarizationSegment[]): string {
  if (segments.length === 0) return "0";

  let bestSpeaker = segments[0].speaker;
  let bestOverlap = -Infinity;

  for (const seg of segments) {
    // Standard interval-overlap formula
    const overlap = Math.min(word.end, seg.end) - Math.max(word.start, seg.start);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSpeaker = seg.speaker;
    }
  }

  // If no segment actually overlaps (negative overlap), fall back to the
  // nearest segment by time distance.
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
    const speaker = assignSpeaker(word, segments);
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

  return turns;
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
