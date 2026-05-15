/**
 * Acoustic Feature Extraction — pure-JS DSP for speaker fingerprinting
 *
 * Given a slice of 16 kHz mono Float32 audio (one word's worth), extracts
 * a small feature vector that's reasonably stable per-speaker:
 *
 *   - F0 (fundamental frequency / pitch) — median Hz across voiced frames
 *   - Spectral centroid — "brightness" of the voice (Hz)
 *   - Spectral rolloff — frequency below which 85% of energy sits (Hz)
 *   - Zero-crossing rate — proxy for noisiness vs. tonality
 *
 * These four numbers are enough to discriminate between two adult speakers
 * in clean audio well enough to correct most boundary-word mis-assignments
 * that pyannote-segmentation-3.0 leaves on the table.
 *
 * All math is plain ES2020 — no native deps, no WASM. About 1 ms per word
 * on a modern laptop.
 */

export interface AcousticFeatures {
  /** Median fundamental frequency in Hz across voiced frames. 0 if no voiced frames. */
  f0: number;
  /** Spectral centroid in Hz (weighted mean frequency by magnitude). */
  centroid: number;
  /** Frequency below which 85% of energy sits, in Hz. */
  rolloff: number;
  /** Zero-crossing rate (crossings per sample, 0..1). */
  zcr: number;
  /** True if the slice was too short / too quiet to produce reliable features. */
  unreliable: boolean;
}

/** Sample rate assumed throughout this module. */
export const SAMPLE_RATE = 16000;

/** Minimum audio duration (in samples) to attempt feature extraction. */
const MIN_SAMPLES = SAMPLE_RATE * 0.05; // 50 ms

/** Pitch detection range — covers adult speech (50 Hz male low to 500 Hz female high). */
const PITCH_MIN_HZ = 50;
const PITCH_MAX_HZ = 500;

/** Energy threshold below which we consider a frame to be silence. */
const SILENCE_RMS = 0.005;

/**
 * Extract acoustic features from an audio slice.
 *
 * @param samples 16 kHz mono Float32 audio samples
 * @returns Feature vector. `unreliable: true` means the caller should
 *   probably NOT include this in speaker-profile averaging.
 */
export function extractFeatures(samples: Float32Array): AcousticFeatures {
  if (samples.length < MIN_SAMPLES) {
    return { f0: 0, centroid: 0, rolloff: 0, zcr: 0, unreliable: true };
  }

  // RMS energy check — silent slices are useless for fingerprinting
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
  const rms = Math.sqrt(sumSq / samples.length);
  if (rms < SILENCE_RMS) {
    return { f0: 0, centroid: 0, rolloff: 0, zcr: 0, unreliable: true };
  }

  return {
    f0: estimatePitchMedian(samples),
    centroid: spectralCentroid(samples),
    rolloff: spectralRolloff(samples, 0.85),
    zcr: zeroCrossingRate(samples),
    unreliable: false,
  };
}

/* ─── Pitch (F0) ─────────────────────────────────────────────────── */

/**
 * Estimate the median fundamental frequency across the slice using a
 * simple autocorrelation peak-pick. Frames of 25 ms with 10 ms hop.
 *
 * This is not as robust as YIN or pYIN, but it's adequate for the
 * "is this voice A or voice B?" decision and avoids pulling in a
 * heavier DSP library.
 */
function estimatePitchMedian(samples: Float32Array): number {
  const frameSize = Math.floor(SAMPLE_RATE * 0.025); // 25 ms
  const hopSize = Math.floor(SAMPLE_RATE * 0.010);   // 10 ms
  const minLag = Math.floor(SAMPLE_RATE / PITCH_MAX_HZ);
  const maxLag = Math.floor(SAMPLE_RATE / PITCH_MIN_HZ);

  const pitches: number[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const frame = samples.subarray(start, start + frameSize);
    const pitch = autocorrelationPitch(frame, minLag, maxLag);
    if (pitch > 0) pitches.push(pitch);
  }

  if (pitches.length === 0) return 0;
  pitches.sort((a, b) => a - b);
  return pitches[Math.floor(pitches.length / 2)];
}

