/**
 * Speech engine: on-device Whisper (WASM/WebGPU) only.
 * The model (~75 MB + ~6 MB speaker model) downloads once and is cached;
 * audio is never sent anywhere. The browser Web Speech API is not used.
 */

/** Dictation is always on-device. The browser Web Speech API (which sends
 *  audio to Google on Chrome/Android) is intentionally never used. */
export type SpeechTier = "whisper";

export function detectSpeechTier(): SpeechTier {
  return "whisper";
}

/**
 * Human-readable description of the active speech tier.
 */
export function describeTier(_tier: SpeechTier = "whisper"): string {
  return "On-device Whisper AI (private)";
}
