/**
 * Acoustic Re-Matching — fix per-word speaker assignments using voice features
 *
 * Pyannote draws speaker boundaries with ~0.2-0.5 s of slop. When a word
 * sits right at one of those boundaries, the greedy time-based alignment
 * sometimes assigns it to the wrong speaker. The result is the familiar
 * bug pattern: "the trailing word of speaker A's turn becomes speaker B's
 * leading word", or vice versa.
 *
 * This module fixes those by:
 *   1. Extracting acoustic features (pitch, spectral centroid, etc.)
 *      from each word's audio slice.
 *   2. Building a per-speaker mean feature profile from the unambiguous
 *      words (those that sit well inside their pyannote segment).
 *   3. For each boundary-suspect word, re-checking distance to each
 *      speaker's profile. If a different speaker is meaningfully closer,
 *      reassign the word.
 *
 * Conservative by default: a word only moves if the alternative speaker
 * is at least 25% closer than the current one. Avoids flapping back and
 * forth on noisy / borderline cases.
 */

import type { WhisperWord } from "./whisper-engine";
import type { DiarizationSegment } from "./diarization";
import { extractFeatures, SAMPLE_RATE, type AcousticFeatures } from "./acoustic-features";

/** A word + its speaker assignment. Same shape used in alignment. */
export interface ScoredWord {
  word: WhisperWord;
  speaker: string;
  /** Acoustic features extracted from the word's audio slice. */
  features?: AcousticFeatures;
}

/**
 * Per-speaker average feature vector. Computed from "confident" words
 * (those that sit well inside their segment, not at boundaries).
 */
interface SpeakerProfile {
  speaker: string;
  f0: number;
  centroid: number;
  rolloff: number;
  zcr: number;
  /** Number of words contributing to the profile. Higher = more reliable. */
  sampleCount: number;
}

/**
 * Reassign boundary-suspect words to the acoustically-closest speaker
 * profile. Returns a new list of {word, speaker} pairs.
 *
 * @param assignments Words with their initial (time-based) speaker labels
 * @param segments Pyannote segments (used to find "confident" words for profiles)
 * @param audio Full audio buffer in 16 kHz mono Float32 format
 */
export function acousticRematch(
  assignments: { word: WhisperWord; speaker: string }[],
  segments: DiarizationSegment[],
  audio: Float32Array,
): { word: WhisperWord; speaker: string }[] {
  if (assignments.length === 0 || audio.length === 0) return assignments;

  // Distinct speakers — if only one, nothing to rematch.
  const distinctSpeakers = new Set(assignments.map(a => a.speaker));
  if (distinctSpeakers.size < 2) return assignments;

  // Step 1: extract features for every word
  const scored: ScoredWord[] = assignments.map(a => ({
    word: a.word,
    speaker: a.speaker,
    features: extractFeaturesForWord(a.word, audio),
  }));

  // Step 2: build per-speaker profile from "confident" words only.
  //
  // A word is "confident" if it's NOT at a segment boundary — i.e. both
  // its start and end fall well inside (not within `BOUNDARY_PAD_S` of)
  // its assigned speaker's nearest segment edge. This ensures the profile
  // is built from clean exemplars, not the same boundary words we're
  // trying to fix.
  const profiles = buildProfiles(scored, segments);

  // If we couldn't build a profile for some speaker (no confident words),
  // skip rematching for that speaker's words — we have nothing to compare against.
  if (profiles.size < distinctSpeakers.size) {
    // Still rematch words whose CURRENT speaker has a profile — they can
    // be moved to another speaker that has a profile.
  }

  // Step 3: for each word, compute distance to every speaker's profile.
  // Reassign if a different speaker is meaningfully closer.
  return scored.map(sw => {
    if (!sw.features || sw.features.unreliable) return { word: sw.word, speaker: sw.speaker };

    const currentProfile = profiles.get(sw.speaker);
    if (!currentProfile) return { word: sw.word, speaker: sw.speaker };

    const currentDist = featureDistance(sw.features, currentProfile);

    let bestSpeaker = sw.speaker;
    let bestDist = currentDist;
    for (const [speaker, profile] of profiles) {
      if (speaker === sw.speaker) continue;
      const dist = featureDistance(sw.features, profile);
      // Be conservative: only switch if the alternative is meaningfully closer
      if (dist < bestDist * 0.75) {
        bestSpeaker = speaker;
        bestDist = dist;
      }
    }
    return { word: sw.word, speaker: bestSpeaker };
  });
}

/**
 * Extract the audio slice for one word and run feature extraction.
 * Returns undefined if the slice is invalid.
 */