/**
 * Autocorrelation-based pitch estimate for a single frame.
 *
 * Returns the F0 in Hz of the peak autocorrelation in [minLag, maxLag],
 * or 0 if the frame is unvoiced (peak too low to trust).
 */
function autocorrelationPitch(frame: Float32Array, minLag: number, maxLag: number): number {
  // Compute frame energy for the unvoiced-frame threshold
  let frameEnergy = 0;
  for (let i = 0; i < frame.length; i++) frameEnergy += frame[i] * frame[i];
  if (frameEnergy === 0) return 0;

  // Autocorrelation: r[k] = sum_{i} samples[i] * samples[i+k]
  let bestLag = 0;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag && lag < frame.length; lag++) {
    let corr = 0;
    const upper = frame.length - lag;
    for (let i = 0; i < upper; i++) corr += frame[i] * frame[i + lag];
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Voiced-frame threshold: normalized correlation must exceed 0.3
  const normalized = bestCorr / frameEnergy;
  if (normalized < 0.3 || bestLag === 0) return 0;

  return SAMPLE_RATE / bestLag;
}

/* ─── Spectral features ──────────────────────────────────────────── */

/**
 * Spectral centroid: the weighted-mean frequency of the signal's
 * magnitude spectrum. Higher centroid = "brighter" sound.
 *
 * Uses a single 1024-point FFT on the middle of the slice, which is
 * sufficient for one-number-per-word fingerprinting.
 */
function spectralCentroid(samples: Float32Array): number {
  const mags = fftMagnitudes(samples);
  if (mags.length === 0) return 0;
  let weightedSum = 0;
  let totalMag = 0;
  for (let i = 0; i < mags.length; i++) {
    const freq = (i * SAMPLE_RATE) / (mags.length * 2);
    weightedSum += freq * mags[i];
    totalMag += mags[i];
  }
  return totalMag === 0 ? 0 : weightedSum / totalMag;
}

/**
 * Spectral rolloff: frequency below which `fraction` of total energy is concentrated.
 */
function spectralRolloff(samples: Float32Array, fraction: number): number {
  const mags = fftMagnitudes(samples);
  if (mags.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < mags.length; i++) total += mags[i];
  const threshold = total * fraction;
  let cumulative = 0;
  for (let i = 0; i < mags.length; i++) {
    cumulative += mags[i];
    if (cumulative >= threshold) {
      return (i * SAMPLE_RATE) / (mags.length * 2);
    }
  }
  return SAMPLE_RATE / 2;
}

/**
 * Compute magnitude spectrum via 1024-point DFT centered on the slice.
 * Returns the first N/2 bins (Nyquist), Hann-windowed.
 *
 * We use a direct O(N²) DFT here rather than a true FFT because:
 *   - N = 1024 → 1M ops per word, well under 1 ms
 *   - We extract features once per word, not once per frame
 *   - Avoids pulling in a 5-10 KB FFT library
 * Total cost: ~1-2 ms per word.
 */
function fftMagnitudes(samples: Float32Array): Float32Array {
  const N = 1024;
  // Take the middle N samples (or pad with zeros if shorter)
  const windowed = new Float32Array(N);
  const sourceStart = Math.max(0, Math.floor((samples.length - N) / 2));
  const sourceEnd = Math.min(samples.length, sourceStart + N);
  for (let i = sourceStart, j = 0; i < sourceEnd && j < N; i++, j++) {
    // Hann window
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * j) / (N - 1)));
    windowed[j] = samples[i] * w;
  }

  // Naive DFT — only the first N/2 bins matter (real input → symmetric)
  const half = N / 2;
  const mags = new Float32Array(half);
  const twoPiOverN = (2 * Math.PI) / N;
  for (let k = 0; k < half; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = twoPiOverN * k * n;
      re += windowed[n] * Math.cos(angle);
      im -= windowed[n] * Math.sin(angle);
    }
    mags[k] = Math.sqrt(re * re + im * im);
  }
  return mags;
}

/* ─── Zero-crossing rate ─────────────────────────────────────────── */

function zeroCrossingRate(samples: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0) !== (samples[i] >= 0)) crossings++;
  }
  return crossings / samples.length;
}