function extractFeaturesForWord(word: WhisperWord, audio: Float32Array): AcousticFeatures | undefined {
  const startSample = Math.max(0, Math.floor(word.start * SAMPLE_RATE));
  // Clamp the end to a generous bound: many Whisper words have inflated
  // end-times (silence padding). Cap at start + 1s to avoid pulling in
  // long silences that would skew the feature averages.
  const naturalEnd = Math.floor(word.end * SAMPLE_RATE);
  const cappedEnd = Math.min(naturalEnd, startSample + SAMPLE_RATE); // 1s cap
  const endSample = Math.min(audio.length, cappedEnd);
  if (endSample - startSample < 100) return undefined;
  const slice = audio.subarray(startSample, endSample);
  return extractFeatures(slice);
}

/**
 * Build per-speaker mean feature profiles from confident words.
 *
 * "Confident" = a word whose start AND end both sit at least
 * BOUNDARY_PAD_S inside the nearest segment edge of its assigned speaker.
 * Words near boundaries are excluded because they're the ones most likely
 * to have been mis-assigned in the first place.
 */
const BOUNDARY_PAD_S = 0.3;
function buildProfiles(
  scored: ScoredWord[],
  segments: DiarizationSegment[],
): Map<string, SpeakerProfile> {
  const segsBySpeaker = new Map<string, DiarizationSegment[]>();
  for (const seg of segments) {
    const list = segsBySpeaker.get(seg.speaker) ?? [];
    list.push(seg);
    segsBySpeaker.set(seg.speaker, list);
  }

  // Per-speaker running sums
  const sums = new Map<string, { f0: number; centroid: number; rolloff: number; zcr: number; n: number }>();

  for (const sw of scored) {
    if (!sw.features || sw.features.unreliable) continue;
    if (sw.features.f0 === 0) continue; // unvoiced — skip for pitch averaging
    if (!isWordConfident(sw.word, sw.speaker, segsBySpeaker)) continue;
    const entry = sums.get(sw.speaker) ?? { f0: 0, centroid: 0, rolloff: 0, zcr: 0, n: 0 };
    entry.f0 += sw.features.f0;
    entry.centroid += sw.features.centroid;
    entry.rolloff += sw.features.rolloff;
    entry.zcr += sw.features.zcr;
    entry.n++;
    sums.set(sw.speaker, entry);
  }

  // Fall back: if a speaker has no confident words, average ALL their
  // words instead. Better than no profile at all.
  for (const [speaker, segs] of segsBySpeaker) {
    if (sums.has(speaker)) continue;
    const allForSpeaker = scored.filter(sw => sw.speaker === speaker && sw.features && !sw.features.unreliable && sw.features.f0 > 0);
    if (allForSpeaker.length === 0) {
      // Reference segs to avoid unused-variable lint (segs is intentionally
      // looped but not used in the fall-back branch)
      void segs;
      continue;
    }
    const entry = { f0: 0, centroid: 0, rolloff: 0, zcr: 0, n: 0 };
    for (const sw of allForSpeaker) {
      entry.f0 += sw.features!.f0;
      entry.centroid += sw.features!.centroid;
      entry.rolloff += sw.features!.rolloff;
      entry.zcr += sw.features!.zcr;
      entry.n++;
    }
    sums.set(speaker, entry);
  }

  // Convert sums to mean profiles
  const profiles = new Map<string, SpeakerProfile>();
  for (const [speaker, s] of sums) {
    if (s.n === 0) continue;
    profiles.set(speaker, {
      speaker,
      f0: s.f0 / s.n,
      centroid: s.centroid / s.n,
      rolloff: s.rolloff / s.n,
      zcr: s.zcr / s.n,
      sampleCount: s.n,
    });
  }
  return profiles;
}

function isWordConfident(
  word: WhisperWord,
  speaker: string,
  segsBySpeaker: Map<string, DiarizationSegment[]>,
): boolean {
  const segs = segsBySpeaker.get(speaker);
  if (!segs) return false;
  for (const seg of segs) {
    if (word.start >= seg.start + BOUNDARY_PAD_S && word.end <= seg.end - BOUNDARY_PAD_S) {
      return true;
    }
  }
  return false;
}

/**
 * Normalized Euclidean distance between a feature vector and a speaker profile.
 *
 * Each dimension is normalized by a typical-spread scale so they
 * contribute roughly equally:
 *   - F0:       ~100 Hz typical spread between speakers
 *   - centroid: ~500 Hz typical spread
 *   - rolloff:  ~1000 Hz typical spread
 *   - zcr:      ~0.05 typical spread
 */
function featureDistance(features: AcousticFeatures, profile: SpeakerProfile): number {
  const df0 = (features.f0 - profile.f0) / 100;
  const dc = (features.centroid - profile.centroid) / 500;
  const dr = (features.rolloff - profile.rolloff) / 1000;
  const dz = (features.zcr - profile.zcr) / 0.05;
  return Math.sqrt(df0 * df0 + dc * dc + dr * dr + dz * dz);
}
